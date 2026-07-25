# AE Captions Runbook — in-AE verification checklist

Run this inside After Effects when agent-side verification isn't possible
(no bridge) or for final human sign-off. Each step says what to do, what
you should see, and what to report back if it fails. Report failures as:
step number + what you saw + the 📋 Log output.

## Setup

1. Open a **9:16 comp** (1080×1920) containing an audio layer, open the
   EditFlow extension (Window → Extensions → EditFlow AI AE), and
   transcribe (🎙️ From Comp or 📁 Upload or 📋 Paste).
   - **Expect:** word list appears in Content tab; preview draws captions.
   - **If not:** report the Transcribe tab error text.

## Single-layer word-by-word (the core rebuild)

2. Animate tab → preset **fadeup_words** → Generate tab → **🧪 Test First
   Caption** (smoke).
   - **Expect:** ONE text layer named `Caption: …` appears (not one layer
     per word). Words fade up one by one as the playhead crosses their
     spoken times.
   - **If the whole sentence fades at once:** the expression-selector probe
     failed → report the generate result line (it includes
     `wordSelector: false`) and your AE version.
3. Select the caption layer → press `U U` → check the animators.
   - **Expect:** animators `EF Word Fade` and `EF Word Rise`, each with an
     **Expression Selector**; *Based On* shows **Words**; Amount carries an
     expression (no keyframes anywhere).
   - **If Based On shows Characters/Lines:** report — the `ADBE Text Range
     Type2` enum guess (3 = Words) is wrong for this build.
4. Font size sanity: the caption's size relative to comp width should match
   the panel preview proportionally (no shrunken long captions — they wrap
   to 2 lines inside the caption box instead).
   - **If a caption is tiny:** report its text + the Caption Box % setting.

## Pills

5. In Content tab toggle 💊 on words 2–3 of one caption → Generate.
   - **Expect:** still ONE text layer; rounded pill shape(s) behind exactly
     those words; each pill pops in at ITS word's spoken time (not at the
     caption start) and stays until the caption ends.
   - **If a pill sits under the wrong word or spans a whole line:** report
     a screenshot + the caption text (word-span measurement bug).

## Timing

6. Generate the full transcript. Step through a caption boundary
   frame-by-frame (Page Down).
   - **Expect:** caption N stays visible until caption N+1 starts, plus the
     Overlap setting (default 2 frames). No flash of empty screen between
     captions; no two captions stacked for more than the overlap.
7. Last caption: holds ~0.5s after its last word, then out.

## Presets + cleanup

8. Sweep presets (popin, bounce, squash, typewriter, fade, fadeup) with
   Generate — each should visibly differ and match its preview motion.
   (These are caption-level in AE v1 — only fadeup_words is per-word.)
9. **Clear** button removes every generated layer (captions + pills);
   🧪 Test layers never touch real captions (preview tag).
10. 🔁 button (top right): panel reloads and jsx re-evals without
    restarting AE; your captions and settings survive.

## Reporting

For any failure: step number, AE version, what you saw, the panel's 📋 Log
output, and (if generation ran) the generate result line from the Generate
tab. With the backend running with `EDITFLOW_AGENT_BRIDGE=1`, an agent can
gather all of this itself — see `docs/ae-agent-workflow.md`.

---

## Pro-polish additions (2026-07-23)

11. **Retime a word by dragging** — generate captions, select a caption
    layer, and look at the timeline: there's one **marker per word**.
    Drag a marker left/right.
    - **Expect:** that word's animation moves with the marker on the next
      preview pass. No expression editing.
    - **If nothing moves:** report whether the markers exist at all
      (they're added in `ef_buildCaptionLayer`).
    - **Known limit:** don't drag a word *past* its neighbour — AE
      re-sorts markers by time, which swaps the two words' timings.
      Retime the neighbour too.

12. **Keep your hand-tuned timing** — after dragging markers, click
    **⬇ Pull Timings from AE** (Generate tab), then Generate again.
    - **Expect:** the status says "Pulled N word timings"; the new
      captions keep the timing you dragged.
    - **If it says 0:** the marker text no longer matches the panel's
      words (an edit); report both.

13. **Caption box** — click 🔲 above the preview. Drag inside the dashed
    box to move it; drag a side handle to resize.
    - **Expect:** captions re-wrap live; Generate places them in the same
      spot in AE. A caption never renders outside the comp.

14. **Platform frame check** (portrait comps) — pick TikTok / Reels /
    Shorts next to 🔲.
    - **Expect:** the app's chrome is drawn over your frame; if your
      caption box overlaps it, the box turns amber and a line names what
      covers it ("like · comment · share").
    - Compare against a real upload once — report any zone that's off.

15. **Font size no longer changes caption size** — drag Font Size to
    140+.
    - **Expect:** captions hold **fewer words each** but every caption
      renders at the SAME glyph size. Nothing shrinks.

16. **Preset sweep, per-word** — popin, bounce, squash and typewriter
    should now animate **word by word** in AE (not the whole caption at
    once), matching the panel preview.
    - **If a preset animates all at once:** the expression-selector probe
      failed — report the generate result line (`wordSelector: false`)
      and your AE version.
