/**
 * The board model, pure: tracker issues in, waves and tickets out. A faithful
 * port of `extension/src/board.ts` + the webview's `sprint.ts` / `rollup.ts`
 * helpers, trimmed to what the pane draws. No `$`, no I/O — unit-tests cold.
 */
import type {
  AtriumBoard,
  AtriumFullStatus,
  AtriumPriority,
  AtriumTicket,
  AtriumTicketState,
  AtriumWave,
} from "../types";

/** The flattened shape the Linear adapter extracts from one issue. */
export interface LinearIssueLite {
  /** Linear's internal UUID. */
  id: string;
  identifier: string;
  title: string;
  url: string;
  priority: number;
  stateType: string;
  stateName: string;
  labels: string[];
  description: string | null;
  branch: string | null;
}

export const DEFAULT_WAVE_PREFIX = "ATR Wave";

export function parsePrefixes(setting?: string): string[] {
  const list = (setting ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length > 0 ? list : [DEFAULT_WAVE_PREFIX];
}

/** Sprint-ish label heuristic: a wave/sprint/phase/slice/milestone word followed
 *  by a number or a single letter. Conservative on purpose. */
const SPRINTISH = /\b(wave|sprint|phase|slice|milestone)([ \-_]?\d+(\.\d+)?|[ -][a-z](?=[\s:.,)]|$))/i;

/** Configured prefixes win when any label matches one; otherwise the heuristic. */
export function makeWaveLabelMatcher(prefixSetting: string | undefined, allLabels: string[]): (label: string) => boolean {
  const prefixes = parsePrefixes(prefixSetting).map((p) => p.toLowerCase());
  const byPrefix = (label: string) => {
    const l = label.trim().toLowerCase();
    return prefixes.some((p) => l.startsWith(p));
  };
  if (allLabels.some(byPrefix)) return byPrefix;
  return (label: string) => SPRINTISH.test(label);
}

/** "ATR Wave 5 · SDLC flow" reads "Wave 5 · SDLC flow". */
export function waveName(label: string): string {
  return label.replace(/^ATR\s+/i, "").trim() || label;
}

/** First number in a wave label — the sort key and the wave-file key. */
export function waveNumber(labelOrName: string): string | null {
  const m = labelOrName.match(/(\d+(?:\.\d+)?)/);
  return m ? m[1] ?? null : null;
}

export function waveOrder(label: string): number {
  const n = waveNumber(label);
  return n === null ? Number.POSITIVE_INFINITY : parseFloat(n);
}

export function mapPriority(p: number): AtriumPriority {
  return p === 1 ? "urgent" : p === 2 ? "high" : p === 3 ? "med" : "low";
}

export function mapState(stateType: string, stateName = ""): AtriumTicketState {
  if (stateType === "completed") return "done";
  if (stateType === "started") return /review/i.test(stateName) ? "review" : "doing";
  return "todo";
}

export function fullStatus(stateType: string, stateName = ""): AtriumFullStatus {
  if (stateType === "completed") return "Done";
  if (stateType === "duplicate") return "Duplicate";
  if (stateType === "canceled") return /duplicate/i.test(stateName) ? "Duplicate" : "Canceled";
  if (stateType === "started") return /review/i.test(stateName) ? "In Review" : "In Progress";
  if (stateType === "backlog") return "Backlog";
  return "Todo";
}

export function isCanceled(t: { status: AtriumFullStatus }): boolean {
  return t.status === "Canceled" || t.status === "Duplicate";
}

export function activeTickets(tickets: AtriumTicket[]): AtriumTicket[] {
  return tickets.filter((t) => !isCanceled(t));
}

/** Every bullet line (-, *, or "1.") with its marker stripped. */
export function specFromDescription(description: string | null): string[] {
  if (!description) return [];
  return description
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^([-*]|\d+\.)\s+/.test(l))
    .map((l) => l.replace(/^([-*]|\d+\.)\s+/, "").replace(/^\[[ x]\]\s*/i, "").trim())
    .filter(Boolean);
}

function issueToTicket(i: LinearIssueLite): AtriumTicket {
  return {
    id: i.identifier,
    title: i.title,
    url: i.url,
    priority: mapPriority(i.priority),
    state: mapState(i.stateType, i.stateName),
    status: fullStatus(i.stateType, i.stateName),
    spec: specFromDescription(i.description),
    description: i.description,
    branch: i.branch,
  };
}

/** all done → release; any active → build; nothing started → plan. */
export function deriveStage(tickets: AtriumTicket[], fallback: string): string {
  const active = activeTickets(tickets);
  if (active.length === 0) return fallback;
  if (active.every((t) => t.state === "done")) return "release";
  if (active.some((t) => t.state === "doing" || t.state === "review")) return "build";
  return "plan";
}

/**
 * Waves emerge from the labels on ACTIVE tickets, sorted by number. Canceled
 * tickets attach to the waves that exist (flagged via `status`) but never make
 * a wave of their own. Active label-less work lands in an Unsorted bucket.
 */
