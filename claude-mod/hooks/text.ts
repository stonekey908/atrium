/**
 * The board as transcript text: what `/atrium` answers where no surface seats a
 * pane (an app view that places none, a narrow terminal, a `-p` run), and what
 * `/atrium text` prints on request. Pure.
 */
import type { AtriumBoard, AtriumTicket, AtriumWaveFiles } from "../types";
import { STATE_LABEL, computeRollup, currentSprint, groupByState, resolveActiveTicket } from "./board";

const GLYPH: Record<string, string> = { doing: "●", review: "◐", todo: "○", done: "✓" };

function row(t: AtriumTicket): string {
  const mark = t.priority === "urgent" ? "‼ " : t.priority === "high" ? "! " : "  ";
  return `  ${mark}${t.id}  ${t.title}`;
}

export function boardText(board: AtriumBoard, branch: string, files: Record<string, AtriumWaveFiles>, waveName?: string | null): string {
  const lines: string[] = [`Atrium · ${board.project}`];
  const active = resolveActiveTicket(board.waves, branch);
  lines.push(active ? `▶ ${active.id}  ${active.title} · ${active.status}  ${active.url}` : `▷ No ticket matches ${branch ? `branch ${branch}` : "the current branch"}.`);

  const current = currentSprint(board.waves);
  // Everything shipped: show the latest wave rather than the first.
  const sprint = currentSprint(board.waves, waveName) ?? board.waves[board.waves.length - 1];
  if (!sprint) {
    lines.push("", 'No tickets with a sprint label yet. Label tickets "Wave 1 · <theme>" and they appear here.');
    return lines.join("\n");
  }
  if (!current) lines.push("", "All waves shipped.");
  const r = computeRollup(sprint.tickets);
  lines.push("", `${sprint.name}${sprint.stage ? ` · ${sprint.stage}` : ""} · ${r.done}/${r.total} done${sprint === current ? "  ← current" : ""}`);
  for (const { state, tickets } of groupByState(sprint)) {
    if (tickets.length === 0) continue;
    if (state === "done") {
      lines.push(`${GLYPH[state]} ${STATE_LABEL[state]} (${tickets.length})`);
      continue;
    }
    lines.push(`${GLYPH[state]} ${STATE_LABEL[state]} (${tickets.length})`, ...tickets.map(row));
  }

  const wf = files[sprint.name];
  const docs = wf ? [...(wf.prd ? [`PRD ${wf.prd.path}`] : []), ...wf.docs.map((d) => `doc ${d.path}`), ...wf.mockups.map((m) => `mockup ${m.path}`)] : [];
  if (docs.length > 0) lines.push("", ...docs.map((d) => `  ${d}`));

  const others = board.waves.filter((w) => w !== sprint);
  if (others.length > 0) {
    lines.push(
      "",
      others
        .map((w) => {
          const o = computeRollup(w.tickets);
          return `${w.name.split(" · ")[0]} ${o.done}/${o.total}`;
        })
        .join(" · "),
    );
  }
  return lines.join("\n");
}
