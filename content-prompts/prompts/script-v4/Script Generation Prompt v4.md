# Documentary Script Factory v4 — Claude Code Pipeline
### Version: 4.0 | Content-Skills Integration

---

## ════════════════════════════════════════════════
## UNIVERSAL NON-NEGOTIABLE RULES
## ════════════════════════════════════════════════

Before any agent does anything, these rules govern every word produced:

1. **PKR ONLY** — All monetary amounts in Pakistani Rupees. Convert USD/EUR at current market rate. Never show dual currency. Never show USD alone.
2. **REAL SOURCES ONLY** — Every named person, company, institution, or statistic must be verifiable. If no real named entity exists, describe the mechanism without one. Do not hallucinate.
3. **INLINE FOOTNOTES ARE MANDATORY** — Every factual claim carries an inline marker: `"Pakistan has 240 million people.[¹]"` A claim without a marker is deleted. No exceptions.
4. **SOURCE FORMAT** — Every source: `[¹] https://full-url.com — Publication Name — Date` No shortened URLs. No "...". No publication-only citations.
5. **MARK UNVERIFIED CLAIMS** — Claims without a source: `❌ UNVERIFIED — [claim text]` These are never used in final narration.
6. **PAKISTAN ONLY** — All examples, institutions, laws, currency, cultural references are Pakistani. No foreign comparisons unless they directly illuminate the Pakistani story.

**PAKISTANI SOURCE PRIORITY LIST (check in this order):**
```
1. Pakistan Bureau of Statistics — pbs.gov.pk
2. State Bank of Pakistan — sbp.org.pk
3. SECP — secp.gov.pk
4. Auditor General of Pakistan — agp.gov.pk
5. Federal Board of Revenue — fbr.gov.pk
6. NAB / FIA — nab.gov.pk / fia.gov.pk
7. Public Accounts Committee — na.gov.pk
8. World Bank Pakistan — worldbank.org/en/country/pakistan
9. Dawn / Dawn Investigations — dawn.com
10. Profit by Pakistan Today — profit.pakistantoday.com.pk
11. The News / Geo — thenews.com.pk
12. Express Tribune — tribune.com.pk
```

**RECENCY HIERARCHY — ALL AGENTS (replaces all hardcoded years):**
```
Priority 1: Published in last 30 days  → always prefer, label 🔴 HOT
Priority 2: Published in last 6 months → use if no fresher source exists, label 🟡 WARM
Priority 3: Published in last 5 years  → structural/historical context only, label 🟢 EVERGREEN
Priority 4: Older than 5 years        → requires [SCRIPTWRITER NOTE: SOURCE AGE — justification]
```
Never write a hardcoded year in a search query. Search without year anchors so the model returns the freshest results.

**THE ANTI-VOICE LIST (Universal Rule 14) — ALL AGENTS:**
Every script must be purged of these AI-voice tells. The Creative Director enforces this. If any appear in the final script, flag and rewrite:
Every script must be purged of these AI-voice tells. The Creative Director enforces this. If any appear in the final script, flag and rewrite:
- "Let's dive in", "unlock the secrets", "the truth about", "you won't believe"
- "In today's world", "in a world where", "when it comes to"
- "It's not X, it's Y" reframe (hollow version — see Anti-AI-Writing)
- Corporate transitions: "Let's explore", "Now let's consider", "To summarize"
- Manufactured physical emotion: "you feel that jolt", "imagine yourself"
- "This raises the question", "this begs the question" (always pretentious)
- "A tale as old as time", "the elephant in the room" (dead clichés)

---

## ════════════════════════════════════════════════
## PHASE FLOW — 10-AGENT PIPELINE
## ════════════════════════════════════════════════

