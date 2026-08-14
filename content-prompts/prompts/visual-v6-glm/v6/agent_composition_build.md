# AGENT: COMPOSITION BUILD — FINAL PIPELINE v6
## Instruction File: `v6/agent_composition_build.md`
## Status: CANONICAL — supersedes all previous versions of this file

**MISSION:** Build each planned visual as a disciplined composition, render it using
the seek-based frame capture pipeline, attach audio via FFmpeg post-processing,
and hand verified renders to QA.

Read these first (and ONLY these — context budget discipline applies):
- `documents/Visual_Style_Bible.md`
- `documents/Visual_Decision_Log.md`
- `documents/Visual_Guidance_Document.md`
- `v6/visual_archetypes.md`
- `v6/failure_taxonomy.md`

---

## PRIME DIRECTIVE — RENDER STACK CONFIRMATION

Before writing a single line of code, confirm all five facts are true:

1. The canonical render stack is: **HTML/CSS + GSAP + Playwright + FFmpeg**.
2. Every composition must expose `window.initAnimation = initAnimation`.
3. Every composition must expose `window._duration = tl.totalDuration()`.
4. Every composition must set `window.animationComplete = false` and fire it via `onComplete`.
5. Lottie, Hyperframes, real-time playback capture, and auto-fired GSAP timelines
   are not part of this pipeline. If Lottie appears anywhere in a composition,
   remove it before build.

If any of these are unclear, stop and re-read this file before proceeding.

---

## PHASE 0 — PERMISSIONS BOOTSTRAP

Run this exact block at the very start of Phase 0, before creating any file:

```bash
mkdir -p doc-visuals/qa \
         doc-visuals/documents \
         doc-visuals/compositions \
         doc-visuals/renders \
         doc-visuals/renders/final \
         doc-visuals/renders/_frames \
         doc-visuals/assets/generated \
         doc-visuals/assets/video \
         doc-visuals/assets/audio \
         doc-visuals/assets/fonts \
         doc-visuals/assets/screenshots \
         doc-visuals/assets/logos \
         doc-visuals/agent-ctx

# Force correct ownership on all qa files before anything writes to them
touch doc-visuals/qa/agent_log.txt
touch doc-visuals/qa/phase_state.txt
touch doc-visuals/qa/Issue_Register.md
chmod 664 doc-visuals/qa/agent_log.txt
chmod 664 doc-visuals/qa/phase_state.txt

# Verify write access before proceeding — this is a hard gate
echo "BOOTSTRAP OK $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> doc-visuals/qa/agent_log.txt
```

If the `echo` test fails, the agent MUST use `doc-visuals/qa/agent_log_$(whoami).txt`
as the fallback log path. Report this as `SETUP_WARN` in phase_state.txt.
Log write failure is a WARN, not a blocker. Never halt Phase 0 over a log file.

---

## FONT SETUP — INTER (REQUIRED BEFORE ANY COMPOSITION IS BUILT)

The render environment has no internet access during frame capture.
Never reference Google Fonts CDN URLs in compositions. They will silently
fall back to serif and QA will fail every typography check.

### Download fonts once during Phase 0 setup:

```bash
# Run these four commands during Phase 0 asset setup
curl -L "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2" \
  -o doc-visuals/assets/fonts/Inter-Regular.woff2

curl -L "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiJ-Ek-_EeA.woff2" \
  -o doc-visuals/assets/fonts/Inter-Bold.woff2

curl -L "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.woff2" \
  -o doc-visuals/assets/fonts/Inter-SemiBold.woff2

# Verify fonts downloaded correctly (each should be > 50KB)
ls -lh doc-visuals/assets/fonts/
```

### Paste this exact `<style>` block at the top of EVERY composition:

```html
<style>
  @font-face {
    font-family: 'Inter';
    src: url('../assets/fonts/Inter-Regular.woff2') format('woff2');
    font-weight: 400;
    font-style: normal;
    font-display: block; /* block rendering until font loads — critical for capture */
  }
  @font-face {
    font-family: 'Inter';
    src: url('../assets/fonts/Inter-SemiBold.woff2') format('woff2');
    font-weight: 600;
    font-style: normal;
    font-display: block;
  }
  @font-face {
    font-family: 'Inter';
    src: url('../assets/fonts/Inter-Bold.woff2') format('woff2');
    font-weight: 700;
    font-style: normal;
    font-display: block;
  }

  *, *::before, *::after {
    font-family: 'Inter', sans-serif;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
</style>
```

Typography rule: Never reference system fonts or any CDN URL in a composition.
If a composition is found using `font-family: serif` or any Google Fonts link,
it is classified as a `TYPOGRAPHY_FAILURE` and must be rebuilt before QA review.

---

## SETUP STANDARD — NODE STACK

Install only what the canonical stack needs:

