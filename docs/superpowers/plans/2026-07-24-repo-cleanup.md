# EditFlow-AE Repo Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Deletion plan: every task ends with the full gate (`node --test tests/*.test.js` + `python -m pytest tests/unit -q` + the panel loading in the browser rig). If a deletion breaks any of them, restore that file and record why in the commit — a "clean" repo that doesn't run is worse than a cluttered one.

**Goal:** Turn EditFlow-AE into what its name says — an After Effects captions tool — by removing the Premiere panel, the 49 MB of experiment videos, the backend and tests nothing in the AE panel reaches, and the installer clutter at the root.

**Architecture:** The AE panel calls exactly **9 REST endpoints + 1 WebSocket** (measured, listed below). Everything else in `backend/` exists for the Premiere product and can go. The cut is driven by that measured surface, not by guesswork: keep what the panel calls plus its transitive imports, delete the rest, and prove it with the existing test suites and a live panel load after each step.

**Tech Stack:** FastAPI backend, CEP panel (vanilla ES modules), ExtendScript ES3, node:test + pytest, git.

---

## Audit — what's actually in EditFlow-AE today

Measured 2026-07-24 on `main` @ `f571a3f`:

| Area | Size / count | Verdict |
|---|---|---|
| `experiments/` | **49 MB**, 6 `.mp4` files | Delete — Premiere-era cut experiments, nothing references them |
| `cep-panel/` | 44 files | Delete — the **Premiere** panel, in a repo named EditFlow-**AE** |
| `cep-panel-ae/` | 14 files | **Keep — this is the product** |
| `backend/` | 69 files, 17 routes | Keep ~8 routes; the rest serve Premiere |
| `tests/` | 52 files | Keep ~12; the rest test deleted code |
| `docs/adobe/` | 1.9 MB | **Keep** — the AE/CEP reference mirror the agent workflow depends on |
| Root scripts | 8 (`.bat`/`.ps1`/`.sh`) | Keep 1 (`EditFlow-AE.bat`); 5 are Premiere installers |
| Root docs | 5 `.md` | Move/trim — Premiere-era architecture notes |
| `.git` | **52 MB** | Only shrinks with a history rewrite (Phase 5, optional) |
| `data/` | untracked | Correct already — properly gitignored |

**The measured API surface** (`grep` over `cep-panel-ae/client/src/*.js`) — everything the AE panel calls:

```
/api/ping                          health check
/api/diag/log  (+ /log/tail)       error relay + agent log reads
/api/models/list                   Settings: LLM model list
/api/providers, /providers/set-active   Settings: provider config
/api/subtitles/transcribe-mixdown  THE feature
/api/subtitles/srt                 SRT export
/api/whisper/status, /whisper/set-model   model management
/api/chat/ws/{client_id}           WebSocket: transcription progress
/api/ae-bridge/*                   agent dev loop (dev-only)
```

**Keep-set routes:** `subtitles`, `whisper_admin`, `diag`, `models_routes`, `providers`, `ae_bridge`, + a new `ws.py` (Task 2.2).
**Delete-set routes:** `premiere`, `edit`, `external_plan`, `pipeline`, `preflight`, `review`, `script_extract`, `agent`, `media`, `chat`.

**Why keep providers/models** even though captions only use Whisper: the parked AI-effects feature (`feat/ai-effects`) needs the Ollama provider layer, and the panel's Settings UI already binds to it. Deleting it would mean ripping up working UI to re-add it next month.

## Decisions

- **Delete, don't archive.** Everything removed here still exists in the `EditFlowAI` repo and in this repo's git history. There is no reason to keep a copy in the working tree.
- **History rewrite is optional and last** (Phase 5). It's the only way to get the clone from 52 MB → ~3 MB, and it's *safe here specifically* because this repo is days old, has no collaborators, and no forks. It is still a force-push, so it gets its own phase and its own explicit go/no-go.
- **EditFlowAI is not restructured** (Phase 6). Its Premiere content belongs there. Only the now-duplicated AE work is addressed.

## File map

