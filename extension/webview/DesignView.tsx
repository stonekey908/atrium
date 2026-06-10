import { useState } from "react";
import { vscode } from "./vscode";
import { MockupPreview } from "./MockupPreview";
import type { InitPayload, Wave, WaveFileRef } from "./types";

/**
 * Design canvas (STO-2168 + STO-2478 + STO-2479): the project's mockup /
 * design artifacts, grouped by the wave that owns them (resolved host-side from
 * .atrium/waves.json or the wave-<n>-* naming convention), with HTML mockups
 * rendering inline in a sandboxed live preview — the host watches previewed
 * files, so edits re-render. Files no wave claims land in a "Project-wide"
 * bucket — visible, never lost. Editing stays VS Code's job (open affordance);
 * Atrium is a surface, not an editor.
 */
export function DesignView({ init }: { init: InitPayload }) {
  const refs = init.designRefs ?? [];
  const waves = (init.waves ?? []).filter(
    (w) => w.files && (w.files.prd || w.files.mockups.length > 0),
  );
  const claimed = new Set(
    waves.flatMap((w) =>
      [w.files?.prd?.path, ...(w.files?.mockups.map((m) => m.path) ?? [])].filter(
        (p): p is string => !!p,
      ),
    ),
  );
  const general = refs.filter((r) => !claimed.has(r.path));

  // The first wave-owned HTML mockup starts expanded so the canvas opens
  // showing a design, not a list of file names.
  const firstHtml = waves
    .flatMap((w) => w.files?.mockups ?? [])
    .find((m) => m.kind === "html")?.path;
  const [open, setOpen] = useState<Set<string>>(() => new Set(firstHtml ? [firstHtml] : []));
  const toggle = (path: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[920px] px-4 py-4 flex flex-col gap-5">
        <header>
          <h2 className="text-[20px] tracking-tight" style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}>
            Design · references
          </h2>
          <p className="text-fg-muted text-[12px] mt-1">
            Mockups grouped by the wave they belong to — HTML mockups preview inline and re-render when the file
            changes. Open one in VS Code to edit it.
          </p>
        </header>
        {waves.map((w) => (
          <WaveDesign key={w.name} wave={w} open={open} onToggle={toggle} />
        ))}
        {general.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-fg-muted">Project-wide</h3>
            <ul className="flex flex-col gap-2">
              {general.map((r) => (
                <DesignCard key={r.path} item={r} open={open.has(r.path)} onToggle={() => toggle(r.path)} />
              ))}
            </ul>
          </section>
        )}
        {waves.length === 0 && general.length === 0 && (
          <p className="text-fg-muted italic text-[12px]">
            {init.folders.length === 0
              ? "No folder is open in this window — open the project folder (File → Open Folder) so Atrium can discover its PRD and mockup files."
              : "No design references found. Map them in .atrium/waves.json or name them wave-<n>-*.html in files/, docs/, mockups/ or design/."}
          </p>
        )}
      </div>
    </div>
  );
}

/** One wave's design artifacts: icon-only PRD link + mockup list with previews. */
function WaveDesign({
  wave,
  open,
  onToggle,
}: {
  wave: Wave;
  open: Set<string>;
  onToggle: (path: string) => void;
}) {
  const files = wave.files!;
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h3 className="text-[13px] font-semibold">{wave.name}</h3>
        {files.prd && (
          <button
            type="button"
            onClick={() => vscode.postMessage({ type: "openFile", path: files.prd!.path })}
            className="flex items-center self-center text-fg-muted hover:text-link"
            aria-label={`Open ${files.prd.name} in VS Code`}
            title={`PRD · open ${files.prd.name} in VS Code`}
          >
            <span className="codicon codicon-book text-[13px]" />
          </button>
        )}
      </div>
      {files.mockups.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {files.mockups.map((m) => (
            <DesignCard key={m.path} item={m} open={open.has(m.path)} onToggle={() => onToggle(m.path)} />
          ))}
        </ul>
      ) : (
        <p className="text-fg-muted italic text-[11px]">No mockups linked to this wave.</p>
      )}
    </section>
  );
}

function DesignCard({
  item,
  open,
  onToggle,
}: {
  item: Pick<WaveFileRef, "name" | "path" | "kind">;
  open: boolean;
  onToggle: () => void;
}) {
  const previewable = item.kind === "html";
  const icon =
    item.kind === "image"
      ? "codicon-file-media"
      : item.kind === "figma"
        ? "codicon-symbol-color"
        : item.kind === "md"
          ? "codicon-book"
          : "codicon-file-code";
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 p-2 border border-border rounded hover:border-fg-muted">
        {previewable ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex items-center gap-2 flex-1 min-w-0 text-left"
            title={open ? `Collapse ${item.name}` : `Preview ${item.name} inline`}
          >
            <span className={`codicon ${open ? "codicon-chevron-down" : "codicon-chevron-right"} text-fg-muted shrink-0`} />
            <span className={`codicon ${icon} text-link shrink-0`} />
            <span className="truncate text-[12px]">{item.name}</span>
          </button>
        ) : (
          <span className="flex items-center gap-2 flex-1 min-w-0">
            <span className={`codicon ${icon} text-link shrink-0`} />
            <span className="truncate text-[12px]">{item.name}</span>
          </span>
        )}
        <button
          type="button"
          aria-label={`Open ${item.name} in VS Code`}
          title={`Open ${item.name} in VS Code to edit`}
          className="flex items-center text-fg-muted hover:text-link shrink-0"
          onClick={() => vscode.postMessage({ type: "openFile", path: item.path })}
        >
          <span className="codicon codicon-link-external text-[12px]" />
        </button>
      </div>
      {previewable && open && <MockupPreview path={item.path} title={item.name} />}
    </li>
  );
}