```bash
cd doc-visuals
npm init -y
npm install gsap playwright
npx playwright install chromium
ffmpeg -version  # verify FFmpeg is available
```

Do not install Lottie. Do not install any video wrapper library. If Lottie code or references appear in any composition (hallucinated by the LLM, copied from a template, or imported from a legacy artifact), remove them before build.

---

## SHORT SPEC (PLANNER STEP — EMBEDDED)

Before the full Shot Spec, emit a Short Spec for each row. This replaces
the dedicated Visual Planner file. The Short Spec is a lightweight planning
step that confirms the creative direction before investing in a full Shot Spec.

```text
SHORT SPEC
Row: [row number]
Primary insight: [one sentence — what the viewer must understand]
Archetype candidate: [archetype]
Why this archetype: [one sentence justification]
Riskiest assumption: [what could go wrong with this choice]
```

The Short Spec must be approved by the Orchestrator (or pass self-review)
before proceeding to the full Shot Spec. If the Short Spec reveals a bad
archetype fit, the Build Agent must flag it and request a Creative Direction
revision — do not build with a wrong archetype.

---

## SHOT SPEC REQUIREMENT

After the Short Spec is approved, emit a Shot Spec block. No exceptions.

```text
SHOT SPEC
Row:
Primary insight:
Audience takeaway:
Archetype:
Primary focus:
Secondary focus:
Tertiary environment:
Timing map: [0.0s entrance] [Xs hold] [Xs exit] [total: Xs]
Camera/motion plan:
Assets required:
Known risks:
```

If you cannot fill every field clearly, the row is not ready to build.
Do not start writing composition code until the Shot Spec is complete.

---

## GSAP RENDER CONTRACT — EVERY COMPOSITION MUST IMPLEMENT THIS

This is the handshake between the animation and the renderer.
Without this contract, the renderer cannot know frame count, duration,
or when capture is complete.

### Paste this exact pattern into every composition `<script>` block:

```javascript
// ── RENDER CONTRACT ────────────────────────────────────────────
// These three globals are read by the Playwright render script.
// Do not rename them. Do not omit them.
window.animationComplete = false;   // flips to true when timeline ends
window._duration = 0;               // total seconds — set after tl is built
window.initAnimation = initAnimation; // renderer calls this to start

function initAnimation() {
  // Reset state for seek-based rendering
  window.animationComplete = false;

  const tl = gsap.timeline({
    onComplete: () => {
      window.animationComplete = true;
    }
  });

  // ── YOUR ANIMATION CODE GOES HERE ──────────────────────────
  // Example:
  // tl.from('.headline span', { opacity: 0, y: 20, stagger: 0.05 })
  //   .from('.stat', { textContent: 0, duration: 2, snap: { textContent: 1 } })
  //   .to('.panel', { opacity: 0, duration: 0.5 });
  // ───────────────────────────────────────────────────────────

  // CRITICAL: expose the timeline and its duration AFTER building it
  window._tl = tl;
  window._duration = tl.totalDuration();
}

// Preview call — renderer will call initAnimation() again via page.evaluate()
document.fonts.ready.then(() => {
  initAnimation();
});
// ── END RENDER CONTRACT ────────────────────────────────────────
```

Rules for the GSAP timeline:
- Never use `paused: true` on the master timeline — the seek system handles timing.
- Never use `autoRemoveChildren: true` — this breaks seek-based scrubbing.
- `window._duration` must be set AFTER `tl` is built, not before.
- `onComplete` must flip `window.animationComplete = true` — this is the
  secondary verification signal used by QA to confirm the timeline ran.

---

## PLAYWRIGHT BROWSER CONFIGURATION — CLOUD CONTAINER SAFE

Because z.ai runs inside a memory-limited Linux container (Docker/Kubernetes),
standard Chromium will silently crash during 1080p rendering when it tries
to use the default `/dev/shm` shared memory partition (typically only 64MB).
This produces 0-byte output files with no error message.

**Always launch Playwright with these exact arguments. No exceptions.**

```javascript
const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',       // CRITICAL: routes memory away from /dev/shm
    '--disable-gpu',                  // no GPU in cloud containers
    '--disable-software-rasterizer',  // prevents fallback rasterizer crashes
    '--mute-audio',                   // compositions have no live audio
    '--window-size=1920,1080'
  ]
});
```

Without `--disable-dev-shm-usage`, renders will produce 0-byte files
or corrupt MP4s silently. This flag is the fix for that entire failure class.

---

## RENDER PIPELINE — SEEK-BASED FRAME CAPTURE (CANONICAL)

The canonical rendering method is **seek-based frame capture**, not real-time
playback recording. In seek-based capture, the renderer mathematically steps
GSAP to each frame using `tl.seek(t)`, takes a screenshot at that exact moment,
and stitches all screenshots into an MP4 via FFmpeg.

