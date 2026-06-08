import { describe, it, expect } from "vitest";
import { waveStages, isCurrentSprint, resolveActiveTicket, boardToColumns, currentSprint } from "./sprint";
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

describe("waveStages", () => {
  it("marks stages before the wave's stage done, the stage itself active, later ones todo", () => {
    const byKey = Object.fromEntries(waveStages("build").map((s) => [s.key, s.status]));
    expect(byKey.plan).toBe("done");
    expect(byKey.design).toBe("done");
    expect(byKey.ux).toBe("done");
    expect(byKey.build).toBe("active");
    expect(byKey.uat).toBe("todo");
    expect(byKey.release).toBe("todo");
  });

  it("treats release as the final active stage with everything before it done", () => {
    const stages = waveStages("release");
    expect(stages.find((s) => s.key === "release")!.status).toBe("active");
    expect(stages.filter((s) => s.key !== "release").every((s) => s.status === "done")).toBe(true);
  });

  it("falls back to all-todo for an unknown stage", () => {
    expect(waveStages("frobnicate").every((s) => s.status === "todo")).toBe(true);
  });
});

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
  it("returns the wave at the Build stage", () => {
    const waves = [wave("past", "release"), wave("now", "build", tk("A", "doing")), wave("future", "plan")];
    expect(currentSprint(waves)?.name).toBe("now");
  });

  it("returns the first Build-stage wave when several match", () => {
    expect(currentSprint([wave("a", "build"), wave("b", "build")])?.name).toBe("a");
  });

  it("returns null when no wave is at Build", () => {
    expect(currentSprint([wave("x", "plan")])).toBeNull();
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
