> **App Connection Note (v7)**: This file is read by the AI agent via the Documentary Studio app's
> `/api/prompts/visual-v7-glm/technique_deck` endpoint. The agent fetches it when needed —
> you don't need to paste it in chat.

# Technique Deck — v7

One card per technique. The build agent **must** draw from this deck during the Creative Pass
(see `v7/agent_composition_build.md`) and **rotate techniques across adjacent shots** — never
two consecutive shots on the same trick unless they are an intentional continuous run.

Cards are vocabulary, not law: combine them, invent beyond them — but keep the craft params.
The deck grows one card at a time: every new technique video the user finds gets distilled
into ONE card here (never paste transcripts).

**Card format:** Feel / Use when / Mechanics / Params / Fails when / Atom (if coded in `./atoms`).

---

## Motion techniques

### CUT_THE_CURVE (seamless transition)
- **Feel:** continuity — two shots read as one unbroken camera move; the cut is invisible.
- **Use when:** the script links two ideas across a cut (cause→effect, zoom from context into detail, montage of related evidence).
- **Mechanics:** both shots share ONE continuous scale animation with strong easing (parent B to A's motion). Hard-cut at the point of **peak velocity** — the eye is too busy tracking motion to register the swap.
- **Params:** easeInOutQuart; cut at t≈0.5 of the curve; scale 1.0→1.6 typical. For box-style organic chop, posterize playback to 12 fps.
- **Fails when:** the two shots have unrelated composition (reads as a glitch), or the easing is gentle (no velocity to hide the cut in).
- **Atom:** `<CutTheCurve a={...} b={...} durationInFrames={n} posterize={12} />`

### PARALLAX_2_5D
- **Feel:** a still photograph feels filmed — quiet cinematic weight.
- **Use when:** a generated/archival still with clear fg/mid/bg depth; evidence shots; emotional holds.
- **Mechanics:** separate layers scale at different rates during a slow push, foreground fastest.
- **Params:** rates bg 0.5 / mid 1.0 / fg 1.5; zoom 1.10–1.35 for evidence, up to 1.6 for scenic; drive with a clamped eased progress over the full hold.
- **Fails when:** layers have visible cut edges; push too fast; applied to flat graphics with no depth cue.
- **Atom:** `<ParallaxPush progress={p} zoom={1.25}><PLayer rate={0.5}>bg</PLayer>…</ParallaxPush>`

### MASKED_KINETIC_TYPE
- **Feel:** words arrive with intent — editorial confidence instead of slide-deck fades.
- **Use when:** hero stats, quotes, alarming sub-stats, any Tier 2–3 text.
- **Mechanics:** overflow-hidden wrapper; text translates from 100% offset to 0 on a spring. Stagger multiple lines/letters; never fade whole blocks.
- **Params:** letter stagger 0.03–0.10s; springs from `SPRINGS` (doc/reveal/snap) matched to the beat's emotion.
- **Fails when:** everything on screen reveals at once; stagger slower than narration cadence (2–3 words/sec).
- **Atom:** `<MaskedReveal delay={f} from="bottom" motion="reveal">…</MaskedReveal>`

### LAYERED_SCENE
- **Feel:** one continuous world the narration moves through — the Vox "set".
- **Use when:** a run of 2–5 shots shares a location/topic; background can stay locked while elements enter/exit.
- **Mechanics:** background layer persists across the run; mid/fg elements animate INTO the frame (masked reveals, slides, scale-ins) on the narration beats. Cut only when the topic truly changes — then consider CUT_THE_CURVE.
- **Params:** one entrance per narration beat; entrances staggered 4–8 frames; background drift ≤ 0.5 rate.
- **Fails when:** the whole frame moves at once; background swaps every shot (kills the continuity the technique exists for).

### DOCUMENTARY_TEXTURE
- **Feel:** filmic, tactile, not "made in a browser".
- **Use when:** every composition — this is the base layer discipline.
- **Mechanics:** OKLCH base (never pure #000/#fff), ONE static frame-locked grain overlay; DOF blur 2–4px on non-hero text only. Flicker is BANNED (stability rules).
- **Params:** grain combined opacity 0.03–0.05, coarse, fixed seed, never over text.
- **Fails when:** grain visible as noise; grain regenerated per frame (boiling); blur on the hero element; texture used to hide weak hierarchy.
- **Atom:** `<Grain opacity={0.04} />` (static) + `INK` palette tokens.

### DUST_DISSOLVE
- **Feel:** impermanence, erasure — a fact, number, or name crumbles away.
- **Use when:** the narration says something vanished, was erased, deleted, or lost (funds disappear, records wiped, a name removed from history). It MEANS loss — never a neutral transition.
- **Mechanics:** per-letter fade + blur + slight upward drift while deterministic dust particles scatter from each letter; dissolve order follows deletion (`rtl`) or reading (`ltr`).
- **Params:** 12–16 particles/letter; overlapping letter stagger (~60%); total 1.2–2.0s; particles drift up-and-away 40–60px, fade with the letter.
- **Fails when:** used decoratively on neutral beats; text too small for particles to read.
- **Atom:** `<DustDissolve text="$4.2B" startAt={f} direction="rtl" />`

### LIQUID_POSTER_TYPE
- **Feel:** loud editorial confidence — the word IS the shot.
- **Use when:** chapter titles or one-word verdicts (GONE. DENIED.) that need raw energy — the louder sibling of `SECTION_TITLE_CARD`.
- **Mechanics:** giant condensed type fills the frame edge-to-edge; letters enter with an elastic squish (wide→tall) on snap springs; between words, hard palette swap (ink↔accent) instead of a crossfade.
- **Params:** fontSize 20–30vw, weight 900, tracking −0.04em, line-height 0.8; 2-frame letter stagger; ≤2 words per shot; ≤2 uses per film.
- **Fails when:** more than ~2 words; somber or grief beats; any body text nearby.
- **Atom:** `<PosterType word="GONE" color={INK.alarm} />` (true glyph morphing not included — needs SVG path interpolation; add only if a beat truly demands it)

---

## Look styles (set dressing for UI / diagram / interface shots)

Pick **one look per shot-run**, driven by the story's subject — not by novelty.
Documentary default is **MINIMAL_EDITORIAL**; louder looks only when the beat is *about*
tech, products, apps, or institutions with a strong visual identity.

### MINIMAL_EDITORIAL (default)
Lots of negative space, nothing extra on screen, type does the talking. Use for stats,
quotes, most charts. Fails when the line needs warmth or physicality.

### GLASSMORPHISM
Frosted translucent panels (`backdrop-filter: blur` + low-alpha fill + 1px light border).
Use for modern-tech/app subjects, layered data cards. Fails on paper/archival topics.

### LIQUID_GLASS
Glassmorphism plus depth and refraction — highlights and lensing like a water drop on the
interface. Use sparingly for premium product/tech hero moments. Fails when overused; it is
a hero treatment, not a body style.

### NEUBRUTALISM
Hard edges, bold flat colors, thick borders, hard offset shadows, zero softness. Use for
punchy comparisons, warnings, "the system is blunt" beats. Fails on somber/emotional beats.

### CLAYMORPHISM
Soft puffy 3D-toy shapes, big rounded corners, double inner/outer shadows. Use for
approachable explainers, consumer-app subjects. Fails on serious evidence or grief beats.

### SKEUOMORPHISM
Real-world textures — digital things look physical (paper, leather, metal, buttons that
press). Use when the metaphor IS a physical object (documents, ledgers, files, stamps).
Fails when texture competes with readability.

### EDITORIAL_POSTER
A magazine cover, not a slide: one giant expressive glyph or script word as the art
object; tiny utilitarian micro-captions scattered at the edges (codes, dates, labels —
they are texture, not content); ground is a grainy B&W photo or a solid ink field; an
image tile may sit inline INSIDE a headline. Use for chapter covers, mood beats between
evidence runs, closing cards. Fails when the captions must actually be read, or when
data accuracy is the point of the shot.

---

## Rotation rule
Across the film: no technique card may appear in two adjacent shots (except an intentional
LAYERED_SCENE run), and no look style may change mid-run. Track what the previous shot used.
