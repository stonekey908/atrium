/**
 * Wave → repo-files resolver, the async twin of `extension/src/wave-files.ts`
 * over `$.fs`. Manifest (`.atrium/waves.json`) first, naming convention second,
 * an honest empty result otherwise; never throws.
 */
import type { AtriumFileKind, AtriumFileRef, AtriumWaveFiles } from "../types";
import { waveNumber } from "./board";

/** The slice of `$.fs` this module needs — a test hands it a map. */
export interface FsLike {
  list: (path: string) => Promise<{ name: string; kind: "file" | "dir" | "other" }[]>;
  exists: (path: string) => Promise<boolean>;
  read: (path: string) => Promise<string>;
}

/** Dirs scanned for convention-named mockups and docs. Flat scans. */
const SCAN_DIRS = ["files", "docs", "mockups", "design", "docs/waves"];

export function join(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .join("/")
    .replace(/\/{2,}/g, "/");
}

export function kindOf(name: string): AtriumFileKind | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".md")) return "md";
  if (lower.endsWith(".html")) return "html";
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/.test(lower)) return "image";
  if (lower.endsWith(".fig")) return "figma";
  return null;
}

function toRef(path: string): AtriumFileRef | null {
  const kind = kindOf(path);
  const name = path.split("/").pop() ?? path;
  return kind ? { name, path, kind } : null;
}

interface ManifestEntry {
  prd?: string;
  mockups?: string[];
  docs?: string[];
}

async function readManifest(fs: FsLike, root: string): Promise<Record<string, ManifestEntry>> {
  try {
    const raw = JSON.parse(await fs.read(join(root, ".atrium", "waves.json"))) as unknown;
    return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, ManifestEntry>) : {};
  } catch {
    return {};
  }
}

async function listFiles(fs: FsLike, dir: string): Promise<string[]> {
  try {
    return (await fs.list(dir)).filter((e) => e.kind === "file").map((e) => e.name);
  } catch {
    return [];
  }
}

const escapeNumber = (n: string) => n.replace(/\./g, "\\.");

/** `wave-<n>` followed by `-` or `.`, so wave-5 never matches wave-55 or wave-0.75. */
async function conventionMockups(fs: FsLike, root: string, n: string): Promise<AtriumFileRef[]> {
  const re = new RegExp(`^wave-${escapeNumber(n)}[-.]`, "i");
  const out: AtriumFileRef[] = [];
  for (const sub of SCAN_DIRS) {
    for (const name of await listFiles(fs, join(root, sub))) {
      if (!re.test(name) || name.toLowerCase().endsWith(".md")) continue;
      const ref = toRef(join(root, sub, name));
      if (ref) out.push(ref);
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** `docs/waves/wave-<n>-*.md` — the bare `wave-<n>.md` is the PRD, not a doc. */
async function conventionDocs(fs: FsLike, root: string, n: string): Promise<AtriumFileRef[]> {
  const re = new RegExp(`^wave-${escapeNumber(n)}-.*\\.md$`, "i");
  const names = await listFiles(fs, join(root, "docs", "waves"));
  return names
    .filter((name) => re.test(name))
    .map((name) => toRef(join(root, "docs", "waves", name)))
    .filter((r): r is AtriumFileRef => r !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function fromManifestList(fs: FsLike, root: string, paths: string[]): Promise<AtriumFileRef[]> {
  const out: AtriumFileRef[] = [];
  for (const p of paths) {
    const abs = join(root, p);
    if (await fs.exists(abs)) {
      const ref = toRef(abs);
      if (ref) out.push(ref);
    }
  }
  return out;
}

export async function resolveWaveFiles(fs: FsLike, root: string, waveLabelOrName: string): Promise<AtriumWaveFiles> {
  const n = waveNumber(waveLabelOrName);
  if (!n) return { prd: null, docs: [], mockups: [] };

  const entry = (await readManifest(fs, root))[n];

  let prd: AtriumFileRef | null = null;
  if (entry?.prd && (await fs.exists(join(root, entry.prd)))) prd = toRef(join(root, entry.prd));
  if (!prd) {
    const conventional = join(root, "docs", "waves", `wave-${n}.md`);
    if (await fs.exists(conventional)) prd = toRef(conventional);
  }

  const mockups = entry?.mockups ? await fromManifestList(fs, root, entry.mockups) : await conventionMockups(fs, root, n);
  const docs = entry?.docs ? await fromManifestList(fs, root, entry.docs) : await conventionDocs(fs, root, n);
  return { prd, mockups, docs };
}
