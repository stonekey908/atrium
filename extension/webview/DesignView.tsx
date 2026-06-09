import { vscode } from "./vscode";
import type { InitPayload, Wave, WaveFileRef } from "./types";

/**
 * Design canvas (STO-2168 + STO-2478): the project's mockup / design artifacts,
 * grouped by the wave that owns them (resolved host-side from .atrium/waves.json
 * or the wave-<n>-* naming convention). Files no wave claims land in a
 * "Project-wide" bucket — visible, never lost. Opens files in VS Code's own
 * editor; live preview is STO-2479.
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

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[760px] px-4 py-4 flex flex-col gap-5">
        <header>
          <h2 className="text-[20px] tracking-tight" style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}>
            Design · references
          </h2>
          <p className="text-fg-muted text-[12px] mt-1">
            Mockups and design artifacts, grouped by the wave they belong to. Open one to view or edit it in VS Code.
          </p>
        </header>
        {waves.map((w) => (
          <WaveDesign key={w.name} wave={w} />
        ))}
        {general.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-fg-muted">Project-wide</h3>
            <ul className="grid grid-cols-2 gap-2">
              {general.map((r) => (
                <DesignCard key={r.path} item={r} />
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

/** One wave's design artifacts: PRD chip + mockup grid. */
function WaveDesign({ wave }: { wave: Wave }) {
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
        <ul className="grid grid-cols-2 gap-2">
          {files.mockups.map((m) => (
            <DesignCard key={m.path} item={m} />
          ))}
        </ul>
      ) : (
        <p className="text-fg-muted italic text-[11px]">No mockups linked to this wave.</p>
      )}
    </section>
  );
}

function DesignCard({ item }: { item: Pick<WaveFileRef, "name" | "path" | "kind"> }) {
  const icon =
    item.kind === "image"
      ? "codicon-file-media"
      : item.kind === "figma"
        ? "codicon-symbol-color"
        : item.kind === "md"
          ? "codicon-book"
          : "codicon-file-code";
  return (
    <li>
      <button
        type="button"
        onClick={() => vscode.postMessage({ type: "openFile", path: item.path })}
        className="w-full flex items-center gap-2 p-2 border border-border rounded hover:border-fg-muted text-left"
        title={`Open ${item.name} in VS Code`}
      >
        <span className={`codicon ${icon} text-link shrink-0`} />
        <span className="truncate text-[12px] flex-1">{item.name}</span>
        <span className="codicon codicon-link-external text-fg-muted text-[11px] shrink-0" />
      </button>
    </li>
  );
}
