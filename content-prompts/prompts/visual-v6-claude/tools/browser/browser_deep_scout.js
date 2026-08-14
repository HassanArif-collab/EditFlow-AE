#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

function loadPlaywright() {
  try {
    return require("playwright");
  } catch (err) {
    return require("C:/Users/hp739/.agents/skills/playwright/node_modules/playwright");
  }
}

const { chromium } = loadPlaywright();
const OUT_DIR = path.resolve("qa/browser_ui_maps");
const CDP_ENDPOINT = process.env.CDP_ENDPOINT || "http://127.0.0.1:9222";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect() {
  return chromium.connectOverCDP(CDP_ENDPOINT);
}

async function waitForBodyText(page, pattern, timeout = 20000) {
  const source = pattern.source;
  const flags = pattern.flags.includes("i") ? pattern.flags : `${pattern.flags}i`;
  return page
    .waitForFunction(
      ({ source, flags }) => {
        const text = String(document.body?.innerText || "");
        return new RegExp(source, flags).test(text);
      },
      { source, flags },
      { timeout },
    )
    .then(() => true)
    .catch(() => false);
}

async function snapshot(page, name, notes = {}) {
  const data = await page.evaluate(() => {
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
      .slice(0, 260)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          text: clean(
            el.innerText ||
              el.getAttribute("aria-label") ||
              el.getAttribute("placeholder") ||
              el.getAttribute("title") ||
              el.value,
          ).slice(0, 120),
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute("role") || "",
          disabled: Boolean(el.disabled || el.getAttribute("aria-disabled") === "true"),
          rect: {
            x: Math.round(r.left),
            y: Math.round(r.top),
            w: Math.round(r.width),
            h: Math.round(r.height),
          },
        };
      });
    return {
      name: "",
      title: document.title,
      url: location.href,
      viewport: { width: innerWidth, height: innerHeight },
      visibleTextSample: clean(document.body.innerText).slice(0, 1600),
      controls,
      security: {
        cookiesExported: false,
        storageExported: false,
        accountDataExported: false,
      },
    };
  });
  data.name = name;
  data.notes = notes;
  const screenshotPath = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});
  data.screenshotPath = screenshotPath;
  return data;
}

async function clickSemantic(page, pattern, options = {}) {
  const source = pattern instanceof RegExp ? pattern.source : String(pattern);
  const flags = pattern instanceof RegExp && pattern.flags.includes("i") ? pattern.flags : "i";
  const findTarget = () =>
    page.evaluate(
      ({ source, flags, prefer = {}, label }) => {
      const match = new RegExp(source, flags);
      const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
      const visibleEnough = (el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          style.pointerEvents !== "none"
        );
      };
      const selector = [
        "button",
        "a",
        "[role='button']",
        "[role='tab']",
        "[role='menuitem']",
        "[tabindex]",
        "[aria-label]",
        "div",
        "span",
      ].join(",");
      const candidates = [];
      for (const el of document.querySelectorAll(selector)) {
        if (!visibleEnough(el)) continue;
        const text = clean(
          el.innerText ||
            el.textContent ||
            el.getAttribute("aria-label") ||
            el.getAttribute("title") ||
            el.getAttribute("placeholder"),
        );
        if (!text || text.length > 180 || !match.test(text)) continue;
        const rect = el.getBoundingClientRect();
        const area = rect.width * rect.height;
        const tag = el.tagName.toLowerCase();
        const role = el.getAttribute("role") || "";
        const actionable =
          tag === "button" ||
          tag === "a" ||
          role === "button" ||
          role === "tab" ||
          role === "menuitem" ||
          el.getAttribute("tabindex") != null;
        let score = area;
        if (actionable) score += 5000000;
        if ((tag === "div" || tag === "span") && area > 200000) score -= 3000000;
        if (prefer.minY != null && rect.top < prefer.minY) score -= 100000;
        if (prefer.maxY != null && rect.top > prefer.maxY) score -= 100000;
        if (prefer.minX != null && rect.left < prefer.minX) score -= 100000;
        if (prefer.maxX != null && rect.left > prefer.maxX) score -= 100000;
        if (prefer.maxArea != null && area > prefer.maxArea) score -= 50000;
        if (prefer.minArea != null && area < prefer.minArea) score -= 50000;
        if (label && text.toLowerCase().includes(String(label).toLowerCase())) score += 5000;
        candidates.push({ el, text, score, area });
      }
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];
      if (!best) return null;
      best.el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      const rect = best.el.getBoundingClientRect();
      return {
        text: best.text.slice(0, 140),
        score: Math.round(best.score),
        tag: best.el.tagName.toLowerCase(),
        role: best.el.getAttribute("role") || "",
        rect: {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        },
        point: {
          x: Math.round(
            prefer.pointX === "right"
              ? rect.left + rect.width - Math.min(18, rect.width / 4)
              : rect.left + rect.width / 2,
          ),
          y: Math.round(rect.top + rect.height / 2),
        },
      };
    },
    {
      source,
      flags,
      prefer: options.prefer || {},
      label: options.label || "",
    },
  );
  const deadline = Date.now() + (options.timeout || 0);
  let target = await findTarget();
  while (!target && Date.now() < deadline) {
    await sleep(500);
    target = await findTarget();
  }
  if (!target) {
    return { clicked: false, reason: "NO_VISIBLE_MATCH", pattern: source };
  }
  await page.mouse.click(target.point.x, target.point.y).catch(() => {});
  if (options.doubleClick) {
    await sleep(250);
    await page.mouse.click(target.point.x, target.point.y).catch(() => {});
  }
  await sleep(options.wait || 2500);
  if (options.escape !== false) {
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(500);
  }
  return { clicked: true, target };
}

