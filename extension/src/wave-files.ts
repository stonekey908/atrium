/**
 * Wave → repo-files resolver (STO-2478): given a wave, deterministically find
 * its PRD/spec doc and mockup files. The agent edits those files directly;
 * Atrium only surfaces them, so resolution must be cheap, pure-ish (fs reads
 * only) and never throw.
 *
 * Resolution order, per field:
 *   1. `.atrium/waves.json` manifest entry for the wave's number — wins when
 *      the path exists on disk (entries pointing at deleted files fall through).
 *   2. Naming convention — PRD at `docs/waves/wave-<n>.md`; mockups are files
 *      named `wave-<n>-*` / `wave-<n>.*` in the design dirs.
 *   3. Nothing — an honest empty result, never a guess.
 */
import { existsSync, readdirSync, readFileSync } from "fs";
import { basename, join } from "path";

export interface WaveFileRef {
  name: string;
  path: string;
  kind: "md" | "html" | "image" | "figma";
}

export interface WaveFiles {
  prd?: WaveFileRef;
  mockups: WaveFileRef[];
  /** Further docs for the wave (TRDs etc.) — manifest `docs` list or
   *  convention `docs/waves/wave-<n>-*.md` (STO-2496). */
  docs: WaveFileRef[];
}

/** Dirs scanned for convention-named mockups (same set as discover.ts plus the
 *  convention home `docs/waves`). Flat scans, no recursion. */
const SCAN_DIRS = ["files", "docs", "mockups", "design", join("docs", "waves")];

/** First number in a wave label/name — "ATR Wave 0.7 · Sprint board" → "0.7".
 *  Kept as a string so "0.7" and "5" key the manifest exactly. */
export function waveNumber(labelOrName: string): string | null {
  const m = labelOrName.match(/(\d+(?:\.\d+)?)/);
  return m ? m[1] : null;
}

function kindOf(name: string): WaveFileRef["kind"] | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".md")) return "md";
  if (lower.endsWith(".html")) return "html";
  if (/\.(png|jpg|jpeg|gif|webp)$/.test(lower)) return "image";
  if (lower.endsWith(".fig")) return "figma";
  return null;
}

function toRef(path: string): WaveFileRef | null {
  const kind = kindOf(path);
  return kind ? { name: basename(path), path, kind } : null;
}

interface ManifestEntry {
  prd?: string;
  mockups?: string[];
  docs?: string[];
}

function readManifest(root: string): Record<string, ManifestEntry> {
  try {
    const raw = JSON.parse(readFileSync(join(root, ".atrium", "waves.json"), "utf8"));
    return raw && typeof raw === "object" ? (raw as Record<string, ManifestEntry>) : {};
  } catch {
    return {};
  }
}

/** Convention mockups: `wave-<n>` followed by `-` or `.` so wave-5 never
 *  matches wave-55 or wave-0.75. */
function conventionMockups(root: string, n: string): WaveFileRef[] {
  const re = new RegExp(`^wave-${n.replace(/\./g, "\\.")}[-.]`, "i");
  const out: WaveFileRef[] = [];
  for (const sub of SCAN_DIRS) {
    let entries;
    try {
      entries = readdirSync(join(root, sub), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isFile() || !re.test(e.name) || e.name.toLowerCase().endsWith(".md")) continue;
      const ref = toRef(join(root, sub, e.name));
      if (ref) out.push(ref);
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Convention docs (TRDs etc.): `docs/waves/wave-<n>-*.md` — the bare
 *  `wave-<n>.md` is the PRD, not a doc. */
function conventionDocs(root: string, n: string): WaveFileRef[] {
  const re = new RegExp(`^wave-${n.replace(/\./g, "\\.")}-.*\\.md$`, "i");
  let entries;
  try {
    entries = readdirSync(join(root, "docs", "waves"), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && re.test(e.name))
    .map((e) => toRef(join(root, "docs", "waves", e.name)))
    .filter((r): r is WaveFileRef => r !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function fromManifestList(root: string, paths: string[]): WaveFileRef[] {
  return paths
    .map((p) => join(root, p))
    .filter((p) => existsSync(p))
    .map(toRef)
    .filter((r): r is WaveFileRef => r !== null);
}

export function resolveWaveFiles(root: string, waveLabelOrName: string): WaveFiles {
  const n = waveNumber(waveLabelOrName);
  if (!n) return { mockups: [], docs: [] };

  const entry = readManifest(root)[n];

  let prd: WaveFileRef | undefined;
  if (entry?.prd && existsSync(join(root, entry.prd))) {
    prd = toRef(join(root, entry.prd)) ?? undefined;
  }
  if (!prd) {
    const conventional = join(root, "docs", "waves", `wave-${n}.md`);
    if (existsSync(conventional)) prd = toRef(conventional) ?? undefined;
  }

  const mockups = entry?.mockups ? fromManifestList(root, entry.mockups) : conventionMockups(root, n);
  const docs = entry?.docs ? fromManifestList(root, entry.docs) : conventionDocs(root, n);

  return prd ? { prd, mockups, docs } : { mockups, docs };
}
