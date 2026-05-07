# Mode: auto-pipeline — Full Automatic Pipeline

When the user pastes a JD (text or URL) without an explicit sub-command, run the pipeline in sequence:

## Step 0 — Extract JD

If the input is a **URL**, follow this priority order:

1. **Playwright (preferred):** Most job portals (Lever, Ashby, Greenhouse, Workday) are SPAs. Use `browser_navigate` + `browser_snapshot`.
2. **WebFetch (fallback):** For static pages.
3. **WebSearch (last resort):** Search for role title + company on secondary portals.

If none work: ask the candidate to paste the JD manually.

If the input is JD text (not a URL): use it directly.

## Step 0.5 — Quick Pre-screen

Using only the extracted JD text, check these hard filters. **No additional file reads needed.**

Check in order and stop at the first match:

1. **Not remote** — JD requires on-site, hybrid, or in-office attendance → SKIP
2. **Not full-time direct-hire** — Contract, part-time, fractional, C2C, staffing agency, or consulting firm billing client hours → SKIP
3. **Company too early-stage** — Explicitly Series A or earlier, pre-revenue, or clearly fewer than ~200 employees → SKIP
4. **Role off-target** — Title is unrelated (data analyst, data engineer, product manager, sales, etc.) or clearly junior (intern, entry-level, associate, new grad) → SKIP
5. **Comp below floor** — Base salary explicitly stated and below $200k USD → SKIP

**If any condition matches:**
- Output: `⛔ SKIP: [one-line reason]`
- Append one row to `data/screened-out.md` (create with header if missing):
  `| {YYYY-MM-DD} | {Company} | {Role} | {reason} |`
- **Stop. Do not load evaluate.md or proceed further.**

**If all conditions pass:**
- Output: `✓ Pre-screen passed — running full evaluation`
- Continue to Step 1.

## Step 1 — A-G Evaluation
Execute exactly the same as the `evaluate` mode (read `modes/evaluate.md` for all blocks A-F + Block G Posting Legitimacy).

## Step 2 — Save Report .md
Save the full evaluation to `reports/{###}-{company-slug}-{YYYY-MM-DD}.md` (see format in `modes/evaluate.md`).
Include Block G in the saved report. Add `**Legitimacy:** {tier}` to the report header.

## Step 3 — Update Shortlist
If final score >= 4.0, append one row to `data/shortlist.md` (create the file with header if it doesn't exist):

```
| {num} | {YYYY-MM-DD} | {Company} | {Role} | {score}/5 | [{num}](reports/{num}-{slug}-{date}.md) |
```

If score < 4.0, do not add to shortlist. State clearly: "Score below 4.0 — not added to shortlist."
