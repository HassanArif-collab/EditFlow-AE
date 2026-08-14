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
const OUT_DIR = path.resolve("qa/browser_downloads");

function parseArgs(argv) {
  const args = { count: 1, promptFragment: "" };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--count") args.count = Number(argv[++i] || "1");
    else if (argv[i] === "--prompt-fragment") args.promptFragment = argv[++i] || "";
  }
  args.count = Number.isFinite(args.count) && args.count > 0 ? Math.min(args.count, 8) : 1;
  return args;
}

async function pickDreaminaPage(browser) {
  const pages = browser.contexts().flatMap((context) => context.pages());
  const dreaminaPages = pages.filter((page) => /dreamina\.capcut\.com/i.test(page.url()));
  const generatePage = dreaminaPages.find((page) => /\/ai-tool\/generate/i.test(page.url()));
  if (generatePage) return generatePage;
  if (dreaminaPages.length > 0) return dreaminaPages[dreaminaPages.length - 1];
  const context = browser.contexts()[0] || (await browser.newContext());
  const page = await context.newPage();
  await page.goto("https://dreamina.capcut.com/ai-tool/home", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(5000);
  return page;
}

async function collectCandidates(page, promptFragment) {
  return page.evaluate((promptFragment) => {
    const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const prompt = clean(promptFragment).toLowerCase();
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return (
        rect.width > 80 &&
        rect.height > 80 &&
        rect.bottom > 0 &&
        rect.top < innerHeight &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    };
    const surroundingText = (el) => {
      let node = el;
      for (let i = 0; i < 5 && node; i += 1) {
        const text = clean(node.innerText || node.textContent);
        if (text.length > 30) return text.slice(0, 500);
        node = node.parentElement;
      }
      return "";
    };
    const images = [];
    for (const img of document.querySelectorAll("img")) {
      if (!visible(img)) continue;
      const rect = img.getBoundingClientRect();
      const src = img.currentSrc || img.src || "";
      if (!src || /^data:image\/svg/i.test(src)) continue;
      if (!/dreamina-sign/i.test(src)) continue;
      const contextText = surroundingText(img);
      if (prompt && !contextText.toLowerCase().includes(prompt)) continue;
      images.push({
        src,
        alt: clean(img.alt).slice(0, 120),
        contextText,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        rect: {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        },
      });
    }
    images.sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
    return images;
  }, promptFragment);
}

async function readImageBytes(page, src) {
  const direct = await fetch(src, { headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => null);
  if (direct?.ok) {
    return {
      mime: direct.headers.get("content-type") || "image/png",
      buffer: Buffer.from(await direct.arrayBuffer()),
    };
  }

  const response = await page.context().request.get(src, { timeout: 30000 }).catch(() => null);
  if (response && response.ok()) {
    return {
      mime: response.headers()["content-type"] || "image/png",
      buffer: await response.body(),
    };
  }
  throw new Error("IMAGE_DOWNLOAD_FAILED");
}

function extensionFor(mime) {
  if (/jpe?g/i.test(mime)) return ".jpg";
  if (/webp/i.test(mime)) return ".webp";
  return ".png";
}

async function main() {
  const args = parseArgs(process.argv);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
  const page = await pickDreaminaPage(browser);

  const candidates = await collectCandidates(page, args.promptFragment);
  const saved = [];
  for (const candidate of candidates.slice(0, args.count)) {
    const image = await readImageBytes(page, candidate.src);
    const filePath = path.join(OUT_DIR, `dreamina_latest_${saved.length + 1}${extensionFor(image.mime)}`);
    fs.writeFileSync(filePath, image.buffer);
    saved.push({
      filePath,
      mime: image.mime,
      rect: candidate.rect,
      naturalWidth: candidate.naturalWidth,
      naturalHeight: candidate.naturalHeight,
    });
  }

  const out = {
    status: saved.length ? "DREAMINA_DOWNLOAD_OK" : "NO_VISIBLE_DREAMINA_IMAGES",
    url: page.url(),
    candidates: candidates.length,
    saved,
    security: {
      cookiesExported: false,
      storageExported: false,
      accountDataExported: false,
    },
  };
  const jsonPath = path.join(OUT_DIR, "dreamina_latest_download.json");
  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2), "utf8");
  console.log(JSON.stringify({ ...out, jsonPath }, null, 2));
}

main()
  .then(() => setTimeout(() => process.exit(0), 25))
  .catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
