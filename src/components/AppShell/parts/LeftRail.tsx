/**
 * LeftRail — 280px left rail of the Project Folder canvas.
 *
 * Three vertical sections separated by `border-t border-border`:
 *   1. WORKSPACES — Stonekey (active), Personal — circle + count chip per row.
 *   2. PROJECTS · STONEKEY — Atrium (active), Lookout, cursor-for-pms — hex + count.
 *   3. FOLDER · ~/projects/atrium — file tree with twist (▾/▸), folder/file icons,
 *      indent levels, and an "+ new file" icon button on the section label.
 *
 * Visual contract: `files/atrium-v5.html` lines ~2666-2787 (markup) + ~245-340
 * (CSS). All colours flow through tokens. Tree state is purely visual — no
 * expand/collapse interactivity yet (out of scope for this ticket).
 */

import { type ReactNode, type SVGProps } from "react";

/** Mono-uppercase 10px section label. Used for WORKSPACES / PROJECTS / FOLDER. */
function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-2.5 pb-1 pt-1.5 font-mono text-[9.5px] uppercase tracking-[0.04em] text-muted-foreground">
      <span>{children}</span>
      {action}
    </div>
  );
}

/** 14×14 circle (border-only). Used as the workspace bullet. */
function CircleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      width={12}
      height={12}
      {...props}
    >
      <circle cx={8} cy={8} r={5.5} />
    </svg>
  );
}

/** 12×12 hex/cube. Used as the project bullet. */
function HexIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      width={12}
      height={12}
      {...props}
    >
      <path d="M2.5 5l5.5-3 5.5 3v6l-5.5 3-5.5-3z" />
    </svg>
  );
}

/** 12×12 folder (filled). Used for tree directory rows. */
function FolderIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" width={12} height={12} {...props}>
      <path d="M2 4a1 1 0 011-1h4l1.5 1.5H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1z" />
    </svg>
  );
}

/** 12×12 document. Used for non-image leaf files. */
function FileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      width={12}
      height={12}
      {...props}
    >
      <path d="M3 2.5h6L13 6v7.5a1 1 0 01-1 1H3a1 1 0 01-1-1V3.5a1 1 0 011-1z" />
    </svg>
  );
}

/** 12×12 document with the dog-ear stroke. Used for the active spec file row. */
function FileWithFoldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      width={12}
      height={12}
      {...props}
    >
      <path d="M3 2.5h6L13 6v7.5a1 1 0 01-1 1H3a1 1 0 01-1-1V3.5a1 1 0 011-1z" />
      <path d="M9 2.5V6h4" />
    </svg>
  );
}

/** 12×12 image (rect + sun + mountains). Used for png/jpg leaf rows. */
function ImageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      width={12}
      height={12}
      {...props}
    >
      <rect x={2.5} y={3} width={11} height={10} rx={1} />
      <circle cx={6} cy={7} r={1} />
      <path d="M3 12l3-3 3 3 4-4" />
    </svg>
  );
}

