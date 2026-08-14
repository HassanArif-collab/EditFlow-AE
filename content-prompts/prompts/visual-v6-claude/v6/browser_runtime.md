# Browser Runtime v6

This file defines how browser-based visual tools are controlled. It is a runtime contract for Dreamina, Google Flow, article capture, and any future logged-in web tool.

---

## Default Browser

Use the user's real Microsoft Edge profile as the default authenticated browser:

```text
User data dir: C:/Users/hp739/AppData/Local/Microsoft/Edge/User Data
Profile directory: Default
CDP endpoint: http://127.0.0.1:9222
```

Preferred control mode:

```js
chromium.connectOverCDP("http://127.0.0.1:9222")
```

This lets the user keep using the same logged-in Edge session while agents attach to dedicated tabs.

---

## Browser Surface Priority

Use the Codex in-app browser skill for public pages, local UI checks, and visual verification when that browser surface is working. Do not assume it shares the user's Microsoft Edge login.

Use shared Edge CDP for Dreamina, Google Flow, credit checks, downloads, and any account-authenticated task, because the user is logged in there.

If the in-app browser control kernel fails before exposing tabs, log `IN_APP_BROWSER_UNAVAILABLE` and continue with shared Edge CDP for authenticated work. Do not pretend the in-app browser can verify logged-in Dreamina/Flow credits unless it actually has that session.

---

## Bootstrap Mode

If `http://127.0.0.1:9222/json/version` is unavailable, start one shared debug Edge session:

```powershell
node tools/edge_keepopen.js
```

That helper launches Edge with:

```text
--profile-directory=Default
--remote-debugging-port=9222
```

Important: if Edge is already running without the debug port, the profile is usually locked. Do not kill Edge automatically. Ask the user to close Edge, then launch `tools/edge_keepopen.js`.

---

## Tab Ownership

Browser task scripts must:

1. Attach to the existing CDP browser.
2. Open a new tab for the task.
3. Close only the tab they opened, unless the user asks to keep it open.
4. Never close the whole browser.
5. Never interfere with tabs not created by the task.

---

## Security Rules

Never print, save, or export:

- cookies
- auth tokens
- localStorage or sessionStorage
- account identifiers beyond generic logged-in/logged-out status
- full browser profile contents
- payment, subscription, or personal account screens

Allowed outputs:

- URL and page title
- visible control labels
- screenshots that do not expose private account data
- generated media files
- download URLs for generated assets
- compact UI maps
- task status logs

---

## Observe -> Decide -> Act -> Verify

Browser agents must not rely on brittle fixed click paths. Use this loop:

1. Observe visible controls and current page state.
2. Match the needed capability from `browser_capabilities.md`.
3. Click the best semantic match.
4. Verify that the page entered the expected state.
5. Stop before credit-spending actions unless the approved asset plan authorizes them.

Coordinates are allowed only as a fallback after semantic selectors fail and after a fresh screenshot confirms the target.

---

## Scout Mode

Use Scout Mode when a required control is missing or the UI has changed:

```powershell
node tools/browser_scout.js dreamina
node tools/browser_scout.js flow
```

Scout Mode captures visible controls and writes compact maps to:

```text
qa/browser_ui_maps/dreamina.json
qa/browser_ui_maps/flow.json
```

These maps are runtime aids, not source-of-truth prompts. The source of truth remains `browser_capabilities.md`.

---

## Credit-Spend Gate

The browser may be configured into a ready-to-generate state during dry runs.

Do not click a final Generate/Create/Submit control unless all are true:

1. The asset appears in the approved decision log or guidance document.
2. The `BROWSER TASK` contract has `allow_credit_spend: true`.
3. The expected credit risk is logged.
4. The output path is known.
5. The agent has high confidence that the selected mode/model/aspect matches the task.

If any condition is false, stop with `CREDIT_SPEND_NOT_AUTHORIZED`.
