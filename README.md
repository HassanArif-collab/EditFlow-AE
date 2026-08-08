# EditFlow AE

Animated word-by-word captions for Adobe After Effects, generated from your
audio — native AE text and shape layers, no MOGRTs, fully editable after
generation.

## Install / run

Double-click **`EditFlow-AE.bat`**.

The first run sets everything up (Python, dependencies, the CEP panel link);
every run after that just starts the backend. Keep the black window open,
then in After Effects: **Window → Extensions → EditFlow AI**.

Requires After Effects 2022 or newer. The first transcription downloads a
Whisper model (~3 GB) from the panel's Settings.

## What it does

- **Transcribes** your comp's audio (WhisperX forced alignment, ~50 ms word
  accuracy) and groups the words into captions.
- **Generates** one AE text layer per caption with per-word animation driven
  by expression selectors — plus optional pill backgrounds behind chosen
  words.
- **Stays editable**: every word gets a timeline marker you can drag to
  retime it, and "Pull Timings from AE" reads your edits back so
  regenerating doesn't discard them.
- **Previews truthfully**: the panel canvas uses the same layout, easing and
  timing math the ExtendScript engine does.

## Layout

| Path | What it is |
|---|---|
| `cep-panel-ae/` | The After Effects panel — `client/` (UI) + `extendscript/` (the caption engine) |
| `backend/` | FastAPI service: transcription, SRT export, Whisper model management |
| `docs/adobe/` | Official AE scripting / expression / CEP reference (local mirror — grep here first) |
| `docs/ae-captions-runbook.md` | In-AE verification checklist |
| `docs/ae-agent-workflow.md` | How an AI agent tests changes against a live AE |
| `tests/` | Node tests for the caption model + generated expressions; pytest for the backend |

## Development

```bash
node --test tests/caption-model.test.js tests/jsx-expressions.test.js
python -m pytest tests -q
```

Start the backend with `EDITFLOW_AGENT_BRIDGE=1` and it also exposes
`/api/ae-bridge/*`, letting an agent run ExtendScript inside a live After
Effects, dump layer structure, and render frames to check its own work —
see `docs/ae-agent-workflow.md`.

The panel also runs in a plain browser at
`http://127.0.0.1:8765/panel-ae/cep-loader.html` (no AE required) — the
preview and all layout logic work there; only the Generate buttons need AE.
