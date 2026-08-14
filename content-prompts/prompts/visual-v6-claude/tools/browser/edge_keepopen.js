#!/usr/bin/env node
"use strict";

const path = require("path");

function loadPlaywright() {
  try {
    return require("playwright");
  } catch (err) {
    return require("C:/Users/hp739/.agents/skills/playwright/node_modules/playwright");
  }
}

const { chromium } = loadPlaywright();

const EDGE_USER_DATA =
  process.env.EDGE_USER_DATA ||
  "C:/Users/hp739/AppData/Local/Microsoft/Edge/User Data";
const EDGE_PROFILE = process.env.EDGE_PROFILE || "Default";
const CDP_PORT = process.env.CDP_PORT || "9222";
const START_URL =
  process.argv[2] ||
  process.env.START_URL ||
  "https://labs.google/fx/tools/flow";

async function main() {
  const args = [
    "--start-maximized",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-crash-restore-bubble",
    `--profile-directory=${EDGE_PROFILE}`,
    `--remote-debugging-port=${CDP_PORT}`,
  ];

  const context = await chromium.launchPersistentContext(EDGE_USER_DATA, {
    channel: "msedge",
    headless: false,
    viewport: null,
    args,
    ignoreDefaultArgs:
      process.env.EDGE_LOAD_EXTENSIONS === "1"
        ? ["--disable-extensions"]
        : undefined,
  });

  const page = context.pages()[0] || (await context.newPage());
  await page.goto(START_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  }).catch(() => {});

  console.log(
    JSON.stringify(
      {
        status: "KEEPOPEN_READY",
        cdp: `http://127.0.0.1:${CDP_PORT}`,
        profile: path.normalize(EDGE_USER_DATA),
        url: page.url(),
      },
      null,
      2,
    ),
  );

  console.log("Leave this process running while agents attach to Edge.");
  await new Promise(() => {});
}

main().catch((err) => {
  const message = String(err.stack || err.message || err);
  const profileLocked = /Failed to launch|exitCode=21|process did exit/i.test(message);
  console.error(
    JSON.stringify(
      {
        status: profileLocked ? "EDGE_PROFILE_LOCKED_OR_DEBUG_UNAVAILABLE" : "EDGE_BOOTSTRAP_FAILED",
        cdp: `http://127.0.0.1:${CDP_PORT}`,
        profile: path.normalize(EDGE_USER_DATA),
        profileDirectory: EDGE_PROFILE,
        nextStep:
          "Close normal Edge first, then run this helper again. The helper must be the first Edge process for the Default profile so the debug port is available.",
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