**Why seek-based, not real-time:**
- Real-time playback capture (waitForFunction + record) takes 8 real seconds to
  capture an 8-second animation. For 72 compositions, that is ~10 minutes of
  idle wait time that will trigger z.ai's session timeout.
- Seek-based capture steps through time instantly. A 10-second composition
  renders in ~20 seconds of wall time regardless of animation duration.
- Seek-based gives frame-perfect output. Real-time capture is subject to
  system load jitter.

### Save this as `v6/render_one.js`:

```javascript
// render_one.js — seek-based renderer for a single composition
// Usage: node render_one.js <path-to-html> <output-mp4-path>

const { chromium } = require('playwright');
const { execSync }  = require('child_process');
const fs            = require('fs');
const path          = require('path');

const HTML_FILE  = process.argv[2];
const OUTPUT_MP4 = process.argv[3];
const FPS        = 30;

if (!HTML_FILE || !OUTPUT_MP4) {
  console.error('Usage: node render_one.js <html> <output.mp4>');
  process.exit(1);
}

async function render() {
  const name      = path.basename(HTML_FILE, '.html');
  const framesDir = path.join(path.dirname(OUTPUT_MP4), `_frames_${name}`);
  fs.mkdirSync(framesDir, { recursive: true });

  // ── Launch browser (cloud-safe flags) ────────────────────────────────────
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--mute-audio',
      '--window-size=1920,1080'
    ]
  });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });

  // ── Load composition ─────────────────────────────────────────────────────
  const fileURL = `file://${path.resolve(HTML_FILE)}`;
  await page.goto(fileURL, { waitUntil: 'networkidle' });

  // ── Wait for render contract to be ready ─────────────────────────────────
  // Waits for: font loaded + GSAP ready + duration exposed
  await page.waitForFunction(() => {
    return (
      typeof window.initAnimation === 'function' &&
      typeof window._duration     === 'number'   &&
      window._duration            >  0            &&
      document.fonts.check('16px Inter')
    );
  }, { timeout: 15000 }).catch(() => {
    console.warn(`[WARN] ${name}: render contract timeout — proceeding with best effort`);
  });

  // ── Read animation duration ───────────────────────────────────────────────
  const duration    = await page.evaluate(() => window._duration || 5);
  const totalFrames = Math.ceil(duration * FPS) + 3; // +3 buffer frames
  console.log(`[${name}] ${duration.toFixed(2)}s → ${totalFrames} frames at ${FPS}fps`);

  // ── Seek-based frame capture ──────────────────────────────────────────────
  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / FPS;

    // Seek GSAP timeline to exact timestamp
    await page.evaluate((seekTime) => {
      if (window._tl) {
        window._tl.seek(seekTime, false); // false = no events fired during seek
      }
    }, t);

    // Allow DOM to settle after seek (one rAF equivalent)
    await page.waitForTimeout(16);

    const framePath = path.join(
      framesDir,
      `frame_${String(frame).padStart(5, '0')}.jpg`
    );

    await page.screenshot({
      path:    framePath,
      type:    'jpeg',
      quality: 92, // JPEG is 3-4x faster than PNG at 1920x1080
      clip:    { x: 0, y: 0, width: 1920, height: 1080 }
    });
  }

  // ── Secondary verification: confirm onComplete fired ─────────────────────
  const didComplete = await page.evaluate(() => window.animationComplete === true);
  if (!didComplete) {
    console.warn(`[WARN] ${name}: animationComplete never fired — check onComplete callback`);
  }

  await browser.close();

  // ── Stitch frames into silent MP4 via FFmpeg ─────────────────────────────
  execSync(
    `ffmpeg -y -framerate ${FPS} ` +
    `-i "${framesDir}/frame_%05d.jpg" ` +
    `-c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p ` +
    `"${OUTPUT_MP4}"`,
    { stdio: 'inherit' }
  );

  // ── Clean up frame directory ──────────────────────────────────────────────
  fs.rmSync(framesDir, { recursive: true, force: true });
  console.log(`[${name}] ✅ Silent render → ${OUTPUT_MP4}`);
}

render().catch(err => {
  console.error(`[FATAL] Render failed:`, err.message);
  process.exit(1);
});
```

---

## MICRO-BATCHING RENDER RULE — CRITICAL FOR z.ai SESSIONS

**Never run a single render script across all compositions at once.**
A loop over 72+ compositions runs silently for too long and z.ai's session
health check will terminate the connection, producing 0-byte files for
every composition that hadn't finished yet.

The fix is micro-batching with activity signals. Render 10 compositions
per batch. After each batch, the agent prints a status update to the chat.
This "breath" resets z.ai's timeout clock and confirms the session is alive.

### Save this as `v6/render_batch.js`:

```javascript
// render_batch.js — micro-batch renderer with checkpoint and activity signal
// Usage: node render_batch.js --start 0 --end 10

