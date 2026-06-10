import { describe, it, expect } from "vitest";
import { isCurrentSprint, resolveActiveTicket, boardToColumns, currentSprint } from "./sprint";
import type { TicketState, Wave } from "./types";

const tk = (id: string, state: TicketState) => ({
  id,
  title: id,
  priority: "med" as const,
  state,
  spec: [],
  tests: { passed: 0, failed: 0, missing: 0 },
  activity: [],
});
const wavesOf = (...t: ReturnType<typeof tk>[]): Wave[] => [{ name: "W", tickets: t }];
const wave = (name: string, stage: string, ...t: ReturnType<typeof tk>[]): Wave => ({ name, stage, tickets: t });

describe("isCurrentSprint", () => {
  it("is true only for a wave at the Build stage", () => {
    expect(isCurrentSprint("build")).toBe(true);
    expect(isCurrentSprint("plan")).toBe(false);
    expect(isCurrentSprint("release")).toBe(false);
    expect(isCurrentSprint(undefined)).toBe(false);
  });
});

describe("boardToColumns", () => {
  it("groups tickets into the four ordered columns by state", () => {
    const cols = boardToColumns(
      wave("W", "build", tk("A", "todo"), tk("B", "doing"), tk("C", "doing"), tk("D", "review"), tk("E", "done")),
    );
    expect(cols.map((c) => c.key)).toEqual(["todo", "doing", "review", "done"]);
    expect(cols.map((c) => c.tickets.length)).toEqual([1, 2, 1, 1]);
  });

  it("yields empty columns when a state is absent", () => {
    const cols = boardToColumns(wave("W", "build", tk("A", "todo")));
    expect(cols.find((c) => c.key === "done")!.tickets).toEqual([]);
  });
});

describe("currentSprint", () => {
  it("picks the wave with active (in-progress / in-review) work", () => {
    const waves = [
      wave("done-wave", "release", tk("A", "done")),
      wave("active", "build", tk("B", "doing")),
      wave("queued", "plan", tk("C", "todo")),
    ];
    expect(currentSprint(waves)?.name).toBe("active");
  });

  it("prefers the active wave furthest along the pipeline", () => {
    const waves = [wave("plan-active", "plan", tk("A", "doing")), wave("build-active", "build", tk("B", "review"))];
    expect(currentSprint(waves)?.name).toBe("build-active");
  });

  it("falls back to the next unfinished wave when nothing is in progress", () => {
    const waves = [wave("shipped", "release", tk("A", "done")), wave("next", "plan", tk("B", "todo"))];
    expect(currentSprint(waves)?.name).toBe("next");
  });

  it("returns null when every ticket is done (no active sprint)", () => {
    expect(currentSprint([wave("w", "build", tk("A", "done"))])).toBeNull();
  });

  it("lets an override win when it matches a wave, and ignores it otherwise", () => {
    const waves = [wave("active", "build", tk("A", "doing")), wave("pinned", "plan", tk("B", "todo"))];
    expect(currentSprint(waves, "pinned")?.name).toBe("pinned");
    expect(currentSprint(waves, "ghost")?.name).toBe("active");
  });
});

describe("resolveActiveTicket", () => {
  it("matches a ticket id embedded in the current branch name", () => {
    const waves = wavesOf(tk("STO-2181", "todo"), tk("STO-2099", "todo"));
    expect(resolveActiveTicket(waves, "feat/sto-2181-rail")?.id).toBe("STO-2181");
  });

  it("falls back to the first doing ticket when the branch has no id", () => {
    const waves = wavesOf(tk("STO-1", "todo"), tk("STO-2", "doing"));
    expect(resolveActiveTicket(waves, "main")?.id).toBe("STO-2");
  });

  it("returns null when nothing matches and nothing is in progress", () => {
    expect(resolveActiveTicket(wavesOf(tk("STO-1", "todo")), "main")).toBeNull();
  });
});
