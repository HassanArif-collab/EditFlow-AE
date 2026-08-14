# Prompt Formulas v6

These formulas harden the generation prompts so they stay professional, documentary, and error-resistant. Use them as base formulas, then add only the minimum line-specific detail needed by the script.

---

## VISUAL TECHNIQUE MENU
The AI chooses ONE technique per shot based on what BEST explains the concept. The technique is the visual language, not decoration.

| Technique | Prompt Fragment | Use When |
|-----------|----------------|----------|
| `CINEMATIC_PHOTO` | `photorealistic 35mm documentary frame, natural lighting, shallow depth of field, cinematic color grade` | Real people, places, physical evidence, credibility anchors |
| `ISOMETRIC_SYSTEM` | `clean isometric 3D illustration, pastel palette, explanatory geometry, soft shadow, no perspective distortion` | Systems, processes, hidden layers, money flows, incentive chains |
| `PAPERCUT_LAYER` | `hand-crafted paper cutout style, layered shadow, textured paper grain, tactile depth, subtle stop-motion feel` | Fragility, layered history, policy erosion, human stories |
| `CLAY_FORCE` | `clay stop-motion aesthetic, soft organic forms, visible fingerprints or soft impressions, warm studio lighting` | Abstract forces made tangible, trade flows, corruption mechanisms |
| `FLAT_DIAGRAM` | `clean 2D flat vector illustration, editorial restraint, single accent color, generous negative space` | Diagrams, comparisons, institutional breakdowns, quick clarity |
| `DATA_PANEL` | `minimal data-driven infographic panel, tabular numbers, clean grid, muted UI aesthetic` | Statistics, charts, rankings, institutional metrics |
| `SKETCH_EVIDENCE` | `rough pencil or ink hand-drawn sketch, unfinished edge, white paper texture, evidence-under-examination feel` | Leaked docs, investigative beats, raw evidence, uncertainty |
| `SOFT_FUTURE` | `soft 3D rendered scene, gentle subsurface scattering, calm studio lighting, subtle material contrast` | Future scenarios, hypotheticals, "what if" visualizations |
| `WATERCOLOR_MEMORY` | `soft watercolor paint style, bleeding edges, paper grain texture, emotional bleed, muted palette` | Memory, grief, moral weight, reflective emotional beats |
| `RETRO_ARCHIVE` | `1970s 16mm film stock, faded color, lifted blacks, fine film grain, slight vignette` | Historical context, archival segments, generational comparison |

---

## NARRATIVE PURPOSE STATEMENT
Before every generation prompt, state: `Visual technique: [TECHNIQUE]. Narrative purpose: explains [concept] by [how the technique reveals it].`

Examples:
- `Visual technique: ISOMETRIC_SYSTEM. Narrative purpose: reveals the hidden layers of the money trail through transparent geometry.`
- `Visual technique: PAPERCUT_LAYER. Narrative purpose: symbolizes the fragility of the social safety net through layered paper.`
- `Visual technique: CLAY_FORCE. Narrative purpose: makes abstract trade flows tangible and graspable through organic forms.`
- `Visual technique: SKETCH_EVIDENCE. Narrative purpose: implies this evidence is under active examination by an investigator.`
- `Visual technique: RETRO_ARCHIVE. Narrative purpose: signals this is archival historical context from a different era.`

---

## Formula Use Rules
1. Start from the base formula.
2. Add only the minimum subject detail needed for that shot.
3. Keep the prompt semantically aligned with the archetype.
4. If output quality is wrong, adjust one variable at a time.
5. Do not overstuff prompts with every possible adjective.
6. **Always include VISUAL TECHNIQUE + NARRATIVE PURPOSE before the base formula.**

---

## IMAGE PROMPT FORMULA

```text
Visual technique: [TECHNIQUE]. Narrative purpose: [explains what by how].

[Archetype or visual role]. [Subject and narrative function in 6-12 words]. Editorial documentary illustration or diagrammatic still. Clean edges, restrained texture, readable silhouette, generous negative space, one dominant focal area, palette restricted to [BG_HEX] [TEXT_HEX] [ACCENT_HEX], muted journalistic tone, observational not playful, composition designed to read clearly at a paused frame, subtle paper or print texture if appropriate.

Negative requirements: no readable text, no watermark, no logo, no fake newspaper masthead, no photoreal stock-ad look, no glossy 3D render, no neon gradient, no oversaturated accent, no clutter, no crowd of unrelated objects, no meme styling, no hallucinated elements, no morphing when animated.
```