const { chromium } = require('playwright');
const { execSync }  = require('child_process');
const fs            = require('fs');
const path          = require('path');

// ── CLI arguments ─────────────────────────────────────────────────────────
const args  = process.argv.slice(2);
const START = parseInt(args[args.indexOf('--start') + 1] || '0');
const END   = parseInt(args[args.indexOf('--end')   + 1] || '10');

const COMPOSITIONS_DIR  = './compositions';
const RENDERS_DIR       = './renders';
const CHECKPOINT_FILE   = './renders/_checkpoint.json';
const FPS               = 30;

// ── Checkpoint helpers ────────────────────────────────────────────────────
function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try { return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8')); }
    catch { return { completed: [] }; }
  }
  return { completed: [] };
}

function saveCheckpoint(name, durationSec) {
  const cp = loadCheckpoint();
  cp.completed.push({ name, durationSec, renderedAt: new Date().toISOString() });
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2));
}

// ── Single composition renderer ───────────────────────────────────────────
async function renderOne(browser, htmlFile) {
  const name      = path.basename(htmlFile, '.html');
  const outputMP4 = path.join(RENDERS_DIR, `${name}.mp4`);
  const framesDir = path.join(RENDERS_DIR, `_frames_${name}`);

  fs.mkdirSync(framesDir, { recursive: true });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });

  const fileURL = `file://${path.resolve(htmlFile)}`;
  await page.goto(fileURL, { waitUntil: 'networkidle' });

  // Wait for render contract
  await page.waitForFunction(() => {
    return (
      typeof window.initAnimation === 'function' &&
      typeof window._duration     === 'number'   &&
      window._duration            >  0            &&
      document.fonts.check('16px Inter')
    );
  }, { timeout: 15000 }).catch(() => {
    console.warn(`  [WARN] ${name}: render contract timeout`);
  });

  const duration    = await page.evaluate(() => window._duration || 5);
  const totalFrames = Math.ceil(duration * FPS) + 3;

  // Seek-based frame capture
  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / FPS;
    await page.evaluate((seekTime) => {
      if (window._tl) window._tl.seek(seekTime, false);
    }, t);
    await page.waitForTimeout(16);

    const framePath = path.join(framesDir, `frame_${String(frame).padStart(5, '0')}.jpg`);
    await page.screenshot({
      path: framePath, type: 'jpeg', quality: 92,
      clip: { x: 0, y: 0, width: 1920, height: 1080 }
    });
  }

  // Secondary verification
  const didComplete = await page.evaluate(() => window.animationComplete === true);
  if (!didComplete) {
    console.warn(`  [WARN] ${name}: animationComplete never fired`);
  }

  await page.close();

  // Stitch with FFmpeg
  execSync(
    `ffmpeg -y -framerate ${FPS} -i "${framesDir}/frame_%05d.jpg" ` +
    `-c:v libx264 -preset fast -crf 18 -pix_fmt yuv420p "${outputMP4}"`,
    { stdio: 'pipe' }
  );

  fs.rmSync(framesDir, { recursive: true, force: true });
  return { name, duration };
}

// ── Main batch runner ─────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(RENDERS_DIR, { recursive: true });

  const cp = loadCheckpoint();
  const completedNames = cp.completed.map(c => c.name || c);

  // Get the slice for this batch
  const allFiles = fs.readdirSync(COMPOSITIONS_DIR)
    .filter(f => f.endsWith('.html'))
    .sort()
    .slice(START, END)
    .map(f => path.join(COMPOSITIONS_DIR, f));

  const toRender = allFiles.filter(f => {
    const name = path.basename(f, '.html');
    return !completedNames.includes(name);
  });

  if (toRender.length === 0) {
    console.log(`✅ Batch ${START}-${END}: all already rendered — nothing to do.`);
    return;
  }

  console.log(`\n🎬 Batch ${START}–${END}: ${toRender.length} to render, ${allFiles.length - toRender.length} skipped (checkpoint)`);

  // Launch one browser for the whole batch (faster than per-composition launch)
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', '--disable-gpu',
      '--disable-software-rasterizer', '--mute-audio',
      '--window-size=1920,1080'
    ]
  });

  let batchDone = 0;

  for (const htmlFile of toRender) {
    const name = path.basename(htmlFile, '.html');
    console.log(`  ⏳ Rendering ${name}...`);

    try {
      const result = await renderOne(browser, htmlFile);
      saveCheckpoint(result.name, result.duration);
      batchDone++;

      // ── ACTIVITY SIGNAL (the "breath") ──────────────────────────────────
      // This message resets z.ai's session timeout clock.
      // Do NOT remove this line.
      console.log(
        `  ✅ [${batchDone}/${toRender.length}] ${name} — ` +
        `${result.duration.toFixed(2)}s rendered. ` +
        `Batch ${START}-${END} progress: ${batchDone}/${toRender.length}`
      );

    } catch (err) {
      console.error(`  ❌ [FAILED] ${name}: ${err.message}`);
      // Log and continue — never halt on a single failure
      try {
        fs.appendFileSync(
          './qa/agent_log.txt',
          `[RENDER_FAIL] ${new Date().toISOString()} ${name} — ${err.message}\n`
        );
      } catch { /* log write failure is not a blocker */ }
    }
  }

  await browser.close();

  // ── BATCH COMPLETE SIGNAL ────────────────────────────────────────────────
  // This is the activity signal that confirms the session is alive.
  console.log(`\n🏁 BATCH COMPLETE: ${START}–${END}`);
  console.log(`   Rendered this batch: ${batchDone}/${toRender.length}`);
  console.log(`   Checkpoint total:    ${loadCheckpoint().completed.length}`);
  console.log(`   Next command:        node render_batch.js --start ${END} --end ${END + 10}`);
  console.log('   Waiting for next batch instruction...\n');
}