```
PHASE 0 — Agent 0: Topic Discovery
  File: agent_topic_discovery.md
  → Live scan, 3-tier search, social proof verification
  → Viral scoring (9-point or 4-point) + Scriptability scoring (4 essentials)
  → Output: 8 candidates with dual scores
  → ⛔ STOPS FOR USER SELECTION

USER SELECTS TOPIC
  ↓

PHASE 1 — Agent 1: Narrative Architect
  File: agent_narrative_architect.md
  → Type routing → Structure (7-step or 5-step)
  → Narrator stance selection
  → PRELIMINARY emotional arc + visual story arc
  → Forward motion diagnostic
  → Evidence inventory + research briefs
  → **Story Lens Push-Past Techniques applied**

PHASE 2 — Agents 2, 3, 4: Parallel Research
  File: agent_research.md (all 3 agents in one file, clearly separated)
  → Agent 2: Historical & Structural Research
  → Agent 3: Mechanism & Case Study Research (+ conditional micro-story)
  → Agent 4: Solutions & Reform Research

PHASE 2.5 — Agent 1B: Arc Reconciler
  File: agent_arc_reconciler.md
  → Reads Agent 1's preliminary arc + all 3 research reports
  → Adjusts emotional arc to match research reality
  → Builds FINAL technique deployment list (STRONG / WEAK / ABSENT per technique)
  → Output: FINAL Emotional Arc Map + FINAL Technique Deployment List

PHASE 3A — Agent 5A: Draft Scriptwriter
  File: agent_draft_scriptwriter.md
  → Writes narration ONLY (no visuals, no formatting)
  → Follows FINAL arc from Agent 1B
  → Deploys: open loops, vulnerability beats, re-hooks (per technique list)
  → **BUT/THEREFORE Protocol applied**
  → **Specificity Ladder (target level 3+)**
  → **4 Hook Killers framework**
  → **Learning Retention: retrieval cue, spaced callback, elaborative question**
  → Output: single-column narration with timestamps + footnotes

PHASE 3B — Agent 5B: Visual Architect
  File: agent_visual_architect.md
  → Reads Agent 5A's narration
  → Builds visual track alongside narration (paired blocks per section)
  → Deploys: visual reveals, visual callbacks, visual specificity
  → Output: narration + visual track (section by section)

PHASE 3C — Agent 5C: Rhythm & Polish
  File: agent_rhythm_polish.md (also references quality_tests.md)
  → Sentence rhythm variation (soft guidelines, not rigid counts)
  → Pattern interrupt placement (at energy dips, not on timer)
  → Re-hook review at section transitions
  → Anti-lecture shield for context-heavy sections
  → **dumbify readability check**
  → **storytelling rhythm (jagged-edge test)**

PHASE 3D — Agent 5D: Creative Director
  File: agent_creative_director.md (also references quality_tests.md)
  → Forced technique scan (remove anything manufactured)
  → Humanity pass (voice consistency)
  → **dumbify pass (8th-grade target)**
  → **storytelling diagnostic (BUT/THEREFORE, Dance, Direction, Lens)**
  → **anti-ai-writing pass (5 diseases, negative parallelism, specificity)**
  → **Anti-Voice List enforcement**
  → Rule-breaking license (ONLY agent allowed to break rules)
  → Final elevation pass (5 quality tests)
  → **Expanded quality tests: Learning Retention, Hollow-vs-Earned, Hook Killers, Anti-AI**
  → YouTube packaging (titles, thumbnails, description, chapters, tags)
  → Output: FINAL script + Director's Notes

PHASE 4 — Agent 6: Fact Verifier (Optional)
  File: agent_fact_verifier.md
  → Audits every footnote URL
  → Confirms claims match sources
  → For Type D: verifies live source accessibility
```

---

## ════════════════════════════════════════════════
## FILE READING MAP — WHAT EACH AGENT READS
## ════════════════════════════════════════════════

Use sub-agents aggressively and intelligently. Each sub-agent should read ONLY the files needed for its role:

```
Agent 0      reads: agent_topic_discovery.md
Agent 1      reads: agent_narrative_architect.md + Agent 0's output
Agents 2,3,4 reads: agent_research.md (each executes its own section) + Agent 1's briefs
Agent 1B     reads: agent_arc_reconciler.md + Agent 1's output + Agents 2,3,4 reports
Agent 5A     reads: agent_draft_scriptwriter.md + Agent 1B's output + all research reports
Agent 5B     reads: agent_visual_architect.md + Agent 5A's draft + Agent 1's visual story arc
Agent 5C     reads: agent_rhythm_polish.md + quality_tests.md + Agent 5B's output + Agent 1B's emotional arc
Agent 5D     reads: agent_creative_director.md + quality_tests.md + Agent 5C's output + Agent 1B's technique list
Agent 6      reads: agent_fact_verifier.md + Agent 5D's final script
```

