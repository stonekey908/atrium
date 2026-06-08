import type { Wave } from "./types";

export interface Rollup {
  total: number;
  done: number;
  doing: number;
  todo: number;
  /** Percent done, rounded. */
  pct: number;
}

/** Project-wide ticket tally across every wave — the "where am I overall" glance. */
export function computeRollup(waves: Wave[]): Rollup {
  const tickets = waves.flatMap((w) => w.tickets);
  const done = tickets.filter((t) => t.state === "done").length;
  const doing = tickets.filter((t) => t.state === "doing").length;
  const todo = tickets.filter((t) => t.state === "todo").length;
  const total = tickets.length;
  return { total, done, doing, todo, pct: total ? Math.round((done / total) * 100) : 0 };
}
