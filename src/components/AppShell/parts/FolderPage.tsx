/**
 * FolderPage — main canvas of the Project Folder view.
 *
 * Sections (top to bottom):
 *   - folder-head: crumbs · h1+description · 4 stats · action row (4 buttons)
 *   - folder-body:
 *       - dropzone (cloud-up icon + format pills)
 *       - "Recent files" group title + 4-column file grid (8 cards)
 *       - "Recent activity" group title + 5-row list
 *
 * Visual contract: `files/atrium-v5.html` lines ~3375-3592 (markup) + ~648-854
 * (CSS). All sizes mirror the `.folder-head` / `.folder-body` / `.dropzone` /
 * `.file-card` / `.activity-row` rules; no raw hex (HSL gradients in image
 * previews are preserved verbatim — the mockup uses inline-style gradients).
 */

import { type ReactNode } from "react";

// ───────────────────────────────────────────────────────────────────────────
// Header
// ───────────────────────────────────────────────────────────────────────────

/** Cloud-with-up-arrow icon for the dropzone. 32×32, stroke 1.5. */
function CloudUploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={32}
      height={32}
      aria-hidden
      className="mx-auto mb-2.5 block text-muted-foreground"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1={12} y1={3} x2={12} y2={15} />
    </svg>
  );
}

/** "Open pipeline" home/triangle glyph. 14×14, stroke 2. */
function HomeIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={14}
      height={14}
      aria-hidden
    >
      <path d="M3 6 l5 -3 l5 3" />
      <line x1={8} y1={3} x2={8} y2={13} />
    </svg>
  );
}

/** Plus icon for "New wave" button. 14×14, stroke 2. */
function PlusIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={14}
      height={14}
      aria-hidden
    >
      <path d="M8 3v10 M3 8h10" />
    </svg>
  );
}

/**
 * Stat block. Mono uppercase 10px label above, 18px font-semibold value below.
 * The "alive" variant tints the value emerald (used for "In flight").
 */
function Stat({ k, v, alive = false }: { k: string; v: string; alive?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="mb-1 font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
        {k}
      </span>
      <span
        className={[
          "text-[18px] font-semibold tracking-[-0.02em]",
          alive ? "text-emerald" : "text-foreground",
        ].join(" ")}
      >
        {v}
      </span>
    </div>
  );
}

/**
 * Action button. Three variants: primary (filled), outline (default), ghost
 * (no border, hover reveal). Matches `.btn` / `.btn.primary` / `.btn.ghost` in
 * v5: 30px height, 12px x-padding, 13px font, 4px gap to icon.
 */