/** Plus-icon button used in the FOLDER section label ("new file"). */
function PlusIconButton() {
  return (
    <button
      type="button"
      aria-label="New file"
      className="inline-flex items-center rounded-[3px] p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} width={11} height={11}>
        <line x1={8} y1={3} x2={8} y2={13} />
        <line x1={3} y1={8} x2={13} y2={8} />
      </svg>
    </button>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Workspaces / Projects rows (lr-item)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Workspace or project row. Matches `.lr-item` from v5: 14px icon · 1fr label
 * · auto count chip. Active variant gets `bg-accent` + medium font weight.
 */
function ListRow({
  icon,
  label,
  count,
  active = false,
}: {
  icon: ReactNode;
  label: string;
  count: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        "mx-1 mb-px grid w-[calc(100%-8px)] grid-cols-[14px_1fr_auto] items-center gap-2 rounded-sm px-2.5 py-1 text-left text-[12.5px] hover:bg-accent",
        active ? "bg-accent font-medium text-foreground" : "text-foreground",
      ].join(" ")}
    >
      <span className={active ? "text-foreground" : "text-muted-foreground"}>{icon}</span>
      <span className="truncate">{label}</span>
      <span className="font-mono text-[10px] text-muted-foreground">{count}</span>
    </button>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// File tree row (tree-row)
// ───────────────────────────────────────────────────────────────────────────

type Twist = "open" | "closed" | "leaf";

/**
 * File tree row. Matches `.tree-row` from v5: 12px twist · 12px icon · 1fr name
 * · auto meta. Two indent levels (depth 2 → pl-6, depth 3 → pl-[38px]) match
 * the `.indent-2` / `.indent-3` selectors. Dirs colour their icon `text-amber`.
 */
function TreeRow({
  twist,
  isDir,
  icon,
  name,
  meta,
  indent = 1,
  active = false,
}: {
  twist: Twist;
  isDir: boolean;
  icon: ReactNode;
  name: string;
  meta?: string;
  indent?: 1 | 2 | 3;
  active?: boolean;
}) {
  const indentClass = indent === 3 ? "pl-[38px]" : indent === 2 ? "pl-6" : "pl-2.5";
  const twistChar = twist === "open" ? "▾" : twist === "closed" ? "▸" : "";

  return (
    <button
      type="button"
      className={[
        "grid w-full grid-cols-[12px_12px_1fr_auto] items-center gap-1.5 rounded-sm py-px pr-2.5 text-left text-[12.5px] hover:bg-accent",
        indentClass,
        active ? "bg-accent font-medium text-foreground" : "text-foreground",
      ].join(" ")}
    >
      <span
        className="font-mono text-[9px] leading-none text-muted-foreground"
        aria-hidden
      >
        {twistChar}
      </span>
      <span className={isDir ? "text-amber" : "text-muted-foreground"}>{icon}</span>
      <span className="truncate">{name}</span>
      {meta ? (
        <span className="font-mono text-[9.5px] text-muted-foreground">{meta}</span>
      ) : (
        <span aria-hidden />
      )}
    </button>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// LeftRail composition
// ───────────────────────────────────────────────────────────────────────────

export function LeftRail() {
  return (
    <aside
      className="flex min-h-0 flex-col overflow-y-auto border-r border-border bg-background py-3"
      aria-label="Project navigation"
    >
      {/* Section 1 — Workspaces */}
      <section className="px-1.5 py-2">
        <SectionLabel>Workspaces</SectionLabel>
        <ListRow icon={<CircleIcon />} label="Stonekey" count="3" active />
        <ListRow icon={<CircleIcon />} label="Personal" count="2" />
      </section>

      {/* Section 2 — Projects · Stonekey */}
      <section className="border-t border-border px-1.5 py-2">
        <SectionLabel>Projects · Stonekey</SectionLabel>
        <ListRow icon={<HexIcon />} label="Atrium" count="9w" active />
        <ListRow icon={<HexIcon />} label="Lookout" count="3w" />
        <ListRow icon={<HexIcon />} label="cursor-for-pms" count="5w" />
      </section>

      {/* Section 3 — Folder file tree */}
      <section className="border-t border-border px-1.5 py-2">
        <SectionLabel action={<PlusIconButton />}>Folder · ~/projects/atrium</SectionLabel>
        <nav aria-label="File tree" className="px-1">
          <TreeRow
            twist="open"
            isDir
            icon={<FolderIcon />}
            name="files"
            meta="7"
            indent={1}
          />
          <TreeRow
            twist="leaf"
            isDir={false}
            icon={<FileWithFoldIcon />}
            name="atrium-spec.md"
            indent={2}
            active
          />
          <TreeRow
            twist="leaf"
            isDir={false}
            icon={<FileIcon />}
            name="atrium.html"
            indent={2}
          />
          <TreeRow
            twist="leaf"
            isDir={false}
            icon={<FileIcon />}
            name="atrium-v5.html"
            indent={2}
          />

          <TreeRow
            twist="open"
            isDir
            icon={<FolderIcon />}
            name="artifacts"
            meta="9"
            indent={1}
          />
          <TreeRow
            twist="closed"
            isDir
            icon={<FolderIcon />}
            name="wave-1"
            meta="3"
            indent={2}
          />
          <TreeRow
            twist="open"
            isDir
            icon={<FolderIcon />}
            name="wave-3-image-input"
            meta="4"
            indent={2}
          />
          <TreeRow
            twist="leaf"
            isDir={false}
            icon={<FileIcon />}
            name="wave-3.html"
            indent={3}
          />
          <TreeRow
            twist="leaf"
            isDir={false}
            icon={<ImageIcon />}
            name="uat-091.png"
            indent={3}
          />
          <TreeRow
            twist="leaf"
            isDir={false}
            icon={<ImageIcon />}
            name="reference-cursor.png"
            indent={3}
          />
          <TreeRow
            twist="leaf"
            isDir={false}
            icon={<FileIcon />}
            name="findings.md"
            indent={2}
          />

          <TreeRow
            twist="closed"
            isDir
            icon={<FolderIcon />}
            name="uploads"
            meta="5"
            indent={1}
          />

          <TreeRow
            twist="leaf"
            isDir={false}
            icon={<FileIcon />}
            name="CLAUDE.md"
            indent={1}
          />
          <TreeRow
            twist="leaf"
            isDir={false}
            icon={<FileIcon />}
            name="README.md"
            indent={1}
          />
        </nav>
      </section>
    </aside>
  );
}