---

## ════════════════════════════════════════════════
## IMPORTANT RULES FOR EXECUTION
## ════════════════════════════════════════════════

1. **Do not ask for approval between phases** unless you hit a real blocker. Continue automatically.
2. **Phase 0 is the ONLY mandatory stop** — wait for user topic selection before proceeding.
3. **Research agents (Phase 2) run in parallel** where safe.
4. **Phases 3A → 3B → 3C → 3D run sequentially** — each depends on the previous agent's output.
5. **Every agent's output is saved** and passed to the next agent in the chain.
6. **If any agent encounters a gap** it cannot fill, it marks the gap with `[NOTE: GAP — reason]` and continues. Do NOT stop the pipeline for minor gaps.
7. **Pakistani truth takes priority over the blueprint.** If research contradicts the planned narrative, the narrative adjusts to reality. Never force a plan onto facts.
8. **v4 content-skills are active.** Each agent checks its assigned skills (dumbify, storytelling, anti-ai-writing, viral-hooks, learning retention) and applies them. Do not skip a technique because it is "optional." Apply per the technique deployment list.

---

## ════════════════════════════════════════════════
## REQUIRED FINAL OUTPUTS
## ════════════════════════════════════════════════

Agent 5D (Creative Director) delivers the final package:

**PART 1 — SOURCE REGISTRY**

| # | Claim (exact text) | Full URL | Publication | Date | Status |
|---|-------------------|----------|-------------|------|--------|
| 1 | "..." | https://... | Name | Date | ✅/❌ |

**PART 2 — FINAL SCRIPT**
```
[SECTION TITLE]
[00:00:00 – 00:00:00]

VISUAL TRACK                    | NARRATION TRACK
================================|================================
[Visual description]            | Narration text.[¹] More narration.[²]

[Continue for all sections]
```

End with:
```
REFERENCES
[¹] https://... — Publication — Date
[²] https://... — Publication — Date
[continue for all markers]
```

**PART 3 — YOUTUBE PACKAGING**
(Title options, thumbnail concept, description, chapters, tags — format varies by type, see agent_creative_director.md)

**PART 4 — DIRECTOR'S NOTES**
- Techniques successfully deployed (including v4 content-skills)
- Techniques skipped (with reasons)
- Rules broken (with justifications)
- Remaining weak spots for user review

---


## ════════════════════════════════════════════════
## APP PUSH PROTOCOL (v7 addition)
## ════════════════════════════════════════════════

After generating the final script + research, push them to the Documentary Studio app:

### Prerequisites
- The user gives you a tunnel URL (e.g. `https://random-words.trycloudflare.com`)
- Store as `<APP_URL>` for all requests below
- Get the project ID: `GET <APP_URL>/api/projects` → pick the project, note its `id`

### 1. Push research as hierarchical topics + child links

For each research topic (parent):
```
POST <APP_URL>/api/projects/<projectId>/research
{
  "parentId": null,
  "title": "Pakistan textile exports decline 2024",
  "content": "Summary of the research finding...",
  "url": "",
  "category": "context",
  "tags": "pakistan,economy,textile"
}
```

For each source link under that topic (child):
```
POST <APP_URL>/api/projects/<projectId>/research
{
  "parentId": "<topic_id_from_previous_response>",
  "title": "Dawn: Pakistan textile exports fall 12% in Q3",
  "url": "https://www.dawn.com/news/...",
  "content": "Why this source matters...",
  "category": "fact-check"
}
```

Categories: `general` | `interview` | `archival` | `context` | `fact-check`

### 2. Push script sections

