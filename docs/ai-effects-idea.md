# AI Effects On-The-Go — design note (researched 2026-07-23)

Feature: describe an effect/animation in the panel ("make the title bounce
in with a glow"), and the tool generates + applies it to the comp.

## Model research (AA-Omniscience, Nov 2025 benchmark)

- MiniCPM5-1B has the LOWEST hallucination rate (~1%) but an Omniscience
  Index of -1: it earns the score by ABSTAINING on most questions. It is
  honest, not knowledgeable. Wrong tool as a docs knowledge source; right
  tool as a cheap verifier gate ("is this matchname in the retrieved doc
  text? yes/no/unknown").
  Sources: artificialanalysis.ai/evaluations/omniscience,
  artificialanalysis.ai/articles/minicpm5-1b-the-leading-1b-open-weights-model

## Architecture (composes what already exists)

1. RETRIEVAL (not a model): grep/BM25 over docs/adobe/ finds real
   matchnames + API deterministically. Retrieval cannot hallucinate.
2. CREATIVE MODEL (Ollama coder model, e.g. qwen2.5-coder, or cloud
   provider): writes the effect — constrained to compose the verified
   ef_* jsx building blocks + retrieved doc snippets, NOT freeform AE API
   from memory. Constrained vocabulary kills most hallucination up front.
3. OPTIONAL GATE: MiniCPM5-1B checks generated claims against retrieved
   text before code reaches AE (abstention posture is the right default).
4. VERIFY LOOP (the real anti-hallucination machinery, already built):
   /api/ae-bridge/eval runs the jsx in live AE -> ef_dumpLayers asserts
   structure -> /api/ae-bridge/frame renders proof -> errors feed back
   into a retry.

Existing pieces this composes: Ollama provider (backend), docs/adobe
mirror + INDEX.md, agent bridge + evidence tools, ef_* caption engine.

## v0 scope suggestion

A single "/effect <description>" panel command, limited to a curated
vocabulary of building blocks (text animators, position/scale/opacity
expressions, pills/shapes) with model-chosen parameters. Freeform jsx
generation only in v1, always through the bridge verify loop.

## Sequencing

Deliberately parked until captions are AE-verified and the first video
ships — this branch exists so the idea and its research don't evaporate.
