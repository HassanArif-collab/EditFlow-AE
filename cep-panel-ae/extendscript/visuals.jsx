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

/* ── expression fragments ── */

/* Count-up. Uses AE's own easing so the curve matches what an editor
   would draw, and hand-rolls the separators because ES3 lacks
   toLocaleString. */
function ef_vis_countExpr(value, dur, prefix, suffix) {
    var v = Math.round(Number(value));
    return "var target=" + v + ";var dur=" + (dur || 3) + ";" +
        "var t=time-inPoint;" +
        "var p=(t<=0)?0:((t>=dur)?1:easeOut(t,0,dur,0,1));" +
        "var n=Math.round(target*p);" +
        "var s=String(Math.abs(n));var out='';" +
        "for(var i=0;i<s.length;i++){if(i>0&&(s.length-i)%3===0){out+=',';}out+=s.charAt(i);}" +
        "(n<0?'-':'')+" + ef_vis_json(String(prefix || "")) + "+out+" +
        ef_vis_json(String(suffix || "")) + ";";
}

/* Letter-by-letter reveal via a text animator + expression selector.
   Same mechanism the caption engine proved in AE. */
function ef_vis_letterProgressExpr(stagger, dur) {
    return "var stag=" + (stagger || 0.05) + ";var d=" + (dur || 0.45) + ";" +
        "var t0=thisLayer.inPoint+(textIndex-1)*stag;" +
        "var p=(time-t0)/d;if(p<0)p=0;if(p>1)p=1;" +
        "var e=1-Math.pow(1-p,3);" +
        "var a=(1-e)*100;[a,a,a];";
}

function ef_vis_addLetterAnimator(layer, name, matchName, value, expr) {
    var animators = layer.property("ADBE Text Properties").property("ADBE Text Animators");
    var anim = animators.addProperty("ADBE Text Animator");
    anim.name = name;
    var prop = anim.property("ADBE Text Animator Properties").addProperty(matchName);
    if (value !== null && value !== undefined) {
        try { prop.setValue(value); }
        catch (e1) { try { prop.setValue([value[0], value[1], 0]); } catch (e2) {} }
    }
    var sel = anim.property("ADBE Text Selectors").addProperty("ADBE Text Expressible Selector");
    try { sel.property("ADBE Text Range Type2").setValue(1); } catch (e3) {}   // 1 = Characters
    sel.property("ADBE Text Expressible Amount").expression = expr;
    return anim;
}

/* ── techniques ──────────────────────────────────────────────
   Shot-level motion, applied on top of whatever the recipe already does.
   Every expression here multiplies `value` rather than assuming 100: the
   recipes set Scale to fit or fill first, and an expression that hardcodes
   100 silently throws that away (learned the hard way from the counter's
   pulse, which un-did its own auto-fit). */

/* Eased 0..1 across the move, after an optional still hold. */
function ef_vis_progressExpr(hold, dur) {
    return "var h=" + (hold || 0) + ";var d=" + Math.max(0.1, dur) + ";" +
           "var t=time-inPoint-h;" +
           "var p=(t<=0)?0:((t>=d)?1:easeOut(t,0,d,0,1));";
}

/* A slow scale toward the subject. rate scales the zoom for parallax depth. */
function ef_vis_pushExpr(zoom, hold, dur, rate) {
    var z = 1 + ((zoom || 1.15) - 1) * (rate == null ? 1 : rate);
    return ef_vis_progressExpr(hold, dur) +
           "var b=value;var s=1+(" + z + "-1)*p;[b[0]*s,b[1]*s];";
}

/* Ken Burns: the push, plus a slow drift so the frame is never static. */
function ef_vis_driftExpr(comp, hold, dur, dx, dy) {
    return ef_vis_progressExpr(hold, dur) +
           "var b=value;[b[0]+" + dx + "*p,b[1]+" + dy + "*p];";
}

/* DUST_DISSOLVE — v7: per-letter fade + blur + upward drift, sequenced.
   It means loss. Direction follows deletion (rtl) or reading (ltr). */
function ef_vis_dustExpr(startAt, stagger, dur, count, rtl) {
    var idx = rtl ? "(" + count + "-textIndex)" : "(textIndex-1)";
    return "var st=" + startAt + ";var stag=" + stagger + ";var d=" + dur + ";" +
           "var t0=st+" + idx + "*stag;var p=(time-inPoint-t0)/d;" +
           "if(p<0)p=0;if(p>1)p=1;p=p*p;";
}

