/**
 * Workspace discovery for the cockpit: the project's design reference artifacts
 * (STO-2168). A cheap, bounded filesystem scan done in the host; failures
 * degrade to []. (The unit-test-file count from STO-2186 was removed in
 * STO-2498's board-first simplification — rebuildable if wanted.)
 */
import { readdirSync } from "fs";
import { join } from "path";

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
