import { useState } from "react";
import { vscode } from "./vscode";
import { DocPreview } from "./DocPreview";
import type { InitPayload, Wave, WaveFileRef } from "./types";

/**
 * PRD canvas (STO-2496) — replaces the old Plan view. The planning surface is
 * the documents themselves: each wave's PRD and further docs (TRDs etc.,
 * resolved by file discovery) render inline as markdown and re-render live when
 * the files change. Moving tickets around stays on the Board; editing docs is
 * VS Code's job (open affordance per doc).
 */
export function PrdView({ init }: { init: InitPayload }) {
  const waves = (init.waves ?? []).filter(
    (w) => w.files && (w.files.prd || w.files.docs.length > 0),
  );
  // First documented wave starts open; the rest collapsed so long docs don't
  // stack into an endless scroll.
  const [open, setOpen] = useState<Set<string>>(() => new Set(waves[0] ? [waves[0].name] : []));
  const toggle = (name: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[820px] px-4 py-4 flex flex-col gap-4">
        <header>
          <h2 className="text-[20px] tracking-tight" style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}>
            PRD · documents
          </h2>
          <p className="text-fg-muted text-[12px] mt-1">
            Each wave's PRD and TRD docs, rendered from the repo — they re-render live when the files change. Open
            one in VS Code to edit it.
          </p>
        </header>
        {waves.map((w) => (
          <WaveDocs key={w.name} wave={w} open={open.has(w.name)} onToggle={() => toggle(w.name)} />
        ))}
        {waves.length === 0 && (
          <p className="text-fg-muted italic text-[12px]">
            {init.folders.length === 0
              ? "No folder is open in this window — open the project folder (File → Open Folder) so Atrium can discover its PRD docs."
              : "No PRD docs found. Add docs/waves/wave-<n>.md (TRDs: wave-<n>-*.md) or map files in .atrium/waves.json."}
          </p>
        )}
      </div>
    </div>
  );
}

function WaveDocs({ wave, open, onToggle }: { wave: Wave; open: boolean; onToggle: () => void }) {
  const files = wave.files!;
  const docs = [files.prd, ...files.docs].filter((d): d is WaveFileRef => !!d);
  return (
    <section className="border border-border rounded">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 h-9 hover:bg-hover text-left"
      >
        <span className={`codicon ${open ? "codicon-chevron-down" : "codicon-chevron-right"} text-fg-muted`} />
        <h3 className="text-[13px] font-semibold truncate">{wave.name}</h3>
        <span className="ml-auto font-mono text-[11px] text-fg-muted shrink-0">
          {docs.length} doc{docs.length === 1 ? "" : "s"}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-4 px-4 pb-4">
          {docs.map((d) => (
            <article key={d.path}>
              <div className="flex items-center gap-2 pt-3 pb-1 border-b border-border mb-1">
                <span className="codicon codicon-book text-link text-[12px]" />
                <span className="font-mono text-[11px] text-fg-muted truncate">{d.name}</span>
                <button
                  type="button"
                  aria-label={`Open ${d.name} in VS Code`}
                  title={`Open ${d.name} in VS Code to edit`}
                  className="ml-auto flex items-center text-fg-muted hover:text-link shrink-0"
                  onClick={() => vscode.postMessage({ type: "openFile", path: d.path })}
                >
                  <span className="codicon codicon-link-external text-[12px]" />
                </button>
              </div>
              <DocPreview path={d.path} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
