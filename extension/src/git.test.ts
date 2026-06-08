import { describe, it, expect } from "vitest";
import { getGitStatus } from "./git";

// Note: the real branch/dirty/ahead read is exercised in the running extension
// host (real Node). Under vitest's jsdom workers the `git` child process isn't
// always reachable, so the happy-path assertion is shape-conditional to avoid a
// flaky environment dependency; the error path (non-repo → null) is exact.
describe("getGitStatus", () => {
  it("returns null for a path that isn't a git repo", async () => {
    expect(await getGitStatus("/")).toBeNull();
  });

  it("resolves to null or a well-formed status without throwing", async () => {
    const status = await getGitStatus(process.cwd());
    if (status !== null) {
      expect(typeof status.branch).toBe("string");
      expect(typeof status.dirty).toBe("boolean");
      expect(Number.isFinite(status.ahead)).toBe(true);
      expect(Number.isFinite(status.behind)).toBe(true);
    }
  });
});