| Path | Action |
|---|---|
| `experiments/` | delete |
| `cep-panel/` | delete |
| `install-editflow.bat`, `get-editflow.bat`, `install_cep.sh`, `install_cep_junction.ps1`, `deploy_cep_admin.ps1` | delete (Premiere installers) |
| `install-editflow-ae.bat`, `start-editflow-ae.bat` | delete (superseded by `EditFlow-AE.bat`) |
| `EditFlow-AE.bat` | **keep at root** — the one double-click entry point |
| `ARCHITECTURE.md`, `PLATFORM.md`, `TESTING.md`, `QUICKSTART.md`, `textlayer.md` | delete or fold into `docs/` (Task 3.2) |
| `README.md` | **create** — what this repo is, how to run it |
| `backend/routes/{premiere,edit,external_plan,pipeline,preflight,review,script_extract,agent,media,chat}.py` | delete |
| `backend/routes/ws.py` | **create** — the WebSocket, extracted from `chat.py` |
| `backend/services/` (Premiere-only set, Task 2.3) | delete |
| `tests/test_mvp_*.py`, `tests/test_phase_b.py`, `tests/test_preflight.py`, `tests/test_sequence_phrase_service.py`, `tests/cep-bridge-regression.test.js`, Premiere `tests/unit/*` | delete |
| `tests/test_no_premiere.py` | **create** — guard rail (Task 4.1) |

---

## Phase 1 — Delete what plainly doesn't belong

### Task 1.1: Remove the experiment videos (49 MB of the 52 MB repo)

- [ ] **Step 1: Confirm nothing references them**

```bash
cd "G:/Tech/AI Orchestration System/AI Editing/EditFlow-AE"
grep -rn "experiments/" --include="*.py" --include="*.js" --include="*.jsx" --include="*.bat" . | grep -v "^./docs/"
```

Expected: no output. If anything prints, stop and report it — a script depends on them.

- [ ] **Step 2: Delete**

```bash
git rm -r --quiet experiments
```

- [ ] **Step 3: Add a guard so media never lands back in git**

Append to `.gitignore`:

```
# Sample/experiment media — keep source videos out of the repo
experiments/
*.mp4
*.mov
*.wav
!tests/fixtures/**/*.wav
```

- [ ] **Step 4: Verify the fixture WAV is still tracked** (the smoke comp needs it)

```bash
git check-ignore -v tests/fixtures/ae/caption-smoke.wav || echo "NOT IGNORED - correct"
```

Expected: `NOT IGNORED - correct`.

- [ ] **Step 5: Commit**

```bash
git add .gitignore && git commit -m "chore: drop 49MB of Premiere-era experiment videos"
```

### Task 1.2: Remove the Premiere panel

- [ ] **Step 1: Confirm the AE panel doesn't reach into it**

```bash
grep -rn "cep-panel/" cep-panel-ae backend run.py EditFlow-AE.bat | grep -v "cep-panel-ae"
```

Expected: no output.

- [ ] **Step 2: Check the backend's static mount** — `backend/main.py` mounts `/panel` from `cep-panel/client`. That mount must go too. Read the block starting at the `panel_dir = Path(__file__).parent.parent / "cep-panel" / "client"` line and delete the whole `if panel_dir.exists():` block including the `_NoCacheStatic` class **only if** the AE mount below it defines its own copy. If both mounts share one `_NoCacheStatic` class, keep the class and delete only the Premiere `app.mount("/panel", ...)` and its `panel_dir` assignment.

- [ ] **Step 3: Delete the panel**

```bash
git rm -r --quiet cep-panel
```

- [ ] **Step 4: Verify the backend still boots and the AE panel still loads**

```bash
EDITFLOW_AGENT_BRIDGE=1 python run.py --prod
```

Then in another shell:

```bash
curl -s http://127.0.0.1:8765/api/ping
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8765/panel-ae/cep-loader.html
```

Expected: ping returns JSON, loader returns `200`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: remove the Premiere panel — this repo is AE-only"
```

### Task 1.3: Remove the Premiere installers

- [ ] **Step 1: Delete the five Premiere-era scripts**

```bash
git rm --quiet install-editflow.bat get-editflow.bat install_cep.sh install_cep_junction.ps1 deploy_cep_admin.ps1
```

- [ ] **Step 2: Delete the two superseded AE scripts** (`EditFlow-AE.bat` does install + start in one)

```bash
git rm --quiet install-editflow-ae.bat start-editflow-ae.bat
```

- [ ] **Step 3: Verify `EditFlow-AE.bat` doesn't call any of them**

```bash
grep -niE "install-editflow|get-editflow|install_cep|deploy_cep|start-editflow" EditFlow-AE.bat
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git commit -q -m "chore: one installer at the root (EditFlow-AE.bat), delete the other seven scripts"
```

## Phase 2 — Trim the backend to the measured surface

### Task 2.1: Delete the Premiere-only routes (except chat.py — Task 2.2 first)

- [ ] **Step 1: Delete nine routes**

```bash
git rm --quiet backend/routes/premiere.py backend/routes/edit.py backend/routes/external_plan.py \
  backend/routes/pipeline.py backend/routes/preflight.py backend/routes/review.py \
  backend/routes/script_extract.py backend/routes/agent.py backend/routes/media.py
