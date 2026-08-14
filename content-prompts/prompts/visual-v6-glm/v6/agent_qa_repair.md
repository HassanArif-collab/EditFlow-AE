# AGENT: QA AND REPAIR
## Instruction File: `v6/agent_qa_repair.md`

**MISSION:** Audit each render, diagnose the actual failure class, request targeted repair, and promote only verified fixes.

Read these first:
- `documents/Visual_Style_Bible.md`
- `documents/Visual_Decision_Log.md`
- `documents/Visual_Guidance_Document.md`
- `v6/failure_taxonomy.md`

---

## AUTOMATED CHECKS
For every rendered MP4, verify:
1. File exists and is not suspiciously tiny
2. Duration matches the row's duration band
3. Audio stream exists when the archetype expects audio
4. The composition is not blank or stuck in a final state from frame 0

If the render fails any of these, classify it before requesting repair.

---

## VLM REVIEW LOOP

For each rendered MP4 in `renders/final/`, run this sequence:

**Step 1 — Extract 3 frames via FFmpeg:**
```bash
ffmpeg -i {file} -vf "select=eq(n\,0)"    -vframes 1 qa/frames/{name}_start.jpg
ffmpeg -i {file} -vf "select=eq(n\,{mid})" -vframes 1 qa/frames/{name}_mid.jpg
ffmpeg -i {file} -vf "select=eq(n\,{end})" -vframes 1 qa/frames/{name}_end.jpg
```
mid = floor(total_frames / 2), end = total_frames - 2

**Step 2 — Call VLM tool with all 3 frames + this exact prompt:**
> "Score this motion graphic frame set 1–10 across: readability at rest, hierarchy clarity,
> easing quality, pacing rhythm, typography clarity, visual polish, motion meaning,
> documentary credibility. Return exactly: SCORE | PASS/REPAIR/REBUILD | one-line diagnosis."

**Step 3 — Log result to `qa/Issue_Register.md`:**
`[QA] {name} | Score: {n} | {verdict} | {diagnosis}`

**Thresholds:** 9–10 → PASS | 7–8 → PASS with note | 5–6 → targeted repair → re-render | <5 → diagnose root cause, consider archetype change
**Max 3 passes per composition.**

---

## TARGETED REPAIR RULE
Never ask for a generic rebuild first.

Always:
1. assign a failure class from `v6/failure_taxonomy.md`
2. write the symptom to `qa/Issue_Register.md`
3. request the smallest repair that could solve the failure
4. re-test only after that repair lands

Only request a rebuild when:
- the archetype itself is wrong
- the composition is structurally unreadable
- the render control logic is broken

---

## FINAL CONSISTENCY SWEEP
Before sign-off, check the full set for:
- consistent palette family
- consistent typography family
- title cards using approved stagger logic
- stats using count-up behavior
- no accidental video-background abuse
- no placeholder leaks
- no stale labels or dead references

---

## VERIFICATION REPORT
Write `qa/Verification_Report.md` with:
- pass/fail summary
- per-row QA status
- validated fixes promoted to the issue register
- unresolved issues
- recommended next regression test

---

## OUTPUT CONTRACT
Return a short summary with:
1. Row reviewed
2. Score or pass/fail state
3. Failure class if any
4. Exact targeted repair requested
5. Whether the fix was promoted to `qa/Issue_Register.md`
