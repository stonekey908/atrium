# Wave 6 · Ship & portability — PRD

> The cockpit is good enough to live in (v0.0.29, dogfooded on its own development).
> Wave 6 makes it **shippable to other people and other stacks**. This PRD is itself
> dogfood: it lives at `docs/waves/wave-6.md`, so Atrium discovers and renders it
> on the PRD tab by convention — no manifest entry needed.

## Why

Atrium currently works perfectly on exactly one machine (this one) and one
labelling convention (`ATR Wave …`). The moat is taste, not capability — but
taste only matters if someone else can install the thing. Wave 6 removes the
three blockers between "works for Nick" and "works for anyone":

1. **Other people's labels** — every project names sprints differently
   (`CG Phase 3`, `Anvil Sprint 2`, `sprint-12`). Hand-configuring a prefix per
   workspace is ceremony; the board should adapt.
2. **Distribution** — there is no installable artifact anywhere public. "Install
   VS Code + this `.vsix`" needs a real channel (Open VSX preferred, GitHub
   release as floor).
3. **Other trackers** — the read seam (`BoardSource`) and write client
   (`LinearWriteClient`) already isolate Linear; a formal `BoardWriter`
   interface makes a Jira adapter a drop-in, not a fork.

## Scope (the tickets)

- **STO-2495 — Flexible wave-label detection.** Prefix list in the setting
  (back-compat with the single string) + auto-detect heuristic when nothing
  matches (`(wave|sprint|phase|slice|milestone)[ -]?<number>`, case-insensitive).
  Per-workspace override wins; unmatched tickets stay visibly Unsorted.
- **STO-2482 — Distribute the `.vsix`.** Pick a channel (Open VSX / GitHub
  release), publish a versioned artifact, write the install README (install +
  own `atrium.linear.apiKey` + reload), verify on a machine that isn't this one.
- **STO-2483 — BoardWriter + Jira adapter spike.** Formalize the write seam
  (setState / setSortOrder / moveToWave / addComment), then spike the Jira
  field mapping (status-categories, rank, sprints) to prove the seam holds.

## Order

STO-2495 → STO-2482 → STO-2483. Flexible detection must land before
distribution (first impression on a foreign board is "everything is Unsorted"
otherwise). The Jira spike is genuinely last — it proves portability but blocks
nobody.

## Out of scope

Webhook-based live refresh (needs a relay; visibility-refresh + pollSeconds
cover the loop for now), marketplace listing polish, code signing, telemetry.

## Acceptance for the wave

- A colleague-shaped human installs Atrium from a public artifact, points it at
  their own Linear key, opens their own repo, and sees their own board grouped
  into their own sprints — zero config.
- A written Jira mapping exists that a motivated stranger could implement
  against the `BoardWriter` seam.
