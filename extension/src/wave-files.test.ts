import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { resolveWaveFiles, waveNumber } from "./wave-files";

describe("waveNumber", () => {
  it("extracts the wave number from a label or display name", () => {
    expect(waveNumber("ATR Wave 5 · SDLC flow")).toBe("5");
    expect(waveNumber("Wave 0.7 · Sprint board")).toBe("0.7");
    expect(waveNumber("Sprint 12")).toBe("12");
  });

  it("returns null when there is no number", () => {
    expect(waveNumber("Unsorted")).toBeNull();
  });
});

describe("resolveWaveFiles", () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "atrium-wave-files-"));
    // Manifest: wave 0.7 fully mapped (one mockup path missing on disk);
    // wave 5's prd entry points at a missing file (falls back to convention).
    mkdirSync(join(root, ".atrium"));
    writeFileSync(
      join(root, ".atrium", "waves.json"),
      JSON.stringify({
        "0.7": { prd: "specs/sprint.md", mockups: ["mocks/horizon.html", "mocks/missing.html"] },
        "5": { prd: "specs/missing.md" },
      }),
    );
    mkdirSync(join(root, "specs"));
    writeFileSync(join(root, "specs", "sprint.md"), "# sprint");
    mkdirSync(join(root, "mocks"));
    writeFileSync(join(root, "mocks", "horizon.html"), "<html/>");
    // Convention artifacts for wave 5.
    mkdirSync(join(root, "docs", "waves"), { recursive: true });
    writeFileSync(join(root, "docs", "waves", "wave-5.md"), "# prd");
    mkdirSync(join(root, "files"));
    writeFileSync(join(root, "files", "wave-5-board.html"), "<html/>");
    writeFileSync(join(root, "files", "wave-5-flow.png"), "png");
    // Near-miss names that must NOT match wave 5.
    writeFileSync(join(root, "files", "wave-55-other.html"), "<html/>");
    writeFileSync(join(root, "files", "wave-0.75-other.html"), "<html/>");
    // A convention file for 0.7 that must NOT be used (manifest mockups win).
    writeFileSync(join(root, "files", "wave-0.7-extra.html"), "<html/>");
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("resolves prd + mockups from the manifest, skipping missing paths", () => {
    const r = resolveWaveFiles(root, "ATR Wave 0.7 · Sprint board");
    expect(r.prd?.path).toBe(join(root, "specs", "sprint.md"));
    expect(r.prd?.kind).toBe("md");
    expect(r.mockups.map((m) => m.name)).toEqual(["horizon.html"]);
  });

  it("manifest mockups override convention matches for the same wave", () => {
    const r = resolveWaveFiles(root, "ATR Wave 0.7 · Sprint board");
    expect(r.mockups.some((m) => m.name === "wave-0.7-extra.html")).toBe(false);
  });

  it("falls back to convention when a manifest path is missing", () => {
    const r = resolveWaveFiles(root, "Wave 5 · SDLC flow");
    expect(r.prd?.path).toBe(join(root, "docs", "waves", "wave-5.md"));
    expect(r.mockups.map((m) => m.name).sort()).toEqual(["wave-5-board.html", "wave-5-flow.png"]);
  });

  it("does not match near-miss wave numbers (wave-55, wave-0.75)", () => {
    const five = resolveWaveFiles(root, "Wave 5 · SDLC flow");
    expect(five.mockups.some((m) => m.name.startsWith("wave-55"))).toBe(false);
    const o7 = resolveWaveFiles(root, "Wave 0.7 · Sprint board");
    expect(o7.mockups.some((m) => m.name.startsWith("wave-0.75"))).toBe(false);
  });

  it("returns empty for a wave with no manifest entry and no convention files", () => {
    expect(resolveWaveFiles(root, "Wave 6 · Ship")).toEqual({ mockups: [] });
  });

  it("returns empty for names without a wave number", () => {
    expect(resolveWaveFiles(root, "Unsorted")).toEqual({ mockups: [] });
  });

  it("never throws on a nonexistent root", () => {
    expect(resolveWaveFiles("/no/such/dir/xyz123", "Wave 5")).toEqual({ mockups: [] });
  });

  it("ignores a malformed manifest and still resolves by convention", () => {
    const broken = mkdtempSync(join(tmpdir(), "atrium-broken-manifest-"));
    try {
      mkdirSync(join(broken, ".atrium"));
      writeFileSync(join(broken, ".atrium", "waves.json"), "{not json");
      mkdirSync(join(broken, "docs", "waves"), { recursive: true });
      writeFileSync(join(broken, "docs", "waves", "wave-1.md"), "# prd");
      const r = resolveWaveFiles(broken, "Wave 1 · CLI");
      expect(r.prd?.name).toBe("wave-1.md");
    } finally {
      rmSync(broken, { recursive: true, force: true });
    }
  });
});
