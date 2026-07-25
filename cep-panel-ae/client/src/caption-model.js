/**
 * caption-model.js — single source of truth for caption logic shared by the
 * panel preview, the config sent to ExtendScript, and Node tests.
 *
 * Pure functions only: no DOM, no CSInterface, no AE APIs. The jsx builds
 * expressions from the SAME formulas (see ef_wordProgressExpr in index.jsx);
 * tests/jsx-expressions.test.js asserts the two stay in agreement.
 */

/* Sentence-ending punctuation across scripts:
   . ? !  latin · ؟ arabic question · ۔ urdu full stop · । devanagari danda
   ؛ arabic semicolon · 。！？ CJK · … ellipsis. Optional closing quote/bracket. */
export const SENTENCE_END = /[.?!؟۔।؛。！？…]["')\]]?\s*$/;

export const EASINGS = {
  linear: (p) => p,
  ease_in: (p) => p * p * p,
  ease_out: (p) => 1 - Math.pow(1 - p, 3),
  ease_in_out: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  // Editor-grade curves: expo_out reads "snappy" (most of the move happens
  // immediately, then a long soft settle); back_out overshoots slightly and
  // comes back — the tiny bounce hand-animated titles have.
  expo_out: (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
  back_out: (p) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
  },
};

/* Layout constants shared with the jsx (mirrored into cfg by the panel). */
export const LAYOUT = {
  wordGapEm: 0.32,      // inter-word gap = fontSize * this
  pillPadXEm: 0.28,
  pillPadYEm: 0.16,
  lineHeightEm: 1.2,
  fitMaxWidthRatio: 0.94, // auto-shrink threshold vs comp width
};

function clamp01(p) { return p < 0 ? 0 : p > 1 ? 1 : p; }

/* ── Grouping ─────────────────────────────────────────────── */

/**
 * Group word objects ({word|text, start, end, pill?}) into captions.
 * Breaks on: silence gap > maxGap, word count, duration, char budget
 * (maxChars × maxLines), or sentence-ending punctuation.
 */
export function groupWords(words, opts) {
  const maxWords = Math.max(1, opts.maxWordsPerSegment || 4);
  const maxChars = opts.maxCharsPerSegment || 30;
  const maxLines = Math.max(1, opts.maxLinesPerSegment || 1);
  const maxDur = opts.maxDurationPerSegment || 3;
  const maxGap = opts.maxGap != null ? opts.maxGap : 0.4;
  const charBudget = maxChars * maxLines;

  // Width mode: decide capacity from MEASURED pixels against the caption
  // box instead of letter count. This is what keeps the rendered font size
  // constant — a bigger font means fewer words per caption, never a
  // shrunk caption. Falls back to the char budget when no measurer is
  // supplied (Node tests, callers without a canvas).
  const widthMode = typeof opts.measure === 'function' && opts.maxWidthPx > 0;
  const spacePx = opts.spacePx || 0;
  let lineCount = 1, lineWidth = 0;
  const resetFit = () => { lineCount = 1; lineWidth = 0; };
  /* Does `text` still fit the box within maxLines? Mirrors wrapLines'
     greedy fill, advanced one word at a time as the group grows. */
  const fitsInBox = (text) => {
    const wpx = opts.measure(text);
    const withWord = lineWidth === 0 ? wpx : lineWidth + spacePx + wpx;
    if (withWord <= opts.maxWidthPx) { lineWidth = withWord; return true; }
    if (lineCount < maxLines) { lineCount += 1; lineWidth = wpx; return true; }
    return false;
  };

  const groups = [];
  let cur = [];
  for (let i = 0; i < (words || []).length; i++) {
    const w = words[i];
    const text = w.word || w.text || '';
    if (!text) continue;
    const norm = {
      text,
      start: parseFloat(w.start),
      end: parseFloat(w.end),
      idx: w.idx != null ? w.idx : i,
      pill: !!w.pill,
    };
    if (cur.length === 0) {
      cur.push(norm);
      if (widthMode) { resetFit(); fitsInBox(text); }
      continue;
    }

    const prev = cur[cur.length - 1];
    const gap = norm.start - prev.end;
    const dur = norm.end - cur[0].start;
    let chars = 0;
    for (const c of cur) chars += c.text.length + 1;
    chars += text.length;

    // Break AFTER a sentence-ending word (prev), never before the current
    // word — the old `currEnds` rule orphaned "channel." into its own caption.
    // Capacity break: measured box overflow (width mode) or char budget.
    // fitsInBox() advances the wrap state only when the word fits, so a
    // rejected word starts the next group cleanly.
    const overCapacity = widthMode ? !fitsInBox(text) : chars > charBudget;

    if (gap > maxGap || cur.length >= maxWords || dur > maxDur ||
        overCapacity || SENTENCE_END.test(prev.text)) {
      groups.push(_toGroup(cur));
      cur = [norm];
      if (widthMode) { resetFit(); fitsInBox(text); }
    } else {
      cur.push(norm);
    }
  }
  if (cur.length) groups.push(_toGroup(cur));
  return opts.mergeOrphans ? _mergeOrphans(groups, opts) : groups;
}

/* A single short word alone on screen ("Yes.") reads as a mistake and, at
   large font sizes, renders comically big next to its neighbours. Merge it
   backwards when it's genuinely adjacent — never across a real pause, and
   never past the caption box. */
function _mergeOrphans(groups, opts) {
  const maxGap = opts.maxGap != null ? opts.maxGap : 0.4;
  const maxWords = Math.max(1, opts.maxWordsPerSegment || 4);
  const widthMode = typeof opts.measure === 'function' && opts.maxWidthPx > 0;
  const maxLines = Math.max(1, opts.maxLinesPerSegment || 1);
  const spacePx = opts.spacePx || 0;
  const charBudget = (opts.maxCharsPerSegment || 30) * maxLines;

  const fitsMerged = (words) => {
    if (widthMode) {
      // greedy re-wrap of the merged word list; must still fit maxLines
      let lines = 1, width = 0;
      for (const w of words) {
        const wpx = opts.measure(w.text);
        const withWord = width === 0 ? wpx : width + spacePx + wpx;
        if (withWord <= opts.maxWidthPx) { width = withWord; continue; }
        if (lines < maxLines) { lines += 1; width = wpx; continue; }
        return false;
      }
      return true;
    }
    return words.reduce((a, w) => a + w.text.length + 1, -1) <= charBudget;
  };

  const out = [];
  for (const g of groups) {
    const prev = out[out.length - 1];
    const isOrphan = g.words.length === 1 && (g.end - g.start) < 0.6;
    if (prev && isOrphan) {
      const gap = g.start - prev.end;
      const merged = prev.words.concat(g.words);
      if (gap <= maxGap && merged.length <= maxWords && fitsMerged(merged)) {
        out[out.length - 1] = _toGroup(merged);
        continue;
      }
    }
    out.push(g);
  }
  return out;
}

/* ── Vertical placement ────────────────────────────────────── */

/**
 * Clamp a caption block's centre Y so no line lands outside the comp.
 * Without this, 2-line captions at a low posY (or a big font) clip the
 * bottom edge. Returns the safe centre Y in comp pixels.
 */
export function clampBlockY({ requestedY, compH, nLines, lineHeight, marginPct = 0.03 }) {
  const half = ((nLines - 1) / 2) * lineHeight + lineHeight / 2;
  const lo = compH * marginPct + half;
  const hi = compH * (1 - marginPct) - half;
  if (hi < lo) return compH / 2;          // block taller than the comp
  return Math.min(hi, Math.max(lo, requestedY));
}

function _toGroup(seg) {
  let text = '';
  for (let k = 0; k < seg.length; k++) text += (k ? ' ' : '') + seg[k].text;
  return { words: seg, start: seg[0].start, end: seg[seg.length - 1].end, text };
}

/* ── Line wrapping ────────────────────────────────────────── */

/**
 * Assign a group's words to lines. Returns [{startIdx, endIdx, text}] with
 * indices into group.words. Overflow beyond maxLines lands on the last line.
 *
 * Width mode (preferred): pass maxWidthPx + measure(text)→px (+ spacePx) —
 * greedy fill by MEASURED width, the caption-box contract. The panel decides
 * lines with real font metrics; AE renders them verbatim, so they agree.
 * Char mode (fallback): character budget per line (maxCharsPerSegment).
 */
export function wrapLines(group, opts) {
  const maxLines = Math.max(1, opts.maxLinesPerSegment || 1);
  const ws = group.words;
  const lines = [];
  let start = 0;

  if (opts.measure && opts.maxWidthPx > 0) {
    const space = opts.spacePx || 0;
    let width = 0;
    for (let i = 0; i < ws.length; i++) {
      const wpx = opts.measure(ws[i].text);
      const withWord = width === 0 ? wpx : width + space + wpx;
      const lastLine = lines.length === maxLines - 1;
      if (width > 0 && withWord > opts.maxWidthPx && !lastLine) {
        lines.push(_lineOf(ws, start, i - 1));
        start = i;
        width = wpx;
      } else {
        width = withWord;
      }
    }
    lines.push(_lineOf(ws, start, ws.length - 1));
    return lines;
  }

  const maxChars = opts.maxCharsPerSegment || 30;
  let chars = 0;
  for (let i = 0; i < ws.length; i++) {
    const wlen = ws[i].text.length;
    const withWord = chars === 0 ? wlen : chars + 1 + wlen;
    const lastLine = lines.length === maxLines - 1;
    if (chars > 0 && withWord > maxChars && !lastLine) {
      lines.push(_lineOf(ws, start, i - 1));
      start = i;
      chars = wlen;
    } else {
      chars = withWord;
    }
  }
  lines.push(_lineOf(ws, start, ws.length - 1));
  return lines;
}

function _lineOf(ws, a, b) {
  let text = '';
  for (let k = a; k <= b; k++) text += (k > a ? ' ' : '') + ws[k].text;
  return { startIdx: a, endIdx: b, text };
}

/* ── Per-word animation model ─────────────────────────────── */

/**
 * Animation state of one word at absolute time t.
 * params: { start, fadeDur, slideDist, easing, intensity }
 * Returns { opacity 0..1, dy px (comp px, +down), scaleX, scaleY, captionLevel }.
 * captionLevel=true means the preset animates the whole caption from the
 * group's start (caller passes group start as `start`).
 */
export function wordAnim(preset, params, t) {
  const start = params.start || 0;
  const fadeDur = params.fadeDur || 0.3;
  const slideDist = params.slideDist != null ? params.slideDist : 40;
  const ease = EASINGS[params.easing] || EASINGS.linear;
  const intensity = params.intensity || 1.0;
  const dt = t - start;
  const base = { opacity: 1, dy: 0, scaleX: 1, scaleY: 1, captionLevel: false };

  switch (preset) {
    case 'popin': {
      if (dt < 0) return { ...base, opacity: 0, scaleX: 0, scaleY: 0 };
      // Damped spring (matches jsx EF_SPRING_SCALE: f=3.0, d=6.0)
      const s = 1 - Math.exp(-6 * dt) * Math.cos(3 * 2 * Math.PI * dt);
      const o = clamp01(dt / 0.1);
      return { ...base, opacity: o, scaleX: s, scaleY: s };
    }
    case 'bounce': {
      if (dt < 0) return { ...base, opacity: 0 };
      const o = Math.exp(-6 * dt) * Math.cos(2 * 2 * Math.PI * dt);
      return { ...base, opacity: clamp01(dt / 0.1), dy: -160 * intensity * o };
    }
    case 'squash': {
      if (dt < 0) return { ...base, opacity: 0, scaleX: 0, scaleY: 0 };
      // Matches jsx ef_squashExpr: maxDev=13i, spd=18i, decay=1
      const dev = Math.abs(13 * intensity * Math.exp(-1 * dt) * Math.sin(18 * intensity * dt));
      const sx = (100 - dev) / 100;
      const sy = (100 + dev) / 100;
      return { ...base, opacity: clamp01(dt / 0.1), scaleX: sx, scaleY: sy };
    }
    case 'typewriter': {
      return { ...base, opacity: dt >= 0 ? 1 : 0 };
    }
    case 'fade': {
      const p = ease(clamp01(dt / fadeDur));
      return { ...base, opacity: p, captionLevel: true };
    }
    case 'fadeup': {
      const p = ease(clamp01(dt / fadeDur));
      return { ...base, opacity: p, dy: slideDist * (1 - p), captionLevel: true };
    }
    case 'fadeup_words':
    default: {
      if (dt < 0) return { ...base, opacity: 0, dy: slideDist };
      const p = ease(clamp01(dt / fadeDur));
      return { ...base, opacity: p, dy: slideDist * (1 - p) };
    }
  }
}

/* ── Caption timing (in/out points) ───────────────────────── */

/**
 * Compute layer in/out for each group. Rules (the user's manual fix, automated):
 *  - in  = group's first word start
 *  - out = next group's start + overlapFrames·frameDur ("hold until next"),
 *          capped at (visible end + maxHold) so long silences still clear
 *  - visible end = max(group end, in + minDur)
 *  - last group: visible end + tailHold
 * Returns [{in, out}] aligned with groups.
 */
export function captionTiming(groups, opts) {
  const frameDur = opts.frameDur || 1 / 30;
  const overlap = (opts.overlapFrames != null ? opts.overlapFrames : 2) * frameDur;
  const minDur = opts.minDur != null ? opts.minDur : 0.7;
  const tailHold = opts.tailHold != null ? opts.tailHold : 0.5;
  const maxHold = opts.maxHold != null ? opts.maxHold : 1.5;

  return groups.map((g, i) => {
    const tIn = g.start;
    const visibleEnd = Math.max(g.end, tIn + minDur);
    const next = groups[i + 1];
    let tOut;
    if (next) {
      tOut = Math.min(next.start + overlap, visibleEnd + maxHold);
      // never end before the caption's own words finish
      if (tOut < g.end) tOut = g.end;
    } else {
      tOut = visibleEnd + tailHold;
    }
    if (tOut <= tIn) tOut = tIn + frameDur;
    return { in: tIn, out: tOut };
  });
}

/* ── Read-back: merge AE-side manual timing into the panel's words ── */

/**
 * Map word markers pulled from AE captions back onto the panel's word list.
 * AE is the source of truth for TIME only — text edits stay panel-side.
 *
 * Matching is positional-with-text-confirmation: walk the panel words once,
 * consuming markers in order; a marker only claims a word when the text
 * matches (case/punctuation-insensitive), so a caption whose words were
 * edited in the panel can't silently retime the wrong word.
 *
 * captions: [{ words: [{ text, time }] }] (from ef_readCaptionTimings)
 * Returns { words: newWords, matched: n, skipped: n } — pure, no mutation.
 */
export function matchTimingsToWords(words, captions) {
  const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const flat = [];
  for (const cap of captions || []) for (const m of (cap.words || [])) flat.push(m);

  const out = words.map((w) => ({ ...w }));
  let wi = 0, matched = 0, skipped = 0;
  for (const m of flat) {
    // find the next panel word with the same text (bounded lookahead so one
    // deleted word can't desync the whole transcript)
    let found = -1;
    for (let k = wi; k < Math.min(out.length, wi + 8); k++) {
      if (norm(out[k].word || out[k].text) === norm(m.text)) { found = k; break; }
    }
    if (found === -1) { skipped++; continue; }
    const w = out[found];
    const dur = Math.max(0.02, (w.end || 0) - (w.start || 0));
    w.start = m.time;
    w.end = m.time + dur;
    matched++;
    wi = found + 1;
  }
  return { words: out, matched, skipped };
}
