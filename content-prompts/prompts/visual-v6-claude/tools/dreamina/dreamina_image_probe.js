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
const CDP_ENDPOINT = process.env.CDP_ENDPOINT || "http://127.0.0.1:9222";
const OUT_DIR = path.resolve("qa/browser_ui_maps");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseArgs(argv) {
  const args = {
    generate: false,
    agent: false,
    allowGptBatch: false,
    closeTab: false,
    prompt:
      "A clean editorial 16:9 infographic background: a glass desk with a blank white data card, subtle grid lines, soft daylight, premium documentary lighting, no readable text, no logos, no watermark.",
  };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--generate") args.generate = true;
    else if (argv[i] === "--agent") args.agent = true;
    else if (argv[i] === "--allow-gpt-batch") args.allowGptBatch = true;
    else if (argv[i] === "--close-tab") args.closeTab = true;
    else if (argv[i] === "--prompt") args.prompt = argv[++i] || args.prompt;
  }
  return args;
}

function buildAgentPrompt(prompt) {
  return [
    "Use the best available Dreamina AI Agent image model.",
    "Create one concise visual direction for the requested image.",
    "Use a 16:9 horizontal composition.",
    "Keep the image text-free: no readable words, no logos, no watermark.",
    `Image prompt: ${prompt}`,
  ].join(" ");
}

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
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const selector = [
      "button",
      "a",
      "input",
      "textarea",
      "[contenteditable='true']",
      "[role='button']",
      "[role='tab']",
      "[role='menuitem']",
      "[aria-label]",
    ].join(",");
    const controls = [...document.querySelectorAll(selector)]
      .filter(visible)
      .slice(0, 220)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          text: clean(
            el.innerText ||
              el.getAttribute("aria-label") ||
              el.getAttribute("placeholder") ||
              el.getAttribute("title") ||
              el.value,
          ).slice(0, 140),
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute("role") || "",
          rect: {
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          },
        };
      });
    const text = clean(document.body.innerText);
    return {
      title: document.title,
      url: location.href,
      viewport: { width: innerWidth, height: innerHeight },
      visibleTextSample: text.slice(0, 1800),
      controls,
      detected: {
        mode: /AI Image/i.test(text) ? "AI Image visible" : /AI Agent/i.test(text) ? "AI Agent visible" : "unknown",
        creditBadge: (text.match(/\b\d+\s*(?:credits?|\/image|\/sec)\b/i) || [""])[0],
        costPhrase: (text.match(/(?:\d+\s*\/image|consumes\s+\d+\s+credits?|will use\s+\d+\s+credits?)/i) || [""])[0],
      },
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

async function clickBest(page, pattern, options = {}) {
  const source = pattern instanceof RegExp ? pattern.source : String(pattern);
  const flags = pattern instanceof RegExp && pattern.flags.includes("i") ? pattern.flags : "i";
  const deadline = Date.now() + (options.timeout || 12000);
  let target = null;

  while (!target && Date.now() < deadline) {
    target = await page.evaluate(
      ({ source, flags, prefer = {}, label = "" }) => {
        const match = new RegExp(source, flags);
        const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
        const visible = (el) => {
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
          if (!visible(el)) continue;
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
          if (prefer.strict) {
            if (prefer.minX != null && rect.left < prefer.minX) continue;
            if (prefer.maxX != null && rect.left > prefer.maxX) continue;
            if (prefer.minY != null && rect.top < prefer.minY) continue;
            if (prefer.maxY != null && rect.top > prefer.maxY) continue;
            if (prefer.minArea != null && area < prefer.minArea) continue;
            if (prefer.maxArea != null && area > prefer.maxArea) continue;
          }
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
          if (prefer.minX != null && rect.left < prefer.minX) score -= 100000;
          if (prefer.maxX != null && rect.left > prefer.maxX) score -= 100000;
          if (prefer.minY != null && rect.top < prefer.minY) score -= 100000;
          if (prefer.maxY != null && rect.top > prefer.maxY) score -= 100000;
          if (prefer.minArea != null && area < prefer.minArea) score -= 50000;
          if (prefer.maxArea != null && area > prefer.maxArea) score -= 50000;
          if (label && text.toLowerCase().includes(label.toLowerCase())) score += 5000;
          candidates.push({ el, text, tag, role, score, area });
        }
        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[0];
        if (!best) return null;
        best.el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
        const rect = best.el.getBoundingClientRect();
        return {
          text: best.text.slice(0, 140),
          tag: best.tag,
          role: best.role,
          score: Math.round(best.score),
          rect: {
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          },
          point: {
            x: Math.round(rect.left + rect.width / 2),
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
    if (!target) await sleep(500);
  }

  if (!target) return { clicked: false, reason: "NO_VISIBLE_MATCH", pattern: source };
  await page.mouse.click(target.point.x, target.point.y).catch(() => {});
  await sleep(options.wait || 2500);
  return { clicked: true, target };
}

async function fillPrompt(page, prompt) {
  const promptTarget = await page.evaluate(() => {
    const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const candidates = [];
    const selector = ["textarea", "[contenteditable='true']", "input", "[role='textbox']"].join(",");
    for (const el of document.querySelectorAll(selector)) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      if (rect.width <= 0 || rect.height <= 0 || style.display === "none" || style.visibility === "hidden") continue;
      const label = clean(el.getAttribute("placeholder") || el.getAttribute("aria-label") || el.innerText || el.value);
      candidates.push({
        label,
        rect: {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        },
      });
    }
    candidates.sort((a, b) => b.rect.w * b.rect.h - a.rect.w * a.rect.h);
    const best = candidates[0];
    if (!best) return null;
    return {
      label: best.label,
      point: {
        x: Math.round(best.rect.x + Math.min(90, best.rect.w / 4)),
        y: Math.round(best.rect.y + best.rect.h / 2),
      },
      rect: best.rect,
    };
  });
  if (!promptTarget) return { filled: false, reason: "NO_PROMPT_BOX" };
  await page.mouse.click(promptTarget.point.x, promptTarget.point.y);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
  await page.keyboard.type(prompt, { delay: 1 });
  await sleep(800);
  return { filled: true, target: promptTarget };
}

async function clickBottomSubmit(page) {
  const target = await page.evaluate(() => {
    const visible = (el) => {
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
    const candidates = [];
    for (const el of document.querySelectorAll("button,[role='button']")) {
      if (!visible(el)) continue;
      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (rect.left < 1220 || rect.left > 1430) continue;
      if (rect.top < 820 || rect.top > 990) continue;
      if (area < 500 || area > 3500) continue;
      candidates.push({
        text: String(el.innerText || el.getAttribute("aria-label") || "").trim(),
        rect: {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        },
      });
    }
    candidates.sort((a, b) => b.rect.x - a.rect.x);
    const best = candidates[0];
    if (!best) return null;
    return {
      ...best,
      point: {
        x: Math.round(best.rect.x + best.rect.w / 2),
        y: Math.round(best.rect.y + best.rect.h / 2),
      },
    };
  });
  if (!target) return { clicked: false, reason: "NO_BOTTOM_SUBMIT" };
  await page.mouse.click(target.point.x, target.point.y).catch(() => {});
  await sleep(45000);
  return { clicked: true, target };
}

async function getActiveImageCost(page) {
  return page.evaluate(() => {
    const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const candidates = [];
    for (const el of document.querySelectorAll("button,div,span")) {
      if (!visible(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.left < 1120 || rect.left > 1400 || rect.top < 820 || rect.top > 980) continue;
      const text = clean(el.innerText || el.textContent);
      if (!/\/image|credits?/i.test(text)) continue;
      candidates.push({
        text,
        rect: {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        },
      });
    }
    candidates.sort((a, b) => a.rect.w * a.rect.h - b.rect.w * b.rect.h);
    return candidates[0]?.text || "";
  });
}

async function hasVisibleText(page, pattern) {
  const source = pattern.source;
  const flags = pattern.flags.includes("i") ? pattern.flags : `${pattern.flags}i`;
  return page.evaluate(
    ({ source, flags }) => new RegExp(source, flags).test(String(document.body?.innerText || "")),
    { source, flags },
  );
}

async function selectGptImage2(page) {
  const visible = await hasVisibleText(page, /GPT Image 2|ChatGPT Image 2/i);
  if (!visible) {
    return { selected: false, reason: "GPT_IMAGE_2_NOT_VISIBLE_IN_MENU" };
  }
  const click = await clickBest(page, /GPT Image 2|ChatGPT Image 2/i, {
    wait: 1800,
    label: "GPT Image 2",
    prefer: { minX: 520, maxX: 1050, minY: 360, maxY: 920, minArea: 100, maxArea: 100000 },
  });
  return { selected: click.clicked, click };
}

async function readPromptChips(page) {
  return page.evaluate(() => {
    const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    return [...document.querySelectorAll("button,[role='button'],div,span")]
      .filter(visible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          text: clean(el.innerText || el.textContent || el.getAttribute("aria-label")),
          rect: { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) },
        };
      })
      .filter((item) => item.rect.y > innerHeight - 220)
      .map((item) => item.text)
      .filter((text) => /AI Image|GPT Image 2|ChatGPT Image 2|Image \d|16:9|1:1|2:3|9:16|2\/image/i.test(text));
  });
}

async function main() {
  const args = parseArgs(process.argv);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await connect();
  const context = browser.contexts()[0] || (await browser.newContext());
  const page = await context.newPage();
  const shots = [];

  try {
    await page.goto("https://dreamina.capcut.com/ai-tool/home", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await waitForBodyText(page, /AI Image|Seedream|Start Creating/, 30000);
    await sleep(2500);
    shots.push(await snapshot(page, "dreamina_image_probe_home", { step: "home" }));

    if (args.agent) {
      const agentReady = await waitForBodyText(page, /AI Agent|Start Creating|Ask me|Describe/i, 12000);
      const agentPrompt = buildAgentPrompt(args.prompt);
      const filled = await fillPrompt(page, agentPrompt);
      shots.push(
        await snapshot(page, "dreamina_agent_probe_prompt_filled", {
          step: "AI Agent prompt filled",
          agentReady,
          filled,
          requestedModel: "AI Agent model, not GPT Image 2",
          note: "Dreamina AI Agent does not expose GPT Image 2.",
        }),
      );

      let generation = { requested: args.generate, clicked: false };
      if (args.generate) {
        generation = {
          requested: true,
          clicked: false,
          reason: "AI_AGENT_NOT_GPT_IMAGE_2",
          nextStep: "Use the AI Image model menu, select GPT Image 2, and approve the 4-image batch cost.",
        };
        shots.push(
          await snapshot(page, "dreamina_agent_probe_blocked_for_gpt", {
            step: "AI Agent generation blocked for GPT Image 2 test",
            generation,
            requestedModel: "AI Agent model, not GPT Image 2",
          }),
        );
      }

      const output = {
        status: "DREAMINA_AGENT_PROBE_OK",
        mode: "cdp",
        scoutedAt: new Date().toISOString(),
        generated: generation,
        shots,
      };
      const jsonPath = path.join(OUT_DIR, "dreamina_agent_probe.json");
      fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2), "utf8");
      console.log(JSON.stringify({ status: output.status, generated: generation, shots: shots.length, jsonPath }, null, 2));
      return;
    }

    const cardClick = await clickBest(page, /AI Image.*Seedream|AI Image/i, {
      wait: 6000,
      label: "AI Image",
      prefer: { minX: 900, maxX: 1500, minY: 330, maxY: 620, minArea: 4000, maxArea: 120000 },
    });
    const imageReady = await waitForBodyText(page, /Describe your image|Image 4\.1|2\s*\/image/i, 24000);
    shots.push(await snapshot(page, "dreamina_image_probe_after_click", { step: "after AI Image card click", cardClick, imageReady }));

    const modelClick = await clickBest(page, /Image\s*4\.1|Seedream|Image 5\.0|Image 4\./i, {
      wait: 1800,
      label: "Image",
      prefer: { strict: true, minX: 680, maxX: 880, minY: 820, maxY: 980, minArea: 500, maxArea: 50000 },
    });
    shots.push(await snapshot(page, "dreamina_image_probe_model_menu", { step: "non-GPT model menu attempt before aspect", modelClick }));
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(700);

    const aspectClick = await clickBest(page, /1:1|16:9|9:16|4:3|3:4/i, {
      wait: 1600,
      label: "aspect",
      prefer: { strict: true, minX: 800, maxX: 990, minY: 820, maxY: 980, minArea: 500, maxArea: 50000 },
    });
    const aspect16x9Click = await clickBest(page, /16:9/i, {
      wait: 1600,
      label: "16:9",
      prefer: { strict: true, minX: 900, maxX: 1000, minY: 620, maxY: 760, minArea: 100, maxArea: 10000 },
    });
    shots.push(
      await snapshot(page, "dreamina_image_probe_aspect_menu", {
        step: "aspect menu attempt",
        aspectClick,
        aspect16x9Click,
      }),
    );
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(700);

    const gptModelClick = await clickBest(page, /Image\s*4\.1|Seedream|Image 5\.0|Image 4\./i, {
      wait: 1800,
      label: "Image",
      prefer: { strict: true, minX: 680, maxX: 880, minY: 820, maxY: 980, minArea: 500, maxArea: 50000 },
    });
    const gptSelection = await selectGptImage2(page);
    const finalChips = await readPromptChips(page);
    shots.push(
      await snapshot(page, "dreamina_image_probe_gpt_after_aspect", {
        step: "GPT selected after 16:9 aspect",
        gptModelClick,
        gptSelection,
        finalChips,
      }),
    );
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(700);

    let generation = { requested: args.generate, clicked: false };
    if (args.generate) {
      const chips = await readPromptChips(page);
      const gptConfirmed = chips.some((chip) => /GPT Image 2|ChatGPT Image 2/i.test(chip));
      const aspectConfirmed = chips.some((chip) => /16:9/.test(chip));
      if (!gptConfirmed || !aspectConfirmed) {
        generation = {
          requested: true,
          clicked: false,
          reason: !gptConfirmed ? "GPT_IMAGE_2_NOT_CONFIRMED" : "ASPECT_16_9_NOT_CONFIRMED",
          chips,
          nextStep: "Select a non-GPT image model, set 16:9, then switch back to GPT Image 2 and verify both chips.",
        };
        shots.push(await snapshot(page, "dreamina_image_probe_blocked_non_gpt", { step: "generation blocked", generation }));
      } else if (!args.allowGptBatch) {
        generation = {
          requested: true,
          clicked: false,
          reason: "GPT_IMAGE_2_BATCH_REQUIRES_EXPLICIT_APPROVAL",
          nextStep: "Re-run with --generate --allow-gpt-batch only after approving the 4-image GPT Image 2 batch spend.",
        };
        shots.push(await snapshot(page, "dreamina_image_probe_blocked_batch_unapproved", { step: "batch generation blocked", generation }));
      } else {
        const filled = await fillPrompt(page, args.prompt);
        shots.push(await snapshot(page, "dreamina_image_probe_prompt_filled", { step: "prompt filled", filled }));
        const costText = await getActiveImageCost(page);
        const generateClick = await clickBottomSubmit(page);
        const creditBlocked = await hasVisibleText(page, /not enough credits|upgrade your subscription|get more credits/i);
        generation = {
          requested: true,
          clicked: generateClick.clicked,
          costText,
          generateClick,
          status: creditBlocked ? "CREDIT_BLOCKED" : "SUBMITTED_OR_COMPLETED",
        };
        shots.push(await snapshot(page, "dreamina_image_probe_after_generate", { step: "after generate attempt", generation }));
      }
    }

    const output = {
      status: "DREAMINA_IMAGE_PROBE_OK",
      mode: "cdp",
      scoutedAt: new Date().toISOString(),
      generated: generation,
      shots,
    };
    const jsonPath = path.join(OUT_DIR, "dreamina_image_probe.json");
    fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2), "utf8");
    console.log(JSON.stringify({ status: output.status, generated: generation, shots: shots.length, jsonPath }, null, 2));
  } finally {
    if (args.closeTab) await page.close().catch(() => {});
    // Do not call browser.close() on a shared Edge CDP connection. It can close
    // the user's logged-in Edge session instead of merely detaching the script.
  }
}

main()
  .then(() => setTimeout(() => process.exit(0), 25))
  .catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
