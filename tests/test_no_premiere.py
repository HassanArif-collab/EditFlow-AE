"""This repo is AE-only. These tests fail if Premiere code or sample media
creeps back in.

Why they exist: the repo split copied the whole monorepo across, so a 44-file
Premiere panel and 49 MB of experiment videos sat in an AE-named repo for
weeks before anyone noticed. Cheap alarm, expensive silence.
"""
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# Exempt by design: the Adobe docs mirror documents both hosts, planning docs
# discuss the split itself, and .git holds the pre-split history.
EXEMPT_DIRS = {"docs", ".git", "data", "node_modules", "__pycache__", ".venv"}

# Exempt files: this test names Premiere by necessity; CSInterface.js is
# Adobe's own vendored library and lists every CEP host app.
EXEMPT_FILES = {"test_no_premiere.py", "CSInterface.js"}

# Word boundaries matter: a naive "ppro" substring also matches
# stopPropagation() and pytest.approx().
PREMIERE_RE = re.compile(r"\bpremiere\b|\bppro\b", re.IGNORECASE)


def _source_files():
    for path in REPO.rglob("*"):
        if not path.is_file() or path.suffix not in {".py", ".js", ".jsx"}:
            continue
        if EXEMPT_DIRS & set(path.relative_to(REPO).parts):
            continue
        if path.name in EXEMPT_FILES:
            continue
        yield path


def test_no_premiere_panel_directory():
    assert not (REPO / "cep-panel").exists(), "the Premiere panel is back in an AE repo"


def test_no_video_files_committed():
    videos = [
        p for p in REPO.rglob("*.mp4")
        if not EXEMPT_DIRS & set(p.relative_to(REPO).parts)
    ]
    assert not videos, f"video files in the repo: {[str(v) for v in videos]}"


def test_no_premiere_references_in_source():
    offenders = []
    for path in _source_files():
        text = path.read_text(encoding="utf-8", errors="ignore")
        if PREMIERE_RE.search(text):
            offenders.append(str(path.relative_to(REPO)))
    assert not offenders, f"Premiere references outside docs/: {offenders}"


def test_backend_only_serves_the_ae_panel():
    """The AE panel calls a known, small set of endpoints. If a route file
    reappears for a feature this product doesn't have, that's Premiere code
    coming back."""
    routes = {p.stem for p in (REPO / "backend" / "routes").glob("*.py")}
    allowed = {"__init__", "ae_bridge", "diag", "models_routes", "providers",
               "subtitles", "visuals", "whisper_admin", "ws"}
    unexpected = routes - allowed
    assert not unexpected, f"unexpected backend routes: {sorted(unexpected)}"