function ActionButton({
  variant = "outline",
  icon,
  children,
}: {
  variant?: "primary" | "outline" | "ghost";
  icon?: ReactNode;
  children: ReactNode;
}) {
  const base =
    "inline-flex h-[30px] items-center gap-1.5 rounded px-3 py-1.5 text-[13px] font-medium transition-colors";
  const variantClass =
    variant === "primary"
      ? "border border-foreground bg-foreground text-background hover:opacity-90"
      : variant === "ghost"
        ? "text-muted-foreground hover:bg-accent hover:text-foreground"
        : "border border-border bg-background text-foreground hover:bg-accent";
  return (
    <button type="button" className={`${base} ${variantClass}`}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

function FolderHead() {
  return (
    <header className="border-b border-border px-pad-x pb-[18px] pt-7">
      <nav
        aria-label="Folder location"
        className="mb-3.5 font-mono text-[11px] tracking-[0.02em] text-muted-foreground"
      >
        <span>~/projects/</span>
        <span className="text-foreground">atrium</span>
      </nav>

      <div className="flex items-end gap-4">
        <div>
          <h1 className="mb-1.5 text-[28px] font-semibold leading-[1.1] tracking-[-0.025em]">
            Atrium
          </h1>
          <p className="max-w-[540px] text-[13.5px] text-muted-foreground">
            A native, refined wrapper for Claude Code — and the visual cockpit for the
            SDLC loop around it. Tracked at{" "}
            <code className="rounded bg-muted px-1.5 py-px font-mono text-[12px] text-foreground">
              ~/projects/atrium
            </code>
            .
          </p>
        </div>

        <div className="ml-auto flex items-end gap-7">
          <Stat k="Waves" v="9" />
          <Stat k="Tickets" v="21 / 56" />
          <Stat k="Files" v="18" />
          <Stat k="In flight" v="1" alive />
        </div>
      </div>

      <div className="mt-[18px] flex gap-2">
        <ActionButton variant="primary" icon={<HomeIcon />}>
          Open pipeline
        </ActionButton>
        <ActionButton icon={<PlusIcon />}>New wave</ActionButton>
        <ActionButton variant="ghost">Reveal in Finder</ActionButton>
        <ActionButton variant="ghost">Open in terminal</ActionButton>
      </div>
    </header>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Drop zone
// ───────────────────────────────────────────────────────────────────────────

/** Mono pill listing an accepted file format (.md, .html, …). */
function FormatPill({ ext }: { ext: string }) {
  return (
    <span className="rounded-full border border-border px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
      {ext}
    </span>
  );
}

function DropZone() {
  return (
    <button
      type="button"
      className="mb-8 block w-full cursor-pointer rounded-md border-[1.5px] border-dashed border-border bg-background px-6 py-7 text-center transition-colors hover:border-ring hover:bg-accent"
    >
      <CloudUploadIcon />
      <h4 className="mb-1 text-[14.5px] font-semibold tracking-[-0.01em]">
        Drop anything here
      </h4>
      <p className="text-[12.5px] text-muted-foreground">
        Specs, mockups, screenshots, reference images, uploads. Files land in this
        project's folder and become available to every stage.
      </p>
      <div className="mt-3 inline-flex flex-wrap justify-center gap-1.5">
        <FormatPill ext=".md" />
        <FormatPill ext=".html" />
        <FormatPill ext=".png" />
        <FormatPill ext=".jpg" />
        <FormatPill ext=".fig" />
        <FormatPill ext=".pdf" />
        <FormatPill ext=".json" />
      </div>
    </button>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// File card + grid
// ───────────────────────────────────────────────────────────────────────────

type FileType = "md" | "html" | "png" | "fig";

/** Recolour the f-type chip per extension, matching `.file-card.md/.html/...`. */
const ftypeClass: Record<FileType, string> = {
  md: "bg-violet-soft text-violet",
  html: "bg-emerald-soft text-emerald",
  png: "bg-orange-soft text-orange",
  fig: "bg-amber-soft text-amber",
};

/**
 * "Lines" preview body for markdown cards. Three stripe widths via classnames:
 * full (100%), m (75%), s (50%) — matches `.file-card .preview .ln{,.m,.s}`.
 */
function LinesPreview({ widths }: { widths: ReadonlyArray<"full" | "m" | "s"> }) {
  const widthClass: Record<"full" | "m" | "s", string> = {
    full: "w-full",
    m: "w-3/4",
    s: "w-1/2",
  };
  return (
    <div className="aspect-[16/10] overflow-hidden rounded-sm border border-border bg-muted">
      <div className="flex flex-col gap-1 p-2">
        {widths.map((w, i) => (
          <div
            key={i}
            className={`h-1 rounded-[2px] ${widthClass[w]}`}
            style={{ background: "hsl(240 5.9% 80%)" }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Tiny html mockup preview: header bar + 30/70 body grid. Matches
 * `.file-card .preview.html-mockup`.
 */
function HtmlMockupPreview() {
  return (
    <div className="aspect-[16/10] overflow-hidden rounded-sm border border-border bg-background p-1.5">
      <div className="h-2 rounded-t-[2px] border-b border-border bg-muted" />
      <div className="grid h-[calc(100%-10px)] grid-cols-[30%_1fr] gap-1 pt-1">
        <div className="rounded-[2px] bg-muted" />
        <div className="rounded-[2px] bg-muted" />
      </div>
    </div>
  );
}

/** Image preview — always a CSS gradient. The gradient is the artwork. */
function ImagePreview({ background }: { background: string }) {
  return (
    <div
      className="aspect-[16/10] overflow-hidden rounded-sm border border-border"
      style={{ background }}
    />
  );
}

/** Generic file card. Renders a `head` chip row, custom preview, name, meta. */
function FileCard({
  ftype,
  stage,
  preview,
  name,
  meta,
}: {
  ftype: FileType;
  stage: string;
  preview: ReactNode;
  name: string;
  meta: ReadonlyArray<string>;
}) {
  return (
    <button
      type="button"
      className="cursor-pointer rounded border border-border bg-background p-3.5 text-left transition-colors hover:border-ring hover:bg-accent"
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className={`rounded-[3px] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.05em] ${ftypeClass[ftype]}`}
        >
          {ftype}
        </span>
        <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.05em] text-muted-foreground">
          {stage}
        </span>
      </div>
      <div className="mb-2.5">{preview}</div>
      <div className="mb-1 truncate text-[13px] font-medium">{name}</div>
      <div className="flex items-center gap-1 font-mono text-[10.5px] text-muted-foreground">
        {meta.map((m, i) => (
          <span key={i} className="contents">
            {i > 0 ? <span className="text-border">·</span> : null}
            <span>{m}</span>
          </span>
        ))}
      </div>
    </button>
  );
}

function FileGrid() {
  return (
    <div className="mb-9 grid grid-cols-4 gap-3">
      <FileCard
        ftype="md"
        stage="Spec"
        name="atrium-spec.md"
        meta={["16 KB", "2026-05-03"]}
        preview={<LinesPreview widths={["m", "s", "full", "m", "full", "s"]} />}
      />
      <FileCard
        ftype="html"
        stage="Design"
        name="atrium-v5.html"
        meta={["62 KB", "just now"]}
        preview={<HtmlMockupPreview />}
      />
      <FileCard
        ftype="png"
        stage="UAT-091"
        name="uat-091.png"
        meta={["184 KB", "annotated"]}
        preview={
          <ImagePreview background="linear-gradient(135deg, hsl(20 50% 70%), hsl(38 60% 65%))" />
        }
      />
      <FileCard
        ftype="png"
        stage="Reference"
        name="reference-cursor.png"
        meta={["312 KB", "upload"]}
        preview={
          <ImagePreview background="linear-gradient(135deg, hsl(218 50% 65%), hsl(258 40% 60%))" />
        }
      />
      <FileCard
        ftype="md"
        stage="Wave 4"
        name="wave-4-mcp-marketplace.md"
        meta={["4.2 KB", "32m ago"]}
        preview={<LinesPreview widths={["m", "full", "s", "full"]} />}
      />
      <FileCard
        ftype="fig"
        stage="Linked"
        name="session-flows.fig"
        meta={["linked", "4h ago"]}
        preview={
          <ImagePreview background="linear-gradient(135deg, hsl(38 60% 42%), hsl(20 60% 50%))" />
        }
      />
      <FileCard
        ftype="md"
        stage="Findings"
        name="findings.md"
        meta={["2.1 KB", "UAT"]}
        preview={<LinesPreview widths={["full", "s", "m"]} />}
      />
      <FileCard
        ftype="png"
        stage="Upload"
        name="shadcn-reference.png"
        meta={["248 KB", "upload"]}
        preview={
          <ImagePreview background="linear-gradient(135deg, hsl(160 40% 60%), hsl(200 50% 60%))" />
        }
      />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Group title + activity list
// ───────────────────────────────────────────────────────────────────────────

/** Section heading shared between "Recent files" and "Recent activity" groups. */
function GroupTitle({
  title,
  count,
  right,
}: {
  title: string;
  count: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3.5 flex items-baseline gap-3">
      <h3 className="text-[14px] font-semibold tracking-[-0.012em]">{title}</h3>
      <span className="font-mono text-[11px] text-muted-foreground">{count}</span>
      {right ? <div className="ml-auto">{right}</div> : null}
    </div>
  );
}

/**
 * Single activity row. Three columns: when (mono 10.5px) · what (13px, bold
 * spans get `font-medium text-foreground`) · where (right-aligned mono 10.5px).
 */
function ActivityRow({
  when,
  children,
  where,
}: {
  when: string;
  children: ReactNode;
  where: string;
}) {
  return (
    <div className="grid grid-cols-[100px_1fr_120px] items-center gap-[18px] border-b border-border px-4 py-3 text-[13px] last:border-b-0">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.04em] text-muted-foreground">
        {when}
      </span>
      <span className="text-muted-foreground">{children}</span>
      <span className="text-right font-mono text-[10.5px] text-muted-foreground">
        {where}
      </span>
    </div>
  );
}

/** Inline span used inside an activity row to highlight a noun (mono+fg). */
function B({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-foreground">{children}</strong>;
}

function ActivityList() {
  return (
    <div className="overflow-hidden rounded border border-border">
      <ActivityRow when="just now" where="→ uploads">
        <B>You</B> dropped <B>shadcn-reference.png</B> into the folder
      </ActivityRow>
      <ActivityRow when="12m ago" where="→ artifacts/wave-3">
        <B>Claude</B> created <B>uat-091.png</B> from a screenshot
      </ActivityRow>
      <ActivityRow when="32m ago" where="→ artifacts">
        <B>/requirements</B> generated <B>wave-4-mcp-marketplace.md</B>
      </ActivityRow>
      <ActivityRow when="1h ago" where="→ pipeline">
        Wave 3 returned to <B>Design</B> · pin opened on uat-091.png
      </ActivityRow>
      <ActivityRow when="3h ago" where="→ STO-2104">
        <B>Linear</B> synced 4 ticket updates into Wave 1
      </ActivityRow>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// FolderPage composition
// ───────────────────────────────────────────────────────────────────────────

export function FolderPage() {
  return (
    <section className="min-h-0 overflow-y-auto bg-background">
      <FolderHead />
      <div className="px-pad-x pb-14 pt-7">
        <DropZone />

        <GroupTitle
          title="Recent files"
          count="7 of 18"
          right={
            <button
              type="button"
              className="inline-flex h-[26px] items-center rounded px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              View all
            </button>
          }
        />
        <FileGrid />

        <GroupTitle title="Recent activity" count="5 of 24" />
        <ActivityList />
      </div>
    </section>
  );
}
