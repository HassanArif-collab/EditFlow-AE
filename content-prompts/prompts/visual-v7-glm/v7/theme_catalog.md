# Theme Catalog — v7.1
## One film = ONE theme. Chosen in Phase 1, locked in the Style Bible, obeyed by every shot.

The #1 amateur tell is theme drift — photoreal next to flat vector next to isometric.
The #2 is flat, single-layer 2D frames. This catalog fixes both: the Creative Direction
agent picks ONE theme by matching the film's emotional register, writes its THEME SUFFIX
into every generation prompt, and its MOTION DNA into every coded shot.

## HOW TO CHOOSE (Phase 1, mandatory)

Match the script's dominant register — not your taste:

| Script register | Theme |
|---|---|
| Policy/economy explainer, "why is X like this" | Paper-cutout collage |
| Scandal, money trail, institutions, evidence | Archival scrapbook |
| A SYSTEM with parts (grid, supply chain, city, flows) | Isometric 3D |
| Salary/price/stat comparisons, budget breakdowns | Neo-brutalist infographic |
| Geopolitics, borders, trade routes, migration | Map-driven (Harris) |
| Human stakes, mood, dread, empathy beats | Realistic-cinematic composite |
| Quote-heavy or number-punch narration | Kinetic typography |
| Friendly/human-centered, softer stories | Claymation-look |

Hybrid rule: ONE primary theme + at most ONE accent theme for a named act
(documented in the Style Bible with the reason), never per-shot mixing.

## THE 8 THEMES

Each theme = definition · suits · the techniques that SELL it · theme suffix (append to
every image/video prompt) · motion DNA (for coded shots).

### 1. PAPER-CUTOUT COLLAGE (Vox)
Photo cutouts arranged on flat-lay paper boards. Suits policy and economy explainers.
**Sell it:** cutout PNGs with 4-8px white stroke + torn-edge alpha; drop shadows 10-20px
offset at 20-30% opacity, ONE global angle; 3-5 parallax layers at 1.0/0.5/0.2x rates;
paper/halftone texture overlay + tape/pin props; elements land with ±2-4° rotation and a
`back.out(1.4)` settle.
**Suffix:** `hand-cut paper collage on textured craft-paper board, torn edges, white cutout borders, soft single-angle drop shadows, tactile documentary style`
**Motion DNA:** durations 0.4/0.7/1.1s · settle `back.out(1.4)` · stagger 60-90ms · cutouts drop IN, never fade.

### 2. ARCHIVAL SCRAPBOOK
Aged documents and stamps as evidence. Suits scandals, institutions, money trails.
**Sell it:** sepia paper textures; typewriter type; animated red circle/underline drawing
on in 300-500ms; photo corners + tape; STATIC dust texture (never animated); date-stamp
counters.
**Suffix:** `aged archival document aesthetic, sepia paper texture, typewriter labels, red editor markings, photo corners, 1970s dossier style`
**Motion DNA:** 0.3/0.6/1.0s · stroke draw-ons `power2.inOut` · camera pushes 1.10-1.35x `power2.out` · holds are STILL (drift ≤0.5%/s, zero flicker).

### 3. ISOMETRIC 3D
The world on a 30° axonometric grid. Suits systems: grids, supply chains, city economics.
**Sell it:** strict 2:1 projection; buildings/blocks extrude UP with `from:"center"`
stagger; one sun angle for every shadow; slow camera dolly across the grid; flat color +
subtle ambient occlusion. Build in three.js lane (`@remotion/three`) or layered SVG.
**Suffix:** `clean isometric 3D diorama, 30-degree axonometric grid, matte flat materials, single sun angle soft shadows, miniature model feel`
**Motion DNA:** extrudes 0.5-0.8s `power3.out` · dolly `power2.inOut` 2-4s · stagger `{amount: 0.4, from: "center"}`.

### 4. CLAYMATION-LOOK
Soft handmade 3D. Suits friendly, human-centered stories.
**Sell it:** matte clay materials with fingerprint/noise bump; squash-stretch scale
[1.2, 0.8] on impacts; stepped 12fps motion (`steps(12)` feel) for the handmade read;
warm three-point studio light.
**Suffix:** `handmade claymation diorama, soft plasticine texture with fingerprints, warm studio lighting, stop-motion charm`
**Motion DNA:** 0.4/0.8s stepped at 12fps · squash-stretch on every landing · gentle idle sway allowed ONLY on characters (never on text/charts).

