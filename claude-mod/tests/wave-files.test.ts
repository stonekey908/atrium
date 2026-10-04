import { describe, expect, test } from "claude-code/testing";

import type { FsLike } from "../hooks/wave-files";
import { resolveWaveFiles } from "../hooks/wave-files";

/** An in-memory tree: directory → file names, plus file contents by path. */
function fakeFs(dirs: Record<string, string[]>, contents: Record<string, string> = {}): FsLike {
  const all = new Set(Object.entries(dirs).flatMap(([d, names]) => names.map((n) => `${d}/${n}`)));
  return {
    list: async (path) => {
      const names = dirs[path];
      if (!names) throw new Error(`ENOENT ${path}`);
      return names.map((name) => ({ name, kind: "file" as const }));
    },
    exists: async (path) => all.has(path) || path in contents,
    read: async (path) => {
      const text = contents[path];
      if (text === undefined) throw new Error(`ENOENT ${path}`);
      return text;
    },
  };
}

describe("resolveWaveFiles", () => {
  test("finds the PRD, further docs and mockups by convention", async () => {
    const fs = fakeFs({
      "/r/docs/waves": ["wave-5.md", "wave-5-trd.md", "wave-55.md", "wave-5-flow.png"],
      "/r/files": ["wave-5-board.html", "wave-0.5-x.html", "readme.txt"],
    });
    const files = await resolveWaveFiles(fs, "/r", "ATR Wave 5 · SDLC flow");
    expect(files.prd?.path).toBe("/r/docs/waves/wave-5.md");
    expect(files.docs.map((d) => d.name)).toEqual(["wave-5-trd.md"]);
    expect(files.mockups.map((m) => `${m.kind}:${m.name}`)).toEqual(["html:wave-5-board.html", "image:wave-5-flow.png"]);
  });

  test("a manifest entry wins while its files exist", async () => {
    const manifest = JSON.stringify({ "0.7": { prd: "docs/specs/sprint.md", mockups: ["files/horizon.html", "files/gone.html"] } });
    const fs = fakeFs({ "/r/docs/specs": ["sprint.md"], "/r/files": ["horizon.html"] }, { "/r/.atrium/waves.json": manifest });
    const files = await resolveWaveFiles(fs, "/r", "Wave 0.7 · Sprint board");
    expect(files.prd?.path).toBe("/r/docs/specs/sprint.md");
    expect(files.mockups.map((m) => m.name)).toEqual(["horizon.html"]);
  });

  test("answers honestly empty for a wave with no number or no files", async () => {
    const fs = fakeFs({});
    expect(await resolveWaveFiles(fs, "/r", "Unsorted · No sprint")).toEqual({ prd: null, docs: [], mockups: [] });
    expect(await resolveWaveFiles(fs, "/r", "Wave 3")).toEqual({ prd: null, docs: [], mockups: [] });
  });
});
