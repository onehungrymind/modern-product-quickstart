# Participant workflow

The workshop is delivered as **tagged commits on a linear history**. You never edit the
tags directly; you branch off a lab's start tag, do the work, verify it, and compare
it against the canonical answer.

## The tag model

```
seed
  └─ 01-start → 01-complete
       └─ 02-start → 02-complete
            └─ … → 10-complete
```

- `NN-start` — the previous lab's state, plus the lab README and any scaffolding for the
  current lab. This is where you begin.
- `NN-complete` — `NN-start` plus the canonical implementation. This is the answer key.

`seed` is the honest baseline: inner ring done well, outer ring dev-grade or absent.
If you check out `seed` and run `npm run verify`, it is green — the test suite passes,
the types are sound. The labs harden what's missing.

## The four commands

### `npm run module:begin NN`

Checks out `NN-start` and creates (or switches to) the branch `my/NN`.

```bash
npm run module:begin 03
# → Checking out 03-start and creating branch my/03...
# → Ready. Open labs/03-test-outer-ring/README.md and follow the walkthrough.
```

**Requires a clean tree.** If you have uncommitted changes the command exits:
`Working tree has uncommitted changes. Commit or stash before switching modules.`
That rule is deliberate — it makes `module:reset` a safe undo.

### `npm run module:compare NN [path]`

Diffs your work against the canonical `NN-complete`. Because work spans `libs/**` and
`apps/**`, the default diff covers the **whole tree**. Pass an optional path to narrow it:

```bash
npm run module:compare 02
npm run module:compare 02 apps/api/src   # scope to the API only
```

Differences are fine — the canonical answer is one correct solution, not the only one.
Use the diff as a teacher, not a grader.

### `npm run module:reset NN`

Hard-resets `my/NN` back to `NN-start`, discarding all your changes. You must already be
on `my/NN` (i.e. have run `module:begin NN` first).

```bash
npm run module:reset 03   # start Lab 03 over from scratch
```

### `npm run module:status`

Prints your current branch, nearest tag, and whether the working tree is clean or dirty.
Useful when you've been away from the workshop for a while.

```bash
npm run module:status
# Branch:       my/05
# Nearest tag:  05-start
# Working tree: dirty
# You are on Module 05. Useful commands:
#   npm run module:compare 05
#   npm run module:reset 05
```

## The git underneath

The npm scripts are thin wrappers. Knowing the git keeps you in control:

| Script | Git equivalent |
|---|---|
| `module:begin NN` | `git checkout NN-start && git checkout -b my/NN` (or just `git checkout my/NN`) |
| `module:compare NN` | `git diff NN-complete` |
| `module:reset NN` | `git reset --hard NN-start` |
| `module:status` | `git rev-parse --abbrev-ref HEAD` + `git describe --tags --abbrev=0` |

If you want the canonical answer for a single file without fully resetting:

```bash
git checkout 03-complete -- libs/common-models/src/lib/url-safety.ts
```

## A typical lab session

1. **Begin** — `npm run module:begin 0N` (clean tree required).
2. **Read** — open `labs/0N-*/README.md` top to bottom before writing any code.
3. **Implement** — make the change(s) described in the walkthrough.
4. **Verify** — run the lab's readiness check (see below). Iterate until it's green.
5. **Commit** — commit conventionally; don't `--no-verify` (the pre-commit hook runs lint
   and formats staged files).
6. **Compare** — `npm run module:compare 0N`. Review the diff; adjust if you see something
   you missed.
7. **Next** — `npm run module:begin 0N+1`.

## The Verify gate — `readiness:check`

Each lab has a machine-checkable gate. The lab README lists the delta IDs:

```bash
npm run readiness:check R01           # Lab 01
npm run readiness:check R02 R03 R04 R05  # Lab 02 (four deltas)
npm run readiness:check R06           # Lab 03
npm run readiness:check R07           # Lab 04
npm run readiness:check R08           # Lab 05
npm run readiness:check R09           # Lab 06
npm run readiness:check R10           # Lab 07
npm run readiness:check R11           # Lab 08
npm run readiness:check R12 R13       # Lab 09
npm run readiness                     # Lab 10 — full PRR, all 14 deltas
```

A check exits 0 (`✓ product-grade`) when the capability has reached product-grade,
non-zero (`✗ not yet`) if it hasn't, and `• pending` if the check script itself
hasn't been built yet. Some checks are heavyweight (testcontainers, Terraform, LGTM) —
plan 2–5 minutes for R06, R09, and R10.

`npm run readiness:status` prints the full manifest table without exiting non-zero —
useful to see where you stand across all 14 deltas at once.

## Lab-by-lab verify commands

| Lab | Deltas | Verify command |
|---|---|---|
| 01 | R01 | `npm run readiness:check R01` |
| 02 | R02 R03 R04 R05 | `npm run readiness:check R02 R03 R04 R05` |
| 03 | R06 | `npm run readiness:check R06` |
| 04 | R07 | `npm run readiness:check R07` |
| 05 | R08 | `npm run readiness:check R08` |
| 06 | R09 | `npm run readiness:check R09` |
| 07 | R10 | `npm run readiness:check R10` |
| 08 | R11 | `npm run readiness:check R11` |
| 09 | R12 R13 | `npm run readiness:check R12 R13` |
| 10 | R14 | `npm run readiness` (all 14) |

## Recovery

**Stuck or messy?**

```bash
npm run module:reset 0N   # discard everything, back to NN-start
```

**Want just one file from the answer key?**

```bash
git checkout 0N-complete -- <path/to/file>
```

**Tags missing after a pull?**

```bash
git fetch --tags
npm run rebuild-tags   # rebuilds from scripts/modules.manifest.json
```

**Don't know where you are?**

```bash
npm run module:status
```

See [troubleshooting.md](./troubleshooting.md) for environment-specific issues
(Docker, Postgres, Terraform, `act`, LGTM).
