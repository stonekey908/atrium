import { activeTickets, type Wave } from "./types";

export interface Rollup {
  total: number;
  done: number;
  doing: number;
  review: number;
  todo: number;
  /** In-progress + in-review — work that's actively underway. */
  active: number;
  /** Percent done, rounded. */
  pct: number;
}

/** Project-wide ticket tally across every wave — the "where am I overall" glance. */
export function computeRollup(waves: Wave[]): Rollup {
  // Canceled/Duplicate tickets don't count toward project progress.
  const tickets = activeTickets(waves.flatMap((w) => w.tickets));
  const done = tickets.filter((t) => t.state === "done").length;
  const doing = tickets.filter((t) => t.state === "doing").length;
  const review = tickets.filter((t) => t.state === "review").length;
  const todo = tickets.filter((t) => t.state === "todo").length;
  const total = tickets.length;
  return {
    total,
    done,
    doing,
    review,
    todo,
    active: doing + review,
    pct: total ? Math.round((done / total) * 100) : 0,
  };
}
