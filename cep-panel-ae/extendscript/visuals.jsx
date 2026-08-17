/**********************************************************************
 * visuals.jsx — EditFlow AE visual shot builder
 *
 * Builds Content Factory shots as native After Effects comps:
 *   STAT_COUNTER        a number counting up, with title and unit
 *   BAR_CHART           axis first, then bars rising from the baseline
 *   SECTION_TITLE_CARD  a headline animating letter by letter
 *
 * Loaded ALONGSIDE index.jsx, never merged into it: the `ef_vis_` prefix
 * keeps this entirely separate from the caption engine's `ef_` functions,
 * so a grep tells you instantly which system owns a line of code.
 *
 * Project layout it maintains:
 *   EF Visuals/
 *     shot_01/  ★ shot_01 v1, shot_01 v2 ...   (builds never overwrite)
 *     EF Visuals Master                        (active versions, end to end)
 *   EF Assets/                                 (imported once, reused)
 *
 * ExtendScript is ES3: var only, no let/const/arrow/JSON/toLocaleString.
 *********************************************************************/

var EF_VIS_ROOT = "EF Visuals";
var EF_VIS_ASSETS = "EF Assets";
var EF_VIS_MASTER = "EF Visuals Master";

/* ── small helpers ── */

function ef_vis_err(msg) { return "ERROR:" + String(msg); }

function ef_vis_isArray(v) { return Object.prototype.toString.call(v) === "[object Array]"; }

function ef_vis_json(v) {
    if (v === null || v === undefined) return "null";
    var t = typeof v;
    if (t === "number") return isFinite(v) ? String(v) : "null";
    if (t === "boolean") return v ? "true" : "false";
    if (t === "string") {
        var out = "", i, c;
        for (i = 0; i < v.length; i++) {
            c = v.charAt(i);
            if (c === '"') out += '\\"';
            else if (c === "\\") out += "\\\\";
            else if (c === "\n") out += "\\n";
            else if (c === "\r") out += "\\r";
            else if (c === "\t") out += "\\t";
            else if (v.charCodeAt(i) < 32) out += " ";
            else out += c;
        }
        return '"' + out + '"';
    }
    if (ef_vis_isArray(v)) {
        var parts = [];
        for (var j = 0; j < v.length; j++) parts.push(ef_vis_json(v[j]));
        return "[" + parts.join(",") + "]";
    }
    var props = [];
    for (var k in v) {
        if (v.hasOwnProperty(k) && typeof v[k] !== "function") {
            props.push(ef_vis_json(String(k)) + ":" + ef_vis_json(v[k]));
        }
    }
    return "{" + props.join(",") + "}";
}

/* Thousands separators. ES3 has no toLocaleString — this mirrors
   groupDigits() in shotlist-model.js so the panel preview and the rendered
   frame always agree. */
function ef_vis_groupDigits(n) {
    var neg = n < 0;
    var s = String(Math.floor(Math.abs(n)));
    var out = "";
    for (var i = 0; i < s.length; i++) {
        if (i > 0 && (s.length - i) % 3 === 0) out += ",";
        out += s.charAt(i);
    }
    return (neg ? "-" : "") + out;
}

function ef_vis_ensureFolder(name, parent) {
    var host = parent || app.project.rootFolder;
    for (var i = 1; i <= host.numItems; i++) {
        var it = host.item(i);
        if (it instanceof FolderItem && String(it.name) === String(name)) return it;
    }
    var f = app.project.items.addFolder(String(name));
    f.parentFolder = host;
    return f;
}

function ef_vis_ensureShotFolder(shotId) {
    return ef_vis_ensureFolder(String(shotId), ef_vis_ensureFolder(EF_VIS_ROOT, app.project.rootFolder));
}

/* Look WITHOUT creating. Every read path uses this: listing versions or
   building a master must not leave empty folders behind for shots that
   were never built. */
function ef_vis_findFolder(name, parent) {
    var host = parent || app.project.rootFolder;
    if (!host) return null;
    for (var i = 1; i <= host.numItems; i++) {
        var it = host.item(i);
        if (it instanceof FolderItem && String(it.name) === String(name)) return it;
    }
    return null;
}

function ef_vis_findShotFolder(shotId) {
    var root = ef_vis_findFolder(EF_VIS_ROOT, app.project.rootFolder);
    return root ? ef_vis_findFolder(String(shotId), root) : null;
}

/* ── versions ── */

function ef_vis_listVersions(shotId) {
    var folder = ef_vis_findShotFolder(shotId), names = [];
    if (!folder) return names;
    for (var i = 1; i <= folder.numItems; i++) {
        if (folder.item(i) instanceof CompItem) names.push(String(folder.item(i).name));
    }
    return names;
}

/* Mirrors nextVersionName() in shotlist-model.js. */
function ef_vis_nextVersionName(shotId, names) {
    var max = 0;
    for (var i = 0; i < names.length; i++) {
        var n = String(names[i]).replace(/^★ /, "");
        if (n.indexOf(shotId + " v") === 0) {
            var num = parseInt(n.substring((shotId + " v").length), 10);
            if (!isNaN(num) && num > max) max = num;
        }
    }
    return shotId + " v" + (max + 1);
}

/* Exactly one starred (active) version per shot; the master uses it. */
function ef_vis_setActiveVersion(shotId, versionName) {
    var folder = ef_vis_findShotFolder(shotId), found = false;
    if (!folder) return false;
    for (var i = 1; i <= folder.numItems; i++) {
        var it = folder.item(i);
        if (!(it instanceof CompItem)) continue;
        var plain = String(it.name).replace(/^★ /, "");
        if (plain === String(versionName)) { it.name = "★ " + plain; found = true; }
        else it.name = plain;
    }
    return found;
}

function ef_vis_activeVersionComp(shotId) {
    var folder = ef_vis_findShotFolder(shotId), first = null;
    if (!folder) return null;
    for (var i = 1; i <= folder.numItems; i++) {
        var it = folder.item(i);
        if (!(it instanceof CompItem)) continue;
        if (String(it.name).indexOf("★ ") === 0) return it;
        if (!first) first = it;
    }
    return first;
}

/* ── assets ── */

/* Resolve a file the brief named.
 *
 * Two bases, and they are not interchangeable:
 *   assets[]           <visualsRoot>/<spec.assetDir>/<name>
 *   sourceAnchor.image <visualsRoot>/<name>        (captures are shared)
 *
 * `rootRelative` picks the second. Joining a capture onto the shot folder
 * finds nothing and reads as a missing file rather than a path bug. */
function ef_vis_assetFile(fileName, cfg, spec, rootRelative) {
    if (!fileName) return null;
    var root = String(cfg.visualsRoot || "");
    if (!root) return null;
    var rel = rootRelative ? String(fileName)
                           : ef_vis_joinPath(String((spec && spec.assetDir) || ""), String(fileName));
    return new File(ef_vis_joinPath(root, rel));
}

function ef_vis_importAsset(fileName, cfg, spec, rootRelative) {
    if (!fileName) return null;
    var assets = ef_vis_ensureFolder(EF_VIS_ASSETS, app.project.rootFolder);
    for (var i = 1; i <= assets.numItems; i++) {
        if (String(assets.item(i).name) === String(fileName)) return assets.item(i);
    }
    try {
        var f = ef_vis_assetFile(fileName, cfg, spec, rootRelative);
        if (!f || !f.exists) return null;
        var item = app.project.importFile(new ImportOptions(f));
        item.parentFolder = assets;
        return item;
    } catch (e) { return null; }
}

/* Loud on purpose — impossible to miss in a review pass, unlike a black frame. */
function ef_vis_placeholderSolid(comp, fileName) {
    var s = comp.layers.addSolid([1, 0, 1], "MISSING: " + String(fileName),
                                 comp.width, comp.height, 1);
    s.property("Opacity").setValue(30);
    return s;
}

/* ── text ── */

function ef_vis_styleText(layer, cfg, spec, sizePx, color) {
    var tp = layer.property("Source Text"), td = tp.value;
    td.resetCharStyle();
    td.fontSize = sizePx;
    var ps = (spec && spec.font) ? spec.font : cfg.fontPS;
    if (ps) { try { td.font = ps; } catch (e) {} }
    td.applyFill = true;
    td.fillColor = color || [1, 1, 1];
    td.applyStroke = false;
    td.justification = ParagraphJustification.CENTER_JUSTIFY;
    tp.setValue(td);
}

/* Long headlines shrink instead of running off frame (same idea as the
   caption engine's ef_fitToBox). */
function ef_vis_fitText(layer, comp, cfg, atTime) {
    try {
        var r = layer.sourceRectAtTime(atTime, false);
        var pct = (cfg.boxWidthPct != null) ? cfg.boxWidthPct : 90;
        var maxW = comp.width * pct / 100;
        if (r.width > maxW) {
            var s = maxW / r.width * 100;
            layer.property("Scale").setValue([s, s]);
            return s / 100;
        }
    } catch (e) {}
    return 1;
}

function ef_vis_centerAnchor(layer, comp, xFrac, yFrac, atTime) {
    try {
        var r = layer.sourceRectAtTime(atTime, false);
        layer.property("Anchor Point").setValue([r.left + r.width / 2, r.top + r.height / 2]);
    } catch (e) {}
    layer.property("Position").setValue([comp.width * xFrac, comp.height * yFrac]);
}

/* ── the style bible ─────────────────────────────────────────
   The theme lives in manifest.json at the visuals root, written by the
   Content Prompts side. Without it every recipe built in default colours
   while the generated stills around it followed the theme, so a finished
   film did not match its own images.

   Read here rather than handed down from the panel, so a code-writing agent
   can call ef_vis_styleBible() and reach the same source the recipes do.
   Hardcoded hexes in generated code drift the moment the theme changes.

   `colors` is null until the user has set three hexes. Half a palette is
   worse than none, so that case falls back to the built-in defaults
   entirely rather than theming some layers and not others. */

var EF_VIS_STYLE = null;        // last parsed bible
var EF_VIS_STYLE_ROOT = null;   // the root it came from; null = never looked

