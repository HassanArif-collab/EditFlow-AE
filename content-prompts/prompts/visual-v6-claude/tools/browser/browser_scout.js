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

const PRODUCT_DEFAULTS = {
  dreamina: {
    url: "https://dreamina.capcut.com/ai-tool/home",
    keywords:
      "ai agent|ai image|ai video|image|video|asset|canvas|gpt image|seedream|seedance|multiframe|single-frame|aspect|16:9|9:16|1:1|generate|create|download|credits?",
  },
  flow: {
    url: "https://labs.google/fx/tools/flow",
    keywords:
      "new project|flow|model|video|image|frames?|ingredients?|references?|veo|omni|flash|nano|banana|aspect|16:9|9:16|1:1|duration|4s|6s|8s|10s|generate|send|create|start frame|end frame|add|credits?",
  },
};

function parseArgs(argv) {
  const product = argv[2] || "flow";
  const out = {
    product,
    url: PRODUCT_DEFAULTS[product]?.url,
    outDir: "qa/browser_ui_maps",
    keepOpen: false,
    userDataDir: "",
    channel: "msedge",
  };

  for (let i = 3; i < argv.length; i += 1) {
    if (argv[i] === "--url") out.url = argv[++i];
    else if (argv[i] === "--out") out.outDir = argv[++i];
    else if (argv[i] === "--keep-open") out.keepOpen = true;
    else if (argv[i] === "--user-data-dir") out.userDataDir = argv[++i];
    else if (argv[i] === "--channel") out.channel = argv[++i];
  }

  if (!PRODUCT_DEFAULTS[product] && !out.url) {
    throw new Error(`Unknown product "${product}". Pass --url for custom scouts.`);
  }
  return out;
}

async function connect() {
  const endpoint = process.env.CDP_ENDPOINT || "http://127.0.0.1:9222";
  return chromium.connectOverCDP(endpoint);
}

async function createBrowserSurface(args) {
  if (!args.userDataDir) {
    const browser = await connect();
    const context = browser.contexts()[0] || (await browser.newContext());
    return {
      browser,
      context,
      mode: "cdp",
      async cleanup(page) {
        if (!args.keepOpen) await page.close().catch(() => {});
        // Shared CDP Edge belongs to the user. Never close it from a scout.
      },
    };
  }

  const userDataDir = path.resolve(args.userDataDir);
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: args.channel,
    headless: false,
    viewport: { width: 1366, height: 820 },
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-crash-restore-bubble",
    ],
  });

  return {
    browser: null,
    context,
    mode: "persistent",
    async cleanup(page) {
      if (!args.keepOpen) await context.close().catch(() => {});
    },
  };
}

async function extractMap(page, product) {
  const keywordSource =
    PRODUCT_DEFAULTS[product]?.keywords || "generate|create|download|model|image|video|prompt|aspect";

  return page.evaluate((keywordSource) => {
    const keywords = new RegExp(keywordSource, "i");
    const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return (
        r.width > 0 &&
        r.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none"
      );
    };
    const controlSelector = [
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

    const raw = [];
    for (const el of document.querySelectorAll(controlSelector)) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      const text = clean(
        el.innerText ||
          el.getAttribute("aria-label") ||
          el.getAttribute("placeholder") ||
          el.getAttribute("title") ||
          el.value,
      );
      raw.push({
        kind: "control",
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute("role") || "",
        text: text.slice(0, 100),
        aria: clean(el.getAttribute("aria-label")).slice(0, 100),
        placeholder: clean(el.getAttribute("placeholder")).slice(0, 100),
        disabled: Boolean(el.disabled || el.getAttribute("aria-disabled") === "true"),
        rect: {
          x: Math.round(r.left),
          y: Math.round(r.top),
          w: Math.round(r.width),
          h: Math.round(r.height),
        },
      });
    }

    for (const el of document.querySelectorAll("div,span,p,label")) {
      if (!visible(el)) continue;
      if (el.children.length > 2) continue;
      const text = clean(el.innerText || el.textContent);
      if (!text || text.length > 100 || !keywords.test(text)) continue;
      const r = el.getBoundingClientRect();
      raw.push({
        kind: "text_chip",
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute("role") || "",
        text,
        aria: clean(el.getAttribute("aria-label")).slice(0, 100),
        placeholder: "",
        disabled: false,
        rect: {
          x: Math.round(r.left),
          y: Math.round(r.top),
          w: Math.round(r.width),
          h: Math.round(r.height),
        },
      });
    }

    const seen = new Set();
    const controls = [];
    for (const item of raw) {
      const key = `${item.kind}|${item.tag}|${item.text}|${item.aria}|${item.rect.x}|${item.rect.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      controls.push(item);
      if (controls.length >= 240) break;
    }

    const bodyText = clean(document.body.innerText).slice(0, 1000);
    return {
      title: document.title,
      url: location.href,
      viewport: { width: innerWidth, height: innerHeight },
      visibleTextSample: bodyText,
      controls,
    };
  }, keywordSource);
}

async function main() {
  const args = parseArgs(process.argv);
  const surface = await createBrowserSurface(args);
  const page = await surface.context.newPage();
  const outDir = path.resolve(args.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  try {
    await page.goto(args.url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(6000);
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(1000);

    const map = await extractMap(page, args.product);
    map.product = args.product;
    map.scoutedAt = new Date().toISOString();
    map.source = "browser_scout";
    map.mode = surface.mode;
    map.security = {
      cookiesExported: false,
      storageExported: false,
      accountDataExported: false,
    };

    const jsonPath = path.join(outDir, `${args.product}.json`);
    const pngPath = path.join(outDir, `${args.product}.png`);
    fs.writeFileSync(jsonPath, JSON.stringify(map, null, 2), "utf8");
    await page.screenshot({ path: pngPath, fullPage: false }).catch(() => {});

    console.log(
      JSON.stringify(
        {
          status: "SCOUT_OK",
          product: args.product,
          mode: surface.mode,
          url: map.url,
          controls: map.controls.length,
          jsonPath,
          screenshotPath: pngPath,
        },
        null,
        2,
      ),
    );
  } finally {
    await surface.cleanup(page);
  }
}

main()
  .then(() => setTimeout(() => process.exit(0), 25))
  .catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