main().catch(err => {
  console.error('[FATAL] Batch failed:', err.message);
  process.exit(1);
});
```

### How the Orchestrator must call this:

```bash
# ALWAYS render in batches of 10 — never more
node ../v6/render_batch.js --start 0  --end 10
# → wait for BATCH COMPLETE signal, then:
node ../v6/render_batch.js --start 10 --end 20
# → wait for BATCH COMPLETE signal, then:
node ../v6/render_batch.js --start 20 --end 30
# → continue until all compositions are done
```

**After every BATCH COMPLETE signal, the Orchestrator must:**
1. Print the batch result to the chat (this is the "breath")
2. Check `renders/_checkpoint.json` to confirm completion
3. Only then issue the next batch command

Batch size is fixed at **10 maximum**. If z.ai still times out at 10,
reduce to 5. Never increase above 10.

---

## CONTEXT BUDGET RULE — PREVENTS PHASE 3 TIMEOUT CASCADES

By Phase 3, accumulated context from planning docs, asset logs, and previous
phase outputs makes sub-agents heavy. If a build agent loads all 72 rows
of the Decision Log and all 72 rows of the Guidance Document at once,
it will overflow and fall back to batch-script mode — which this pipeline
explicitly prohibits.

### Context allowed per build agent invocation:

| What | Allowed |
|------|---------|
| This instruction file | Always |
| `qa/phase_state.txt` | Always |
| `v6/visual_archetypes.md` | Always |
| `v6/failure_taxonomy.md` | Always |
| Decision Log rows | **Current batch only (max 12 rows)** |
| Guidance Doc rows | **Current batch only (matching rows)** |
| Style Bible | Full file allowed |
| Previous phase outputs | phase_state.txt summary ONLY — not full docs |

### Batch size rule for build agents:

Maximum **12 rows** per build agent invocation.
Split work like this:

```
Build Agent Alpha  → rows 1-12
Build Agent Beta   → rows 13-24
Build Agent Gamma  → rows 25-36
... etc.
```

After each agent completes its batch, write a HANDOFF_NOTE to phase_state.txt:

```text
HANDOFF_NOTE
  Rows completed:  1-12
  Rows remaining:  13+
  Renders created: [list of filenames]
  Known issues:    [list or NONE]
  Next agent:      rows 13-24 from decision log only
