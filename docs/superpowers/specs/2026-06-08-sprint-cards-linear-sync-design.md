# Sprint Cards View + Optimistic Linear Write-Back

**Date:** 2026-06-08
**Status:** Approved concept (mockup `files/atrium-sprint-horizon.html`) — design for review
**Builds on:** W0.6 cockpit (real board behind `BoardSource`, live `LinearSdkSource`, refresh)

## Problem

The cockpit shows the board as a flat wave list. The current sprint deserves to
be the **spotlight** — a kanban you can drag tickets across — and those drags
should **sync back to Linear** (our first write). Per the focus-gradient concept:
*done* fades behind, the current sprint is bright, the future fades in ahead, and
the past surfaces only its loose ends.

This spec covers **piece A** only: the sprint cards (kanban) + optimistic Linear
write-back. Planning (B) and mockup storage (C) are separate cycles.

## Approach

Add the kanban as a **spotlight section at the top of the cockpit**; the existing
W0.6 wave list stays below it as the "horizon." This extends the current cockpit
rather than replacing it. The full focus-gradient treatment of the wave list
(collapse done, loose-ends callout) is a follow-up slice.

The "current sprint" = the wave at the **Build** stage (reusing `isCurrentSprint`).
If multiple are at Build, the first; if none, the spotlight hides and only the
wave list shows.

## Components

**Webview**
- `SprintBoard` — renders the current sprint's tickets into four columns
  (`todo / doing / review / done`), grouped by ticket state. Pure layout over the
  board data already in the payload.
- `KanbanCard` — id, title, priority, `↗` open-in-Linear, and a **sync badge**
  (`idle | syncing | synced | failed`).
- Drag layer (HTML5 drag-and-drop or a tiny pointer-based handler): drag a card to
  another column → optimistic local move + emit an intent to the host; drag within
  a column → reorder intent.
- `useBoardMutations` (webview hook): holds optimistic state layered over
  `init.waves`, tracks per-ticket sync status, and reconciles when the host
  confirms/rejects or a fresh `init` arrives.

**Host**
- `LinearSdkSource` (or a sibling `linear-writes.ts`) gains:
  - `setIssueState(id, targetState)` — maps our `todo/doing/review/done` back to a
    Linear workflow-state **id** for the issue's team (resolve once, cache), via
    `updateIssue`.
  - `setIssueSortOrder(id, sortOrder)` — for reordering.
- Message handlers: `moveTicket {id, toState}` and `reorderTicket {id, sortOrder}`
  → perform the write → reply `mutationResult {id, ok, error?, ticket?}`.

## Data flow (the move loop)

```
webview: drag card → optimistic move in useBoardMutations, badge=syncing
       → postMessage moveTicket {id, toState}
host:   resolve target workflow-state id for the issue's team
       → linear updateIssue(id, {stateId})  (live key required)
       → postMessage mutationResult {id, ok}            // or {ok:false, error}
webview: ok   → badge=synced (brief), keep move
        fail → badge=failed, REVERT to prior column, show a toast/banner
```

State→stateId mapping is resolved from Linear (each team's workflow states), not
hardcoded, so custom state names work. `review` maps to the team's `started` state
whose name matches /review/i (fallback: first `started`); `doing` → the other
`started`; `done` → first `completed`; `todo` → first `unstarted`/`backlog`.

## Conflict handling

Writes are pull-then-write, so a stale local view can fight Linear. Minimal, honest
handling:
- Before applying, the host reads the issue's current state; if it already differs
  from the webview's `fromState`, treat as a **conflict**: don't clobber — reply
  `mutationResult {ok:false, conflict:true}` and the webview reverts + flags
  "changed in Linear — refreshing." A Refresh reconciles.
- No multi-field merge UI in v1 (single-field state/order changes only).

## Write-back gating & safety

- **Requires the live API key** (`atrium.linear.apiKey`). With no key, the board is
  **read-only**: drag is disabled (cards show a "set a key to sync" affordance), so
  we never pretend to sync.
- All writes go through the host (the webview never holds the key).

## Error handling

- No key → read-only board, no drag.
- Write fails (network/permission/conflict) → optimistic move reverts, card badge
  `failed`, one-line banner; the board stays truthful to Linear.
- Unknown/again-unmapped target state → reject the move (revert) rather than guess.

## Testing

- Pure: `boardToColumns(wave)` (group tickets by state into ordered columns);
  state↔workflow mapping resolver (given a team's states, pick the right id).
- `useBoardMutations`: optimistic apply, synced-keeps-move, failed-reverts,
  conflict-reverts, reconcile-on-init.
- `linear-writes` resolver unit-tested with fake team-state lists.
- Webview: dragging a card emits `moveTicket`; read-only mode disables drag.
- Live `updateIssue` itself is smoke-verified with a key (manual UAT), like the
  read path.

## Vertical slices

1. **Read-only kanban** — `SprintBoard` + `KanbanCard` for the current sprint from
   existing payload data; regenerate the snapshot to match the pruned board.
2. **Drag-to-status + write-back** — optimistic move, host `setIssueState`,
   sync states, revert-on-fail, conflict check, key-gating. (Key setup here.)
3. **Drag-to-reorder** — `setIssueSortOrder` within a column.

Each slice ends green (tsc + vitest) and F5-verifiable.

## Out of scope (this spec)

Focus-gradient polish of the wave list (collapse done / loose-ends callout —
follow-up), planning surface (B), mockup storage (C), multi-field conflict merge,
creating/deleting issues from the board.