```

- [ ] **Step 2: Update `backend/main.py`** — the import line becomes:

```python
from .routes import diag, models_routes, providers, subtitles, whisper_admin, ws
```

and the registration block becomes:

```python
app.include_router(ws.router, prefix="/api")
app.include_router(models_routes.router, prefix="/api")
app.include_router(providers.router, prefix="/api")
app.include_router(whisper_admin.router, prefix="/api")
app.include_router(subtitles.router, prefix="/api")
app.include_router(diag.router, prefix="/api")
if _bridge_enabled():
    from .routes import ae_bridge
    app.include_router(ae_bridge.router, prefix="/api")
```

- [ ] **Step 3: Do NOT run yet** — `ws` doesn't exist until Task 2.2. Proceed straight there.

### Task 2.2: Extract the WebSocket from chat.py, then delete chat.py

The AE panel uses exactly one thing from `chat.py`: the `/chat/ws/{client_id}` WebSocket for transcription progress. `chat.py` also pulls in `chat_engine` → the whole agent stack. Extract the 20 lines that matter.

- [ ] **Step 1: Create `backend/routes/ws.py`**

```python
"""Progress WebSocket.

The panel opens /api/chat/ws/{client_id} and receives progress + agent-bridge
messages. Extracted from the old chat.py so the agent/chat stack could be
deleted; the PATH is unchanged so the panel needs no edit.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..utils.progress import manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["ws"])


@router.websocket("/ws/{client_id}")
async def websocket_progress(websocket: WebSocket, client_id: str):
    accepted_id = await manager.connect(websocket, client_id)
    if accepted_id is None:
        return
    try:
        while True:
            # The panel only listens; reads keep the socket open and let us
            # notice a disconnect.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(accepted_id)
    except Exception as exc:  # noqa: BLE001 — never let one socket kill the app
        logger.debug("ws %s closed: %s", accepted_id, exc)
        manager.disconnect(accepted_id)
```

- [ ] **Step 2: Delete chat.py**

```bash
git rm --quiet backend/routes/chat.py
```

- [ ] **Step 3: Boot and verify the socket**

```bash
EDITFLOW_AGENT_BRIDGE=1 python run.py --prod
```

Load `http://127.0.0.1:8765/panel-ae/cep-loader.html` in the browser rig, then check the console shows `[ws] Connected to backend` and:

```bash
curl -s http://127.0.0.1:8765/api/ae-bridge/health
```

Expected: `{"backend":true,"panel":true,...}` — `panel:true` proves the WebSocket works.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "refactor(backend): extract progress WebSocket, delete chat + 9 Premiere routes"
```

### Task 2.3: Delete now-orphaned services

- [ ] **Step 1: Find services nothing imports any more**

```bash
cd backend
for f in services/*.py services/**/*.py; do
  n=$(basename "$f" .py)
  [ "$n" = "__init__" ] && continue
  hits=$(grep -rl "import .*\b$n\b\|from .*\b$n\b" --include="*.py" . | grep -v "^./$f" | wc -l)
  [ "$hits" -eq 0 ] && echo "ORPHAN: $f"
done
```

- [ ] **Step 2: Delete each reported orphan, then re-run the scan** — deleting one orphan usually orphans its dependencies (e.g. removing `cut_planner` orphans `take_segmenter`). Repeat until the scan prints nothing. Expected orphans across the passes: `chat_engine`, `agent/` (whole package), `cut_planner`, `cutting_pipeline`, `take_segmenter`, `match_validator`, `plan_store`, `bin_resolver`, `script_matcher`, `script_extractor_service`, `sequence_phrase_service`, `external_plan`, `preflight`, `review_service`, `review_media`, `review_trace`, `scribe_service`, `gemini_transcript`, `embedding_service`.

- [ ] **Step 3: Keep these even if the scan flags them** — they are the caption pipeline: `whisper_service`, `subtitles/*`, `transcribe/*`, `provider_service`, `audio_prepare`, `media_fingerprint`, `dev_watch`.

- [ ] **Step 4: Full gate**

```bash
cd .. && python -m pytest tests/unit -q
```

Expected: failures ONLY in test files that test deleted services — those tests are removed in Task 2.4. Note which fail; do not "fix" them.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore(backend): delete services orphaned by the route removal"
```

### Task 2.4: Delete tests for deleted code

- [ ] **Step 1: Delete Premiere-era suites**

```bash
git rm --quiet tests/test_mvp_bin_resolver.py tests/test_mvp_cut_planner.py \
  tests/test_mvp_match_validator.py tests/test_mvp_plan_store.py \
  tests/test_mvp_script_matcher.py tests/test_mvp_take_segmenter.py \
  tests/test_phase_b.py tests/test_preflight.py tests/test_sequence_phrase_service.py \
  tests/cep-bridge-regression.test.js
git rm --quiet tests/unit/test_external_plan.py tests/unit/test_external_plan_routes.py \
  tests/unit/test_cut_proposer_helpers.py tests/unit/test_gemini_transcript.py \
  tests/unit/test_parse_beats.py tests/unit/test_plan_to_edl_ops.py \
  tests/unit/test_review_build.py tests/unit/test_review_scribe.py \
  tests/unit/test_review_srt.py tests/unit/test_review_suggest.py \
  tests/unit/test_review_tighten.py tests/unit/test_review_trace.py \
  tests/unit/test_review_words.py tests/unit/test_native_captions_integration.py \
  tests/unit/test_path_recovery.py
```

(`test_native_captions_integration.py` tests the **Premiere** native-captions path — the AE engine is covered by `tests/jsx-expressions.test.js`.)

- [ ] **Step 2: Full gate — this one must be clean**

```bash
node --test tests/caption-model.test.js tests/jsx-expressions.test.js
python -m pytest tests/unit -q
```

Expected: node `pass 81 / fail 0`; pytest all-pass (roughly 40 tests: subtitles, sanitizer, ae_bridge, logsink, fixtures, transcript sidecar).

- [ ] **Step 3: If a KEPT test fails**, it depends on something deleted in 2.3. Restore that one service file (`git checkout HEAD~1 -- backend/services/<name>.py`), note it in the commit as a real dependency, and re-run.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test: remove suites for the deleted Premiere code"
```

## Phase 3 — Make the root readable

### Task 3.1: Fold the remaining scripts into `scripts/`

- [ ] **Step 1:** After Phase 1 the only scripts left are `run.py` and `EditFlow-AE.bat`. Both belong at the root (one is the entry point users double-click, the other is how the backend starts). **No move needed** — this task exists to confirm that, not to create a folder for two files.

- [ ] **Step 2: Delete the stray root `__init__.py`** if `git ls-files __init__.py` shows it tracked and `grep -rn "^import __init__\|from __init__" .` is empty:

```bash
git rm --quiet __init__.py && git commit -q -m "chore: drop stray root __init__.py"
```

### Task 3.2: Deal with the root markdown

- [ ] **Step 1: Check each for AE relevance**

```bash
for f in ARCHITECTURE.md PLATFORM.md TESTING.md QUICKSTART.md textlayer.md; do
  echo "=== $f"; grep -ciE "premiere|ppro|sequence" "$f"; done
```

- [ ] **Step 2:** Any file whose Premiere hit-count is non-trivial describes the old product — delete it:

```bash
git rm --quiet ARCHITECTURE.md PLATFORM.md QUICKSTART.md textlayer.md
```

`textlayer.md` is AE research notes — if `grep -c "premiere" textlayer.md` is 0, instead move it: `git mv textlayer.md docs/textlayer-notes.md`.

- [ ] **Step 3: Keep `TESTING.md` only if it still describes commands that exist**; otherwise delete it (the runbook + workflow doc cover verification now).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "docs: remove Premiere-era root docs"
```

### Task 3.3: Write the README that should have been there

**Files:** Create `README.md`.

- [ ] **Step 1: Write it**

```markdown
# EditFlow AE

Animated word-by-word captions for Adobe After Effects, generated from your
audio — native AE text layers and shape layers, no MOGRTs, fully editable
after generation.

## Install / run

Double-click **`EditFlow-AE.bat`**. First run sets everything up (Python,
dependencies, the CEP panel link); every run after that just starts the
backend. Keep the window open, then in After Effects:
**Window → Extensions → EditFlow AI**.

Requires After Effects 2022 or newer. The first transcription downloads a
Whisper model (~3 GB) via the panel's Settings.

## What's in here

| Path | What it is |
|---|---|
| `cep-panel-ae/` | The After Effects panel (UI + ExtendScript engine) |
| `backend/` | FastAPI service: transcription, SRT export, model management |
| `docs/adobe/` | Official AE scripting/expression/CEP reference (local mirror) |
| `docs/ae-captions-runbook.md` | In-AE verification checklist |
| `docs/ae-agent-workflow.md` | How an AI agent tests changes against a live AE |
| `tests/` | `node --test tests/*.test.js` and `pytest tests/unit` |

## Development

```bash
node --test tests/caption-model.test.js tests/jsx-expressions.test.js
python -m pytest tests/unit -q
```

With `EDITFLOW_AGENT_BRIDGE=1`, the backend exposes `/api/ae-bridge/*` so an
agent can run ExtendScript in a live AE, dump layers, and render frames —
see `docs/ae-agent-workflow.md`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md && git commit -m "docs: add a README describing what this repo actually is"
```

## Phase 4 — Keep it clean

### Task 4.1: A guard rail that fails if Premiere code returns

**Files:** Create `tests/test_no_premiere.py`.

- [ ] **Step 1: Write the test**

```python
"""This repo is AE-only. These tests fail if Premiere code creeps back in —
the last split left 44 Premiere panel files and 9 Premiere routes sitting in
an AE-named repo for weeks before anyone noticed."""
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# Deliberate exceptions: the Adobe docs mirror documents both hosts, and
# planning docs discuss the split itself.
EXEMPT_DIRS = {"docs", ".git", "data", "node_modules", "__pycache__", ".venv"}


def _source_files():
    for p in REPO.rglob("*"):
        if not p.is_file() or p.suffix not in {".py", ".js", ".jsx"}:
            continue
        if EXEMPT_DIRS & set(p.relative_to(REPO).parts):
            continue
        yield p


def test_no_premiere_panel_directory():
    assert not (REPO / "cep-panel").exists(), "the Premiere panel is back in an AE repo"


def test_no_experiment_media():
    big = [p for p in REPO.rglob("*.mp4") if ".git" not in p.parts]
    assert not big, f"video files committed: {big}"


def test_no_premiere_imports_in_backend():
    offenders = []
    for p in _source_files():
        text = p.read_text(encoding="utf-8", errors="ignore").lower()
        if "premiere" in text or "ppro" in text:
            offenders.append(str(p.relative_to(REPO)))
    assert not offenders, f"Premiere references outside docs/: {offenders}"
```

- [ ] **Step 2: Run it**

```bash
python -m pytest tests/test_no_premiere.py -v
```

Expected: 3 passed. If `test_no_premiere_imports_in_backend` fails, the listed files are leftovers from Phase 2 — clean them or add a narrowly-scoped exemption with a comment saying why.

- [ ] **Step 3: Commit**

```bash
git add tests/test_no_premiere.py && git commit -m "test: guard against Premiere code returning to the AE repo"
```

## Phase 5 — Shrink the clone (optional, force-push)

**Stop and get an explicit go-ahead before this phase.** Everything above is a normal commit history. This rewrites it.

Deleting the videos in Phase 1 removes them from the *working tree*, but they stay in history, so `git clone` still transfers 52 MB forever. A fresh root commit fixes that permanently.

**Safe here because:** the repo is days old, has one contributor, no forks, no open PRs. **Not safe** if anyone else has cloned it.

### Task 5.1: Rewrite to a single clean root commit

- [ ] **Step 1: Back up first — non-negotiable**

```bash
cd "G:/Tech/AI Orchestration System/AI Editing"
cp -r EditFlow-AE EditFlow-AE.backup
```

- [ ] **Step 2: Squash `main` to one root commit**

```bash
cd EditFlow-AE
git checkout main
git checkout --orphan clean-main
git add -A
git commit -q -m "EditFlow AE — animated captions for After Effects

Word-by-word captions on native AE text layers: draggable word markers for
timing, width-aware grouping, caption box + platform safe zones, per-word
animation for every preset, agent bridge for automated in-AE verification.

History before this commit was the Premiere-era monorepo (52MB of experiment
videos and a second panel); it lives on in the EditFlowAI repo."
git branch -D main
git branch -m main
```

- [ ] **Step 3: Verify the tree is intact and small**

```bash
git count-objects -vH | grep size-pack
node --test tests/caption-model.test.js tests/jsx-expressions.test.js
python -m pytest tests/unit -q
```

Expected: `size-pack` a few MB (was 52 MB); all tests pass.

- [ ] **Step 4: Force-push**

```bash
git push --force origin main
```

- [ ] **Step 5: Re-cut the feature branch from the new main** — `feat/ai-effects` still points at the old history. Recreate it (its only content is one design note):

```bash
git checkout -b feat/ai-effects-new main
git checkout feat/ai-effects -- docs/ai-effects-idea.md 2>/dev/null || true
git add -A && git commit -q -m "docs: AI effects on-the-go — researched design note"
git branch -D feat/ai-effects && git branch -m feat/ai-effects
git push --force origin feat/ai-effects
git push origin --delete feat/captions-pro-polish   # already merged into main
```

- [ ] **Step 6: Verify from a clean clone, then delete the backup**

```bash
cd /tmp && git clone https://github.com/HassanArif-collab/EditFlow-AE.git verify-clone
cd verify-clone && du -sh .git && ls
```

Expected: `.git` a few MB, `cep-panel-ae/` present, no `experiments/` or `cep-panel/`. Only then remove `EditFlow-AE.backup`.

## Phase 6 — EditFlowAI: retire the duplicated AE branch

`EditFlowAI` keeps the Premiere product; its clutter is legitimate there. The one real problem is `feat/ae-animated-captions`: 182 files of AE work that now live in EditFlow-AE, on a branch 67 commits ahead of its own `main`.

### Task 6.1: Retire the branch

- [ ] **Step 1: Confirm EditFlow-AE has everything first**

```bash
cd "G:/Tech/AI Orchestration System/AI Editing"
diff <(cd EditFlowAI && git ls-tree -r --name-only feat/ae-animated-captions -- cep-panel-ae | sort) \
     <(cd EditFlow-AE && git ls-tree -r --name-only main -- cep-panel-ae | sort)
```

Expected: differences are only files this cleanup *improved* (safe-zones.js added, etc.), never files missing from EditFlow-AE.

- [ ] **Step 2: Tag it so nothing is lost, then delete the branch**

```bash
cd EditFlowAI
git tag archive/ae-captions-split feat/ae-animated-captions
git push origin archive/ae-captions-split
git checkout main
git branch -D feat/ae-animated-captions
git push origin --delete feat/ae-animated-captions
```

The tag keeps every commit reachable forever; the branch (and the "Create PR" bar nagging about 46,483 lines) goes away.

- [ ] **Step 3: Leave `EditFlowAI/main` untouched.** Restructuring the Premiere repo is a separate project with its own plan, and it isn't blocking anything.

---

## Self-review

- **Spec coverage:** ".bat files at root" → Tasks 1.3, 3.1; "Premiere code in the AE repo" → Tasks 1.2, 2.1–2.4, guarded by 4.1; "analyze both" → the audit table + Phase 6 for EditFlowAI; "clean and proper implementation" → Phase 3 (README, root) + Phase 5 (clone weight). ✓
- **Placeholders:** none — every deletion names exact paths, every code step carries the code, and the orphan scan is a runnable loop rather than "find dead code". ✓
- **Name consistency:** `ws.py` / `websocket_progress` / `/chat/ws/{client_id}` used identically in 2.1, 2.2; `test_no_premiere.py` helpers match their asserts. ✓
- **Ordering rationale:** cheap unambiguous deletions first (Phase 1) so the risky backend surgery (Phase 2) happens in a smaller repo; `ws.py` is created *before* `chat.py` is deleted so the panel never loses its socket; the guard rail lands after the cleanup it protects; the force-push is last and gated.
- **Risks:** (1) the orphan scan is grep-based and can flag a service that's only referenced dynamically — Step 2.4.3 is the recovery path; (2) Phase 5 is a force-push — backup + clean-clone verification bracket it; (3) `provider_service` looks orphaned from the captions path but Settings and the future AI-effects work need it, so it's explicitly on the keep list.