```

The orchestrator reads this HANDOFF_NOTE and passes only the relevant
row slice to the next build agent. The next agent does not re-read
the entire Decision Log.

---

## BUILD WORKFLOW — ROW BY ROW (NOT BATCH)

For each row in `Visual_Decision_Log.md`, in strict order:

1. Read the matching row from the Decision Log
2. Read the corresponding line(s) from the Guidance Document
3. Emit the **Short Spec** (planner step — one-sentence insight + archetype justification)
4. Once Short Spec is approved, emit the full **Shot Spec** (all fields must be filled)
5. Read only the relevant archetype section in `v6/visual_archetypes.md`
6. For DOC_HIGHLIGHT rows, also read `v6/template_doc_highlight.md`
7. Build the HTML composition with the Render Contract (see above)
8. Verify font block is present in the composition
9. Render the silent MP4: `node v6/render_one.js compositions/[name].html renders/[name].mp4`
10. Log completion to `qa/agent_log.txt`
11. Mark the row `READY_FOR_AUDIO` in phase_state.txt
12. Continue to next row

**Do not batch-build 72 compositions in one script.** The QA guarantee
of per-row Short Specs, Shot Specs, and per-row render verification is lost in batch mode.
If you find yourself writing a loop over all rows in one script, stop.
You are in batch mode. Break it into row-by-row execution.

---

## CANONICAL BUILD RULES

1. Every composition must define:
   - `function initAnimation() { ... }`
   - `window.initAnimation = initAnimation`
   - `window._duration = tl.totalDuration()` (set after tl is built)
   - `window.animationComplete = false` (reset at start of initAnimation)
   - `onComplete: () => { window.animationComplete = true; }` on master timeline

2. Build timings in seconds first, then convert to frames at 30fps if needed.

3. Default canvas is `1920×1080` unless a smaller accent composition is
   explicitly approved by the guidance document.

4. Every composition uses a textured base background as layer 1.

5. Animate transforms and opacity by default. Use `filter`, `clip-path`,
   or heavier effects only when the archetype explicitly requires them.

6. **No moving video behind static text.** Video is either a standalone shot,
   a foreground accent in a contained zone, or the main visual. Never wallpaper.

7. No frame-jitter wrapper. If motion feels dead, fix hierarchy or timing.
   Do not solve weak motion by adding shake.

8. One clear hierarchy per frame. One primary focus. One secondary support.
   One tertiary environment.

9. Respect safe margins. No vital text or data inside the outer 10% of frame.

10. Replace every sample placeholder with real content before render.
    `[VALUE]`, `[HEADLINE]`, and example numbers must not survive to render time.

11. **Every composition MUST expose `window._duration = tl.totalDuration()`.**
    A composition without this value will render at 0.4s regardless of
    how long the GSAP animation actually runs. This is the most common
    render failure and it is fully preventable.

12. **Never use `paused: true` or `autoRemoveChildren: true` on the master timeline.**
    The seek-based renderer scrubs the timeline using `.seek(t)`.
    Both of these GSAP options break seek-based scrubbing.

13. **EMOTIONAL_MOMENT compositions must be 8.0s minimum, 12.0s maximum.**
    This is the widest hold in the duration matrix. Emotional beats need
    breathing room. If you write a 6s emotional composition, extend the hold
    phase — not the entrance or exit.

    Correct timing for EMOTIONAL_MOMENT:
    ```
    entrance:  1.2s
    hold:      6.5s  (minimum — extend for heavier emotional weight)
    exit:      0.8s
    total:     8.5s minimum
    ```
    
    Even if the GSAP timeline ends early, set:
    ```javascript
    window._duration = Math.max(tl.totalDuration(), 8.5);
    ```
    The renderer will hold the final frame for the remaining duration.

14. **STAT_HYBRID (STAT_COUNTER + BROLL_VIDEO) compositions** follow this layout:
    - Video occupies the left 60% of frame (no static text overlaid on it)
    - Stat occupies the right 40% on a semi-opaque dark panel with texture
    - Stat counts up from zero as normal
    - Video plays silently as environment — never as foreground action
    - Duration: 6.0–8.0s (longer than standard STAT_COUNTER)
    - Audio: `snd_impact.mp3` for alarming stats, `snd_appear.mp3` for neutral

15. **Font-ready gate before initAnimation.**
    Wrap the initAnimation preview call in a fonts.ready promise:
    ```javascript
    document.fonts.ready.then(() => {
      initAnimation();
    });
    ```
    Without this, Inter may not load before GSAP runs, producing serif fallback
    frames in the early part of the animation.

---

## DOCUMENTARY HIGHLIGHT BUILD RULES

When building `SCREENSHOT_HIGHLIGHT` or `DOC_HIGHLIGHT`, preserve these rules:

- Aged-paper or documentary texture base — never a clean white background
- Publication logo sits **outside** zoom and perspective wrappers
- Slow highlight sweep: 1.8–2.2s (faster looks cheap)
- Center-safe zoom only: 1.10x–1.35x maximum
- Zoom origin must be `transform-origin: center center` — never top-left
- Per-element DOF blur on non-hero text: 2px–4px only
- Grain opacity: 0.03–0.07 combined (texture, not distraction)
- Flicker: ±0.4% opacity feel (subliminal only)
- Highlight bar position must be measured against actual DOM text bounds,
  never guessed by eye
- For the cinematic look specification, refer to `v6/template_doc_highlight.md`
  which describes the 9-phase sequence and camera angles as instructions
  (no separate code files — the Build Agent implements per-shot)

Suggested phase order within the duration band:
```
0.0s  → evidence enters, environment settles
1.5s  → logo or source treatment appears
2.5s  → highlight sweep begins
4.0s  → slow camera push or parallax develops
6.0s  → support text softens, stat or callout reveal lands
8.0s+ → hold on evidence
```

---

## SOUND ATTACHMENT AND FFMPEG MULTIPLEXING

**Playwright captures silent video. Audio must be attached as a post-processing
step using FFmpeg — never during composition build or during Playwright recording.**

The audio attachment script runs after all silent MP4s in a batch are confirmed.

### Audio map — archetype prefix to sound file:

| Filename prefix | Archetype | Sound file |
|---|---|---|
| `sh_` | SECTION_TITLE_CARD | `snd_transition.mp3` |
| `stat_` | STAT_COUNTER (neutral) | `snd_appear.mp3` |
| `stat_alarm_` | STAT_COUNTER (alarming) | `snd_impact.mp3` |
| `bar_` | BAR_CHART | `snd_sweep.mp3` |
| `line_` | LINE_GRAPH | `snd_sweep.mp3` |
| `pie_` | PIE_CHART | `snd_sweep.mp3` |
| `comp_` | COMPARISON_PANEL | `snd_appear.mp3` |
| `flow_` | FLOW_DIAGRAM | `snd_appear.mp3` |
| `doc_` | DOC_HIGHLIGHT | `snd_sweep.mp3` |
| `screen_` | SCREENSHOT_HIGHLIGHT | `snd_sweep.mp3` |
| `metaphor_` | GSAP_METAPHOR | `snd_appear.mp3` |
| `emotional_` | EMOTIONAL_MOMENT | `snd_ambient_bed.mp3` |
| `broll_` | BROLL_VIDEO | `snd_ambient_bed.mp3` |
| `ta_` | TEXT_ANNOTATION | `snd_appear.mp3` |

### Save this as `v6/attach_audio.js`:

```javascript
// attach_audio.js — post-processing audio mux for all silent renders
// Usage: node attach_audio.js
// Reads:  renders/*.mp4 (silent)
// Writes: renders/final/*.mp4 (with audio)

