---
name: career-ops
description: AI job search command center -- evaluate offers, scan portals, track applications
user_invocable: true
args: mode
argument-hint: "[scan | deep | evaluate | batch | pipeline | update]"
---

# career-ops -- Router

## Mode Routing

Determine the mode from `{{mode}}`:

| Input | Mode |
|-------|------|
| (empty / no args) | `discovery` -- Show command menu |
| JD text or URL (no sub-command) | **`auto-pipeline`** |
| `evaluate` | `evaluate` |
| `deep` | `deep` |
| `pipeline` | `pipeline` |
| `scan` | `scan` |
| `batch` | `batch` |

**Auto-pipeline detection:** If `{{mode}}` is not a known sub-command AND contains JD text (keywords: "responsibilities", "requirements", "qualifications", "about the role", "we're looking for", company name + role) or a URL to a JD, execute `auto-pipeline`.

If `{{mode}}` is not a sub-command AND doesn't look like a JD, show discovery.

---

## Discovery Mode (no arguments)

Show this menu:

```
career-ops -- Command Center

  /career-ops {JD}       → AUTO-PIPELINE: evaluate + report + shortlist (paste text or URL)
  /career-ops pipeline   → Process pending URLs from inbox (data/pipeline.md)
  /career-ops evaluate   → Evaluation only A-G (no auto shortlist)
  /career-ops deep       → Deep research on a company
  /career-ops scan       → Scan portals and discover new offers
  /career-ops batch      → Batch processing with parallel workers

Inbox: add URLs to data/pipeline.md → /career-ops pipeline
Or paste a JD directly to run the full pipeline.
```

---

## Context Loading by Mode

After determining the mode, load the necessary files before executing:

### Modes that require `_shared.md` + their mode file:
Read `modes/_shared.md` + `modes/{mode}.md`

Applies to: `auto-pipeline`, `evaluate`, `pipeline`, `scan`, `batch`

### Standalone modes (only their mode file):
Read `modes/{mode}.md`

Applies to: `deep`

### Modes delegated to subagent:
For `scan`, and `pipeline` (3+ URLs): launch as Agent with the content of `_shared.md` + `modes/{mode}.md` injected into the subagent prompt.

```
Agent(
  subagent_type="general-purpose",
  prompt="[content of modes/_shared.md]\n\n[content of modes/{mode}.md]\n\n[invocation-specific data]",
  description="career-ops {mode}"
)
```

Execute the instructions from the loaded mode file.