### 5. KINETIC TYPOGRAPHY
Words ARE the visual. Suits quotes, stat punches, narration-driven beats.
**Sell it:** word-sync to VO; mass-based timing (big word 400ms `power4.out`, small words
fast); motion metaphors (the word "crash" drops with a bounce, "half" splits); ONE
typeface, 2 weights; max 5-7 words on screen; masked block reveals, never letter-opacity.
**Suffix (for texture plates):** `minimal editorial background, subtle paper grain, single accent color field`
**Motion DNA:** big 0.4s `power4.out` / small 0.15-0.25s `expo.out` · exits 60-70% of enters · 100-200ms stillness after each settle.

### 6. NEO-BRUTALIST INFOGRAPHIC
Flat blocks, raw data, loud honesty. Suits salary/GDP/price comparisons — HIS franchise.
**Sell it:** 2-4px solid borders + hard 4-8px offset shadows (ZERO blur); one electric
accent on a desaturated field; counters ticking `expo.out`; bar-by-bar builds with
50-80ms stagger; grid-snapped movement (no arcs).
**Suffix:** `bold neo-brutalist infographic, thick outlines, hard offset shadows, flat desaturated field with one electric accent, raw editorial honesty`
**Motion DNA:** 0.25/0.5/0.9s `expo.out` · zero rotation · snaps and holds · counters linear-then-`expo.out` landing.

### 7. REALISTIC-CINEMATIC COMPOSITE
AI-photoreal stills + restyled real footage treated as cinema. Suits geopolitics, dread,
human stakes.
**Sell it:** 2-4% Ken Burns push per still; depth-map 2.5D parallax; STATIC grain +
vignette + letterbox; ONE LUT/grade across all stills (style bible paragraph verbatim);
drifting haze particles only where light justifies them.
**Suffix:** `photorealistic editorial documentary photograph, 35mm, shallow depth of field, desaturated teal-orange grade, no posing, cinematic natural light`
**Motion DNA:** pushes 0.5-2%/s linear or `power1.inOut` · cuts on VO beats · NOTHING oscillates.

### 8. MAP-DRIVEN STORYTELLING (Harris)
The map is the set. Suits trade corridors, borders, regional economics, migration.
**Sell it:** satellite zoom camera paths (`power2.inOut`, 2-4s); route lines drawing via
stroke-dashoffset; track-matte wipes revealing highlighted region layers; labels pinned
with connector lines that draw on; constant slow drift + STATIC grain so the map never
reads as a screenshot; cast icons move along routes with intent.
**Suffix (for map plates):** `high-detail satellite terrain map, muted editorial palette, subtle paper texture overlay, documentary map-room aesthetic`
**Motion DNA:** zooms 2-4s `power2.inOut` · route draws sync to narration phrases · icon moves `power2.out` · drift ≤0.5%/s.

## MOTION DNA — THE SHARED CONTRACT (applies to EVERY theme)

Declare once in the Style Bible as a token object; every coded shot reads from it:

```ts
export const DNA = {
  durations: { fast: 0.3, base: 0.6, dramatic: 1.1 },     // per-theme values above
  ease: { in: 'power2.out', out: 'power2.in', move: 'power2.inOut', hero: 'power4.out' },
  settle: 'back.out(1.4)',            // or spring({ damping: 200 }) for premium-no-bounce
  stagger: { each: 0.07, max: 0.5 },  // total stagger NEVER exceeds 0.5s
  layers: { fg: 1.0, mid: 0.5, bg: 0.2 },  // every scene has all three
  dimNonHero: 0.5,                    // point attention by dimming, not by adding
  grain: { opacity: 0.04, static: true },  // ONE static overlay, never per-frame
}
```

## THE PREMIUM-MOTION CHECKLIST (QA gates every shot against this)

1. Nothing spatial moves linearly (linear only for counters/progress).
2. One signature ease + 3-duration palette per film — from DNA, never ad-hoc.
3. Every scene has fg/mid/bg layers moving at 1.0/0.5/0.2x. Single-layer frames fail QA.
4. Camera never fully static >4s (2-4% drift allowed) — and NEVER wobbles/oscillates.
5. One idea on screen; old element exits (60-70% of enter time) before the next lands.
6. Stagger anything plural: 50-100ms each, total <0.5s, `from:"center"` for hero moments.
7. Hero landings: anticipation (10-20% counter-move) + settle; then 100-200ms stillness.
8. Follow-through: shadows/labels/children trail parents by 50-150ms.
9. ONE global light: identical shadow angle and opacity across all scenes.
10. Texture always — but STATIC: grain/paper at 3-5%, frame-locked, never on text layers.
11. Type reveals via masks/blocks, ≤7 words visible; no letter-opacity fades.
12. Dim non-heroes to 40-60% (+2-4px blur) whenever pointing attention.
13. Exit is always subtler than entrance; never scale to 0 — exit at 0.95 + fade.
14. All values come from the DNA object — consistency is what reads as expensive.
