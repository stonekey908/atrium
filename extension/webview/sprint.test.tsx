import { describe, it, expect } from "vitest";
import { waveStages, isCurrentSprint } from "./sprint";

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
