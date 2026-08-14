# Failure Taxonomy v6 — Claude Pipeline

Use this file to classify failures before repairing them. The repair path should be targeted to the failure class, not generic.

---

## Render Failures (Remotion)

| Failure Class | Symptoms | Likely Cause | Targeted Repair |
|---------------|----------|--------------|-----------------|
| Bundle crash | Remotion build fails with import error | React-18 incompatible package | Remove incompatible import, use fallback component |
| Serif font | Output shows serif where Inter expected | Font not registered in `Root.tsx` | Register `@font-face` in global style |
| Empty render | Output is black or blank | Props mismatch between shotlist and component | Verify component prop types match shotlist.json |
| Static first-frame stat | Number shown at final value from frame 0 | Missing `spring()` starting from 0 | Add spring-based counter with initial value 0 |
| Missing stagger | Title card fades as one block | Letter spans not split | Split into `<span>` array with staggered spring |
| Placeholder leakage | `[VALUE]` or example text visible | Placeholder not replaced | Audit final render, replace with real content |
| 0-frame render | Duration is 0 regardless of timeline length | `useCurrentFrame()` bound to wrong config | Verify `durationInFrames` matches shot spec |

---

## Prompt Integrity Failures

| Failure Class | Symptoms | Likely Cause | Targeted Repair | Rebuild Threshold |
|---------------|----------|--------------|-----------------|-------------------|
| Instruction conflict | Two active rules disagree | Old v5 rule survived beside new v6 rule | Remove or demote the stale rule and keep one canonical rule | Rebuild prompt section only |
| Placeholder leakage | `[VALUE]`, `[HEADLINE]`, sample numbers, or example labels show up in outputs | Example content not replaced | Add integrity check and replace all placeholders before render | No full rebuild needed |
| Stale pipeline reference | HTML/GSAP/FFmpeg language or dead toolchain references appear | Incomplete refactor | Replace with Remotion equivalents and align summaries/output contracts | No full rebuild needed |
| Duration contradiction | Same archetype has two conflicting minima | Mixed legacy rules | Keep only one duration band in archetype table | No full rebuild needed |

---

## Visual Output Failures

| Failure Class | Symptoms | Likely Cause | Targeted Repair | Rebuild When |
|---------------|----------|--------------|-----------------|--------------|
| Layout collision | Text overlaps chart, labels clip, safe margins break | Bad spacing or wrong hierarchy | Re-space, shrink secondary content, restore negative space | If the whole composition architecture is wrong |
| Bad hierarchy | Viewer does not know where to look first | Too many hero elements, weak contrast, synchronized motion overload | Reassign primary/secondary/tertiary focus and simplify | If the archetype itself is wrong |
| Mechanical easing | Motion feels robotic, abrupt, or cheap | Symmetric timing, weak easing, rushed holds | Normalize to duration matrix and pacing ratio | Rarely |
| Illegible stat | Number, unit, or label cannot be read quickly | Weak scale, poor contrast, over-effects | Enlarge hero number, reduce competing motion, lengthen hold | If the layout cannot support the stat |
| Highlight misalignment | Yellow sweep misses the cited phrase | Highlight position guessed instead of measured | Use article_capture.js DOM bounds to regenerate highlight geometry | No rebuild; targeted repair |
| Too much grain/flicker | Frame feels dirty, unstable, or distracting | Effects pushed beyond limits | Reduce opacity/range and keep effects outside critical text | No rebuild; targeted repair |
| Cheap camera movement | Zoom feels broken, top-left anchored, or overdramatic | Wrong transform origin or excessive scale | Re-center zoom, reduce scale, simplify parallax | If the shot concept depends on bad camera behavior |
| Wrong archetype choice | The chosen format fights the line's meaning | Planning error in decision log | Replace with a better archetype and update guidance doc | Yes |
| Text artifacts in generated image | AI image shows fake words or corrupted typography | Prompt too loose, model artifact | Regenerate with stronger negatives and simpler composition | Use fallback recreation after repeated failure |
| Fake stock aesthetic | Clip or image looks like ad creative | Prompt overused generic cinematic words | Tighten to documentary observational language | No rebuild if asset can be replaced |
| Confused flow logic | Diagram animates but mechanism is unclear | Too many nodes at once or poor sequencing | Reveal cause chain step-by-step | If node structure itself is wrong |
| Pacing mismatch | Shot is readable but drags or rushes | Hold time wrong for information density | Rebalance entrance/hold/exit within band | No rebuild unless concept also fails |
| Missing count-up | Final number appears immediately | Counter behavior omitted | Rebuild only the stat animation logic | No full rebuild |
| Missing title stagger | Section card fades in as one block | Archetype rule ignored | Rebuild title entrance with letter spans | No full rebuild |
| Render control bug | Frame 0 is already mid-animation or fully complete | Component state not reset or `useEffect` timing wrong | Fix render control pattern (reset in `useEffect`) | Yes if timeline logic is unusable |

---

## Repair Priority Order
1. Fix structural readability first
2. Fix hierarchy second
3. Fix timing and easing third
4. Fix polish effects last

If a composition fails at level 1 or 2, do not waste passes on grain, glow, or decorative polish.
