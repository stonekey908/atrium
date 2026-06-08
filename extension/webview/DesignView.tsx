import { vscode } from "./vscode";
import type { DesignRef, InitPayload } from "./types";

/**
 * Design canvas (STO-2168), lightweight for the VS Code reframe: lists the
 * project's mockup / design artifacts and opens them in VS Code's own editor.
 * Live HTML preview + annotation pins from the original spec are a VS Code-native
 * flow (open the HTML, use a preview extension) rather than a bespoke canvas.
 */
export function DesignView({ init }: { init: InitPayload }) {
  const refs = init.designRefs ?? [];
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[760px] px-4 py-4 flex flex-col gap-4">
        <header>
          <h2 className="text-[20px] tracking-tight" style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}>
            Design · references
          </h2>
          <p className="text-fg-muted text-[12px] mt-1">
            Mockups and design artifacts in the project. Open one to view or edit it in VS Code.
          </p>
        </header>
        {refs.length === 0 ? (
          <p className="text-fg-muted italic text-[12px]">No design references found in files/, docs/, mockups/ or design/.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {refs.map((r) => (
              <DesignCard key={r.path} item={r} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DesignCard({ item }: { item: DesignRef }) {
  const icon =
    item.kind === "image" ? "codicon-file-media" : item.kind === "figma" ? "codicon-symbol-color" : "codicon-file-code";
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
