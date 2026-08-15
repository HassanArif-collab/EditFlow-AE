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

/* ── versions ── */

function ef_vis_listVersions(shotId) {
    var folder = ef_vis_ensureShotFolder(shotId), names = [];
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
    var folder = ef_vis_ensureShotFolder(shotId), found = false;
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
    var folder = ef_vis_ensureShotFolder(shotId), first = null;
    for (var i = 1; i <= folder.numItems; i++) {
        var it = folder.item(i);
        if (!(it instanceof CompItem)) continue;
        if (String(it.name).indexOf("★ ") === 0) return it;
        if (!first) first = it;
    }
    return first;
}

/* ── assets ── */

function ef_vis_importAsset(fileName, cfg) {
    if (!fileName) return null;
    var assets = ef_vis_ensureFolder(EF_VIS_ASSETS, app.project.rootFolder);
    for (var i = 1; i <= assets.numItems; i++) {
        if (String(assets.item(i).name) === String(fileName)) return assets.item(i);
    }
    try {
        var dir = String(cfg.assetsDir || "");
        if (!dir) return null;
        dir = dir.replace(/[\\\/]+$/, "");
        var f = new File(dir + "/" + fileName);
        if (!f.exists) return null;
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

/* ── background ── */

function ef_vis_addBackground(comp, spec, cfg, missing) {
    if (spec.bgSrc) {
        var item = ef_vis_importAsset(spec.bgSrc, cfg);
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
    ef_vis_centerAnchor(num, comp, 0.5, 0.50, 0.1);
    ef_vis_fitText(num, comp, cfg, 0.1);

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

    if (spec.pulse) {
        // ONE restrained pulse after the count lands — never a loop
        num.property("Scale").expression =
            "var t=time-inPoint-" + (spec.countDur || 3) + ";" +
            "if(t<0||t>0.6){[100,100]}else{var s=100+6*Math.sin(t/0.6*Math.PI);[s,s]}";
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

        var missing = [];
        if (spec.archetype === "STAT_COUNTER") ef_vis_buildStatCounter(comp, spec, cfg, missing);
        else if (spec.archetype === "BAR_CHART") ef_vis_buildBarChart(comp, spec, cfg, missing);
        else if (spec.archetype === "SECTION_TITLE_CARD") ef_vis_buildTitleCard(comp, spec, cfg, missing);
        else { app.endUndoGroup(); comp.remove(); return ef_vis_err("unsupported archetype: " + spec.archetype); }

        // first build of a shot becomes the active version
        if (ef_vis_listVersions(spec.id).length === 1) ef_vis_setActiveVersion(spec.id, name);

        app.endUndoGroup();
        return ef_vis_json({ comp: comp.name, shot: spec.id, archetype: spec.archetype,
                             layers: comp.numLayers, duration: comp.duration,
                             missingAssets: missing });
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

/* ── inspection (the agent's eyes) ── */

function ef_vis_dumpShot(jsonStr) {
    try {
        var cfg = eval("(" + jsonStr + ")");
        var folder = ef_vis_ensureShotFolder(cfg.shot);
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
        var folder = ef_vis_ensureShotFolder(cfg.shot);
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

function ef_vis_listAll() {
    try {
        var root = null;
        for (var i = 1; i <= app.project.rootFolder.numItems; i++) {
            var it = app.project.rootFolder.item(i);
            if (it instanceof FolderItem && String(it.name) === EF_VIS_ROOT) { root = it; break; }
        }
        if (!root) return ef_vis_json({ shots: [] });
        var shots = [];
        for (var j = 1; j <= root.numItems; j++) {
            var f = root.item(j);
            if (!(f instanceof FolderItem)) continue;
            var versions = [];
            for (var k = 1; k <= f.numItems; k++) {
                if (f.item(k) instanceof CompItem) versions.push(String(f.item(k).name));
            }
            shots.push({ shot: String(f.name), versions: versions });
        }
        return ef_vis_json({ shots: shots });
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
        var folder = ef_vis_ensureShotFolder(cfg.shot);
        app.beginUndoGroup("EditFlow: Delete Version");
        var removed = 0;
        for (var i = folder.numItems; i >= 1; i--) {
            var it = folder.item(i);
            if (it instanceof CompItem &&
                String(it.name).replace(/^★ /, "") === String(cfg.version)) {
                it.remove(); removed++;
            }
        }
        app.endUndoGroup();
        return ef_vis_json({ removed: removed });
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
        out.fonts = [];
        try {
            var all = app.fonts.allFonts;
            for (var i = 0; i < Math.min(all.length, 60); i++) {
                out.fonts.push(String(all[i].postScriptName));
            }
        } catch (e4) {}
        return ef_vis_json(out);
    } catch (e) { return ef_vis_err("probeEnvironment: " + e.toString()); }
}

function ef_vis_ping() { return "vis-pong"; }
