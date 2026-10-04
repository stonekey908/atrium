/**
 * The agent briefing — the same conventions the VS Code cockpit's Help modal
 * copies to the clipboard, here injected straight into the model's system
 * prompt (the one thing the extension could never do). Platform-agnostic:
 * no tracker or assistant brand names.
 */
import type { AtriumBoard, AtriumTicket } from "../types";
import { computeRollup, currentSprint } from "./board";

export const AGENT_BRIEFING = `# Project conventions — follow these when planning and building

Use these conventions for all tickets, branches, and planning files in this
project, so progress stays visible on the project board (the /atrium pane).

## Tickets (issue tracker)

- Give every ticket exactly ONE sprint label naming its wave of work, in the
  form "<word> <number> · <theme>" where <word> is one of: Wave, Sprint,
  Phase, Slice, Milestone — e.g. "Wave 1 · Foundations" or "Sprint 3 · Auth".
  Keep the same word and numbering style across the whole project.
- Move tickets through workflow states as you work (Todo → In Progress →
  In Review → Done). Comment on the ticket at pickup, when the plan is
  agreed, at the end of each phase, and at close.
- Give every sprint label a short one-line description of what that wave
  entails. Keep it current as the wave's scope settles.

## Branches

- One branch per ticket, named feat/<TICKET-ID>-<short-description>
  (fix/ or chore/ for those types). The board matches the branch name to
  show which ticket is being worked on.

## Planning files (in the repo)

- Build PRD: docs/PRD.md — the SINGLE build-level PRD for the whole project
  (one document that evolves with architecture, features and direction).
- Per-wave docs (PRD, TRDs etc.): docs/waves/wave-<n>.md and
  docs/waves/wave-<n>-<topic>.md (e.g. docs/waves/wave-1.md).
- Mockups: files named wave-<n>-<name>.html (or .png) placed in files/,
  docs/, mockups/ or design/. Self-contained HTML mockups (inline CSS, no
  external assets).
- If a planning file must live elsewhere or keep another name, map it in
  .atrium/waves.json at the repo root:
  { "<n>": { "prd": "path.md", "docs": ["path.md"], "mockups": ["path.html"] } }
`;

/** The live context section: what the board shows right now. */
export function workingOnText(board: AtriumBoard, ticket: AtriumTicket | null, branch: string, fullDescription: string | null): string {
  const lines: string[] = [`# Project board (live from the tracker): ${board.project}`];
  const sprint = currentSprint(board.waves);
  if (sprint) {
    const r = computeRollup(sprint.tickets);
    lines.push(`Current sprint: ${sprint.name} — ${r.done}/${r.total} done, ${r.doing} in progress, ${r.review} in review.`);
  }
  if (branch) lines.push(`Git branch: ${branch}`);
  if (ticket) {
    lines.push("", `## Working on: ${ticket.id} — ${ticket.title}`, `Status: ${ticket.status} · Priority: ${ticket.priority} · ${ticket.url}`);
    const description = (fullDescription ?? ticket.description ?? "").trim();
    if (description) lines.push("", description.slice(0, 6000));
    lines.push(
      "",
      `When you finish a phase of this ticket, move it along (In Progress → In Review → Done) and comment on it; the board reflects the tracker live.`,
    );
  } else {
    lines.push("", "No ticket matches the current branch. Before starting work, pick or create a ticket, give it the sprint label, and branch as feat/<TICKET-ID>-<slug>.");
  }
  return lines.join("\n");
}
