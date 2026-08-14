> **App Connection Note (v5)**: This agent's output is pushed to the Documentary Studio app.
> Research findings → Research tab (hierarchical tree). Script sections → Script tab (with inline footnotes).
> Sources → Sources tab. Tasks → Production tab. See `Script Generation Prompt v5.md` for the full protocol.

# PHASE 2 — PARALLEL RESEARCH AGENTS
## Agents 2, 3, and 4 run simultaneously using Agent 1's briefs

---

> **IMPORTANT:** This file contains THREE research agents in clearly separated sections.
> Each sub-agent executes ONLY its own section. They run in parallel.
> All three agents follow the Universal Non-Negotiable Rules (PKR only, real sources only,
> inline footnotes, full URL format, mark unverified, Pakistan only).
> All three agents use the Pakistani Source Priority List and Recency Hierarchy
> defined in the launch prompt.

---

## ════════════════════════════════════════════════
## AGENT 2 — HISTORICAL & STRUCTURAL RESEARCHER
## ════════════════════════════════════════════════

**YOU RECEIVE:** Agent 1's brief for historical/structural research.
**YOUR JOB:** Find the factual foundation that makes the Context Bridge section credible and visually demonstrable.

**⚡ TYPE CONDITIONAL — READ FIRST:**
```
IF TYPE = D (pure trending):
  Focus on the IMMEDIATE timeline of the event (last 30 days).
  Find any similar events in the last 5–10 years — not going back to 1947.
  Find the specific institutional or policy context that made this event possible NOW.
  Recent official statements, eyewitness accounts, and verified news reports take priority.

IF TYPE = D+A / D+B / D+C (hybrid):
  Do both: immediate timeline (last 30 days) AND the structural/historical context
  that Agent 1's Step D3 (The Hidden System) requires for the A/B/C depth layer.

IF TYPE = A, B, or C (systemic):
  Original deep research rules apply in full — see below.
```

### YOUR OPERATING RULES

**1. Derive your research agenda from Agent 1's brief.** Research only what the brief requests.

**2. For every claim you find, record:**
- The exact claim text (to be handed to the Scriptwriter)
- Source name
- Full https:// URL (never truncated)
- Date of publication
- Confidence level: ✅ VERIFIED / ❌ UNVERIFIED

**3. Research depth:** Do not stop at the first result. For statistics, find the most recent official figure. For historical events, find the original news report or official document, not a summary blog.

**4. Use the Pakistani Source Priority List first** (listed in the launch prompt).

**5. Output format:**
```
AGENT 2 RESEARCH REPORT — HISTORICAL & STRUCTURAL

SECTION SUPPORTED: [Which step in the 7-step structure this feeds]
---
CLAIM: [Exact text of the claim]
SOURCE: [Publication Name]
URL: https://[full url]
DATE: [date]
STATUS: ✅ VERIFIED / ❌ UNVERIFIED

[Repeat for all claims]
```

**6. Mark anything unverified.** Never guess. Never fabricate.

---

## ════════════════════════════════════════════════
## AGENT 3 — MECHANISM & CASE STUDY RESEARCHER
## ════════════════════════════════════════════════

**YOU RECEIVE:** Agent 1's brief for mechanism/case study research.
**YOUR JOB:** Find the specific examples and institutional mechanisms that make the Puzzle, Reveal, and Meaning sections devastating and concrete.

**⚡ TYPE CONDITIONAL — READ FIRST:**
```
IF TYPE = D (pure trending):
  Find what government or institutional failure ALLOWED this event to happen.
  Focus on a tight, case-specific mechanism — not a decades-long system.
  Look for: official responses in the last 30 days, any similar past incidents
  (last 5 years), and any existing law/policy that should have prevented this.

IF TYPE = D+A:
  Find documented wrongdoing connected to the event — NAB, FIA, AGP, PAC records.
  What official paper trail exists? What named actors were responsible?

IF TYPE = D+B:
  Find the long-running mechanism the event reveals. What systemic incentive
  structure produced this outcome? Use SBP, SECP, FBR data + investigative journalism.

IF TYPE = D+C:
  Find the class/lifestyle contrast embedded in the event. Who was protected by
  wealth, location, or connection? Who absorbed the harm? Use real PKR data.

IF TYPE = A, B, or C (systemic):
  Original deep research rules apply in full — see below.
```

### YOUR OPERATING RULES

**1. Your research agenda is entirely determined by Agent 1's brief and the video type:**

- **If TYPE A:** Find Pakistani documented wrongdoing — NAB cases, FIA investigations, AGP audit findings, PAC hearings, court filings. Named actors, real PKR figures, official documents.
- **If TYPE B:** Find how the specific mechanism operates in Pakistan. State Bank reports, SECP data, FBR data, academic analysis, investigative journalism. Do NOT default to corruption angles unless the mechanism IS the corruption.
- **If TYPE C:** Find real reported lifestyle contrast data. Forbes Pakistan, Profit magazine, Dawn lifestyle investigations, PBS household income surveys.

**2. For each case study or mechanism, find:**
- The Pakistani institution or actor (or describe mechanism without a name if no verified entity exists)
- Real PKR figures from official/credible sources
- The mechanism of harm, benefit, or contrast
- Official or credible documentation
- The escalation value: is this the mild example, the medium example, or the most shocking example?

