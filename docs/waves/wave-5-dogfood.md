# Wave 5 · Dogfood log (STO-2481)

> The end-to-end run: Atrium driving its own development, written as a wave doc
> so the PRD tab renders it — which is itself the test.

## The validated flow

1. **PRD** — write `docs/waves/wave-<n>.md` (or map odd-named files in
   `.atrium/waves.json`). It appears rendered on the **PRD** tab for that wave,
   re-rendering live as the file is edited. TRDs/extra docs: `wave-<n>-*.md`
   (this very file).
2. **Design** — drop mockups named `wave-<n>-*.html` (or manifest-mapped) into
   `files/` etc. They group under their wave on the **Design** tab and preview
   live in sandboxed iframes; edits re-render in place.
3. **Tickets** — created in Linear with the wave label (`ATR Wave …` or your
   `wavePrefix`). They appear on the board grouped into waves; the wave with
   active work becomes the spotlighted sprint kanban automatically.
4. **Build** — branch named `feat/<ticket-id>-…` → the **Working on** strip
   shows the branch-matched ticket (click it for the full modal). Drag cards
   across kanban columns / reorder / promote–demote between waves — all live
   Linear write-back. Ticket click → modal with the description rendered like
   Linear renders it; editing happens in Linear (link in the modal header).
5. **Freshness** — instant re-pull on window focus / tab visibility; optional
   rolling poll via the status-strip picker (manual / 30s / 1m / 2m / 5m). No
   push: Linear webhooks need a public endpoint (out of scope, Wave 6 PRD).
6. **Done** — a wave whose tickets are all Done folds into the collapsed
   **Completed** group; UAT bounces show as the Pass-N loop-back strip/badges.

## Friction found → shipped in-flight

| # | Finding | Fix | Version |
|---|---|---|---|
| 1 | Board stale unless manually refreshed | Re-pull when the tab becomes visible | v0.0.29 |
| 1b | …but only on tab switches; browser→VS Code loop missed | Re-pull on window focus regained | v0.0.30 |
| 2 | Poll cadence buried in VS Code settings | Auto-refresh picker in the status strip | v0.0.31 |
| 2b | Picker choice snapped back visually | pollSeconds change now re-posts init | v0.0.32 |

## Friction deferred (already ticketed)

- **STO-2495** — other naming conventions land in Unsorted (flexible wave-label
  detection; first impression blocker for distribution).
- **STO-2482** — open question parked: should `pollSeconds` default to ~120
  instead of 0 for first installs?

## Verdict

The loop holds: PRD/mockups → board → build → done, all inside the cockpit,
with Linear as the single source of truth and the repo as the artifact store.
Four friction points were found and fixed *during* the run — which is the
strongest evidence the dogfood worked.