export function boardFromIssues(
  issues: LinearIssueLite[],
  opts: { projectName: string; generatedAt: string; wavePrefix?: string },
): AtriumBoard {
  const active = issues.filter((i) => i.stateType !== "canceled" && i.stateType !== "duplicate");
  const allLabels = Array.from(new Set(active.flatMap((i) => i.labels)));
  const isWaveLabel = makeWaveLabelMatcher(opts.wavePrefix, allLabels);

  const waveLabels = Array.from(new Set(active.flatMap((i) => i.labels.filter(isWaveLabel)))).sort(
    (a, b) => waveOrder(a) - waveOrder(b) || a.localeCompare(b),
  );

  const waves: AtriumWave[] = waveLabels.map((label) => {
    const tickets = issues.filter((i) => i.labels.includes(label)).map(issueToTicket);
    return { name: waveName(label), label, stage: deriveStage(tickets, "plan"), tickets };
  });

  const isOrphan = (i: LinearIssueLite) => !i.labels.some(isWaveLabel);
  if (active.some(isOrphan)) {
    waves.push({ name: "Unsorted · No sprint", label: "", stage: "", tickets: issues.filter(isOrphan).map(issueToTicket) });
  }

  return { project: opts.projectName, generatedAt: opts.generatedAt, waves };
}

const STAGE_RANK: Record<string, number> = { "": -1, plan: 0, design: 1, build: 2, release: 3 };

/**
 * The wave to spotlight: the one with in-progress / in-review work, else the
 * next wave with unfinished tickets, preferring the one furthest along. Null
 * when everything is done. An `override` wins while it still names a wave.
 */
export function currentSprint(waves: AtriumWave[], override?: string | null): AtriumWave | null {
  if (override) {
    const pinned = waves.find((w) => w.name === override);
    if (pinned) return pinned;
  }
  const unfinished = waves.filter((w) => {
    const act = activeTickets(w.tickets);
    return act.length > 0 && act.some((t) => t.state !== "done");
  });
  if (unfinished.length === 0) return null;
  const active = unfinished.filter((w) => w.tickets.some((t) => t.state === "doing" || t.state === "review"));
  const pool = active.length > 0 ? active : unfinished;
  const first = pool[0] as AtriumWave;
  return pool.reduce((best, w) => ((STAGE_RANK[w.stage] ?? -1) > (STAGE_RANK[best.stage] ?? -1) ? w : best), first);
}

/**
 * The ticket being worked on: the one whose id appears in the git branch
 * (`feat/sto-2181-…` → STO-2181), else the one whose tracker branch name is
 * the current branch, else the first ticket in progress, else null.
 */
export function resolveActiveTicket(waves: AtriumWave[], branch: string): AtriumTicket | null {
  const tickets = activeTickets(waves.flatMap((w) => w.tickets));
  const b = branch.toLowerCase();
  if (b) {
    const byId = tickets.find((t) => b.includes(t.id.toLowerCase()));
    if (byId) return byId;
    const byBranch = tickets.find((t) => t.branch && t.branch.toLowerCase() === b);
    if (byBranch) return byBranch;
  }
  return tickets.find((t) => t.state === "doing") ?? null;
}

export interface Rollup {
  total: number;
  done: number;
  doing: number;
  review: number;
  todo: number;
  pct: number;
}

export function computeRollup(tickets: AtriumTicket[]): Rollup {
  const act = activeTickets(tickets);
  const count = (s: AtriumTicketState) => act.filter((t) => t.state === s).length;
  const done = count("done");
  return {
    total: act.length,
    done,
    doing: count("doing"),
    review: count("review"),
    todo: count("todo"),
    pct: act.length ? Math.round((done / act.length) * 100) : 0,
  };
}

/** The board's groups, in the order the pane lists them (active work first). */
export const STATE_ORDER: AtriumTicketState[] = ["doing", "review", "todo", "done"];

export const STATE_LABEL: Record<AtriumTicketState, string> = {
  doing: "In progress",
  review: "In review",
  todo: "To do",
  done: "Done",
};

/** The statuses the pane offers as write targets, in workflow order. */
export const STATUS_PICKS: AtriumFullStatus[] = ["Backlog", "Todo", "In Progress", "In Review", "Done", "Canceled"];

/** The next status along the workflow, or null at the end. */
export function nextStatus(status: AtriumFullStatus): AtriumFullStatus | null {
  switch (status) {
    case "Backlog":
      return "Todo";
    case "Todo":
      return "In Progress";
    case "In Progress":
      return "In Review";
    case "In Review":
      return "Done";
    default:
      return null;
  }
}

const PRIORITY_RANK: Record<AtriumPriority, number> = { urgent: 0, high: 1, med: 2, low: 3 };

/** A wave's tickets grouped by column, each group by priority then id. */
export function groupByState(wave: AtriumWave): { state: AtriumTicketState; tickets: AtriumTicket[] }[] {
  return STATE_ORDER.map((state) => ({
    state,
    tickets: activeTickets(wave.tickets)
      .filter((t) => t.state === state)
      .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.id.localeCompare(b.id, undefined, { numeric: true })),
  }));
}

/** Folder name → project name: exact (case-insensitive) beats normalized
 *  (lowercase alphanumerics), so "atrium-cockpit" relates to "Atrium Cockpit". */
export function matchProject(folders: string[], projects: string[]): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const f of folders) {
    const exact = projects.find((p) => p.toLowerCase() === f.toLowerCase());
    if (exact) return exact;
  }
  for (const f of folders) {
    const fn = norm(f);
    if (!fn) continue;
    const loose = projects.find((p) => norm(p) === fn);
    if (loose) return loose;
  }
  return null;
}

export function basename(path: string): string {
  const parts = path.replace(/[\\/]+$/, "").split(/[\\/]/);
  return parts[parts.length - 1] ?? path;
}
