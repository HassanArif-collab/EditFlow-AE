# App Connection Protocol — For Any AI Agent

> This file teaches any AI agent (GLM, Claude, Mistral, etc.) how to connect to the Documentary Studio app.

## What this is

The Documentary Studio app runs on the user's Windows 11 PC. It has:
- A SQLite database with projects, scripts, research, scenes, sources, tasks, visual plans
- An AI co-pilot (Ollama local, or ZAI cloud in sandbox)
- A Visual Plans review tab where the user approves/feedbacks
- A prompts library (served via /api/prompts)

You (the AI agent in any chat) connect to it via a Cloudflare tunnel URL the user gives you.

## Repository Structure

```
Content-Prompts-for-AI/
├── prompts/                    ← Canonical prompts (GitHub source of truth)
│   ├── script-v5/
│   ├── visual-v7-glm/
│   └── ...
└── content-app/                ← The Documentary Studio app
    ├── src/                    ← App source
    ├── prompts/                ← Copy of canonical prompts (served via /api/prompts)
    └── ...
```

The app has its own copy of the prompts at `content-app/prompts/`. When you call `/api/prompts/<folder>/<file>`, the app reads from its local copy. You don't need to worry about the GitHub repo structure — just use the API.

## The connection checklist

1. User gives you a tunnel URL like `https://random-words.trycloudflare.com`
2. Test: `GET <URL>/api/tunnel/status` → should return `{"running": true, "url": "..."}`
3. Get project ID: `GET <URL>/api/projects` → pick the project, note its `id`
4. Fetch script: `GET <URL>/api/projects/<id>/script?version=my_draft` — or ask the user which source to use (`v2`, `d3`, `my_draft`); the default is the user's own live draft, see "Script source selection" below
5. Read prompt files: `GET <URL>/api/prompts/<folder>/<file>`
6. Push plan: `POST <URL>/api/projects/<id>/visual-plans`
7. User reviews in app, gives feedback
8. You update: `PATCH <URL>/api/visual-plans/<planId>`

## The golden rules

1. **Pick the script source first, then always fetch fresh** — the default source is the user's own live draft (`version=my_draft`); use exactly what they name ("use v2", "use my draft")
2. **Pass the SAME `?version=` to script, research and sources** — footnote `[N]` numbering is per-version; mixing sources breaks the mapping
3. **Manual mode** — you write copy-paste prompts for the user; they execute on the tool websites, the app auto-links dropped files
4. **Push max once per phase** — don't spam the app
5. **Wait for the user's feedback in chat** after pushing a plan for review
6. **Read prompt files via the API** — don't guess what they contain
7. **You never run tools or a browser** — you write prompts, the user pastes them, the app links the results

## Script source selection

Every project can hold several scripts. When you fetch the script — for planning, research grounding, or anything else — you must state which source you mean, via the `?version=` query param:

| Value | Meaning |
|---|---|
| `my_draft` | The user's private live draft (Write mode) — **the default source** |
| `dN` (e.g. `d2`) | A saved draft snapshot ("Save draft as version") |
| `vN` (e.g. `v2`) | An AI-generated script version |

**Default resolution (no `?version=` or omitted):** the user's own live draft when it has content → the newest draft snapshot (`dN`) → the newest AI version (`vN`). The endpoint never mixes versions and never returns empty.

- `GET /api/projects/<id>/script?version=v2` returns `{ version, kind, label, requested, sections }` — `sections` is the array to plan from; `version`/`label`/`kind` tell you exactly which source you got (`kind`: `live_draft` | `draft_snapshot` | `ai`). A 404 means that version holds no sections.
- `research` and `sources` accept the same `?version=`. A live draft owns no footnotes, so `version=my_draft` resolves research/sources against the same fallback chain (draft snapshot → AI version).
- **Record the source on every visual plan you create** — `version` field in the POST body (see shape below). The app shows it as a "Built from …" badge so the user can tell which script each plan was planned against.

## API endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/tunnel/status` | GET | Check if tunnel is running |
| `/api/projects` | GET | List all projects |
| `/api/projects/<id>` | GET | Get one project with all data |
| `/api/projects/<id>/script` | GET/POST/PUT/PATCH/DELETE | Script sections — GET takes `?version=` (default = live draft; see "Script source selection") |
| `/api/projects/<id>/research` | GET/POST | Get/add research notes (hierarchical tree) |
| `/api/projects/<id>/sources` | GET/POST | Get/add sources |
| `/api/projects/<id>/visual-plans` | GET/POST | List/create visual plans |
| `/api/visual-plans/<planId>` | GET/PATCH/DELETE | Read/update/delete a plan |
| `/api/ai/chat` | POST | Streaming chat with AI co-pilot |
| `/api/ai/settings` | GET/POST | AI provider settings (ZAI/Ollama) |
| `/api/prompts` | GET | List all prompt folders/files |
| `/api/prompts/<folder>/<file>` | GET | Read a specific prompt file |
| `/api/seed` | POST | Seed sample documentary data |

## Prompt folders available via API

When you call `/api/prompts`, you'll get:
- `script-v5` — Script Generation v5 (app-connected)
- `script-v4` — Script Generation v4 (original)
- `visual-v7-glm` — Visual Generation v7 for GLM (Remotion + app connection)
- `visual-v6-claude` — Visual Generation v6 for Claude (reference)
- `visual-v6-glm` — Visual Generation v6 for GLM (reference)

Read individual files: `GET /api/prompts/visual-v7-glm/Visuals%20Generation%20Prompt%20v7`

## Visual plan JSON shape

```json
{
  "title": "Visual plan — Act I",
  "status": "in_review",
  "version": "my_draft",
  "scriptSnapshot": "<exact script text>",
  "shotsJson": "[{...}]",
  "feedbackJson": "[]",
  "remotionCode": "",
  "remotionPreview": ""
}
```

`version` (`my_draft` | `dN` | `vN`) records which script source the plan was planned against — set it at creation, keep it on every PATCH.

## Status flow

```
draft → in_review → approved → rendered
                ↘ changes_requested → in_review (loop)
```

## Error handling

- If tunnel is down → tell user to restart it in the app
- If Ollama fails → tell user to check `ollama serve` is running
- If Prisma errors → tell user to run `bun run db:push`
- Never retry more than 3 times → ask user for help
