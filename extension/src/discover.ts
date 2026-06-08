/**
 * Workspace discovery for the cockpit: a count of unit-test files (STO-2186) and
 * the project's design reference artifacts (STO-2168). Both are cheap, bounded
 * filesystem walks done in the host; failures degrade to 0 / [].
 *
 * Per-ticket test↔ticket association from the original STO-2186 spec isn't
 * implemented — there's no mapping convention in the repo and running the suite
 * at cockpit-load is too heavy — so this surfaces a project-level count instead.
 */
import { readdirSync } from "fs";
import { join } from "path";

const SKIP = new Set(["node_modules", ".git", "dist", "target", "out", "coverage"]);
const TEST_RE = /\.(test|spec)\.(ts|tsx|js|jsx)$/;

/** Recursively counts unit-test files under `root` (bounded depth, skips build dirs). */
export function getTestFileCount(root: string): number {
  let count = 0;
  const walk = (dir: string, depth: number): void => {
    if (depth > 8) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!SKIP.has(e.name) && !e.name.startsWith(".")) walk(join(dir, e.name), depth + 1);
      } else if (TEST_RE.test(e.name)) {
        count++;
      }
    }
  };
  walk(root, 0);
  return count;
}

export interface DesignRef {
  name: string;
  path: string;
  kind: "html" | "image" | "figma";
}

const DESIGN_DIRS = ["files", "docs", "mockups", "design"];

/** Lists mockup / design-reference files in the project's known design dirs. */
export function getDesignRefs(root: string): DesignRef[] {
  const refs: DesignRef[] = [];
  for (const sub of DESIGN_DIRS) {
    let entries;
    try {
      entries = readdirSync(join(root, sub), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isFile()) continue;
      const lower = e.name.toLowerCase();
      const kind = lower.endsWith(".html")
        ? "html"
        : /\.(png|jpg|jpeg|gif|webp)$/.test(lower)
          ? "image"
          : lower.endsWith(".fig")
            ? "figma"
            : null;
      if (kind) refs.push({ name: e.name, path: join(root, sub, e.name), kind });
    }
  }
  return refs;
}
