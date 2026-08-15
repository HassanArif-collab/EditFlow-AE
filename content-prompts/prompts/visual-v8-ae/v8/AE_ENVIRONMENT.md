# AE ENVIRONMENT BRIEF — read this before writing any After Effects code

Every fact below was **verified by running it in the target machine's After
Effects**, not read from documentation. Probed 2026-08-15.

## The machine

| Fact | Value |
|---|---|
| After Effects version | `25.6x101` |
| Expression selectors available | **yes** (`canAddProperty("ADBE Text Expressible Selector")` → true) |
| `comp.saveFrameToPng(time, file)` | **yes** |
| Scripting language | **ExtendScript (ES3)** |

## ES3 — the single biggest source of model errors

ExtendScript is a 1999-era JavaScript. These **do not exist** and will throw:

| Forbidden | Use instead |
|---|---|
| `let`, `const` | `var` |
| `() => {}` arrow functions | `function () {}` |
| `JSON.parse` / `JSON.stringify` | `eval("(" + str + ")")` / build strings by hand |
| `Number.toLocaleString()` | hand-roll separators (see below) |
| `Array.forEach/map/filter` | `for (var i = 0; ...)` |
| template `` `strings` `` | `"a" + b + "c"` |
| `String.trim()` | `str.replace(/^\s+|\s+$/g, "")` |

**Thousands separators**, since `toLocaleString` is unavailable:

```js
function groupDigits(n) {
    var s = String(Math.floor(Math.abs(n))), out = "";
    for (var i = 0; i < s.length; i++) {
        if (i > 0 && (s.length - i) % 3 === 0) out += ",";
        out += s.charAt(i);
    }
    return (n < 0 ? "-" : "") + out;
}
```

## Verified match names

Every one of these is used by code that **currently runs** in this AE:

| Match name | Used as |
|---|---|
| `ADBE Text Properties` | `layer.property("ADBE Text Properties")` |
| `ADBE Text Animators` | `.property("ADBE Text Animators")` |
| `ADBE Text Animator` | `animators.addProperty("ADBE Text Animator")` |
| `ADBE Text Animator Properties` | `anim.property("ADBE Text Animator Properties")` |
| `ADBE Text Opacity` | `.addProperty("ADBE Text Opacity")` — set 0 to hide |
| `ADBE Text Position 3D` | `.addProperty("ADBE Text Position 3D")` — `[x, y]` |
| `ADBE Text Scale 3D` | `.addProperty("ADBE Text Scale 3D")` — `[-60,-60]` = shrink |
| `ADBE Text Rotation` | `.addProperty("ADBE Text Rotation")` |
| `ADBE Text Selectors` | `anim.property("ADBE Text Selectors")` |
| `ADBE Text Expressible Selector` | `selectors.addProperty(...)` |
| `ADBE Text Expressible Amount` | `.expression = "..."` — **0 = no effect, 100 = fully applied** |
| `ADBE Text Range Type2` | Based On. **1 = Characters, 3 = Words** |
| `ADBE Root Vectors Group` | `shapeLayer.property("ADBE Root Vectors Group")` |
| `ADBE Vector Group` | `.addProperty("ADBE Vector Group")` |
| `ADBE Vectors Group` | `group.property("ADBE Vectors Group")` |
| `ADBE Vector Shape - Rect` | `.addProperty("ADBE Vector Shape - Rect")` |
| `ADBE Vector Rect Size` | `[width, height]` |
| `ADBE Vector Rect Position` | offset — set `[0, -h/2]` so Y-scale grows **up** from the baseline |
| `ADBE Vector Graphic - Fill` | `.addProperty("ADBE Vector Graphic - Fill")` |
| `ADBE Vector Fill Color` | `[r, g, b]` floats **0..1**, not 0-255 |

## Known failures — hard-won, do not repeat

1. **Set `inPoint` before `outPoint`**, or AE keeps the old duration and shifts the layer.
2. **`sourceRectAtTime(t, false)` must be called at a time when the layer is visible** — at `t=0` on a layer that starts later it returns zeros.
3. **`textIndex` starts at 1**, not 0. Guard `if (textIndex < 1) textIndex = 1;`.
4. **Markers are 1-indexed** and AE re-sorts them by time.
5. **Colours are 0..1 floats.** `[255,0,0]` is not red, it's out of range.
6. **An expression selector's Amount is inverted** from intuition: `100` means the animator is fully applied (so `ADBE Text Opacity = 0` → invisible), `0` means at rest.
7. **`saveFrameToPng` returns before the file is flushed** — re-stat the file a few times before deciding it failed.
8. Wrap every build in `app.beginUndoGroup(...)` / `app.endUndoGroup()`, and end the group in your `catch` too or AE stays stuck in the group.

## Working example — a shape that grows from its baseline

```js
var bar = comp.layers.addShape();
var g = bar.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group")
           .property("ADBE Vectors Group");
var rect = g.addProperty("ADBE Vector Shape - Rect");
rect.property("ADBE Vector Rect Size").setValue([120, 400]);
rect.property("ADBE Vector Rect Position").setValue([0, -200]);   // grow upward
var fill = g.addProperty("ADBE Vector Graphic - Fill");
fill.property("ADBE Vector Fill Color").setValue([0.72, 0.53, 0.04]);
bar.property("Position").setValue([960, 800]);
bar.property("Scale").expression =
    "var t=time-inPoint;if(t<=0){[100,0]}else if(t>=0.9){[100,100]}" +
    "else{var p=t/0.9;var e=1-Math.pow(2,-10*p);[100,e*100]}";
```

## Working example — letter-by-letter reveal

```js
var animators = layer.property("ADBE Text Properties").property("ADBE Text Animators");
var anim = animators.addProperty("ADBE Text Animator");
anim.property("ADBE Text Animator Properties")
    .addProperty("ADBE Text Opacity").setValue(0);
var sel = anim.property("ADBE Text Selectors")
              .addProperty("ADBE Text Expressible Selector");
sel.property("ADBE Text Range Type2").setValue(1);          // 1 = Characters
sel.property("ADBE Text Expressible Amount").expression =
    "var stag=0.05;var d=0.45;" +
    "var t0=thisLayer.inPoint+(textIndex-1)*stag;" +
    "var p=(time-t0)/d;if(p<0)p=0;if(p>1)p=1;" +
    "var e=1-Math.pow(1-p,3);var a=(1-e)*100;[a,a,a];";
```

## Expression helpers AE provides

`easeOut(t, tMin, tMax, v1, v2)`, `ease(...)`, `easeIn(...)`, `linear(...)`,
`time`, `inPoint`, `outPoint`, `thisLayer`, `textIndex`, `textTotal`,
`thisLayer.marker.key(i).time`.