function ef_vis_applyDustDissolve(layer, comp, spec, startAt) {
    // 60% overlap between letters, 1.2–2.0s total, per the technique deck
    var text = String(spec.title || spec.value || "");
    var count = Math.max(1, text.length);
    var total = 1.6;
    var stagger = (total * 0.4) / count;
    var dur = Math.max(0.35, total * 0.6);
    var rtl = String(spec.dustDirection || "rtl") === "rtl";
    var p = ef_vis_dustExpr(startAt, stagger, dur, count, rtl);

    ef_vis_addLetterAnimator(layer, "EF Dust Fade", "ADBE Text Opacity", 0,
        p + "(1-p)*100;");
    ef_vis_addLetterAnimator(layer, "EF Dust Drift", "ADBE Text Position 3D",
        [0, -Math.round(comp.height * 0.045)], p + "[0,p*100,0];");
    // Blur is what sells "crumbling" rather than "sliding away"
    try {
        ef_vis_addLetterAnimator(layer, "EF Dust Blur", "ADBE Text Blur",
            [40, 40], p + "[p*100,p*100];");
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
    if (t === "NONE" || !t) return "";

    if (t === "PUSH_IN" || t === "KEN_BURNS" || t === "PARALLAX_2_5D") {
        if (!o.scalable) return "";
        layer.property("Scale").expression =
            ef_vis_pushExpr(o.zoom, hold, dur, o.rate);
        if (t === "KEN_BURNS") {
            // a drift of a few percent of frame reads as filmed, not sliding
            var dx = Math.round(comp.width * 0.03) * (o.panX == null ? 1 : o.panX);
            var dy = Math.round(comp.height * 0.02) * (o.panY == null ? -1 : o.panY);
            layer.property("Position").expression = ef_vis_driftExpr(comp, hold, dur, dx, dy);
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
    var bg = comp.layers.addSolid(cfg.bgColor || [0.04, 0.05, 0.08], "BG",
                                 comp.width, comp.height, 1);
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
    ef_vis_styleText(num, cfg, spec, numSize, [1, 1, 1]);
    num.property("Source Text").expression =
        ef_vis_countExpr(spec.value, spec.countDur, spec.prefix, "");
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
        title.property("Opacity").expression =
            "var t=time-inPoint;t<0?0:(t>=0.4?100:easeOut(t,0,0.4,0,100))";
    }

    if (spec.unit) {
        var unit = comp.layers.addText(String(spec.unit));
        unit.name = "Unit";
        ef_vis_styleText(unit, cfg, spec, Math.round(comp.height * 0.032), [0.75, 0.78, 0.82]);
        ef_vis_centerAnchor(unit, comp, 0.5, 0.62, 0.1);
        unit.property("Opacity").expression =
            "var t=time-inPoint-" + (spec.countDur || 3) + ";t<0?0:(t>=0.5?70:easeOut(t,0,0.5,0,70))";
    }

    spec._techniqueApplied = ef_vis_applyTechnique(num, comp, spec, {
        text: true, dustStart: (spec.countDur || 3) + 0.4,
    });

    if (spec.pulse) {
        // ONE restrained pulse after the count lands — never a loop.
        // Multiplies `value` (the scale ef_vis_fitText just set) instead of
        // assuming 100: hardcoding it threw away the fit, so a long number
        // that had been shrunk to fit sprang back over the frame edge.
        num.property("Scale").expression =
            "var b=value;var t=time-inPoint-" + (spec.countDur || 3) + ";" +
            "if(t<0||t>0.6){b}else{var s=1+0.06*Math.sin(t/0.6*Math.PI);[b[0]*s,b[1]*s]}";
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
    afill.property("ADBE Vector Fill Color").setValue([0.45, 0.48, 0.55]);
    axis.property("Position").setValue([comp.width / 2, baseY]);
    axis.property("Scale").expression =
        "var t=time-inPoint;var p=(t<=0)?0:((t>=0.4)?1:easeOut(t,0,0.4,0,1));[p*100,100]";

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
        bar.property("Scale").expression =
            "var d=" + (spec.growDur || 0.9) + ";var t=time-inPoint-" + delay + ";" +
            "if(t<=0){[100,0]}else if(t>=d){[100,100]}else{" +
            "var p=t/d;var e=1-Math.pow(2,-10*p);var o=1+0.06*Math.sin(p*Math.PI);" +
            "[100,e*100*o]}";

        if (b.label) {
            var lab = comp.layers.addText(String(b.label));
            lab.name = "Label " + (i + 1);
            ef_vis_styleText(lab, cfg, spec, Math.round(comp.height * 0.028),
                             b.accent ? spec.accent : [0.8, 0.83, 0.88]);
            ef_vis_centerAnchor(lab, comp, cx / comp.width, (baseY + comp.height * 0.05) / comp.height, 0.1);
            // labels arrive AFTER the data is readable
            lab.property("Opacity").expression =
                "var t=time-inPoint-" + (delay + (spec.growDur || 0.9)) + ";" +
                "t<0?0:(t>=0.35?100:easeOut(t,0,0.35,0,100))";
        }

        var val = comp.layers.addText("0");
        val.name = "Value " + (i + 1);
        ef_vis_styleText(val, cfg, spec, Math.round(comp.height * 0.030),
                         b.accent ? [1, 1, 1] : [0.72, 0.75, 0.8]);
        val.property("Source Text").expression = ef_vis_countExpr(b.value, spec.growDur || 0.9, "", "");
        var valY = (baseY - h - comp.height * 0.035) / comp.height;
        ef_vis_centerAnchor(val, comp, cx / comp.width, valY, 0.1);
        val.property("Opacity").expression =
            "var t=time-inPoint-" + delay + ";t<0?0:100";
    }

    if (spec.caption) {
        var cap = comp.layers.addText(String(spec.caption));
        cap.name = "Caption";
        ef_vis_styleText(cap, cfg, spec, Math.round(comp.height * 0.034), [0.85, 0.88, 0.92]);
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
    ef_vis_styleText(title, cfg, spec, Math.round(comp.height * 0.10), [1, 1, 1]);
    ef_vis_centerAnchor(title, comp, 0.5, 0.47, 0.1);
    ef_vis_fitText(title, comp, cfg, 0.1);

    var expr = ef_vis_letterProgressExpr(spec.stagger, 0.45);
    ef_vis_addLetterAnimator(title, "EF Letter Fade", "ADBE Text Opacity", 0, expr);

    var v = spec.variant;
    if (v === "slide_up") {
        ef_vis_addLetterAnimator(title, "EF Letter Rise", "ADBE Text Position 3D",
                                 [0, Math.round(comp.height * 0.05)], expr);
    } else if (v === "slide_left") {
        ef_vis_addLetterAnimator(title, "EF Letter Slide", "ADBE Text Position 3D",
                                 [-Math.round(comp.width * 0.06), 0], expr);
    } else if (v === "scale_center") {
        ef_vis_addLetterAnimator(title, "EF Letter Scale", "ADBE Text Scale 3D",
                                 [-60, -60], expr);
    } else if (v === "fade_rotate") {
        var anim = ef_vis_addLetterAnimator(title, "EF Letter Rotate", "ADBE Text Rotation",
                                            null, expr);
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
        sub.property("Opacity").expression =
            "var t=time-inPoint-" + after + ";t<0?0:(t>=0.5?100:easeOut(t,0,0.5,0,100))";
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
    { name: "ASSET_REVEAL",       fn: "ef_vis_buildAssetReveal" }
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
        ef_vis_applyTechnique(L, comp, spec, {
            scalable: true, zoom: spec.zoom || 1.15, hold: spec.hold || 0,
            dur: comp.duration - (spec.hold || 0), rate: rate,
        });
        L.moveToEnd();
        placed++;
    }
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

    var rectMidPage = (a.rect.y || 0) + (a.rect.h || 0) / 2;
    var restY = comp.height / 2 - rectMidPage * scale;      // cited line centred
    var startY = comp.height / 2 - (realH * scale) / 2;     // page centred
    if (String(spec.technique || "").toUpperCase() === "DOC_SCROLL" ||
        !spec.technique || String(spec.technique).toUpperCase() === "NONE") {
        var travel = Math.max(0.5, comp.duration - (spec.holdAfter || 1.5));
        L.property("Position").setValue([comp.width / 2, 0]);
        L.property("Position").expression =
            "var d=" + travel + ";var t=time-inPoint;" +
            "var p=(t<=0)?0:((t>=d)?1:easeOut(t,0,d,0,1));" +
            "[" + (comp.width / 2) + "," + startY + "+(" + (restY - startY) + ")*p];";
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
    hl.property("Scale").expression =
        "var t=time-inPoint-" + arrive + ";" +
        "if(t<=0){[0,100]}else{var p=(t>=0.45)?1:easeOut(t,0,0.45,0,1);[p*100,100]}";
    hl.property("Anchor Point").setValue([-hw / 2, 0]);
    hl.property("Position").setValue([hlX - hw / 2, comp.height / 2]);
    return 2;
}

/* ── build one shot ────────────────────────────────────────
   Always a NEW version; never overwrites. */
function ef_vis_buildShot(jsonStr) {
    var started = false;
    try {
        var cfg = eval("(" + jsonStr + ")");
        var spec = cfg.spec;
        if (!spec || !spec.id) return ef_vis_err("no spec");

        var w = cfg.width || 1920, h = cfg.height || 1080, fps = cfg.fps || 30;
        var folder = ef_vis_ensureShotFolder(spec.id);
        var name = ef_vis_nextVersionName(spec.id, ef_vis_listVersions(spec.id));

        app.beginUndoGroup("EditFlow: Build " + name);
        started = true;

        var comp = app.project.items.addComp(name, w, h, 1, Math.max(spec.duration || 5, 0.5), fps);
        comp.parentFolder = folder;
        comp.bgColor = cfg.bgColor || [0.04, 0.05, 0.08];

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