async function selectDreaminaMode(page, mode) {
  const opener = await clickSemantic(page, /^(AI Agent|AI Image|AI Video)\b/i, {
    wait: 900,
    timeout: 8000,
    escape: false,
    label: "AI",
    prefer: {
      minX: 350,
      maxX: 650,
      minY: 240,
      maxY: 380,
      minArea: 1000,
      maxArea: 30000,
      pointX: "right",
    },
  });
  const option = await clickSemantic(page, new RegExp(`^${mode}\\b`, "i"), {
    wait: 2500,
    timeout: 8000,
    escape: true,
    label: mode,
    prefer: {
      minX: 350,
      maxX: 700,
      minY: 280,
      maxY: 680,
      minArea: 100,
      maxArea: 50000,
    },
  });
  return { opener, option };
}

async function dreamina(page) {
  const shots = [];
  await page.goto("https://dreamina.capcut.com/ai-tool/home", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await waitForBodyText(page, /Start Creating|AI Image|AI Video|Seedance|Seedream/, 25000);
  await sleep(2000);
  await page.keyboard.press("Escape").catch(() => {});
  shots.push(await snapshot(page, "dreamina_deep_home", { step: "home" }));

  const modeClick = await clickSemantic(page, /^AI Agent\b/i, {
    wait: 1200,
    escape: false,
    label: "AI Agent",
    prefer: { minX: 350, maxX: 650, minY: 240, maxY: 380, minArea: 100, maxArea: 30000, pointX: "right" },
  });
  shots.push(
    await snapshot(page, "dreamina_deep_mode_dropdown", {
      step: "opened AI Agent mode/dropdown area",
      click: modeClick,
    }),
  );
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(700);

  await page.goto("https://dreamina.capcut.com/ai-tool/home", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await waitForBodyText(page, /AI Agent|Start Creating|AI Image|AI Video/, 25000);
  const imageMode = await selectDreaminaMode(page, "AI Image");
  const imageReady = await waitForBodyText(page, /AI Image|Image 4\.1|Seedream|Describe your image|2\/image/, 12000);
  await sleep(2500);
  shots.push(
    await snapshot(page, "dreamina_deep_ai_image", {
      step: "AI Image mode selected",
      ready: imageReady,
      mode: imageMode,
    }),
  );

  await page.goto("https://dreamina.capcut.com/ai-tool/home", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await waitForBodyText(page, /AI Agent|Start Creating|AI Image|AI Video/, 25000);
  const videoMode = await selectDreaminaMode(page, "AI Video");
  const videoReady = await waitForBodyText(page, /AI Video|Video 4\.1|Seedance|Start with an idea|Describe your video|video/i, 12000);
  await sleep(2500);
  shots.push(
    await snapshot(page, "dreamina_deep_ai_video", {
      step: "AI Video mode selected",
      ready: videoReady,
      mode: videoMode,
    }),
  );

  return shots;
}

async function dismissOnboarding(page) {
  const dismissed = await clickSemantic(page, /Get started|Got it|Continue/i, {
    wait: 3500,
    timeout: 4000,
    escape: false,
    label: "Get started",
    prefer: { minArea: 1000, maxArea: 80000 },
  });
  if (!dismissed.clicked) {
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(800);
  }
  return dismissed;
}

async function flow(page) {
  const shots = [];
  await page.goto("https://labs.google/fx/tools/flow", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await waitForBodyText(page, /New project|Try Omni|Gemini Omni/, 30000);
  await sleep(2500);
  await page.keyboard.press("Escape").catch(() => {});
  shots.push(await snapshot(page, "flow_deep_dashboard", { step: "dashboard" }));

  const newProjectClicked = await clickSemantic(page, /New project/i, {
    wait: 9000,
    timeout: 20000,
    escape: false,
    label: "New project",
    doubleClick: true,
    prefer: { minArea: 3000, maxArea: 80000 },
  });
  await waitForBodyText(page, /prompt|create|video|frames|ingredients|veo|omni|model|aspect|duration/i, 20000);
  shots.push(await snapshot(page, "flow_deep_new_project", { step: "after New project", click: newProjectClicked }));

  const onboarding = await dismissOnboarding(page);
  await waitForBodyText(page, /What do you want to create|Start creating with a sample prompt|Agent|Video/i, 25000);
  shots.push(await snapshot(page, "flow_deep_project_ready", { step: "project ready", onboarding }));

  const settingsClicked = await clickSemantic(page, /Video\s*4s|Video/i, {
    wait: 2200,
    timeout: 6000,
    escape: false,
    label: "Video",
    prefer: { minY: 780, minArea: 500, maxArea: 80000 },
  });
  shots.push(await snapshot(page, "flow_deep_video_settings", { step: "video settings chip", click: settingsClicked }));
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(600);

  return shots;
}

async function main() {
  const product = process.argv[2] || "flow";
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await connect();
  const context = browser.contexts()[0] || (await browser.newContext());
  const page = await context.newPage();

  try {
    const shots = product === "dreamina" ? await dreamina(page) : await flow(page);
    const output = {
      product,
      scoutedAt: new Date().toISOString(),
      mode: "cdp",
      cdpEndpoint: CDP_ENDPOINT,
      shots,
    };
    const jsonPath = path.join(OUT_DIR, `${product}_deep.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2), "utf8");
    console.log(JSON.stringify({ status: "DEEP_SCOUT_OK", product, shots: shots.length, jsonPath }, null, 2));
  } finally {
    await page.close().catch(() => {});
    // Shared CDP Edge belongs to the user. Never close it from a scout.
  }
}

main()
  .then(() => setTimeout(() => process.exit(0), 25))
  .catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
