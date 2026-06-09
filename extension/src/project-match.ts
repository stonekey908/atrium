/**
 * Pure workspace-folder → Linear-project matcher (STO-2486). Kept SDK- and
 * vscode-free so it unit-tests cheaply; the host feeds it folder names and the
 * fetched project list.
 *
 * Exact (case-insensitive) matches win over normalized ones, and folders are
 * checked in workspace order. Normalized = lowercase, alphanumerics only, so
 * "atrium-cockpit" relates to "Atrium Cockpit".
 */
const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function matchProject(folders: string[], projects: string[]): string | null {
  for (const f of folders) {
    const exact = projects.find((p) => p.toLowerCase() === f.toLowerCase());
    if (exact) return exact;
  }
  for (const f of folders) {
    const fn = norm(f);
    if (!fn) continue;
    const loose = projects.find((p) => norm(p) === fn);
    if (loose) return loose;
  }
  return null;
}
