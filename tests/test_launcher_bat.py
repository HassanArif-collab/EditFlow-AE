"""EditFlow-AE.bat must survive being read by Windows PowerShell 5.1.

The launcher is a .bat with a PowerShell script appended after a marker;
the .bat extracts that tail to %TEMP% and runs it. Windows PowerShell 5.1's
`Get-Content` defaults to ANSI (CP1252), not UTF-8 — so a UTF-8 em-dash in
the source came out as `â€”`, and its third character is `"` (U+201D), which
PowerShell accepts as a STRING DELIMITER. One em-dash inside one
double-quoted string closed that string early and the whole script failed
to parse:

    Write-Warn "FFmpeg extract failed - transcription may not work."

Symptom was five unrelated-looking parse errors and a launcher that never
started the backend. It reproduced on two different PCs.

Two independent defences, one test each below. Either alone fixes it; both
means a future edit that loses one still boots.
"""

import shutil
import subprocess
from pathlib import Path

import pytest

BAT = Path(__file__).resolve().parents[1] / "EditFlow-AE.bat"
MARKER = "# PS_SCRIPT_START"


def test_the_launcher_is_pure_ascii():
    """Defence 1: no character that ANSI decoding can turn into a quote."""
    raw = BAT.read_bytes()
    bad = sorted({b for b in raw if b > 127})
    assert not bad, (
        f"EditFlow-AE.bat has non-ASCII bytes {bad}. PowerShell 5.1 reads this "
        f"file as CP1252, and characters like a UTF-8 em-dash decode to a "
        f"curly quote that PowerShell treats as a string delimiter — which "
        f"breaks the whole launcher. Use plain ASCII: - instead of an em-dash."
    )


def test_the_extractor_states_its_encoding():
    """Defence 2: read the file as UTF-8 rather than trusting the default."""
    text = BAT.read_text(encoding="utf-8", errors="replace")
    line = next(l for l in text.splitlines() if "Get-Content -LiteralPath '%~f0'" in l)
    assert "-Encoding UTF8" in line, (
        "The extractor must pass -Encoding UTF8. Windows PowerShell 5.1 "
        "defaults to ANSI and will mangle any non-ASCII character."
    )


def _extraction_command() -> tuple[str, Path]:
    """The launcher's own extraction line, with cmd's %VARS% filled in.

    Read from the .bat rather than retyped, so this test exercises whatever
    the launcher actually does today — not a copy that can drift out of sync
    and pass while the real thing is broken.
    """
    text = BAT.read_text(encoding="utf-8", errors="replace")
    line = next(l for l in text.splitlines()
                if l.startswith("powershell ") and "PS_SCRIPT_START" in l)
    cmd = line.split('-Command ', 1)[1].strip()
    cmd = cmd[1:-1] if cmd.startswith('"') and cmd.endswith('"') else cmd
    tmp = Path(subprocess.run(
        ["powershell", "-NoProfile", "-Command", "$env:TEMP"],
        capture_output=True, text=True).stdout.strip()) / "editflow_bat_parsecheck.ps1"
    return cmd.replace("%~f0", str(BAT)).replace("%PS1%", str(tmp)), tmp


@pytest.mark.skipif(shutil.which("powershell") is None,
                    reason="Windows PowerShell not available")
def test_the_extracted_script_actually_parses():
    """The real check: run the launcher's OWN extraction, then parse the result.

    Everything above is a proxy. This is what the user experiences — and it
    is the only test here that fails for the original bug via the original
    mechanism, so it is the one that must keep working.
    """
    extract, tmp = _extraction_command()
    tmp.unlink(missing_ok=True)
    subprocess.run(["powershell", "-NoProfile", "-Command", extract],
                   capture_output=True, text=True, timeout=180)
    assert tmp.exists(), "the launcher's extraction produced no script at all"

    check = (f"$errs = $null; [System.Management.Automation.Language.Parser]::ParseFile("
             f"'{tmp}', [ref]$null, [ref]$errs) | Out-Null; "
             "if ($errs.Count) { $errs | ForEach-Object { "
             "'line ' + $_.Extent.StartLineNumber + ': ' + $_.Message } } else { 'CLEAN' }")
    out = subprocess.run(["powershell", "-NoProfile", "-Command", check],
                         capture_output=True, text=True, timeout=180)
    tmp.unlink(missing_ok=True)
    assert "CLEAN" in out.stdout, (
        f"The launcher's PowerShell half does not parse:\n{out.stdout}{out.stderr}"
    )