Use this for:
- metaphors
- emotional stills
- document recreation fallback plates
- restrained background texture plates

### Image Prompt Add-Ons
- For metaphors: add `physical metaphor for [idea] with one clear action`
- For emotional moments: add `quiet, restrained, documentary mood`
- For diagram plates: add `clean geometry, explanatory composition`
- For corruption, secrecy, pressure, or institutional decay themes: add `serious institutional atmosphere, not thriller poster`

### Visual Technique Guidance by Beat Type
| Beat Category | Preferred Technique | Why |
|--------------|-------------------|-----|
| Evidence / document | `SKETCH_EVIDENCE` or `CINEMATIC_PHOTO` | Credibility and investigatory feel |
| System / process explanation | `ISOMETRIC_SYSTEM` or `FLAT_DIAGRAM` | Clarity of hidden structure |
| Human cost / emotional weight | `WATERCOLOR_MEMORY` or `PAPERCUT_LAYER` | Tactile, emotional texture |
| Abstract force (corruption, trade, influence) | `CLAY_FORCE` or `ISOMETRIC_SYSTEM` | Makes the invisible visible |
| Future / hypothetical | `SOFT_FUTURE` or `FLAT_DIAGRAM` | Signals speculation clearly |
| History / archival | `RETRO_ARCHIVE` | Temporal distance, generational context |
| Data / ranking / comparison | `DATA_PANEL` | Quick numerical comprehension |

---

## VIDEO PROMPT FORMULA

```text
Visual technique: [TECHNIQUE]. Narrative purpose: [explains what by how].

[Shot type]. [Specific subject + one micro-action]. [Environment]. [Lighting in 4-8 words]. [Framing]. [Camera move: static / slow pan / slow dolly in / gentle push]. Documentary B-roll, observational, naturalistic, credible, restrained grade, realistic motion, 5-7 seconds, no presenter-to-camera unless requested, no ad aesthetic, no hype montage, no exaggerated action.

Negative requirements: no visible subtitles, no on-screen text, no lower thirds, no logo stings, no fake watermark, no stock-commercial smiles, no hyper-saturated colors, no time-lapse unless requested, no heroic product-shot look, no dramatic whip pans.
```

Use this for:
- `BROLL_VIDEO`
- environmental support
- restrained emotional cutaways

### Video Prompt Add-Ons
- For institutional spaces: `quiet administrative atmosphere`
- For crowded public context: `observational, non-performative behavior`
- For evidence or documents: `slow, careful movement that respects readability`

---

## IMAGE-TO-VIDEO FORMULA

```text
Visual technique: [TECHNIQUE]. Narrative purpose: [explains what by how].

Source image: [describe image in 5-10 words]. Preserve original composition, preserve palette, preserve focal subject, no new objects, no morphing, no jump cuts. Apply a slow documentary push, pan, or subtle parallax only. 5-7 seconds. Smooth motion, restrained movement, readable at rest, cinematic only in the sense of calm focus and credible depth.

Negative requirements: no scene rewrite, no sudden zoom, no hallucinated text, no logo invention, no camera shake, no dramatic rack focus unless explicitly requested.
```

Use this when:
- video generation fails
- an emotional still just needs breathing motion
- a document or screenshot needs a gentle push

---

## FALLBACK DOCUMENT RECREATION FORMULA

```text
Visual technique: FLAT_DIAGRAM. Narrative purpose: provides a credible, readable document plate for compositing.

Flat documentary document plate for [document type]. Clean paper texture, restrained institutional layout, realistic margins, visible structure without readable generated text, room for later composited headline or excerpt, credible but non-branded, one focal highlighted region, muted palette from the style bible.

Negative requirements: no fake publication logos, no lorem ipsum paragraphs, no readable body text, no exaggerated grunge, no glossy poster styling.
```

Use this only when a real source crop is unreadable or unavailable and the decision log explicitly permits fallback recreation.

---

## PROMPT HARDENING CHECKLIST
Before accepting a generated asset, confirm:
1. The image or clip matches the archetype
2. The palette is controlled
3. The focal point is obvious
4. No text artifact appears unless explicitly intended later by composition
5. The result looks editorial/documentary, not cartoonish or ad-like
6. The frame still reads when paused
7. The technique choice serves the narrative purpose (not decoration)
8. The technique is applied consistently across all assets for a given beat

If one of these fails, refine the prompt with the smallest necessary adjustment.