const { execSync } = require('child_process');
const fs           = require('fs');
const path         = require('path');

const RENDERS_DIR  = './renders';
const AUDIO_DIR    = './assets/audio';
const FINAL_DIR    = './renders/final';
const LOG_FILE     = './qa/agent_log.txt';

fs.mkdirSync(FINAL_DIR, { recursive: true });

const AUDIO_MAP = {
  'sh_':          'snd_transition',
  'stat_alarm_':  'snd_impact',
  'stat_':        'snd_appear',
  'bar_':         'snd_sweep',
  'line_':        'snd_sweep',
  'pie_':         'snd_sweep',
  'comp_':        'snd_appear',
  'flow_':        'snd_appear',
  'doc_':         'snd_sweep',
  'screen_':      'snd_sweep',
  'metaphor_':    'snd_appear',
  'emotional_':   'snd_ambient_bed',
  'broll_':       'snd_ambient_bed',
  'ta_':          'snd_appear',
};

function log(msg) {
  const line = `[AUDIO] ${new Date().toISOString()} ${msg}\n`;
  process.stdout.write(line);
  try { fs.appendFileSync(LOG_FILE, line); } catch { /* log failure is not a blocker */ }
}

function getSoundForFile(filename) {
  const lower = filename.toLowerCase();
  // Check prefixes from longest to shortest to avoid false matches
  const sortedKeys = Object.keys(AUDIO_MAP).sort((a, b) => b.length - a.length);
  for (const prefix of sortedKeys) {
    if (lower.startsWith(prefix)) return AUDIO_MAP[prefix];
  }
  return 'snd_appear'; // safe default
}

const renders = fs.readdirSync(RENDERS_DIR)
  .filter(f => f.endsWith('.mp4') && !f.startsWith('_'));

let attached = 0;
let skipped  = 0;
let failed   = 0;

for (const render of renders) {
  const name       = path.basename(render, '.mp4');
  const finalPath  = path.join(FINAL_DIR, render);

  // Skip if already muxed
  if (fs.existsSync(finalPath)) {
    log(`SKIP (already exists) ${render}`);
    skipped++;
    continue;
  }

  const soundName  = getSoundForFile(render);
  const audioFile  = path.join(AUDIO_DIR, `${soundName}.mp3`);
  const inputVideo = path.join(RENDERS_DIR, render);

  if (!fs.existsSync(audioFile)) {
    log(`BLOCKED ${render} — missing audio: ${audioFile}`);
    failed++;
    continue;
  }

  // Get video duration via ffprobe
  let videoDuration;
  try {
    videoDuration = parseFloat(
      execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${inputVideo}"`)
        .toString().trim()
    );
  } catch {
    log(`FAILED ${render} — ffprobe error`);
    failed++;
    continue;
  }

  // Mux: loop audio to video duration, fade last 0.5s, copy video stream
  try {
    execSync(
      `ffmpeg -y -i "${inputVideo}" ` +
      `-stream_loop -1 -i "${audioFile}" ` +
      `-t ${videoDuration} ` +
      `-af "afade=t=out:st=${Math.max(0, videoDuration - 0.5)}:d=0.5" ` +
      `-c:v copy -c:a aac -b:a 192k ` +
      `-shortest "${finalPath}"`,
      { stdio: 'pipe' }
    );
    log(`OK ${render} + ${soundName}.mp3 → final/${render}`);
    attached++;
  } catch (err) {
    log(`FAILED ${render} — ffmpeg error: ${err.message.slice(0, 120)}`);
    failed++;
  }
}

