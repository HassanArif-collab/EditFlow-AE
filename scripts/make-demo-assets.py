"""Generate the sample files the asset-based recipes need.

DOC_HIGHLIGHT, ASSET_REVEAL and PROOF_STACK all place real images, so without
files on disk they can only ever show magenta placeholders. These are plain
enough to be obviously synthetic and specific enough to prove the mechanics:
the capture is tall with a known highlighted line, the stack images are
numbered so cuts are countable, and the parallax layers have real depth.

    python scripts/make-demo-assets.py
"""
from __future__ import annotations

import pathlib

from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parents[1] / "samples" / "visuals"
SHOT = ROOT / "assets" / "demo"
CAPTURE = ROOT / "assets" / "_captures" / "demo-page"

INK = (26, 28, 34)
PAPER = (247, 245, 240)
ACCENT = (184, 134, 11)

# The line DOC_HIGHLIGHT is meant to land on. The brief repeats these numbers
# in sourceAnchor.rect — if they disagree, the highlight lands on the wrong
# paragraph, which is exactly the failure the dimension check exists to catch.
PAGE_W, PAGE_H = 1280, 3200
QUOTE_RECT = (96, 1580, 940, 84)      # x, y, w, h


def page() -> None:
    """A tall 'captured web page' with one quotable line."""
    img = Image.new("RGB", (PAGE_W, PAGE_H), PAPER)
    d = ImageDraw.Draw(img)

    d.rectangle([0, 0, PAGE_W, 120], fill=INK)
    d.text((96, 52), "THE DAILY LEDGER", fill=PAPER)

    d.rectangle([96, 190, 1000, 250], fill=(60, 64, 74))       # headline bar
    d.rectangle([96, 280, 700, 312], fill=(140, 146, 158))     # subhead

    y = 380
    row = 0
    while y < PAGE_H - 120:
        if QUOTE_RECT[1] <= y < QUOTE_RECT[1] + QUOTE_RECT[3] + 40:
            y = QUOTE_RECT[1] + QUOTE_RECT[3] + 60
            continue
        width = 1088 if row % 4 != 3 else 620          # ragged right edge
        d.rectangle([96, y, 96 + width, y + 22], fill=(176, 180, 190))
        y += 52
        row += 1

    # the cited line, visibly different so you can see the scroll land on it
    x, ry, w, h = QUOTE_RECT
    d.rectangle([x, ry, x + w, ry + h], fill=(214, 210, 200))
    d.rectangle([x, ry, x + 8, ry + h], fill=ACCENT)
    d.text((x + 28, ry + 32), "the take-home figure is Rs 8,484 a month", fill=INK)

    CAPTURE.mkdir(parents=True, exist_ok=True)
    img.save(CAPTURE / "fullpage.png")
    print(f"capture  {PAGE_W}x{PAGE_H}  rect={QUOTE_RECT}")


def evidence() -> None:
    """Numbered stills, so a cut rhythm is countable on screen."""
    shades = [(38, 44, 58), (58, 44, 38), (38, 58, 46), (52, 38, 58), (58, 54, 38)]
    for i, base in enumerate(shades, 1):
        img = Image.new("RGB", (1920, 1080), base)
        d = ImageDraw.Draw(img)
        for g in range(0, 1920, 160):
            d.line([(g, 0), (g, 1080)], fill=tuple(c + 10 for c in base))
        d.rectangle([760, 380, 1160, 700], fill=ACCENT if i % 2 else (222, 226, 232))
        d.text((900, 520), f"EVIDENCE {i}", fill=base)
        img.save(SHOT / f"evidence-{i}.png")
    print(f"evidence 5 stills")


def parallax() -> None:
    """Three layers with genuine depth: sky, hills, foreground."""
    SHOT.mkdir(parents=True, exist_ok=True)

    bg = Image.new("RGBA", (2400, 1350), (32, 40, 62, 255))
    d = ImageDraw.Draw(bg)
    for i in range(40):
        d.ellipse([120 + i * 55, 120 + (i % 7) * 30, 128 + i * 55, 128 + (i % 7) * 30],
                  fill=(220, 226, 240, 255))
    bg.save(SHOT / "layer-bg.png")

    mid = Image.new("RGBA", (2400, 1350), (0, 0, 0, 0))
    d = ImageDraw.Draw(mid)
    d.polygon([(0, 1000), (600, 620), (1200, 900), (1800, 560), (2400, 940),
               (2400, 1350), (0, 1350)], fill=(46, 58, 74, 255))
    mid.save(SHOT / "layer-mid.png")

    fg = Image.new("RGBA", (2400, 1350), (0, 0, 0, 0))
    d = ImageDraw.Draw(fg)
    d.polygon([(0, 1240), (500, 1120), (1100, 1280), (1700, 1100), (2400, 1240),
               (2400, 1350), (0, 1350)], fill=(18, 22, 30, 255))
    fg.save(SHOT / "layer-fg.png")
    print("parallax 3 layers (bg, mid, fg)")


def hero() -> None:
    """One still for a plain ASSET_REVEAL."""
    img = Image.new("RGB", (2400, 1350), (24, 28, 38))
    d = ImageDraw.Draw(img)
    for r in range(700, 0, -60):
        shade = 30 + (700 - r) // 12
        d.ellipse([1200 - r, 675 - r // 2, 1200 + r, 675 + r // 2],
                  outline=(shade, shade + 4, shade + 12), width=3)
    d.text((1090, 660), "B-ROLL STILL", fill=(220, 226, 236))
    img.save(SHOT / "hero-still.png")
    print("hero     1 still")


if __name__ == "__main__":
    SHOT.mkdir(parents=True, exist_ok=True)
    page()
    evidence()
    parallax()
    hero()
    print(f"\nvisuals root: {ROOT}")