For each section of the final script:
```
POST <APP_URL>/api/projects/<projectId>/script
{
  "type": "act",
  "heading": "ACT I — THE BASEMENT",
  "content": "The full narration text with inline footnotes [1][2]..."
}
```

Types: `hook` | `act` | `transition` | `outro`

### 3. Push sources (for the footnote references)

For each source in the source registry:
```
POST <APP_URL>/api/projects/<projectId>/sources
{
  "type": "article",
  "title": "...",
  "author": "Last, F.",
  "url": "https://...",
  "publisher": "...",
  "publicationDate": "2024-03-15",
  "citation": "Full APA citation",
  "notes": "Why this source matters",
  "credibility": 4
}
```

Types: `book` | `article` | `paper` | `video` | `interview` | `website` | `archival`
Credibility: 1-5 (5 = primary source, 3 = reputable secondary, 1 = weak)

### 4. Inline footnotes in script content

The script content you push MUST include inline footnotes:
```
"Pakistan has 240 million people.[1] The textile sector employs 40% of the workforce.[2]"
```

The app renders `[1]` footnotes as clickable links that open in a sidebar showing:
- The source URL (from the sources you pushed)
- An AI summarize button (uses the app's AI co-pilot to summarize the page)
- A chat-about-this-source button (start a focused chat about this source)

So every `[N]` in the script MUST correspond to a source you push to `/sources`.

### 5. Push production tasks

For each task in the production plan:
```
POST <APP_URL>/api/projects/<projectId>/tasks
{
  "title": "Schedule archive access window",
  "category": "research",
  "status": "todo",
  "priority": "high",
  "dueDate": "2025-09-15",
  "notes": ""
}
```

Categories: `research` | `filming` | `editing` | `graphics` | `sound` | `licensing` | `publish` | `general`

### Golden rules for app push

1. **Always use the tunnel URL the user gave you** — don't guess
2. **Push research topics first, then child links** (so you have the parent IDs)
3. **Every footnote [N] must map to a source** — don't leave orphan references
4. **Push max 5 items per batch** — don't spam the app
5. **Tell the user when you're done** — "Pushed 8 research topics, 6 script sections, 12 sources to your app. Review in the Research and Script tabs."

## ════════════════════════════════════════════════
## EXECUTION ORDER SUMMARY
## ════════════════════════════════════════════════

```
PHASE 0 — Agent 0 (Topic Discovery)
  → Mandatory live scan (dawn.com, geo.tv, YouTube coverage gap check)
  → 3-tier search (Global, Pakistan Original, Hybrid)
  → Social proof verification (4-signal protocol) for Type D candidates
  → Freshness decay tier assigned to each Type D candidate
  → Topic scoring: 9-point Viral Test (A/B/C) OR 4-point Trending Threshold (D)
  → Scriptability scoring: 4 essential checks (Revelation Gap, Visual Anchor, Emotional Arc, Open Loop)
  → Enhancement layer flags: micro-story, history, solutions, contrast availability
  → Output: 8 candidates with enforced mix + dual scores
  → ⛔ STOPS FOR USER SELECTION

USER SELECTS TOPIC
  ↓

PHASE 1 — Agent 1 (Narrative Architect)
  → Type routing: A/B/C → 7-step | D → 5-step | hybrid → 5+depth
  → Narrator stance: Investigator / Curious Citizen / Witness / Rapid Responder
  → PRELIMINARY emotional arc map (beat-by-beat feelings + energy levels)
  → Visual story arc (7 visual set pieces)
  → Forward motion diagnostic (question chain verification)
  → Evidence inventory
  → Type-conditional research briefs for Agents 2, 3, 4
  → Scriptwriter brief for Agent 5A (with arc + stance + sample rhythms)
  → **Story Lens Push-Past Techniques: invert villain, find asset in failure, jump to second-order, switch POV, flip cost/benefit**

PHASE 2 — Agents 2 + 3 + 4 (Parallel Research)
  → Agent 2: Historical & Structural (depth varies by type)
  → Agent 3: Mechanism & Case Study (+ micro-story if flagged available)
  → Agent 4: Solutions & Reform (+ absence-as-story if flagged unavailable)

PHASE 2.5 — Agent 1B (Arc Reconciler)
  → Reconciles preliminary arc with research reality
  → Builds FINAL technique deployment list (STRONG / WEAK / ABSENT)
  → Outputs FINAL emotional arc map + structural adjustments

PHASE 3A — Agent 5A (Draft Scriptwriter)
  → Reads FINAL arc + technique list + all research
  → Writes narration only (no visuals)
  → Deploys: open loops, vulnerability beats, re-hooks per technique list
  → **BUT/THEREFORE Protocol: replace "and then" with but/therefore between beats**
  → **Specificity Ladder: target level 3+ (concrete), avoid level 1-2 (vague)**
  → **Teach by Example: one concrete example per major point**
  → **4 Hook Killers: check for DELAY, CONFUSION, IRRELEVANCE, DISINTEREST**
  → **Platform-specific hook table (reel/YT/LinkedIn/X/newsletter/carousel)**
  → **Learning Retention Protocol:**
      - Retrieval cue: callback to earlier anchor/number/analogy
      - Spaced callback: main concept appears 3x (intro, middle, final meaning)
      - Elaborative question: "why/how does this connect?" to make viewer process

PHASE 3B — Agent 5B (Visual Architect)
  → Reads 5A's narration + visual story arc
  → Builds visual track (paired blocks per section)
  → Visual reveals, callbacks, specificity mandate

PHASE 3C — Agent 5C (Rhythm & Polish)
  → Sentence rhythm variation (soft guidelines)
  → Pattern interrupts at energy dips
  → Re-hook review at transitions
  → Anti-lecture shield for context sections
  → **dumbify readability check: flag sentences >25 words, jargon, abstraction**
  → **storytelling rhythm check: jagged-edge test, speak-aloud test**
  → **learning retention check: Does main idea appear 3x? Does callback exist?**

PHASE 3D — Agent 5D (Creative Director)
  → Forced technique scan + humanity pass
  → **dumbify pass: target ~8th-grade reading level, preserve rhythm and voice**
  → **storytelling diagnostic: check BUT/THEREFORE, Direction (end written first?), Lens (non-obvious?), Rhythm (jagged edge?)**
  → **anti-ai-writing pass: diagnose 5 diseases (vagueness compression, significance inflation, hedged confidence, rhythmic flatness, borrowed authority). Enforce specificity ladder. Enforce negative parallelism ban.**
  → **Anti-Voice List enforcement: purge banned phrases**
  → **Learning Retention check: Can viewer explain core idea in one sentence?**
  → Rule-breaking license
  → Final elevation pass (expanded quality tests)
  → YouTube packaging (type-specific format)
  → Delivers: Source Registry + Final Script + YouTube Packaging + Director's Notes

PHASE 4 — Agent 6 (Fact Verifier) — Optional
  → Audits all footnotes
  → For Type D: verifies live source accessibility
  → Returns errors to Agent 5D for correction

TOTAL: 10 agents + 1 optional = 11 maximum
Types supported: A, B, C, D, D+A, D+B, D+C, A+B, B+C
```

---

## v4 SKILL INTEGRATION SUMMARY

| Skill | Where Applied | Key Mechanism |
|-------|--------------|---------------|
| **dumbify** | Creative Director §1.6, Rhythm §Readability | 8th-grade target, one idea/sentence, concrete > abstract, active voice |
| **storytelling** | Creative Director §2, Narrative Architect §Lens | The Dance (BUT/THEREFORE), Direction (end first), Story Lens (push-past), Rhythm (jagged edge) |
| **anti-ai-writing** | Creative Director §Humanity Pass, Quality Tests | 5 diseases, specificity ladder, negative parallelism ban, hollow vs earned |
| **viral-hooks** | Draft Scriptwriter §Hooks | 4 Hook Killers, platform-specific hook shapes |
| **learning retention** | Draft Scriptwriter §3A, Quality Tests | Retrieval cue, spaced callback (3x), elaborative question |
| **Anti-Voice List** | Universal Rules + Creative Director | Banned phrases list, transition ban, cliché purge |
