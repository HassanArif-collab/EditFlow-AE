#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { FLOW_DURATION_CREDITS } = require("../routing/visual_tool_router");

function loadPlaywright() {
  try {
    return require("playwright");
  } catch (err) {
    return require("C:/Users/hp739/.agents/skills/playwright/node_modules/playwright");
  }
}

const { chromium } = loadPlaywright();

const CAPABILITIES = {
  "dreamina.still_image": {
    product: "dreamina",
    url: "https://dreamina.capcut.com/ai-tool/home",
    required: [/ai image|ai agent/i, /gpt image 2|chatgpt image 2|model/i, /16:9|aspect|ratio/i, /generate|create|send/i],
    spendsCredit: true,
    modelPolicy: "Dreamina still images require GPT Image 2 / ChatGPT Image 2 in the AI Image model menu. AI Agent is not a GPT Image 2 route. GPT Image 2 generates 4 images per run; stop on low confidence.",
  },
  "dreamina.multiframes": {
    product: "dreamina",
    url: "https://dreamina.capcut.com/ai-tool/home",
    required: [/ai video|video/i, /seedance|multiframe|single-frame/i, /generate|create/i],
    spendsCredit: true,
  },
  "flow.frames_to_video": {
    product: "flow",
    url: "https://labs.google/fx/tools/flow",
    required: [/video/i, /frames?|start frame|end frame/i, /veo|model/i, /generate|send|create/i],
    spendsCredit: true,
    creditTable: Object.entries(FLOW_DURATION_CREDITS).map(([seconds, credits]) => `${seconds}s=${credits}`).join(", ") + " credits for start-only or start/end-frame video.",
  },
  "flow.ingredients_to_video": {
    product: "flow",
    url: "https://labs.google/fx/tools/flow",
    required: [/video/i, /ingredients?|references?/i, /veo|model/i, /generate|send|create/i],
    spendsCredit: true,
    creditTable: Object.entries(FLOW_DURATION_CREDITS).map(([seconds, credits]) => `${seconds}s=${credits}`).join(", ") + " credits for ingredients video.",
  },
  "flow.omni_edit": {
    product: "flow",
    url: "https://labs.google/fx/tools/flow",
    required: [/omni|flash/i, /edit|video/i, /generate|send|create/i],
    spendsCredit: true,
  },
  "flow.image_model": {
    product: "flow",
    url: "https://labs.google/fx/tools/flow",
    required: [/image/i, /nano|banana/i, /generate|send|create/i],
    spendsCredit: true,
    modelPolicy: "Use Nano Banana 2 or Nano Banana Pro for Flow image creation; operator treats this lane as unlimited for planning.",
  },
  "browser.source_capture": {
    product: "browser",
    url: null,
    required: [],
    spendsCredit: false,
  },
};

function usage() {
  console.error("Usage: node tools/browser_task.js <task.json> [--scout-if-needed]");
  process.exit(2);
}

function loadTask(file) {
  if (!file) usage();
  const task = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!task.capability || !CAPABILITIES[task.capability]) {
    throw new Error(`Unknown capability: ${task.capability || "(missing)"}`);
  }
  return task;
}

async function connect() {
  const endpoint = process.env.CDP_ENDPOINT || "http://127.0.0.1:9222";
  return chromium.connectOverCDP(endpoint);
}

async function observe(page) {
  return page.evaluate(() => {
    const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return r.width > 0 && r.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const selector = [
      "button",
      "a",
      "input",
      "textarea",
      "select",
      "[contenteditable='true']",
      "[role='button']",
      "[role='tab']",
      "[role='menuitem']",
      "[aria-label]",
    ].join(",");
    const controls = [...document.querySelectorAll(selector)]
      .filter(visible)
      .slice(0, 200)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          text: clean(
            el.innerText ||
              el.getAttribute("aria-label") ||
              el.getAttribute("placeholder") ||
              el.value,
          ).slice(0, 100),
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute("role") || "",
          rect: {
            x: Math.round(r.left),
            y: Math.round(r.top),
            w: Math.round(r.width),
            h: Math.round(r.height),
          },
        };
      });
    return {
      title: document.title,
      url: location.href,
      controls,
      security: {
        cookiesExported: false,
        storageExported: false,
      },
    };
  });
}

function evaluateRequirements(capability, observed) {
  const text = observed.controls.map((c) => c.text).join("\n");
  const missing = capability.required
    .filter((pattern) => !pattern.test(text))
    .map((pattern) => pattern.toString());
  return {
    ok: missing.length === 0,
    missing,
  };
}

async function main() {
  const taskPath = process.argv[2];
  const task = loadTask(taskPath);
  const cap = CAPABILITIES[task.capability];
  const browser = await connect();
  const context = browser.contexts()[0] || (await browser.newContext());
  const page = await context.newPage();
  const targetUrl = task.url || cap.url;

  if (!targetUrl) {
    throw new Error("Task must provide url for browser.source_capture.");
  }

  const result = {
    taskPath: path.resolve(taskPath),
    capability: task.capability,
    status: "PENDING",
    allowCreditSpend: Boolean(task.allow_credit_spend),
    actionTaken: "observe_only",
    modelPolicy: cap.modelPolicy || "",
    creditTable: cap.creditTable || "",
  };

  try {
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(5000);
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(1000);

    const observed = await observe(page);
    const requirements = evaluateRequirements(cap, observed);

    result.url = observed.url;
    result.title = observed.title;
    result.visibleControls = observed.controls.length;
    result.requirements = requirements;

    if (!requirements.ok) {
      result.status = "LOW_CONFIDENCE_UI";
      result.nextStep = `Run tools/browser_deep_scout.js ${cap.product} or tools/browser_scout.js ${cap.product}, then update the UI map.`;
    } else if (cap.spendsCredit && !task.allow_credit_spend) {
      result.status = "CREDIT_SPEND_NOT_AUTHORIZED";
      result.nextStep = "Ready-state can be configured, but final Generate/Create is blocked.";
    } else {
      result.status = "READY_FOR_AUTHORIZED_EXECUTION";
      result.nextStep = "Implement capability-specific action steps before enabling generation.";
    }

    const outDir = path.resolve("qa/browser_ui_maps");
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, "last_browser_task_result.json");
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");
    result.resultPath = outPath;
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await page.close().catch(() => {});
    // Shared CDP Edge belongs to the user. Never close it from a task script.
  }
}

main()
  .then(() => setTimeout(() => process.exit(0), 25))
  .catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
