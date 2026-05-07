# Career-Ops -- AI Job Search Pipeline

## Origin

Built to evaluate 740+ job offers and land a Head of Applied AI role. Archetypes, scoring, and proof point structure reflect AI/automation roles — designed to be made yours.

**It will work out of the box, but it's designed to be made yours.** Just ask to change archetypes, scoring weights, or anything else. You (AI Agent) can edit the user's files directly.

## Data Contract (CRITICAL)

There are two layers. Read `DATA_CONTRACT.md` for the full list.

**User Layer (NEVER auto-updated, personalization goes HERE):**
- `cv.md`, `config/profile.yml`, `modes/_profile.md`, `article-digest.md`, `portals.yml`
- `data/*`, `reports/*`, `output/*`

**System Layer (auto-updatable, DON'T put user data here):**
- `modes/_shared.md`, `modes/evaluate.md`, all other modes
- `CLAUDE.md`, `*.mjs` scripts, `dashboard/*`, `templates/*`, `batch/*`

**THE RULE: When the user asks to customize anything (archetypes, narrative, scoring weights, proof points, location policy, comp targets), ALWAYS write to `modes/_profile.md` or `config/profile.yml`. NEVER edit `modes/_shared.md` for user-specific content.**

## Update Check

On the first message of each session, run the update checker silently:

```bash
node update-system.mjs check
```

Parse the JSON output:
- `{"status": "update-available", "local": "1.0.0", "remote": "1.1.0", "changelog": "..."}` → tell the user:
  > "career-ops update available (v{local} → v{remote}). Your data (CV, profile, reports) will NOT be touched. Want me to update?"
  If yes → run `node update-system.mjs apply`. If no → run `node update-system.mjs dismiss`.
- Any other status → say nothing

The user can also say "check for updates" or "update career-ops" at any time to force a check.
To rollback: `node update-system.mjs rollback`

## What is career-ops

AI-powered job search automation: offer evaluation, portal scanning, batch processing, company research.

### Main Files

| File | Function |
|------|----------|
| `data/shortlist.md` | High-score offers (≥4.0) to send to recruiter |
| `data/pipeline.md` | Inbox of pending URLs |
| `data/scan-history.tsv` | Scanner dedup history |
| `portals.yml` | Query and company config |
| `article-digest.md` | Compact proof points from portfolio (optional) |
| `scan.mjs` | Zero-token portal scanner — hits Greenhouse/Ashby/Lever APIs directly |
| `check-liveness.mjs` | Job posting liveness checker |
| `liveness-core.mjs` | Shared liveness logic (expired signals win over generic Apply text) |
| `reports/` | Evaluation reports (format: `{###}-{company-slug}-{YYYY-MM-DD}.md`). Blocks A-F + G (Posting Legitimacy). Header includes `**Legitimacy:** {tier}`. |

### First Run — Onboarding (IMPORTANT)

**Before doing ANYTHING else, check if the system is set up.** Run these checks silently every time a session starts:

1. Does `cv.md` exist?
2. Does `config/profile.yml` exist (not just profile.example.yml)?
3. Does `modes/_profile.md` exist (not just _profile.template.md)?
4. Does `portals.yml` exist (not just templates/portals.example.yml)?

If `modes/_profile.md` is missing, copy from `modes/_profile.template.md` silently.

**If ANY of these is missing, enter onboarding mode.** Do NOT proceed until the basics are in place.

#### Step 1: CV (required)
If `cv.md` is missing, ask:
> "I don't have your CV yet. You can either:
> 1. Paste your CV here and I'll convert it to markdown
> 2. Paste your LinkedIn URL and I'll extract the key info
> 3. Tell me about your experience and I'll draft a CV for you"

Create `cv.md` with sections: Summary, Experience, Projects, Education, Skills.

#### Step 2: Profile (required)
If `config/profile.yml` is missing, copy from `config/profile.example.yml` and ask:
> "I need: your name/email, location, target roles, and salary range."

Store user-specific archetypes and narrative in `modes/_profile.md` or `config/profile.yml`, not in `modes/_shared.md`.

#### Step 3: Portals (recommended)
If `portals.yml` is missing, copy `templates/portals.example.yml` → `portals.yml`. Update `title_filter.positive` to match their target roles.

#### Step 4: Shortlist
If `data/shortlist.md` doesn't exist, create it:
```markdown
# Shortlist — Offers Worth Applying To

| # | Date | Company | Role | Score | Report |
|---|------|---------|------|-------|--------|
```

#### Step 5: Get to know the user

> "The basics are ready. The system works much better when it knows you well:
> - What makes you unique? What's your 'superpower'?
> - What kind of work excites you? What drains you?
> - Any deal-breakers? (e.g., no on-site, no startups under 20 people)
> - Your best professional achievement
> - Any published projects, articles, or case studies?"

Store insights in `config/profile.yml` (under narrative), `modes/_profile.md`, or `article-digest.md`.

**After every evaluation, learn.** If the user says "this score is too high" or "you missed X", update `modes/_profile.md` or `config/profile.yml`.

#### Step 6: Ready
> "You're all set! Paste a job URL to evaluate, or run `/career-ops scan` to search portals."

### Personalization

You (AI Agent) can edit the user's files directly. Common requests:
- "Change the archetypes" → edit `modes/_profile.md` or `config/profile.yml`
- "Add companies to my portals" → edit `portals.yml`
- "Update my profile" → edit `config/profile.yml`
- "Adjust scoring weights" → edit `modes/_profile.md`

### Skill Modes

| If the user... | Mode |
|----------------|------|
| Pastes JD or URL | auto-pipeline (evaluate + report + shortlist) |
| Asks to evaluate offer | `evaluate` |
| Asks for company research | `deep` |
| Searches for new offers | `scan` |
| Processes pending URLs | `pipeline` |
| Batch processes offers | `batch` |

### CV Source of Truth

- `cv.md` in project root is the canonical CV
- `article-digest.md` has detailed proof points (optional)
- **NEVER hardcode metrics** — read them from these files at evaluation time

---

## Ethical Use -- CRITICAL

**This system is designed for quality, not quantity.**

- **NEVER submit an application without the user reviewing it first.**
- **Strongly discourage low-fit applications.** Score below 4.0/5 → recommend against applying.
- **Quality over speed.** Guide the user toward fewer, better applications.

---

## Offer Verification -- MANDATORY

**NEVER trust WebSearch/WebFetch to verify if an offer is still active.** ALWAYS use Playwright:
1. `browser_navigate` to the URL
2. `browser_snapshot` to read content
3. Only footer/navbar without JD = closed. Title + description + Apply = active.

**Exception for batch workers (`claude -p`):** Playwright is not available in headless pipe mode. Use WebFetch as fallback and mark the report header with `**Verification:** unconfirmed (batch mode)`.

---

## Stack and Conventions

- Node.js (mjs modules), Playwright (scraping), YAML (config), Markdown (data)
- Output in `output/` (gitignored), Reports in `reports/`
- JDs in `jds/` (referenced as `local:jds/{file}` in pipeline.md)
- Batch in `batch/` (gitignored except scripts and prompt)
- Report numbering: sequential 3-digit zero-padded, max existing + 1

### Shortlist Format

After each evaluation, if score >= 4.0, append one row to `data/shortlist.md`:

```
| {num} | {YYYY-MM-DD} | {Company} | {Role} | {score}/5 | [{num}](reports/{num}-{slug}-{date}.md) |
```

### Pipeline Integrity

1. All reports MUST include `**URL:**` in the header. Include `**Legitimacy:** {tier}` (see Block G in `modes/evaluate.md`).
2. Health check: `node verify-pipeline.mjs`
3. Normalize statuses: `node normalize-statuses.mjs`
