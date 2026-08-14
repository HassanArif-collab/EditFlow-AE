# Prompt Formulas v6 — Claude Pipeline

These formulas harden the generation prompts so they stay professional, documentary, and error-resistant. Use them as base formulas, then add only the minimum line-specific detail needed by the script.

---

## VISUAL TECHNIQUE MENU
The AI chooses ONE technique per shot based on what BEST explains the concept. The technique is the visual language, not decoration.

| Technique | Prompt Fragment | Use When |
|-----------|----------------|----------|
| `PHOTOREAL_CINEMATIC` | `photorealistic 35mm documentary frame, natural lighting, shallow depth of field, cinematic color grade` | Real people, places, physical evidence, credibility anchors |
| `ISOMETRIC_ILLUSTRATION` | `clean isometric 3D illustration, pastel palette, explanatory geometry, soft shadow, no perspective distortion` | Systems, processes, hidden layers, money flows, incentive chains |
| `PAPERCUT_STOPMOTION` | `hand-crafted paper cutout style, layered shadow, textured paper grain, tactile depth, subtle stop-motion feel` | Fragility, layered history, policy erosion, human stories |
| `CLAYMATION` | `clay stop-motion aesthetic, soft organic forms, visible fingerprints/imprints, warm studio lighting` | Abstract forces made tangible, trade flows, corruption mechanisms |
| `FLAT_2D_ILLUSTRATION` | `clean 2D flat vector illustration, editorial restraint, single accent color, generous negative space` | Diagrams, comparisons, institutional breakdowns, quick clarity |
| `DATA_INFographic` | `minimal data-driven infographic panel, tabular numbers, clean grid, muted UI aesthetic` | Statistics, charts, rankings, institutional metrics |
| `HANDDRAWN_SKETCH` | `rough pencil/ink hand-drawn sketch, unfinished edge, white paper texture, evidence-under-examination feel` | Leaked docs, investigative beats, raw evidence, uncertainty |
| `SOFT_3D_RENDER` | `soft 3D rendered scene, gentle subsurface scattering, calm studio lighting, subtle material contrast` | Future scenarios, hypotheticals, "what if" visualizations |
| `WATERCOLOR_WASH` | `soft watercolor paint style, bleeding edges, paper grain texture, emotional bleed, muted palette` | Memory, grief, moral weight, reflective emotional beats |
| `RETRO_FILM` | `1970s 16mm film stock, faded color, lifted blacks, fine film grain, slight vignette` | Historical context, archival segments, generational comparison |

---

## NARRATIVE PURPOSE VOCABULARY
The AI states WHY it chose the technique (5-15 words). Examples:
- "isometric reveals the hidden layers of the money trail"
- "papercut symbolizes the fragility of the social safety net"
- "claymation makes abstract trade flows tangible and graspable"
- "handdrawn implies this evidence is under active examination"
- "retro film signals this is archival historical context"

---

## Formula Use Rules
1. Start from the base formula.
2. Add only the minimum subject detail needed for that shot.
3. Keep the prompt semantically aligned with the archetype.
4. If output quality is wrong, adjust one variable at a time.
5. Do not overstuff prompts with every possible adjective.
6. **Always include: [VISUAL TECHNIQUE] + [NARRATIVE PURPOSE] before the base formula.**

---

## IMAGE PROMPT FORMULA (Dreamina GPT Image 2 / nano banana)

```
>>> VISUAL TECHNIQUE: [AI picks one from menu above] <<<
>>> NARRATIVE PURPOSE: [AI states why this technique explains this beat] <<<
[Archetype or visual role]. [Subject and narrative function in 6-12 words]. Editorial documentary illustration or diagrammatic still. Clean edges, restrained texture, readable silhouette, generous negative space, one dominant focal area, muted journalistic tone, observational not playful, composition designed to read clearly at a paused frame, subtle paper or print texture if appropriate. Palette restricted to [BG_HEX] [TEXT_HEX] [ACCENT_HEX].

Negative requirements: no readable text, no watermark, no logo, no fake newspaper masthead, no photoreal stock-ad look, no glossy 3D render, no neon gradient, no oversaturated accent, no clutter, no crowd of unrelated objects, no meme styling, no morphing when animated, no hallucinated elements.
```

### Image Prompt Add-Ons
- For metaphors: add `physical metaphor for [idea] with one clear action`
- For emotional moments: add `quiet, restrained, documentary mood`
- For diagram plates: add `clean geometry, explanatory composition`

---

## VIDEO PROMPT FORMULA (Flow Veo / Dreamina Multiframes)

```
>>> VISUAL TECHNIQUE: [AI picks one from menu above] <<<
>>> NARRATIVE PURPOSE: [AI states why this technique explains this beat] <<<
[Shot type]. [Specific subject + one micro-action]. [Environment]. [Lighting: key direction + quality + color temp in 6-10 words]. [Framing]. [Camera move: static / slow push-in / slow pull-back / low-angle track / steadycam walk / handheld jitter / whip pan / crash zoom / orbit 360 / rack focus / crane up / drone reveal / dolly zoom]. Documentary B-roll, observational, naturalistic, credible, [color grade: e.g. teal-orange cinematic / Kodak 2383 film / desaturated journalistic / bleach bypass], realistic motion, [duration structure: e.g. 0-3s establish | 3-5s push | 5-7s hold], no presenter-to-camera unless requested, no ad aesthetic, no hype montage, no exaggerated action.

Negative requirements: no visible subtitles, no on-screen text, no lower thirds, no logo stings, no fake watermark, no stock-commercial smiles, no hyper-saturated colors, no time-lapse unless requested, no heroic product-shot look, no dramatic whip pans, no morphing, no warping, no hallucinated text, no compositing artifacts, no random objects.
```

### Video Prompt Add-Ons
- For institutional spaces: `quiet administrative atmosphere`
- For crowded public context: `observational, non-performative behavior`
- For audio-synced shots: `match transitions to audio downbeat, sync motion to voice cadence`
- For character consistency: `same person, identical face and wardrobe as reference image`

---

## IMAGE-TO-VIDEO FORMULA

```
>>> VISUAL TECHNIQUE: [AI picks one from menu above] <<<
>>> NARRATIVE PURPOSE: [AI states why this technique explains this beat] <<<
Source image: [describe image in 5-10 words]. Preserve original composition, preserve palette, preserve focal subject, no new objects, no morphing, no jump cuts. [Camera move: slow push-in / subtle parallax / micro-zoom with breath / locked-off]. [Audio sync: match motion to audio downbeat / sync to voice cadence / none]. Duration matches audio or 5-7 seconds. Smooth motion, restrained movement, readable at rest.

Negative requirements: no scene rewrite, no sudden zoom, no hallucinated text, no logo invention, no camera shake, no dramatic rack focus unless explicitly requested, no morphing, no warping.
```

---

## FALLBACK DOCUMENT RECREATION FORMULA

```
Flat documentary document plate for [document type]. Clean paper texture, restrained institutional layout, realistic margins, visible structure without readable generated text, room for later composited headline or excerpt, credible but non-branded, one focal highlighted region, muted palette from the style bible.

Negative requirements: no fake publication logos, no lorem ipsum paragraphs, no readable body text, no exaggerated grunge, no glossy poster styling.
```

---

## PROMPT HARDENING CHECKLIST
Before accepting a generated asset, confirm:
1. The image or clip matches the archetype
2. The palette is controlled
3. The focal point is obvious
4. No text artifact appears unless intentionally added later
5. The result looks editorial/documentary, not cartoonish or ad-like
6. The frame still reads when paused

If one of these fails, refine the prompt with the smallest necessary adjustment.
