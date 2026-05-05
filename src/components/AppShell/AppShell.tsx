/**
 * AppShell — Atrium's three-column application shell, Project Folder canvas.
 *
 * Layout: 280px left rail (workspaces · projects · file tree) · 1fr folder
 * page (header + drop zone + file grid + activity) · 44px slim icon rail.
 *
 * Visual contract: `files/atrium-v5.html` — section 01 (Project Folder view).
 * All sub-components live in `./parts/*` and consume design tokens only;
 * there are no raw hex colours in this tree (HSL inline gradients on image
 * previews are a deliberate carry-over from the mockup).
 *
 * Scope: visual fidelity only. No state, no routing, no real data. Real
 * interactivity (file tree expand/collapse, drag-drop, etc.) lands in
 * STO-2163 and friends.
 */

import { FolderPage } from "./parts/FolderPage";
import { LeftRail } from "./parts/LeftRail";
import { SlimIconRail } from "./parts/SlimIconRail";

export function AppShell() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr_44px] bg-background text-foreground">
      <LeftRail />
      <FolderPage />
      <SlimIconRail />
    </div>
  );
}
