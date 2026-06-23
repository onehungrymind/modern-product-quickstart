# Postmortem — [Incident Title]

> **Blameless.** This document focuses on systems, processes, and conditions — not individuals.
> The goal is to learn and improve, not to assign fault.

---

## Summary

| Field | Value |
|-------|-------|
| **Date** | YYYY-MM-DD |
| **Duration** | Xh Ym |
| **Severity** | SEV-1 / SEV-2 / SEV-3 |
| **Service(s)** | e.g. Tracer redirect hot path |
| **Status** | Resolved |
| **Author(s)** | |
| **Reviewed by** | |

One or two sentences describing what happened and what the user-facing impact was.

---

## Impact

- **Users affected:** Describe scope (all users, subset, specific regions/features).
- **SLO/SLA impact:** Which SLOs were breached and by how much.
- **Error budget consumed:** X minutes out of Y-minute monthly budget.
- **Business impact:** Revenue, conversion, user trust (if known).

---

## Timeline

All times in UTC.

| Time (UTC) | Event |
|------------|-------|
| HH:MM | Bad deploy / change introduced |
| HH:MM | **DETECTED** — alert fired / on-call paged |
| HH:MM | On-call acknowledged; investigation started |
| HH:MM | Root cause identified |
| HH:MM | **MITIGATED** — rollback initiated / fix deployed |
| HH:MM | **RESOLVED** — SLO alert cleared, latency confirmed normal |

---

## Root Cause

Describe the proximate and contributing causes. Use a 5-Whys or fishbone approach if helpful.
Focus on system conditions, not individual actions.

**Proximate cause:** What immediately caused the incident?

**Contributing factors:**
- Factor 1
- Factor 2

---

## Time to Recovery (TTR)

```
Detected at:    HH:MM UTC
Resolved at:    HH:MM UTC
TTR:            Xh Ym Zs
```

---

## What Went Well

- Item 1 — e.g. Alert fired within 2 minutes of SLO breach.
- Item 2 — e.g. Rollback script executed cleanly with no data loss.
- Item 3

---

## What Went Poorly

- Item 1 — e.g. No runbook step for this specific failure mode.
- Item 2 — e.g. Communication lag between detection and escalation.
- Item 3

---

## Action Items

| Priority | Action | Owner | Due date | Status |
|----------|--------|-------|----------|--------|
| P1 | | | | Open |
| P2 | | | | Open |
| P3 | | | | Open |

---

## Appendix

Include any relevant graphs, log excerpts, or metric snapshots here.