function ef_vis_hexToRgb(hex, fallback) {
    var m = /^#?([0-9a-fA-F]{6})$/.exec(String(hex || ""));
    if (!m) return fallback;
    var n = parseInt(m[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function ef_vis_styleBible(root) {
    var r = String(root || EF_VIS_STYLE_ROOT || "");
    if (EF_VIS_STYLE_ROOT === r) return EF_VIS_STYLE;   // cached, hit or miss
    EF_VIS_STYLE_ROOT = r;
    EF_VIS_STYLE = null;
    if (!r) return null;
    try {
        var f = new File(ef_vis_joinPath(r, "manifest.json"));
        if (!f.exists) return null;
        f.encoding = "UTF-8";
        f.open("r");
        var txt = f.read();
        f.close();
        var man = eval("(" + txt + ")");
        EF_VIS_STYLE = (man && man.styleBible) ? man.styleBible : null;
    } catch (e) { EF_VIS_STYLE = null; }
    return EF_VIS_STYLE;
}

/**
 * A themed colour, or the built-in default.
 *
 * A colour the SHOT names always wins — it is more specific than the film's
 * theme. That precedence is applied by the caller, which passes the shot's
 * value as `fallback` only when the shot actually set one.
 */
function ef_vis_styleColor(cfg, role, fallback) {
    var sb = ef_vis_styleBible(cfg && cfg.visualsRoot);
    if (!sb || !sb.colors) return fallback;
    return ef_vis_hexToRgb(sb.colors[role], fallback);
}

/* The builders use several quieter greys below full text colour. Mixing the
   themed ink toward the themed background keeps that hierarchy intact on a
   light theme, where a fixed grey would vanish. */
function ef_vis_styleInk(cfg, weight, fallback) {
    var ink = ef_vis_styleColor(cfg, "text", null);
    if (!ink) return fallback;
    var bg = ef_vis_styleColor(cfg, "bg", [0.04, 0.05, 0.08]);
    var w = (weight == null) ? 1 : weight;
    return [ink[0] * w + bg[0] * (1 - w),
            ink[1] * w + bg[1] * (1 - w),
            ink[2] * w + bg[2] * (1 - w)];
}

/* ── keyframes ───────────────────────────────────────────────
   Real keyframes, not expressions.

   An expression is invisible in the timeline and cannot be curve-edited —
   you cannot grab a handle in the graph editor and make the move feel
   different. Everything below writes actual keys with eased tangents, so
   every shot lands in your timeline as something you can take over by hand.

   Two things genuinely cannot be keys, and both are documented where they
   appear: a counting number needs one formatting expression driven by a
   keyframed slider, and per-letter timing uses a Range Selector whose
   Start/End are themselves keyframed. Both leave the TIMING on keys, which
   is the part an editor wants to touch. */

/* Named curves, so the feel is a choice rather than a constant buried in
   code. Influence is how far a bezier handle reaches across the segment:
   under about 30 the segment is mostly straight, over about 80 it stalls.

     smooth  a true S — eased hard at both ends. The default.
     settle  leaves with pace, arrives slowly. Good for a push that must
             feel like it started before the cut.
     soft    After Effects' own Easy Ease.
     snap    barely moves, then arrives fast and stops dead.

   `tail` is the handle on the outer edge of the whole move, where there is
   no neighbouring key to blend with. */
var EF_VIS_CURVES = {
    smooth: { "in": 70, out: 70, tail: 70 },
    settle: { "in": 85, out: 40, tail: 40 },
    soft:   { "in": 33, out: 33, tail: 33 },
    snap:   { "in": 92, out: 18, tail: 25 }
};

function ef_vis_curve(style) {
    var st = String(style || "smooth");
    // the old style names, kept so existing calls keep their meaning
    if (st === "out") st = "settle";
    if (st === "inout") st = "smooth";
    return EF_VIS_CURVES[st] || EF_VIS_CURVES.smooth;
}

function ef_vis_easeArr(n, influence) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(new KeyframeEase(0, influence));
    return out;
}

/**
 * Set keyframes and shape their curves.
 *
 * pairs: [[time, value], ...]
 * style: "out"    decelerate into the last key — the documentary default
 *        "inout"  ease both ends, for a move that starts and stops
 *        "hold"   step, no interpolation (a hard cut)
 *        "linear" untouched
 */
function ef_vis_kf(prop, pairs, style) {
    if (!prop || !pairs || !pairs.length) return prop;
    var i;
    for (i = 0; i < pairs.length; i++) prop.setValueAtTime(pairs[i][0], pairs[i][1]);

    var st = String(style || "smooth");
    if (st === "linear") return prop;

    var dims = 1;
    try { dims = (pairs[0][1] instanceof Array) ? pairs[0][1].length : 1; } catch (eD) {}

    for (i = 1; i <= prop.numKeys; i++) {
        if (st === "hold") {
            try {
                prop.setInterpolationTypeAtKey(i, KeyframeInterpolationType.HOLD,
                                                  KeyframeInterpolationType.HOLD);
            } catch (eH) {}
            continue;
        }
        var first = (i === 1), last = (i === prop.numKeys);
        var curve = ef_vis_curve(st);
        // The handles at the ENDS of the whole move are what shape the S. An
        // interior key gets both. Influence is the percentage of the segment
        // the handle reaches across — too little and the curve is a ramp with
        // a soft landing, which is what 20 was giving.
        var inInf = first ? curve.tail : curve.in;
        var outInf = last ? curve.tail : curve.out;
        try {
            prop.setInterpolationTypeAtKey(i, KeyframeInterpolationType.BEZIER,
                                              KeyframeInterpolationType.BEZIER);
            prop.setTemporalEaseAtKey(i, ef_vis_easeArr(dims, inInf), ef_vis_easeArr(dims, outInf));
        } catch (e1) {
            // some properties report a different dimensionality than their
            // value; one ease applied to all dimensions is the safe retry
            try {
                prop.setTemporalEaseAtKey(i, ef_vis_easeArr(1, inInf), ef_vis_easeArr(1, outInf));
            } catch (e2) {}
        }
    }
    return prop;
}

/** Fade a layer in, and optionally back out, with real keys. */
function ef_vis_kfFade(layer, at, dur, to, outAt, outDur) {
    var op = layer.property("Opacity");
    var pairs = [[at, 0], [at + (dur || 0.4), (to == null ? 100 : to)]];
    if (outAt != null) {
        pairs.push([outAt, (to == null ? 100 : to)]);
        pairs.push([outAt + (outDur || 0.35), 0]);
    }
    return ef_vis_kf(op, pairs, "out");
}

/* ── expression fragments ── */

/* A counter on REAL keyframes.
 *
 * A number cannot be keyframed as text without one key per displayed value —
 * ninety keys for a three-second count, unreadable in the timeline. So the
 * standard rig: a Slider Control carries the count and is keyframed and
 * curve-editable like anything else, and one short expression formats the
 * slider into text. The TIMING, which is what you would want to adjust, is
 * entirely on keys. Drag them, ease them, move them — the number follows.
 */
/* The one expression left in this file. It reads the keyframed slider and
   turns it into text with thousands separators — ES3 has no toLocaleString,
   and AE has no way to show a number without one. It carries no timing:
   every bit of that is on the slider's keys. */
function ef_vis_countFormatExpr(prefix, suffix) {
    return "var n=Math.round(effect(\"Count\")(\"Slider\"));" +
        "var s=String(Math.abs(n));var out='';" +
        "for(var i=0;i<s.length;i++){if(i>0&&(s.length-i)%3===0){out+=',';}out+=s.charAt(i);}" +
        "(n<0?'-':'')+" + ef_vis_json(String(prefix || "")) + "+out+" +
        ef_vis_json(String(suffix || "")) + ";";
}

function ef_vis_buildCounterRig(layer, comp, value, dur, prefix, suffix, startAt) {
    var fx = layer.property("ADBE Effect Parade");
    var slider = fx.addProperty("ADBE Slider Control");
    slider.name = "Count";
    var at = startAt || 0;
    ef_vis_kf(slider.property("ADBE Slider Control-0001"),
              [[at, 0], [at + Math.max(0.1, dur || 3), Math.round(Number(value) || 0)]], "out");

    layer.property("Source Text").expression = ef_vis_countFormatExpr(prefix, suffix);
    return slider;
}



/**
 * Per-letter animation on a RANGE SELECTOR whose Start/End are keyframed —
 * the rig an editor would build by hand, and the reason letters can be
 * retimed by dragging two keys instead of editing code.
 *
 * The animator holds the "off" state (opacity 0, offset position, blur).
 * The selector says which letters are currently in that state, and moving
 * its edge across the line is what makes them arrive or leave.
 *
 *   reveal, ltr   Start 0 -> 100   selection shrinks from the left, letters appear
 *   dissolve, ltr End   0 -> 100   selection grows from the left, letters leave
 *   dissolve, rtl Start 100 -> 0   selection grows from the right
 */
function ef_vis_addLetterAnimator(layer, name, matchName, value, timing) {
    var animators = layer.property("ADBE Text Properties").property("ADBE Text Animators");
    var anim = animators.addProperty("ADBE Text Animator");
    anim.name = name;
    var prop = anim.property("ADBE Text Animator Properties").addProperty(matchName);
    if (value !== null && value !== undefined) {
        try { prop.setValue(value); }
        catch (e1) { try { prop.setValue([value[0], value[1], 0]); } catch (e2) {} }
    }

    var sel = anim.property("ADBE Text Selectors").addProperty("ADBE Text Selector");
    try { sel.property("ADBE Text Range Type2").setValue(1); } catch (e3) {}   // 1 = Characters
    // a little softness at the edge so letters overlap instead of popping
    try { sel.property("ADBE Text Range Smoothness").setValue(timing.smooth == null ? 60 : timing.smooth); } catch (e4) {}

    var t0 = timing.at || 0, t1 = t0 + Math.max(0.1, timing.dur || 0.8);
    if (timing.edge === "end") {
        ef_vis_kf(sel.property("ADBE Text Percent End"), [[t0, 0], [t1, 100]], timing.style || "out");
    } else if (timing.from != null) {
        ef_vis_kf(sel.property("ADBE Text Percent Start"),
                  [[t0, timing.from], [t1, timing.to]], timing.style || "out");
    } else {
        ef_vis_kf(sel.property("ADBE Text Percent Start"), [[t0, 0], [t1, 100]], timing.style || "out");
    }
    return anim;
}

/* ── techniques ──────────────────────────────────────────────
   Shot-level motion, applied on top of whatever the recipe already does.
   Every expression here multiplies `value` rather than assuming 100: the
   recipes set Scale to fit or fill first, and an expression that hardcodes
   100 silently throws that away (learned the hard way from the counter's
   pulse, which un-did its own auto-fit). */





function ef_vis_applyDustDissolve(layer, comp, spec, startAt) {
    // 60% overlap between letters, 1.2–2.0s total, per the technique deck
    var text = String(spec.title || spec.value || "");
    var count = Math.max(1, text.length);
    var total = 1.6;                       // v7 band: 1.2-2.0s for the whole line
    var rtl = String(spec.dustDirection || "rtl") === "rtl";
    // rtl: the selection grows from the RIGHT, so the end of the number goes
    // first — deletion order. ltr: it grows from the left, reading order.
    var timing = rtl
        ? { at: startAt, dur: total, from: 100, to: 0, smooth: 45 }
        : { at: startAt, dur: total, edge: "end", smooth: 45 };

    ef_vis_addLetterAnimator(layer, "EF Dust Fade", "ADBE Text Opacity", 0, timing);
    ef_vis_addLetterAnimator(layer, "EF Dust Drift", "ADBE Text Position 3D",
        [0, -Math.round(comp.height * 0.045)], timing);
    // Blur is what sells "crumbling" rather than "sliding away"
    try {
        ef_vis_addLetterAnimator(layer, "EF Dust Blur", "ADBE Text Blur", [40, 40], timing);
    } catch (eB) {}
    // ponytail: no per-letter particle scatter — the deck asks for 12-16
    // particles per letter, which is a real particle system in ExtendScript.
    // Fade+blur+drift carries the read; add particles if it looks thin at 4K.
    return true;
}

/**
 * Apply spec.technique to a layer. Returns the technique actually applied,
 * or "" when the recipe/technique pair has no meaning — the caller reports
 * that as "not applied" rather than pretending.
 */
function ef_vis_applyTechnique(layer, comp, spec, opts) {
    var t = String(spec.technique || "NONE").toUpperCase();
    var o = opts || {};
    var dur = (o.dur != null) ? o.dur : comp.duration;
    var hold = (o.hold != null) ? o.hold : 0;
    var start = (o.start != null) ? o.start : 0;
    if (t === "NONE" || !t) return "";

    if (t === "PUSH_IN" || t === "KEN_BURNS" || t === "PARALLAX_2_5D") {
        if (!o.scalable) return "";
        var sp = layer.property("Scale");
        var base = sp.value;                        // whatever fitLayer set
        var rate = (o.rate == null) ? 1 : o.rate;
        var z = 1 + ((o.zoom || 1.15) - 1) * rate;
        var end = [];
        for (var d = 0; d < base.length; d++) end.push(base[d] * z);
        ef_vis_kf(sp, [[start + hold, base], [start + hold + Math.max(0.1, dur), end]], "out");

        if (t === "KEN_BURNS") {
            // a drift of a few percent of frame reads as filmed, not sliding
            var pp = layer.property("Position");
            var p0 = pp.value;
            var dx = Math.round(comp.width * 0.03) * (o.panX == null ? 1 : o.panX);
            var dy = Math.round(comp.height * 0.02) * (o.panY == null ? -1 : o.panY);
            var p1 = [p0[0] + dx, p0[1] + dy];
            if (p0.length > 2) p1.push(p0[2]);
            ef_vis_kf(pp, [[start + hold, p0], [start + hold + Math.max(0.1, dur), p1]], "out");
        }
        return t;
    }

    if (t === "DUST_DISSOLVE") {
        if (!o.text) return "";
        ef_vis_applyDustDissolve(layer, comp, spec, (o.dustStart != null) ? o.dustStart : dur * 0.45);
        return t;
    }

    return "";   // DOC_SCROLL is intrinsic to DOC_HIGHLIGHT, never bolted on
}

/* ── background ── */

function ef_vis_addBackground(comp, spec, cfg, missing) {
    if (spec.bgSrc) {
        var item = ef_vis_importAsset(spec.bgSrc, cfg, spec, false);
        if (item) {
            var L = comp.layers.add(item);
            try {
                var sw = comp.width / L.source.width * 100;
                var sh = comp.height / L.source.height * 100;
                var s = Math.max(sw, sh);              // fill, never letterbox
                L.property("Scale").setValue([s, s]);
            } catch (eS) {}
            L.property("Opacity").setValue(55);
            L.moveToEnd();
            return L;
        }
        missing.push(String(spec.bgSrc));
        var ph = ef_vis_placeholderSolid(comp, spec.bgSrc);
        ph.moveToEnd();
        return ph;
    }
    var bg = comp.layers.addSolid(
        ef_vis_styleColor(cfg, "bg", cfg.bgColor || [0.04, 0.05, 0.08]),
        "BG", comp.width, comp.height, 1);
    bg.moveToEnd();
    return bg;
}

/* ── STAT_COUNTER ──────────────────────────────────────────
   v7 rules: count from 0; label enters with or before the number; unit
   lighter than the hero number; optional single restrained pulse. */
function ef_vis_buildStatCounter(comp, spec, cfg, missing) {
    ef_vis_addBackground(comp, spec, cfg, missing);

    var numSize = Math.round(comp.height * 0.16);
    var num = comp.layers.addText("0");
    num.name = "Value";
    ef_vis_styleText(num, cfg, spec, numSize, ef_vis_styleInk(cfg, 1, [1, 1, 1]));
    ef_vis_buildCounterRig(num, comp, spec.value, spec.countDur, spec.prefix, "", 0);
    // Measure the FINAL number, not the "0" it starts on. Sampling at 0.1s
    // sized the layer to one digit, so "Rs 8,484" then ran off the frame.
    var landed = Math.min(comp.duration - 0.01, (spec.countDur || 3) + 0.1);
    ef_vis_centerAnchor(num, comp, 0.5, 0.50, landed);
    ef_vis_fitText(num, comp, cfg, landed);

    if (spec.title) {
        var title = comp.layers.addText(String(spec.title));
        title.name = "Title";
        ef_vis_styleText(title, cfg, spec, Math.round(comp.height * 0.045), spec.accent);
        ef_vis_centerAnchor(title, comp, 0.5, 0.36, 0.1);
        ef_vis_fitText(title, comp, cfg, 0.1);
        // label arrives WITH the number, never after a long delay
        ef_vis_kfFade(title, 0, 0.4, 100);
    }

    if (spec.unit) {
        var unit = comp.layers.addText(String(spec.unit));
        unit.name = "Unit";
        ef_vis_styleText(unit, cfg, spec, Math.round(comp.height * 0.032), ef_vis_styleInk(cfg, 0.72, [0.75, 0.78, 0.82]));
        ef_vis_centerAnchor(unit, comp, 0.5, 0.62, 0.1);
        ef_vis_kfFade(unit, (spec.countDur || 3), 0.5, 70);
    }

    spec._techniqueApplied = ef_vis_applyTechnique(num, comp, spec, {
        text: true, dustStart: (spec.countDur || 3) + 0.4,
    });

    if (spec.pulse) {
        // ONE restrained pulse after the count lands — never a loop.
        // Multiplies `value` (the scale ef_vis_fitText just set) instead of
        // assuming 100: hardcoding it threw away the fit, so a long number
        // that had been shrunk to fit sprang back over the frame edge.
        var sc = num.property("Scale"), b = sc.value, pk = [];
        for (var q = 0; q < b.length; q++) pk.push(b[q] * 1.06);
        var pt = spec.countDur || 3;
        ef_vis_kf(sc, [[pt, b], [pt + 0.3, pk], [pt + 0.6, b]], "inout");
    }
    return 1;
}

/* ── BAR_CHART ─────────────────────────────────────────────
   v7 rules: axis first, bars rise from the baseline with restrained
   overshoot, values count up, labels after the data is readable, and the
   bar the script names carries the accent. */
function ef_vis_buildBarChart(comp, spec, cfg, missing) {
    ef_vis_addBackground(comp, spec, cfg, missing);

    var n = spec.bars.length;
    var plotW = comp.width * 0.72, plotH = comp.height * 0.46;
    var left = (comp.width - plotW) / 2, baseY = comp.height * 0.76;
    var slot = plotW / n, barW = Math.min(slot * 0.56, comp.width * 0.13);

    // axis first
    var axis = comp.layers.addShape();
    axis.name = "Axis";
    var ag = axis.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group")
                 .property("ADBE Vectors Group");
    var arect = ag.addProperty("ADBE Vector Shape - Rect");
    arect.property("ADBE Vector Rect Size").setValue([plotW, 3]);
    arect.property("ADBE Vector Rect Position").setValue([0, 0]);
    var afill = ag.addProperty("ADBE Vector Graphic - Fill");
    afill.property("ADBE Vector Fill Color").setValue(ef_vis_styleInk(cfg, 0.42, [0.45, 0.48, 0.55]));
    axis.property("Position").setValue([comp.width / 2, baseY]);
    ef_vis_kf(axis.property("Scale"), [[0, [0, 100]], [0.4, [100, 100]]], "out");

    for (var i = 0; i < n; i++) {
        var b = spec.bars[i];
        var h = Math.max(4, plotH * (b.value / spec.maxValue));
        var cx = left + slot * i + slot / 2;
        var delay = 0.35 + i * 0.12;

        var bar = comp.layers.addShape();
        bar.name = "Bar " + (i + 1) + (b.accent ? " (accent)" : "");
        var g = bar.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group")
                   .property("ADBE Vectors Group");
        var rect = g.addProperty("ADBE Vector Shape - Rect");
        rect.property("ADBE Vector Rect Size").setValue([barW, h]);
        // anchor the rect so scaling Y grows UP from the baseline
        rect.property("ADBE Vector Rect Position").setValue([0, -h / 2]);
        var fill = g.addProperty("ADBE Vector Graphic - Fill");
        fill.property("ADBE Vector Fill Color").setValue(
            b.accent ? spec.accent : [0.30, 0.34, 0.42]);
        bar.property("Position").setValue([cx, baseY]);
        // rise with a restrained overshoot, then settle
        // rise, overshoot a little, settle — three keys is what an editor
        // would draw, and each one can be dragged
        var gd = spec.growDur || 0.9;
        ef_vis_kf(bar.property("Scale"),
                  [[delay, [100, 0]], [delay + gd * 0.78, [100, 106]], [delay + gd, [100, 100]]],
                  "out");

        if (b.label) {
            var lab = comp.layers.addText(String(b.label));
            lab.name = "Label " + (i + 1);
            ef_vis_styleText(lab, cfg, spec, Math.round(comp.height * 0.028),
                             b.accent ? spec.accent : ef_vis_styleInk(cfg, 0.80, [0.8, 0.83, 0.88]));
            ef_vis_centerAnchor(lab, comp, cx / comp.width, (baseY + comp.height * 0.05) / comp.height, 0.1);
            // labels arrive AFTER the data is readable
            ef_vis_kfFade(lab, delay + (spec.growDur || 0.9), 0.35, 100);
        }

        var val = comp.layers.addText("0");
        val.name = "Value " + (i + 1);
        ef_vis_styleText(val, cfg, spec, Math.round(comp.height * 0.030),
                         b.accent ? [1, 1, 1] : ef_vis_styleInk(cfg, 0.72, [0.72, 0.75, 0.8]));
        ef_vis_buildCounterRig(val, comp, b.value, spec.growDur || 0.9, "", "", delay);
        var valY = (baseY - h - comp.height * 0.035) / comp.height;
        ef_vis_centerAnchor(val, comp, cx / comp.width, valY, 0.1);
        ef_vis_kf(val.property("Opacity"), [[delay, 0], [delay + 0.01, 100]], "hold");
    }

    if (spec.caption) {
        var cap = comp.layers.addText(String(spec.caption));
        cap.name = "Caption";
        ef_vis_styleText(cap, cfg, spec, Math.round(comp.height * 0.034), ef_vis_styleInk(cfg, 0.88, [0.85, 0.88, 0.92]));
        ef_vis_centerAnchor(cap, comp, 0.5, 0.16, 0.1);
        ef_vis_fitText(cap, comp, cfg, 0.1);
    }
    return 1;
}

/* ── SECTION_TITLE_CARD ────────────────────────────────────
   v7 rules: split into letters, staggered animation, never a block fade,
   one title + at most one supporting line. */
function ef_vis_buildTitleCard(comp, spec, cfg, missing) {
    ef_vis_addBackground(comp, spec, cfg, missing);

    var title = comp.layers.addText(String(spec.title));
    title.name = "Title";
    ef_vis_styleText(title, cfg, spec, Math.round(comp.height * 0.10), ef_vis_styleInk(cfg, 1, [1, 1, 1]));
    ef_vis_centerAnchor(title, comp, 0.5, 0.47, 0.1);
    ef_vis_fitText(title, comp, cfg, 0.1);

    // the whole line arrives over stagger x letters, which is what the v7
    // band is really describing once it is expressed as one move
    var revealDur = Math.max(0.5, (spec.stagger || 0.05) * String(spec.title).length + 0.45);
    var timing = { at: 0, dur: revealDur, smooth: 60 };
    ef_vis_addLetterAnimator(title, "EF Letter Fade", "ADBE Text Opacity", 0, timing);

    var v = spec.variant;
    if (v === "slide_up") {
        ef_vis_addLetterAnimator(title, "EF Letter Rise", "ADBE Text Position 3D",
                                 [0, Math.round(comp.height * 0.05)], timing);
    } else if (v === "slide_left") {
        ef_vis_addLetterAnimator(title, "EF Letter Slide", "ADBE Text Position 3D",
                                 [-Math.round(comp.width * 0.06), 0], timing);
    } else if (v === "scale_center") {
        ef_vis_addLetterAnimator(title, "EF Letter Scale", "ADBE Text Scale 3D",
                                 [-60, -60], timing);
    } else if (v === "fade_rotate") {
        var anim = ef_vis_addLetterAnimator(title, "EF Letter Rotate", "ADBE Text Rotation",
                                            null, timing);
        try {
            anim.property("ADBE Text Animator Properties")
                .property("ADBE Text Rotation").setValue(12);
        } catch (eR) {}
    }

    spec._techniqueApplied = ef_vis_applyTechnique(title, comp, spec, {
        text: true, dustStart: (spec.stagger || 0.05) * String(spec.title).length + 0.8,
    });

    if (spec.supporting) {
        var sub = comp.layers.addText(String(spec.supporting));
        sub.name = "Supporting";
        ef_vis_styleText(sub, cfg, spec, Math.round(comp.height * 0.035), spec.accent);
        ef_vis_centerAnchor(sub, comp, 0.5, 0.60, 0.1);
        ef_vis_fitText(sub, comp, cfg, 0.1);
        var after = (spec.stagger || 0.05) * String(spec.title).length + 0.25;
        ef_vis_kfFade(sub, after, 0.5, 100);
    }
    return 1;
}

/* ── the recipe table ───────────────────────────────────────
   One list, used both to dispatch a build and to answer "what can this
   install actually build?". A recipe is reported as built only when its
   builder function really exists in this file, so the published registry
   cannot promise something that would fail in AE. Adding a recipe means
   adding a builder and one row here — nowhere else. */

var EF_VIS_RECIPES = [
    { name: "STAT_COUNTER",       fn: "ef_vis_buildStatCounter" },
    { name: "BAR_CHART",          fn: "ef_vis_buildBarChart" },
    { name: "SECTION_TITLE_CARD", fn: "ef_vis_buildTitleCard" },
    { name: "LINE_GRAPH",         fn: "ef_vis_buildLineGraph" },
    { name: "COMPARISON_PANEL",   fn: "ef_vis_buildComparisonPanel" },
    { name: "DOC_HIGHLIGHT",      fn: "ef_vis_buildDocHighlight" },
    { name: "ASSET_REVEAL",       fn: "ef_vis_buildAssetReveal" },
    { name: "PROOF_STACK",        fn: "ef_vis_buildProofStack" },
    { name: "TEXT_ANNOTATION",    fn: "ef_vis_buildTextAnnotation" },
    { name: "PIE_CHART",          fn: "ef_vis_buildPieChart" },
    { name: "FLOW_DIAGRAM",       fn: "ef_vis_buildFlowDiagram" }
];

function ef_vis_builderFor(name) {
    var want = String(name || "").toUpperCase();
    for (var i = 0; i < EF_VIS_RECIPES.length; i++) {
        if (EF_VIS_RECIPES[i].name !== want) continue;
        var fn = null;
        try { fn = $.global[EF_VIS_RECIPES[i].fn]; } catch (e) { fn = null; }
        return (typeof fn === "function") ? fn : null;
    }
    return null;
}

function ef_vis_recipes() {
    try {
        var out = [];
        for (var i = 0; i < EF_VIS_RECIPES.length; i++) {
            out.push({
                name: EF_VIS_RECIPES[i].name,
                built: ef_vis_builderFor(EF_VIS_RECIPES[i].name) !== null
            });
        }
        return ef_vis_json({ recipes: out, aeVersion: String(app.version) });
    } catch (e) { return ef_vis_err("recipes: " + e.toString()); }
}

/* ── ASSET_REVEAL ──────────────────────────────────────────
   A finished image or clip, placed full frame. This is what carries the
   `generated` and `captured` routes: the panel does not make the picture,
   it places the one you made and gives it disciplined motion.

   With several assets and PARALLAX_2_5D it treats them as depth layers,
   back to front — bg 0.5, mid 1.0, fg 1.5, as the technique deck specifies. */
function ef_vis_buildAssetReveal(comp, spec, cfg, missing) {
    var names = spec.assets && spec.assets.length ? spec.assets : (spec.bgSrc ? [spec.bgSrc] : []);
    if (!names.length) {
        ef_vis_placeholderSolid(comp, "no asset named for " + spec.id);
        missing.push("(no asset named)");
        return 1;
    }

    var parallax = String(spec.technique || "").toUpperCase() === "PARALLAX_2_5D" && names.length > 1;
    var rates = [0.5, 1.0, 1.5];
    var placed = 0;

    // back to front: assets[0] is the backdrop, so it goes in last (bottom)
    for (var i = names.length - 1; i >= 0; i--) {
        var item = ef_vis_importAsset(names[i], cfg, spec, false);
        if (!item) {
            missing.push(String(names[i]));
            ef_vis_placeholderSolid(comp, names[i]).moveToEnd();
            continue;
        }
        var L = comp.layers.add(item);
        L.name = String(names[i]);
        ef_vis_fitLayer(L, comp, spec.fit || "fill");
        var rate = parallax ? rates[Math.min(i, rates.length - 1)] : 1;
        var got = ef_vis_applyTechnique(L, comp, spec, {
            scalable: true, zoom: spec.zoom || 1.15, hold: spec.hold || 0,
            dur: comp.duration - (spec.hold || 0), rate: rate,
        });
        if (got) spec._techniqueApplied = got;
        L.moveToEnd();
        placed++;
    }
    return placed;
}

/* ── PROOF_STACK ───────────────────────────────────────────
   v7's own grammar: the reveal is not one long shot, it is evidence landing
   back to back — document, number, quote — with the cut rhythm tightening
   into the last one. The same builder covers a fast montage of a dozen
   captured images, because the only real difference is the rhythm.

   Hard cuts, never crossfades. A dissolve between evidence reads as
   "these are vaguely related"; a cut reads as "and another, and another". */

/**
 * Slot durations for n images across `total` seconds.
 *
 * tightening: each cut shorter than the last, accelerating into the final
 *   image, which then holds — the shape of an argument landing.
 * even: a steady montage. Below ~0.13s an image cannot be read at all, so
 *   the slots are floored and the count is what gives way, not legibility.
 */
function ef_vis_stackSlots(n, total, rhythm, holdLast) {
    var out = [], i;
    if (n <= 0 || total <= 0) return out;
    var hold = Math.max(0, holdLast || 0);
    var mode = String(rhythm || "auto");
    if (mode === "auto") mode = (n <= 5) ? "tightening" : "even";

    if (n === 1) return [total];

    if (mode === "tightening") {
        // geometric shrink; solve the ratio so the slots fill the time left
        var body = Math.max(0.1, total - hold);
        var ratio = 0.72, weights = [], sum = 0;
        for (i = 0; i < n - 1; i++) { var w = Math.pow(ratio, i); weights.push(w); sum += w; }
        for (i = 0; i < n - 1; i++) out.push(body * weights[i] / sum);
        out.push(hold > 0 ? hold : body * weights[n - 2] / sum);
    } else {
        var each = total / n;
        for (i = 0; i < n; i++) out.push(each);
        if (hold > 0 && n > 1) {
            // borrow the hold from the others so the last image lands
            var take = Math.min(hold, each * (n - 1) * 0.5) / (n - 1);
            for (i = 0; i < n - 1; i++) out[i] -= take;
            out[n - 1] += take * (n - 1);
        }
    }

    // below this an image is a flicker, not evidence
    for (i = 0; i < out.length; i++) if (out[i] < 0.13) out[i] = 0.13;
    return out;
}

function ef_vis_buildProofStack(comp, spec, cfg, missing) {
    var names = spec.assets && spec.assets.length ? spec.assets : [];
    if (!names.length) {
        ef_vis_placeholderSolid(comp, "PROOF_STACK needs assets for " + spec.id);
        missing.push("(no assets named)");
        return 1;
    }

    var slots = ef_vis_stackSlots(names.length, comp.duration,
                                  spec.rhythm || "auto", spec.holdLast);
    var need = 0, k;
    for (k = 0; k < slots.length; k++) need += slots[k];
    if (need > comp.duration + 0.01) {
        // an image under ~0.13s cannot be read, so the count gives way, not
        // legibility — say which images will not make it rather than clip
        // them off the end in silence
        var fits = 0, acc = 0;
        for (k = 0; k < slots.length; k++) { acc += slots[k]; if (acc <= comp.duration) fits++; }
        missing.push("shot is " + comp.duration.toFixed(1) + "s but " + names.length +
                     " images need " + need.toFixed(1) + "s — only " + fits +
                     " will be seen; lengthen the shot or send fewer");
    }
    var t = 0, placed = 0, applied = "";

    for (var i = 0; i < names.length; i++) {
        var item = ef_vis_importAsset(names[i], cfg, spec, false);
        var L;
        if (!item) {
            missing.push(String(names[i]));
            L = ef_vis_placeholderSolid(comp, names[i]);
        } else {
            L = comp.layers.add(item);
            L.name = (i + 1) + ". " + String(names[i]);
            ef_vis_fitLayer(L, comp, spec.fit || "fill");
            placed++;
        }
        // hard cut: each image occupies its slot alone
        L.startTime = 0;
        L.inPoint = t;
        L.outPoint = Math.min(comp.duration, t + slots[i]);
        applied = ef_vis_applyTechnique(L, comp, spec, {
            scalable: true, zoom: spec.zoom || 1.06, dur: slots[i], start: t,
        }) || applied;
        t += slots[i];
    }
    spec._techniqueApplied = applied;
    return placed;
}

/* Scale a footage layer to the comp: fill crops, contain letterboxes. */
function ef_vis_fitLayer(L, comp, fit) {
    try {
        var sw = comp.width / L.source.width * 100;
        var sh = comp.height / L.source.height * 100;
        var s = (String(fit) === "contain") ? Math.min(sw, sh) : Math.max(sw, sh);
        L.property("Scale").setValue([s, s]);
        L.property("Position").setValue([comp.width / 2, comp.height / 2]);
    } catch (e) {}
}

/* ── DOC_HIGHLIGHT ─────────────────────────────────────────
   The captured page scrolls to the cited line and highlights it.

   `rect` is in PAGE coordinates and the PNG may have been captured at a
   different pixel density, so everything maps through image/page. If the
   file on disk is not the size the brief declared, the highlight would land
   on the wrong paragraph and read as a research error — so that is refused
   outright rather than built confidently wrong. */
function ef_vis_buildDocHighlight(comp, spec, cfg, missing) {
    var a = spec.sourceAnchor;
    if (!a || !a.image) return ef_vis_err("DOC_HIGHLIGHT needs sourceAnchor.image");

    // root-relative: captures are shared between every shot citing the page
    var item = ef_vis_importAsset(a.image, cfg, spec, true);
    if (!item) {
        missing.push(String(a.image));
        ef_vis_placeholderSolid(comp, a.image);
        return 1;
    }

    var realW = 0, realH = 0;
    try { realW = item.width; realH = item.height; } catch (eD) {}
    var wantW = a.imageWidth || a.pageWidth, wantH = a.imageHeight || a.pageHeight;
    if (realW && wantW && (realW !== wantW || realH !== wantH)) {
        return ef_vis_err("capture is " + realW + "x" + realH + " but the brief says " +
                          wantW + "x" + wantH + " — the highlight would land on the " +
                          "wrong line. Re-capture without resizing.");
    }

    var L = comp.layers.add(item);
    L.name = "Source page";

    // page space -> comp space: fit the page WIDTH, scroll vertically
    var scale = comp.width / (a.pageWidth || realW || comp.width);
    L.property("Scale").setValue([scale * 100, scale * 100]);

    // A layer is positioned by its ANCHOR, which defaults to the centre of the
    // source — not its top-left. Treating it as top-left scrolled the page
    // clean off the bottom of the frame, which only a rendered frame showed.
    var half = (realH * scale) / 2;
    var rectMidPage = (a.rect.y || 0) + (a.rect.h || 0) / 2;
    var startY = half;                                        // page top at frame top
    var restY = comp.height / 2 + half - rectMidPage * scale;  // cited line centred
    if (String(spec.technique || "").toUpperCase() === "DOC_SCROLL" ||
        !spec.technique || String(spec.technique).toUpperCase() === "NONE") {
        var travel = Math.max(0.5, comp.duration - (spec.holdAfter || 1.5));
        // two keys: page centred, then the cited line centred. Drag the
        // second one to change where the scroll settles.
        ef_vis_kf(L.property("Position"),
                  [[0, [comp.width / 2, startY]], [travel, [comp.width / 2, restY]]], "out");
    } else {
        L.property("Position").setValue([comp.width / 2, restY]);
        ef_vis_applyTechnique(L, comp, spec, { scalable: true, zoom: spec.zoom || 1.1 });
    }

    // the highlight itself, arriving once the scroll has landed
    var hl = comp.layers.addShape();
    hl.name = "Highlight";
    var g = hl.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group")
              .property("ADBE Vectors Group");
    var rect = g.addProperty("ADBE Vector Shape - Rect");
    var hw = Math.max(8, (a.rect.w || 0) * scale), hh = Math.max(8, (a.rect.h || 0) * scale);
    rect.property("ADBE Vector Rect Size").setValue([hw, hh]);
    var fill = g.addProperty("ADBE Vector Graphic - Fill");
    fill.property("ADBE Vector Fill Color").setValue(spec.accent || [0.95, 0.85, 0.2]);
    hl.property("Opacity").setValue(28);
    hl.blendingMode = BlendingMode.MULTIPLY;

    var hlX = ((a.rect.x || 0) + (a.rect.w || 0) / 2) * scale;
    var arrive = Math.max(0.3, comp.duration - (spec.holdAfter || 1.5));
    hl.property("Position").setValue([hlX, comp.height / 2]);
    // swipe on from the left, the way a marker is drawn
    ef_vis_kf(hl.property("Scale"),
              [[arrive, [0, 100]], [arrive + 0.45, [100, 100]]], "out");
    hl.property("Anchor Point").setValue([-hw / 2, 0]);
    hl.property("Position").setValue([hlX - hw / 2, comp.height / 2]);
    return 2;
}

/* ── LINE_GRAPH ────────────────────────────────────────────
   Something changing over time. Axis first, then the line draws on left to
   right with Trim Paths, then the point the script names is called out.
   Same discipline as the bar chart: the data is readable before any label
   arrives to explain it. */
function ef_vis_buildLineGraph(comp, spec, cfg, missing) {
    ef_vis_addBackground(comp, spec, cfg, missing);

    var pts = spec.points || [];
    var n = pts.length;
    if (n < 2) { ef_vis_placeholderSolid(comp, "LINE_GRAPH needs 2+ points"); return 1; }

    var plotW = comp.width * 0.72, plotH = comp.height * 0.42;
    var left = (comp.width - plotW) / 2, baseY = comp.height * 0.74;
    var maxV = 0, minV = 0, i;
    for (i = 0; i < n; i++) {
        var v = Number(pts[i].value) || 0;
        if (i === 0 || v > maxV) maxV = v;
        if (i === 0 || v < minV) minV = v;
    }
    if (minV > 0) minV = 0;                      // a value axis that lies is worse than a long one
    var span = (maxV - minV) || 1;

    // axis
    var axis = comp.layers.addShape();
    axis.name = "Axis";
    var ag = axis.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group")
                 .property("ADBE Vectors Group");
    var ar = ag.addProperty("ADBE Vector Shape - Rect");
    ar.property("ADBE Vector Rect Size").setValue([plotW, 3]);
    ar.property("ADBE Vector Rect Position").setValue([0, 0]);
    ag.addProperty("ADBE Vector Graphic - Fill")
      .property("ADBE Vector Fill Color").setValue(ef_vis_styleInk(cfg, 0.42, [0.45, 0.48, 0.55]));
    axis.property("Position").setValue([comp.width / 2, baseY]);
    ef_vis_kf(axis.property("Scale"), [[0, [0, 100]], [0.4, [100, 100]]], "out");

    // the line itself, as a path drawn on with Trim Paths
    var verts = [];
    for (i = 0; i < n; i++) {
        var x = left + (plotW * i / (n - 1)) - comp.width / 2;
        var y = baseY - (((Number(pts[i].value) || 0) - minV) / span) * plotH - comp.height / 2;
        verts.push([x, y]);
    }
    var line = comp.layers.addShape();
    line.name = "Line";
    var lg = line.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group")
                 .property("ADBE Vectors Group");
    var shape = new Shape();
    shape.vertices = verts;
    shape.closed = false;
    lg.addProperty("ADBE Vector Shape - Group")
      .property("ADBE Vector Shape").setValue(shape);
    var stroke = lg.addProperty("ADBE Vector Graphic - Stroke");
    stroke.property("ADBE Vector Stroke Color").setValue(spec.accent || [0.72, 0.53, 0.04]);
    stroke.property("ADBE Vector Stroke Width").setValue(Math.max(3, comp.height * 0.005));
    line.property("Position").setValue([comp.width / 2, comp.height / 2]);

    var trim = line.property("ADBE Root Vectors Group").addProperty("ADBE Vector Filter - Trim");
    var drawDur = Math.max(0.6, Math.min(2.4, comp.duration * 0.45));
    ef_vis_kf(trim.property("ADBE Vector Trim End"),
              [[0.35, 0], [0.35 + drawDur, 100]], "out");

    // the point the narration names
    var hi = Number(spec.highlightIndex);
    if (!isFinite(hi) || hi < 0 || hi >= n) hi = n - 1;
    var dot = comp.layers.addShape();
    dot.name = "Callout";
    var dg = dot.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group")
                .property("ADBE Vectors Group");
    var el = dg.addProperty("ADBE Vector Shape - Ellipse");
    var r = Math.max(8, comp.height * 0.012);
    el.property("ADBE Vector Ellipse Size").setValue([r * 2, r * 2]);
    dg.addProperty("ADBE Vector Graphic - Fill")
      .property("ADBE Vector Fill Color").setValue(spec.accent || [0.72, 0.53, 0.04]);
    dot.property("Position").setValue([verts[hi][0] + comp.width / 2, verts[hi][1] + comp.height / 2]);
    var dotAt = 0.35 + drawDur * (hi / (n - 1));
    ef_vis_kf(dot.property("Scale"),
              [[dotAt, [0, 0]], [dotAt + 0.26, [112, 112]], [dotAt + 0.42, [100, 100]]], "out");

    var val = comp.layers.addText(ef_vis_groupDigits(Number(pts[hi].value) || 0));
    val.name = "Callout value";
    ef_vis_styleText(val, cfg, spec, Math.round(comp.height * 0.038), ef_vis_styleInk(cfg, 1, [1, 1, 1]));
    ef_vis_centerAnchor(val, comp,
        (verts[hi][0] + comp.width / 2) / comp.width,
        (verts[hi][1] + comp.height / 2 - comp.height * 0.055) / comp.height, 0.1);
    ef_vis_kfFade(val, dotAt + 0.2, 0.35, 100);

    // labels last, once the shape of the data is already readable
    for (i = 0; i < n; i++) {
        if (!pts[i].label) continue;
        var lab = comp.layers.addText(String(pts[i].label));
        lab.name = "Label " + (i + 1);
        ef_vis_styleText(lab, cfg, spec, Math.round(comp.height * 0.026), ef_vis_styleInk(cfg, 0.78, [0.78, 0.81, 0.86]));
        ef_vis_centerAnchor(lab, comp,
            (verts[i][0] + comp.width / 2) / comp.width,
            (baseY + comp.height * 0.05) / comp.height, 0.1);
        ef_vis_kfFade(lab, 0.35 + drawDur + 0.1, 0.35, 100);
    }

    if (spec.caption) {
        var cap = comp.layers.addText(String(spec.caption));
        cap.name = "Caption";
        ef_vis_styleText(cap, cfg, spec, Math.round(comp.height * 0.034), ef_vis_styleInk(cfg, 0.88, [0.85, 0.88, 0.92]));
        ef_vis_centerAnchor(cap, comp, 0.5, 0.16, 0.1);
        ef_vis_fitText(cap, comp, cfg, 0.1);
    }
    return 1;
}

/* ── COMPARISON_PANEL ──────────────────────────────────────
   Two sides, the second arriving after the first so the gap between them
   is felt rather than just shown. "What you earn" then "what rent costs". */
function ef_vis_buildComparisonPanel(comp, spec, cfg, missing) {
    ef_vis_addBackground(comp, spec, cfg, missing);

    var sides = [spec.left || {}, spec.right || {}];
    var gap = 0.9;                                  // seconds before the second lands

    for (var i = 0; i < 2; i++) {
        var s = sides[i];
        var cx = (i === 0) ? 0.28 : 0.72;
        var at = i * gap;
        var accent = (i === 1) ? (spec.accent || [0.72, 0.53, 0.04]) : [0.62, 0.66, 0.72];

        if (s.title) {
            var t = comp.layers.addText(String(s.title));
            t.name = (i ? "Right" : "Left") + " title";
            ef_vis_styleText(t, cfg, spec, Math.round(comp.height * 0.040), accent);
            ef_vis_centerAnchor(t, comp, cx, 0.38, 0.1);
            ef_vis_fitText(t, comp, cfg, 0.1);
            ef_vis_kfFade(t, at, 0.4, 100);
        }

        var num = comp.layers.addText("0");
        num.name = (i ? "Right" : "Left") + " value";
        ef_vis_styleText(num, cfg, spec, Math.round(comp.height * 0.11),
                         (i === 1) ? [1, 1, 1] : ef_vis_styleInk(cfg, 0.84, [0.82, 0.85, 0.9]));
        var cd = Math.max(1.2, Math.min(2.4, comp.duration * 0.35));
        ef_vis_buildCounterRig(num, comp, Number(s.value) || 0, cd,
                               String(s.prefix || ""), "", at);
        var landed = Math.min(comp.duration - 0.01, at + cd + 0.1);
        ef_vis_centerAnchor(num, comp, cx, 0.52, landed);
        ef_vis_fitText(num, comp, cfg, landed);
        ef_vis_kf(num.property("Opacity"), [[at, 0], [at + 0.01, 100]], "hold");

        if (s.unit) {
            var u = comp.layers.addText(String(s.unit));
            u.name = (i ? "Right" : "Left") + " unit";
            ef_vis_styleText(u, cfg, spec, Math.round(comp.height * 0.028), ef_vis_styleInk(cfg, 0.72, [0.72, 0.75, 0.8]));
            ef_vis_centerAnchor(u, comp, cx, 0.63, 0.1);
            ef_vis_kfFade(u, at + cd * 0.8, 0.4, 70);
        }
    }

    // a divider, so the two sides read as a comparison and not two shots
    var rule = comp.layers.addShape();
    rule.name = "Divider";
    var rg = rule.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group")
                 .property("ADBE Vectors Group");
    var rr = rg.addProperty("ADBE Vector Shape - Rect");
    rr.property("ADBE Vector Rect Size").setValue([2, comp.height * 0.30]);
    rg.addProperty("ADBE Vector Graphic - Fill")
      .property("ADBE Vector Fill Color").setValue(ef_vis_styleInk(cfg, 0.34, [0.35, 0.38, 0.45]));
    rule.property("Position").setValue([comp.width / 2, comp.height * 0.50]);
    ef_vis_kf(rule.property("Scale"), [[0.3, [100, 0]], [0.8, [100, 100]]], "out");

    if (spec.caption) {
        var cap = comp.layers.addText(String(spec.caption));
        cap.name = "Caption";
        ef_vis_styleText(cap, cfg, spec, Math.round(comp.height * 0.034), ef_vis_styleInk(cfg, 0.88, [0.85, 0.88, 0.92]));
        ef_vis_centerAnchor(cap, comp, 0.5, 0.18, 0.1);
        ef_vis_fitText(cap, comp, cfg, 0.1);
    }
    return 1;
}

/* ── TEXT_ANNOTATION ───────────────────────────────────────
   A label over whatever is behind it. Third most used archetype in the real
   corpus, and the cheapest to get wrong: white text straight onto a photo is
   unreadable half the time, so the backing plate is on by default. */
function ef_vis_buildTextAnnotation(comp, spec, cfg, missing) {
    var hasAsset = (spec.assets && spec.assets.length) || spec.bgSrc;
    if (hasAsset) {
        var aName = (spec.assets && spec.assets.length) ? spec.assets[0] : spec.bgSrc;
        var item = ef_vis_importAsset(aName, cfg, spec, false);
        if (item) {
            var bgL = comp.layers.add(item);
            bgL.name = String(aName);
            ef_vis_fitLayer(bgL, comp, spec.fit || "fill");
            ef_vis_applyTechnique(bgL, comp, spec,
                { scalable: true, zoom: spec.zoom || 1.08, dur: comp.duration });
            bgL.moveToEnd();
        } else {
            missing.push(String(aName));
            ef_vis_placeholderSolid(comp, aName).moveToEnd();
        }
    } else {
        ef_vis_addBackground(comp, spec, cfg, missing);
    }

    var sizes = { small: 0.030, normal: 0.045, large: 0.070 };
    var px = Math.round(comp.height * (sizes[String(spec.size || "normal")] || sizes.normal));
    var spots = {
        lower_left:   [0.28, 0.80], lower_right:  [0.72, 0.80],
        upper_left:   [0.28, 0.18], upper_right:  [0.72, 0.18],
        center:       [0.50, 0.50], lower_center: [0.50, 0.82]
    };
    var at = spots[String(spec.place || "lower_left")] || spots.lower_left;

    var t = comp.layers.addText(String(spec.text || ""));
    t.name = "Label";
    ef_vis_styleText(t, cfg, spec, px, ef_vis_styleInk(cfg, 1, [1, 1, 1]));
    ef_vis_centerAnchor(t, comp, at[0], at[1], 0.1);
    ef_vis_fitText(t, comp, cfg, 0.1);

    var sub = null;
    if (spec.sub) {
        sub = comp.layers.addText(String(spec.sub));
        sub.name = "Sub";
        ef_vis_styleText(sub, cfg, spec, Math.round(px * 0.55), ef_vis_styleInk(cfg, 0.78, [0.78, 0.81, 0.86]));
        ef_vis_centerAnchor(sub, comp, at[0], at[1] + (px * 1.15) / comp.height, 0.1);
    }

    if (spec.boxed !== false) {
        // measured off the text, so the plate always fits what sits on it
        var r = { width: comp.width * 0.4, height: px * 1.6 };
        try { r = t.sourceRectAtTime(0.1, false); } catch (eR) {}
        var padX = px * 0.6, padY = px * 0.45;
        var pw = r.width + padX * 2;
        var ph = r.height + padY * 2 + (sub ? px * 0.9 : 0);
        var plate = comp.layers.addShape();
        plate.name = "Plate";
        var pg = plate.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group")
                      .property("ADBE Vectors Group");
        var prect = pg.addProperty("ADBE Vector Shape - Rect");
        prect.property("ADBE Vector Rect Size").setValue([pw, ph]);
        try { prect.property("ADBE Vector Rect Roundness").setValue(Math.round(px * 0.22)); } catch (eRo) {}
        pg.addProperty("ADBE Vector Graphic - Fill")
          .property("ADBE Vector Fill Color").setValue(ef_vis_styleColor(cfg, "bg", [0.04, 0.05, 0.08]));
        plate.property("Opacity").setValue(78);
        plate.property("Position").setValue(
            [comp.width * at[0], comp.height * at[1] + (sub ? px * 0.45 : 0)]);
        try { plate.moveAfter(sub || t); } catch (eM) {}
        ef_vis_kf(plate.property("Scale"), [[0, [0, 100]], [0.42, [100, 100]]], "smooth");
    }

    ef_vis_kfFade(t, 0.18, 0.4, 100);
    if (sub) ef_vis_kfFade(sub, 0.34, 0.4, 100);
    return 1;
}

/* ── PIE_CHART ─────────────────────────────────────────────
   Slices as filled wedge paths, arriving one at a time. The named slice is
   pulled out from the centre — the one thing a pie does better than a bar
   chart is make "this part of the whole" physical. */
function ef_vis_buildPieChart(comp, spec, cfg, missing) {
    ef_vis_addBackground(comp, spec, cfg, missing);

    var slices = spec.slices || [], n = slices.length, i;
    if (!n) { ef_vis_placeholderSolid(comp, "PIE_CHART needs slices"); return 1; }
    var total = 0;
    for (i = 0; i < n; i++) total += Math.abs(Number(slices[i].value) || 0);
    if (total <= 0) { ef_vis_placeholderSolid(comp, "PIE_CHART slices are all zero"); return 1; }

    var cx = comp.width * 0.42, cy = comp.height * 0.56;
    var R = Math.min(comp.width, comp.height) * 0.26;

    var accentIdx = -1;
    var wanted = Number(spec.accentIndex);
    if (wanted >= 0 && wanted < n) accentIdx = wanted;
    else { for (i = 0; i < n; i++) if (slices[i].accent) accentIdx = i; }

    var greys = [[0.30, 0.34, 0.42], [0.40, 0.44, 0.52], [0.24, 0.27, 0.34],
                 [0.46, 0.50, 0.58], [0.34, 0.38, 0.46], [0.20, 0.23, 0.29]];
    var angle = -Math.PI / 2;                       // start at twelve o'clock
    var labels = [];

    for (i = 0; i < n; i++) {
        var frac = Math.abs(Number(slices[i].value) || 0) / total;
        var sweep = frac * Math.PI * 2;
        var mid = angle + sweep / 2;

        // a wedge is the centre plus an arc walked in small steps
        var verts = [[0, 0]];
        var steps = Math.max(4, Math.ceil(sweep / 0.12));
        for (var k = 0; k <= steps; k++) {
            var a = angle + sweep * (k / steps);
            verts.push([Math.cos(a) * R, Math.sin(a) * R]);
        }
        var sl = comp.layers.addShape();
        sl.name = "Slice " + (i + 1) + (i === accentIdx ? " (accent)" : "");
        var sg = sl.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group")
                   .property("ADBE Vectors Group");
        var shp = new Shape();
        shp.vertices = verts;
        shp.closed = true;
        sg.addProperty("ADBE Vector Shape - Group").property("ADBE Vector Shape").setValue(shp);
        sg.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color")
          .setValue(i === accentIdx ? (spec.accent || [0.72, 0.53, 0.04]) : greys[i % greys.length]);

        var off = (i === accentIdx) ? R * 0.09 : 0;   // the named slice sits proud
        sl.property("Position").setValue([cx + Math.cos(mid) * off, cy + Math.sin(mid) * off]);

        var at = 0.25 + i * 0.22;
        ef_vis_kf(sl.property("Scale"), [[at, [0, 0]], [at + 0.45, [100, 100]]], "smooth");

        // labels are made AFTER every slice: each new layer lands on top, so a
        // label written here disappears under the next slice drawn over it
        if (slices[i].label) {
            labels.push({ text: String(slices[i].label) + "  " + Math.round(frac * 100) + "%",
                          mid: mid, accent: (i === accentIdx), at: at + 0.4, n: i + 1 });
        }
        angle += sweep;
    }

    for (i = 0; i < labels.length; i++) {
        var L = labels[i];
        var lab = comp.layers.addText(L.text);
        lab.name = "Label " + L.n;
        // Every label is light. The accent colour on the accent label put gold
        // text over the gold slice and half the word vanished — the slice being
        // pulled out already says which one the script means.
        ef_vis_styleText(lab, cfg, spec, Math.round(comp.height * 0.030),
                         L.accent ? [1, 1, 1] : ef_vis_styleInk(cfg, 0.78, [0.78, 0.81, 0.87]));

        // Sit OUTSIDE the rim and read away from it: a label on the right is
        // left-aligned at the edge, one on the left is right-aligned. Centring
        // pushes half the text back over the pie.
        var pad = comp.width * 0.02;
        var rimX = cx + Math.cos(L.mid) * (R * 1.10);
        var ly = cy + Math.sin(L.mid) * (R * 1.16);
        var w = comp.width * 0.2;
        try { w = lab.sourceRectAtTime(0.1, false).width; } catch (eW) {}
        var lx;
        if (Math.cos(L.mid) > 0.20) {
            lx = rimX + pad + w / 2;                       // right side, reads outward
        } else if (Math.cos(L.mid) < -0.20) {
            lx = rimX - pad - w / 2;                       // left side
        } else {
            lx = cx;                                       // straight up or down
            ly = cy + Math.sin(L.mid) * (R * 1.30);
        }
        if (lx + w / 2 > comp.width * 0.98) lx = comp.width * 0.98 - w / 2;
        if (lx - w / 2 < comp.width * 0.02) lx = comp.width * 0.02 + w / 2;
        ef_vis_centerAnchor(lab, comp, lx / comp.width, ly / comp.height, 0.1);
        ef_vis_kfFade(lab, L.at, 0.35, 100);
    }

    if (spec.caption) {
        var cap = comp.layers.addText(String(spec.caption));
        cap.name = "Caption";
        ef_vis_styleText(cap, cfg, spec, Math.round(comp.height * 0.034), ef_vis_styleInk(cfg, 0.88, [0.85, 0.88, 0.92]));
        ef_vis_centerAnchor(cap, comp, 0.5, 0.14, 0.1);
        ef_vis_fitText(cap, comp, cfg, 0.1);
    }
    return 1;
}

/* ── FLOW_DIAGRAM ──────────────────────────────────────────
   Steps in a row with connectors drawing between them, in the order the
   narration walks through. Each connector lands just before the box it
   points at, so the eye is led rather than chased. */
function ef_vis_buildFlowDiagram(comp, spec, cfg, missing) {
    ef_vis_addBackground(comp, spec, cfg, missing);

    var raw = spec.steps || [], n = raw.length, i;
    if (!n) { ef_vis_placeholderSolid(comp, "FLOW_DIAGRAM needs steps"); return 1; }

    var steps = [];
    for (i = 0; i < n; i++) {
        var st = raw[i];
        steps.push((st && typeof st === "object")
            ? { label: String(st.label || ""), accent: !!st.accent }
            : { label: String(st), accent: false });
    }

    var gap = comp.width * 0.035;
    var boxW = Math.min(comp.width * 0.22, (comp.width * 0.86 - gap * (n - 1)) / n);
    var boxH = comp.height * 0.20;
    var totalW = boxW * n + gap * (n - 1);
    var left = (comp.width - totalW) / 2;
    var cy = comp.height * 0.52;
    var step = (spec.stepDur == null) ? 0.55 : spec.stepDur;

    for (i = 0; i < n; i++) {
        var bx = left + i * (boxW + gap) + boxW / 2;
        var at = 0.2 + i * step;

        if (i > 0) {
            var conn = comp.layers.addShape();
            conn.name = "Link " + i;
            var cg = conn.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group")
                         .property("ADBE Vectors Group");
            var line = new Shape();
            line.vertices = [[-gap / 2, 0], [gap / 2, 0]];
            line.closed = false;
            cg.addProperty("ADBE Vector Shape - Group")
              .property("ADBE Vector Shape").setValue(line);
            var strk = cg.addProperty("ADBE Vector Graphic - Stroke");
            strk.property("ADBE Vector Stroke Color").setValue(ef_vis_styleInk(cfg, 0.50, [0.50, 0.54, 0.62]));
            strk.property("ADBE Vector Stroke Width").setValue(Math.max(2, comp.height * 0.004));
            conn.property("Position").setValue([bx - boxW / 2 - gap / 2, cy]);
            var trim = conn.property("ADBE Root Vectors Group")
                           .addProperty("ADBE Vector Filter - Trim");
            ef_vis_kf(trim.property("ADBE Vector Trim End"),
                      [[at - step * 0.45, 0], [at - step * 0.05, 100]], "smooth");
        }

        var box = comp.layers.addShape();
        box.name = "Step " + (i + 1) + (steps[i].accent ? " (accent)" : "");
        var bgp = box.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group")
                     .property("ADBE Vectors Group");
        var br = bgp.addProperty("ADBE Vector Shape - Rect");
        br.property("ADBE Vector Rect Size").setValue([boxW, boxH]);
        try { br.property("ADBE Vector Rect Roundness").setValue(Math.round(comp.height * 0.014)); } catch (eRr) {}
        bgp.addProperty("ADBE Vector Graphic - Fill").property("ADBE Vector Fill Color")
           .setValue(steps[i].accent ? (spec.accent || [0.72, 0.53, 0.04]) : [0.16, 0.18, 0.24]);
        var bs = bgp.addProperty("ADBE Vector Graphic - Stroke");
        bs.property("ADBE Vector Stroke Color").setValue(ef_vis_styleInk(cfg, 0.34, [0.34, 0.38, 0.46]));
        bs.property("ADBE Vector Stroke Width").setValue(2);
        box.property("Position").setValue([bx, cy]);
        ef_vis_kf(box.property("Scale"), [[at, [88, 88]], [at + 0.4, [100, 100]]], "smooth");
        ef_vis_kfFade(box, at, 0.32, 100);

        var lab2 = comp.layers.addText(steps[i].label);
        lab2.name = "Step label " + (i + 1);
        ef_vis_styleText(lab2, cfg, spec, Math.round(comp.height * 0.028),
                         steps[i].accent ? [0.06, 0.07, 0.10] : ef_vis_styleInk(cfg, 0.92, [0.90, 0.92, 0.95]));
        ef_vis_centerAnchor(lab2, comp, bx / comp.width, cy / comp.height, 0.1);
        // fit to the BOX, not the frame, or a long label runs over its neighbour
        ef_vis_fitText(lab2, comp, { boxWidthPct: (boxW * 0.86) / comp.width * 100 }, 0.1);
        ef_vis_kfFade(lab2, at + 0.12, 0.32, 100);
    }

    if (spec.caption) {
        var cap2 = comp.layers.addText(String(spec.caption));
        cap2.name = "Caption";
        ef_vis_styleText(cap2, cfg, spec, Math.round(comp.height * 0.034), ef_vis_styleInk(cfg, 0.88, [0.85, 0.88, 0.92]));
        ef_vis_centerAnchor(cap2, comp, 0.5, 0.20, 0.1);
        ef_vis_fitText(cap2, comp, cfg, 0.1);
    }
    return 1;
}

/* ── build one shot ────────────────────────────────────────
   Always a NEW version; never overwrites. */
function ef_vis_buildShot(jsonStr) {
    var started = false;
    try {
        var cfg = eval("(" + jsonStr + ")");
        var spec = cfg.spec;
        if (!spec || !spec.id) return ef_vis_err("no spec");

        // The theme's accent applies unless this shot named its own. Done once
        // here so every builder downstream just reads spec.accent.
        if (!spec._accentFromShot) {
            spec.accent = ef_vis_styleColor(cfg, "accent",
                spec.accent || [0.72, 0.53, 0.04]);
        }

        var w = cfg.width || 1920, h = cfg.height || 1080, fps = cfg.fps || 30;
        var folder = ef_vis_ensureShotFolder(spec.id);
        var name = ef_vis_nextVersionName(spec.id, ef_vis_listVersions(spec.id));

        app.beginUndoGroup("EditFlow: Build " + name);
        started = true;

        var comp = app.project.items.addComp(name, w, h, 1, Math.max(spec.duration || 5, 0.5), fps);
        comp.parentFolder = folder;
        comp.bgColor = ef_vis_styleColor(cfg, "bg", cfg.bgColor || [0.04, 0.05, 0.08]);

        // The brief separates recipe (what AE builds) from archetype (why the
        // script needs the shot). Prefer the recipe; fall back to archetype so
        // older shotlists that only carry one still build.
        var wanted = spec.recipe || spec.archetype;
        var missing = [];
        var builder = ef_vis_builderFor(wanted);
        if (!builder) {
            app.endUndoGroup(); comp.remove();
            return ef_vis_err("no builder for \"" + wanted + "\" in this version");
        }
        var built = builder(comp, spec, cfg, missing);
        // A builder may refuse outright — a capture that is not the size the
        // brief declared would highlight the wrong line. Take the comp back
        // out rather than leaving a confidently wrong version behind.
        if (typeof built === "string" && built.indexOf("ERROR:") === 0) {
            app.endUndoGroup();
            try { comp.remove(); } catch (eR) {}
            return built;
        }

        // first build of a shot becomes the active version
        if (ef_vis_listVersions(spec.id).length === 1) ef_vis_setActiveVersion(spec.id, name);

        app.endUndoGroup();
        return ef_vis_json({ comp: comp.name, shot: spec.id, archetype: spec.archetype,
                             recipe: String(wanted).toUpperCase(),
                             layers: comp.numLayers, duration: comp.duration,
                             missingAssets: missing,
                             technique: String(spec.technique || "NONE"),
                             techniqueApplied: String(spec._techniqueApplied || "") });
    } catch (e) {
        if (started) { try { app.endUndoGroup(); } catch (e2) {} }
        return ef_vis_err("buildShot: " + e.toString() + (e.line ? " (line " + e.line + ")" : ""));
    }
}

/* ── master comp ── */

function ef_vis_buildMaster(jsonStr) {
    var started = false;
    try {
        var cfg = eval("(" + jsonStr + ")");
        var root = ef_vis_ensureFolder(EF_VIS_ROOT, app.project.rootFolder);
        for (var i = root.numItems; i >= 1; i--) {
            var it = root.item(i);
            if (it instanceof CompItem && String(it.name) === EF_VIS_MASTER) it.remove();
        }
        app.beginUndoGroup("EditFlow: Build Visuals Master");
        started = true;

        var order = cfg.order || [], total = 0;
        for (var k = 0; k < order.length; k++) total += order[k].duration;
        var master = app.project.items.addComp(EF_VIS_MASTER, cfg.width || 1920,
            cfg.height || 1080, 1, Math.max(total, 1), cfg.fps || 30);
        master.parentFolder = root;

        var placed = 0, missing = [];
        for (var j = order.length - 1; j >= 0; j--) {   // reverse so shot 1 sits on top
            var src = ef_vis_activeVersionComp(order[j].id);
            if (!src) { missing.push(order[j].id); continue; }
            var L = master.layers.add(src);
            L.startTime = order[j].startTime;
            L.outPoint = order[j].startTime + order[j].duration;
            placed++;
        }
        master.openInViewer();
        app.endUndoGroup();
        return ef_vis_json({ master: master.name, placed: placed, missing: missing,
                             duration: master.duration });
    } catch (e) {
        if (started) { try { app.endUndoGroup(); } catch (e2) {} }
        return ef_vis_err("buildMaster: " + e.toString());
    }
}

/* ── project binding + saved state ──────────────────────────
   The comps under EF Visuals are the truth about what is BUILT — the panel
   re-reads them every time it opens, so closing After Effects can never
   lose them.

   The shotlist itself has no home in an .aep, so it goes in a sidecar file
   next to the project:  MyDoc.aep -> MyDoc.editflow-visuals.json
   That travels with the project, opens in any text editor, and survives a
   panel reload, an AE restart and a move to another machine.

   An unsaved project has nowhere to put it. Rather than pretend, we say so
   and the panel falls back to browser storage until the user saves. */

function ef_vis_stateFileFor(projFile) {
    if (!projFile) return null;
    var base = String(projFile.name).replace(/\.aepx?$/i, "");
    return new File(projFile.parent.fsName + "/" + base + ".editflow-visuals.json");
}

function ef_vis_projectInfo() {
    try {
        var f = app.project.file;                    // null until first save
        var out = {
            saved: !!f,
            name: f ? String(f.name) : "(unsaved project)",
            path: f ? String(f.fsName) : "",
            dirty: !!app.project.dirty,
            statePath: ""
        };
        if (f) {
            var sf = ef_vis_stateFileFor(f);
            out.statePath = String(sf.fsName);
            out.hasState = sf.exists;
        } else {
            out.hasState = false;
        }
        return ef_vis_json(out);
    } catch (e) { return ef_vis_err("projectInfo: " + e.toString()); }
}

function ef_vis_readState() {
    try {
        var f = app.project.file;
        if (!f) return ef_vis_json({ saved: false, data: "" });
        var sf = ef_vis_stateFileFor(f);
        if (!sf.exists) return ef_vis_json({ saved: true, data: "", path: String(sf.fsName) });
        sf.encoding = "UTF-8";
        sf.open("r");
        var txt = sf.read();
        sf.close();
        return ef_vis_json({ saved: true, data: String(txt), path: String(sf.fsName) });
    } catch (e) { return ef_vis_err("readState: " + e.toString()); }
}

function ef_vis_writeState(jsonStr) {
    try {
        var cfg = eval("(" + jsonStr + ")");
        var f = app.project.file;
        if (!f) return ef_vis_json({ saved: false, wrote: false });
        var sf = ef_vis_stateFileFor(f);
        sf.encoding = "UTF-8";
        if (!sf.open("w")) return ef_vis_err("cannot write " + sf.fsName);
        sf.write(String(cfg.data || ""));
        sf.close();
        return ef_vis_json({ saved: true, wrote: true, path: String(sf.fsName) });
    } catch (e) { return ef_vis_err("writeState: " + e.toString()); }
}

/* ── the visuals folder ─────────────────────────────────────
   Every path in a brief resolves under one root — the project's visuals/
   folder. Two different bases, which is the part that bites:

     assets[]            relative to the shot's assetDir
     sourceAnchor.image  relative to the ROOT (captures are shared between
                         every shot citing the same page, so they cannot
                         live inside any one shot's folder)

   Scanning up front means a brief naming a file that was never dropped in
   is caught before the build starts, not discovered halfway through it. */

function ef_vis_joinPath(a, b) {
    var left = String(a || "").replace(/[\\\/]+$/, "");
    var right = String(b || "").replace(/^[\\\/]+/, "");
    if (!left) return right;
    if (!right) return left;
    return left + "/" + right;
}

function ef_vis_listFiles(folder) {
    var out = [];
    try {
        var kids = folder.getFiles();
        for (var i = 0; i < kids.length; i++) {
            if (kids[i] instanceof File) out.push(String(kids[i].name));
        }
    } catch (e) {}
    return out;
}

function ef_vis_scanAssets(jsonStr) {
    try {
        var cfg = eval("(" + jsonStr + ")");
        var root = String(cfg.root || "");
        if (!root) return ef_vis_err("no visuals root set");
        var rootFolder = new Folder(root);
        if (!rootFolder.exists) return ef_vis_err("visuals root not found: " + root);

        var dirs = cfg.dirs || [], found = {}, missingDirs = [];
        for (var i = 0; i < dirs.length; i++) {
            var rel = String(dirs[i]);
            if (!rel) continue;
            var f = new Folder(ef_vis_joinPath(root, rel));
            if (f.exists) found[rel] = ef_vis_listFiles(f);
            else missingDirs.push(rel);
        }

        // capture images are named root-relative, so they are checked as
        // whole paths rather than joined onto a shot folder
        var images = cfg.images || [], missingImages = [];
        for (var j = 0; j < images.length; j++) {
            var img = new File(ef_vis_joinPath(root, String(images[j])));
            if (!img.exists) missingImages.push(String(images[j]));
        }

        return ef_vis_json({ root: root, dirs: found,
                             missingDirs: missingDirs, missingImages: missingImages });
    } catch (e) { return ef_vis_err("scanAssets: " + e.toString()); }
}

/* Open a built version in the AE viewer — the panel is a control surface,
   not a wall you have to go around to reach your own comps. */
function ef_vis_openComp(jsonStr) {
    try {
        var cfg = eval("(" + jsonStr + ")");
        var target = null;
        if (cfg.master) {
            var root = ef_vis_findFolder(EF_VIS_ROOT, app.project.rootFolder);
            if (root) {
                for (var m = 1; m <= root.numItems; m++) {
                    if (root.item(m) instanceof CompItem &&
                        String(root.item(m).name) === EF_VIS_MASTER) { target = root.item(m); break; }
                }
            }
        } else {
            var folder = ef_vis_findShotFolder(cfg.shot);
            if (!folder) return ef_vis_err("shot not built: " + cfg.shot);
            for (var i = 1; i <= folder.numItems; i++) {
                var it = folder.item(i);
                if (!(it instanceof CompItem)) continue;
                if (!cfg.version || String(it.name).replace(/^★ /, "") === String(cfg.version)) {
                    target = it; if (cfg.version) break;
                }
            }
        }
        if (!target) return ef_vis_err("nothing to open");
        target.openInViewer();
        return ef_vis_json({ opened: String(target.name) });
    } catch (e) { return ef_vis_err("openComp: " + e.toString()); }
}

/* ── inspection (the agent's eyes) ── */

function ef_vis_dumpShot(jsonStr) {
    try {
        var cfg = eval("(" + jsonStr + ")");
        var folder = ef_vis_findShotFolder(cfg.shot);
        if (!folder) return ef_vis_err("shot not built: " + cfg.shot);
        var target = null;
        for (var i = 1; i <= folder.numItems; i++) {
            var it = folder.item(i);
            if (!(it instanceof CompItem)) continue;
            if (!cfg.version || String(it.name).replace(/^★ /, "") === String(cfg.version)) {
                target = it; if (cfg.version) break;
            }
        }
        if (!target) return ef_vis_err("no version found for " + cfg.shot);
        var t = (cfg.at != null) ? Number(cfg.at) : target.duration * 0.9;
        var layers = [];
        for (var j = 1; j <= target.numLayers; j++) {
            var L = target.layer(j);
            var d = { name: String(L.name), inPoint: L.inPoint, outPoint: L.outPoint };
            try { d.opacity = L.property("Opacity").valueAtTime(t, false); } catch (e1) {}
            try { d.scale = L.property("Scale").valueAtTime(t, false); } catch (e2) {}
            try { d.position = L.property("Position").valueAtTime(t, false); } catch (e3) {}
            try { d.text = String(L.property("Source Text").valueAtTime(t, false).text); } catch (e4) {}
            try {
                var an = L.property("ADBE Text Properties").property("ADBE Text Animators");
                if (an && an.numProperties > 0) {
                    d.animators = [];
                    for (var a = 1; a <= an.numProperties; a++) d.animators.push(String(an.property(a).name));
                }
            } catch (e5) {}
            layers.push(d);
        }
        return ef_vis_json({ comp: String(target.name), at: t, duration: target.duration,
                             width: target.width, height: target.height, layers: layers });
    } catch (e) { return ef_vis_err("dumpShot: " + e.toString()); }
}

/* Render one frame of a shot version to PNG so the agent can look at it. */
function ef_vis_renderShot(jsonStr) {
    try {
        var cfg = eval("(" + jsonStr + ")");
        var folder = ef_vis_findShotFolder(cfg.shot);
        if (!folder) return ef_vis_err("shot not built: " + cfg.shot);
        var target = null;
        for (var i = 1; i <= folder.numItems; i++) {
            var it = folder.item(i);
            if (!(it instanceof CompItem)) continue;
            if (!cfg.version || String(it.name).replace(/^★ /, "") === String(cfg.version)) {
                target = it; if (cfg.version) break;
            }
        }
        if (!target) return ef_vis_err("no version found for " + cfg.shot);
        if (typeof target.saveFrameToPng !== "function") return ef_vis_err("saveFrameToPng unavailable");
        var t = (cfg.at != null) ? Number(cfg.at) : target.duration * 0.9;
        if (t < 0) t = 0;
        if (t > target.duration) t = target.duration;
        var f = new File(String(cfg.out));
        try { if (f.exists) f.remove(); } catch (e1) {}
        target.saveFrameToPng(t, f);
        // saveFrameToPng returns before the bytes are flushed, so a single
        // immediate .length read reports 0 on a file that is actually fine.
        // Re-stat a few times before calling it a failure.
        var len = 0, chk = null;
        for (var a = 0; a < 12; a++) {
            chk = new File(f.fsName);
            try { len = chk.exists ? chk.length : 0; } catch (e2) { len = 0; }
            if (len >= 1024) break;
            $.sleep(120);
        }
        if (len < 1024) return ef_vis_err("render produced no/tiny file after 1.4s");
        return ef_vis_json({ path: chk.fsName, at: t, comp: String(target.name), bytes: len });
    } catch (e) { return ef_vis_err("renderShot: " + e.toString()); }
}

/* Everything the panel needs to redraw itself from scratch, in one call.
   This is what makes reopening After Effects a non-event: the panel throws
   its memory away and asks the project what exists. */
function ef_vis_listAll() {
    try {
        var root = ef_vis_findFolder(EF_VIS_ROOT, app.project.rootFolder);
        if (!root) return ef_vis_json({ shots: [], master: null });
        var shots = [], master = null;
        for (var j = 1; j <= root.numItems; j++) {
            var f = root.item(j);
            if (f instanceof CompItem && String(f.name) === EF_VIS_MASTER) {
                master = { name: String(f.name), duration: f.duration, layers: f.numLayers };
                continue;
            }
            if (!(f instanceof FolderItem)) continue;
            var versions = [];
            for (var k = 1; k <= f.numItems; k++) {
                var c = f.item(k);
                if (!(c instanceof CompItem)) continue;
                var nm = String(c.name);
                versions.push({
                    name: nm.replace(/^★ /, ""),
                    active: nm.indexOf("★ ") === 0,
                    duration: c.duration,
                    layers: c.numLayers,
                    width: c.width,
                    height: c.height
                });
            }
            if (versions.length) shots.push({ shot: String(f.name), versions: versions });
        }
        return ef_vis_json({ shots: shots, master: master });
    } catch (e) { return ef_vis_err("listAll: " + e.toString()); }
}

function ef_vis_setActive(jsonStr) {
    try {
        var cfg = eval("(" + jsonStr + ")");
        app.beginUndoGroup("EditFlow: Set Active Version");
        var ok = ef_vis_setActiveVersion(cfg.shot, cfg.version);
        app.endUndoGroup();
        return ef_vis_json({ ok: ok, shot: cfg.shot, version: cfg.version });
    } catch (e) { return ef_vis_err("setActive: " + e.toString()); }
}

function ef_vis_deleteVersion(jsonStr) {
    try {
        var cfg = eval("(" + jsonStr + ")");
        var folder = ef_vis_findShotFolder(cfg.shot);
        if (!folder) return ef_vis_json({ removed: 0 });
        app.beginUndoGroup("EditFlow: Delete Version");
        var removed = 0, killedActive = false;
        for (var i = folder.numItems; i >= 1; i--) {
            var it = folder.item(i);
            if (it instanceof CompItem &&
                String(it.name).replace(/^★ /, "") === String(cfg.version)) {
                if (String(it.name).indexOf("★ ") === 0) killedActive = true;
                it.remove(); removed++;
            }
        }
        // Deleting the active version must not leave the shot with none —
        // the master would silently drop it. Promote whatever is left.
        var promoted = "";
        if (killedActive) {
            var rest = ef_vis_listVersions(cfg.shot);
            if (rest.length) {
                promoted = String(rest[0]).replace(/^★ /, "");
                ef_vis_setActiveVersion(cfg.shot, promoted);
            }
        }
        // An empty shot folder is clutter; the next build recreates it.
        if (folder.numItems === 0) { try { folder.remove(); } catch (eF) {} }
        app.endUndoGroup();
        return ef_vis_json({ removed: removed, promoted: promoted });
    } catch (e) { return ef_vis_err("deleteVersion: " + e.toString()); }
}

function ef_vis_clearAll() {
    try {
        var root = null;
        for (var i = 1; i <= app.project.rootFolder.numItems; i++) {
            var it = app.project.rootFolder.item(i);
            if (it instanceof FolderItem && String(it.name) === EF_VIS_ROOT) { root = it; break; }
        }
        if (!root) return ef_vis_json({ removed: 0 });
        app.beginUndoGroup("EditFlow: Clear Visuals");
        var n = root.numItems;
        root.remove();
        app.endUndoGroup();
        return ef_vis_json({ removed: n });
    } catch (e) { return ef_vis_err("clearAll: " + e.toString()); }
}

/* Environment probe — what THIS install can actually do. The agent brief
   quotes this so a model is told the machine's reality, not the docs'. */
function ef_vis_probeEnvironment() {
    try {
        var out = { version: String(app.version), build: String(app.buildName || "") };
        var selectorOk = false, tmp = null;
        try {
            tmp = app.project.items.addComp("__ef_probe", 128, 128, 1, 1, 30);
            var probe = tmp.layers.addText("probe");
            var anim = probe.property("ADBE Text Properties")
                .property("ADBE Text Animators").addProperty("ADBE Text Animator");
            selectorOk = anim.property("ADBE Text Selectors")
                .canAddProperty("ADBE Text Expressible Selector");
        } catch (e1) { selectorOk = false; }
        if (tmp) { try { tmp.remove(); } catch (e2) {} }
        out.expressionSelector = selectorOk;
        out.saveFrameToPng = false;
        try {
            var t2 = app.project.items.addComp("__ef_probe2", 8, 8, 1, 1, 30);
            out.saveFrameToPng = (typeof t2.saveFrameToPng === "function");
            t2.remove();
        } catch (e3) {}
        // app.fonts.allFonts is a list of FAMILY GROUPS, each an array of
        // Font objects — allFonts[i].postScriptName is undefined, which is
        // what this used to send the agent, 60 times over.
        out.fonts = [];
        try {
            var all = app.fonts.allFonts;
            for (var i = 0; i < all.length && out.fonts.length < 60; i++) {
                var group = all[i];
                var face = (group && group.length) ? group[0] : group;
                if (!face) continue;
                var ps = String(face.postScriptName);
                if (ps && ps !== "undefined") out.fonts.push(ps);
            }
        } catch (e4) {}
        out.fontCount = out.fonts.length;
        return ef_vis_json(out);
    } catch (e) { return ef_vis_err("probeEnvironment: " + e.toString()); }
}

function ef_vis_ping() { return "vis-pong"; }