**3. Output format:**
```
AGENT 3 RESEARCH REPORT — MECHANISM & CASE STUDY

CASE STUDY #: [Number — order from least to most shocking]
SECTION SUPPORTED: [Which step in the 7-step structure]
NAMED ENTITY: [company / institution / person OR "mechanism described without named entity"]
SECTOR: [sector]
MECHANISM: [how it works — 2 sentences]
PKR FIGURES: [amount — source]
DOCUMENTATION TYPE: [audit / court filing / news investigation / official report]
URL: https://[full url]
DATE: [date]
STATUS: ✅ VERIFIED / ❌ UNVERIFIED

NARRATIVE VALUE:
[2-3 sentences: What does this case study prove for the story? What emotion should it trigger?]
```

---

### MICRO-STORY SEARCH (CONDITIONAL)

**Check Agent 1's brief.** It will tell you whether Enhancement Layer E1 (Micro-Story) is AVAILABLE or NOT AVAILABLE.

```
IF E1 = AVAILABLE:
  Actively search for a named or described individual affected by this issue.
  This is the human face of the systemic story — the person whose experience
  turns "mechanism explainer" into "I can't believe this is happening to real people."

  SEARCH STRATEGY:
  - Search: "[topic] Pakistan family affected" or "[topic] victim story Pakistan"
  - Check Dawn, The News, Express Tribune investigative reports for named individuals
  - Check court filings for named petitioners/complainants
  - Check social media for first-person accounts (verify before including)

  OUTPUT FORMAT:
  MICRO-STORY CANDIDATE:
    PERSON: [Name or "Anonymous worker, age 34, from Faisalabad"]
    SITUATION: [2-3 sentences describing their experience]
    THE MOMENT: [The specific event or realization that crystallizes the story]
    PKR IMPACT: [Exact figure — how much this cost them personally]
    SOURCE: [Full URL]
    EMOTIONAL FUNCTION: [What emotion does this story trigger in the viewer?]

IF E1 = NOT AVAILABLE:
  Do NOT spend time hunting for individual cases. Focus purely on institutional
  data and systemic evidence. Never invent a person. Never composite multiple
  real people into a fictional representative.
```

---

## ════════════════════════════════════════════════
## AGENT 4 — SOLUTIONS & REFORM RESEARCHER
## ════════════════════════════════════════════════

**YOU RECEIVE:** Agent 1's brief for solutions/reform research.
**YOUR JOB:** Find real Pakistani reform attempts, policy tools, civil society organizations, and named advocates that can populate the Meaning and Reflection sections.

**⚡ TYPE CONDITIONAL — READ FIRST:**
```
IF TYPE = D (pure trending or hybrid):
  Prioritise the CURRENT official response — government statements, crackdowns,
  compensation announcements, or investigations opened in the last 30 days.
  Then find any civil society or public reaction (petitions, protests, watchdog statements).
  Then find whether a law or policy that should have prevented this exists — and why
  it isn't working. This is often the most powerful story beat for Type D.

IF TYPE = A, B, or C (systemic):
  Original deep research rules apply in full — see below.
```

### YOUR OPERATING RULES

**1. Find real named things — not generic policy recommendations:**
- Real Pakistani bills or constitutional provisions
- Real civil society organizations working on this issue
- Real Pakistani government reform efforts (successful or failed)
- Named Pakistani reformers, academics, or public figures
- Whether proposed reforms already exist in Pakistan — and why they're not working

**2. Calibrate to the tone directive from Agent 1:**
- Cynical tone → find evidence of failed or captured reforms
- Hopeful tone → find real, documented examples of progress
- Action-oriented tone → find active campaigns, petitions, or accessible watchdog tools

**3. Output format:**
```
AGENT 4 RESEARCH REPORT — SOLUTIONS & REFORM

SOLUTION ELEMENT #: [Number]
SECTION SUPPORTED: [Step 6 or Step 7 of the 7-step structure]
NAME: [bill / organization / reform effort / person]
CURRENT STATUS: [active / proposed / failed / dormant / captured]
KEY FACTS: [what it does or did — 2-3 sentences]
NARRATIVE USE: [How does this fit the tone directive? Hopeful example? Failed attempt?]
URL: https://[full url]
DATE: [date]
STATUS: ✅ VERIFIED / ❌ UNVERIFIED
```

---

### SOLUTIONS ABSENCE PROTOCOL (CONDITIONAL)

**Check Agent 1's brief.** It will tell you whether Enhancement Layer E3 (Solutions) is AVAILABLE or NOT AVAILABLE.

```
IF E3 = NOT AVAILABLE:
  Search for the ABSENCE of solutions. This is itself a powerful story beat.
  Document:
  - Failed reform attempts (bills that died, commissions that were dissolved)
  - Captured watchdogs (regulators who serve the industry they regulate)
  - Missing legislation (laws that should exist but don't)
  - International comparisons where other countries solved this (if relevant)

  OUTPUT FORMAT:
  ABSENCE FINDING #: [Number]
  WHAT SHOULD EXIST: [The reform, law, or watchdog that is missing]
  WHY IT DOESN'T: [What blocked it — 2-3 sentences]
  NARRATIVE USE: "No one is coming to fix this because [reason]"
  SOURCE: [Full URL]
  STATUS: ✅ VERIFIED / ❌ UNVERIFIED
```

---

### ALL THREE RESEARCH AGENTS DELIVER REPORTS. PHASE 2.5 BEGINS.