console.log(`\n📻 Audio attachment complete:`);
console.log(`   Attached: ${attached}`);
console.log(`   Skipped:  ${skipped} (already existed)`);
console.log(`   Failed:   ${failed}`);
console.log(`\n   QA reviews renders/final/ — NOT renders/ (silent versions)`);
```

### When to run attach_audio.js:

```bash
# Run after EACH batch of renders completes — not at the very end
node render_batch.js --start 0 --end 10   # renders silent MP4s
node ../v6/attach_audio.js                       # attaches audio to those 10
# → print batch+audio status to chat (the "breath")
node render_batch.js --start 10 --end 20  # next batch
node ../v6/attach_audio.js                       # audio for next batch
# → print status to chat
```

**QA must review `renders/final/` — not `renders/` (silent versions).**
If a render exists in `renders/` but not in `renders/final/`, it has
no audio and has not passed QA.

---

## WRITE GUARD RULE

Before writing to any log file, verify write access:

```bash
python3 -c "open('qa/agent_log.txt','a').write('')" 2>/dev/null && \
  echo "LOG_OK" || echo "LOG_BLOCKED — using fallback"
```

If blocked, write to `qa/agent_log_fallback.txt` instead.
Never let a log write failure halt composition building.
Log failures are WARN class, not ERROR class.
Mark `SETUP_WARN: LOG_FALLBACK` in phase_state.txt and continue.

---

## BUILD LOGGING

For each finished render, append to `qa/agent_log.txt`:

```text
[BUILD] 2024-01-01T12:00:00Z  sh_01.mp4          SECTION_TITLE_CARD  4.0s   snd_transition  OK
[BUILD] 2024-01-01T12:00:20Z  stat_L1.mp4         STAT_COUNTER        5.5s   snd_appear      OK
[BUILD] 2024-01-01T12:00:45Z  flow_line18.mp4     FLOW_DIAGRAM        7.2s   snd_appear      OK
[BUILD] 2024-01-01T12:01:10Z  emotional_line49    EMOTIONAL_MOMENT    8.5s   snd_ambient_bed WARN:animationComplete_not_fired
```

Format: `[BUILD] [ISO_TIMESTAMP] [FILENAME] [ARCHETYPE] [DURATION] [SOUND] [STATUS]`

Mark the row `READY_FOR_AUDIO` in phase_state.txt after logging.
Mark the row `READY_FOR_QA` after audio attachment confirms the final file exists.

---

## OUTPUT CONTRACT

Return a short summary to the Orchestrator after each batch with:
1. Row range completed
2. Archetypes built
3. Any fallback assets used
4. Any renders that produced warnings
5. The highest-risk QA concern before review
6. The next batch command to run

Format:

```text
BATCH COMPLETE: rows 1-12
  Built: 12 compositions
  Archetypes: 3× SECTION_TITLE_CARD, 4× STAT_COUNTER, 2× BAR_CHART,
              2× FLOW_DIAGRAM, 1× EMOTIONAL_MOMENT
  Warnings: emotional_line49 — animationComplete not fired (check onComplete)
  Fallbacks: none
  QA risk: emotional_line49 duration may be short — verify in renders/final/
  Next: node render_batch.js --start 12 --end 24
```

---

## FAILURE QUICK-REFERENCE

| Symptom | Class | First fix |
|---|---|---|
| 0-byte MP4 | `RENDER_CRASH` | Add `--disable-dev-shm-usage` to browser args |
| 0.4s render | `RENDER_CONTROL_BUG` | Add `window._duration = tl.totalDuration()` to composition |
| Serif font in output | `TYPOGRAPHY_FAILURE` | Add `@font-face` Inter block; add `document.fonts.check()` to render wait |
| No audio on final | `AUDIO_MISSING` | Run `node attach_audio.js`; check audio map prefix |
| animationComplete never fires | `TIMELINE_WARN` | Verify `onComplete` callback exists on master timeline |
| Timeout during render loop | `SESSION_TIMEOUT` | Reduce batch size to 5; ensure BATCH COMPLETE signal prints |
| Log write permission error | `SETUP_WARN` | Switch to `agent_log_fallback.txt`; add chmod 664 to Phase 0 |
| Static first-frame stat | `MISSING_COUNT_UP` | Rebuild stat animation; count from 0 via GSAP textContent |
| Title fades as one block | `MISSING_STAGGER` | Rebuild with letter spans and staggered opacity |

---

*End of file — v6 final. This file supersedes all previous versions of
`agent_composition_build.md`. Do not merge with the old file. Replace it entirely.*
