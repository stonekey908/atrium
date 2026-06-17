import { useEffect, useState } from "react";
import { vscode } from "./vscode";
import { mdToHtml } from "./markdown";
import type { InitPayload, Wave, WaveFileRef } from "./types";

/**
 * PRD canvas. The hero is the single **build PRD** (docs/PRD.md) — rendered
 * inline and editable in place (STO-2573): Save writes the repo file and syncs
 * the markdown to the Linear project overview. Each wave's further docs (TRDs,
 * resolved by file discovery) render below and are editable too (file-only) —
 * every doc has an Edit (in-cockpit) and an Open-in-VS-Code affordance.
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
            The build PRD — editable here and synced to the Linear project overview — plus each wave's further docs
            (editable, saved to the repo).
          </p>
        </header>
        {init.prd && (
          <section className="border border-border rounded px-4 pb-1">
            <EditableDoc name="Build PRD" path={init.prd.path} sync hero />
          </section>
        )}
        {waves.length > 0 && (
          <h3 className="text-[11px] uppercase tracking-wide text-fg-muted mt-2">Per-wave docs</h3>
        )}
        {waves.map((w) => (
          <WaveDocs key={w.name} wave={w} open={open.has(w.name)} onToggle={() => toggle(w.name)} />
        ))}
        {!init.prd && waves.length === 0 && (
          <p className="text-fg-muted italic text-[12px]">
            {init.folders.length === 0
              ? "No folder is open in this window — open the project folder (File → Open Folder) so Atrium can discover its PRD docs."
              : "No PRD found. Add docs/PRD.md (the build PRD) or docs/waves/wave-<n>.md (per-wave docs)."}
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
            <EditableDoc key={d.path} name={d.name} path={d.path} />
          ))}
        </div>
      )}
    </section>
  );
}

const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p;

/**
 * A repo doc rendered inline with two affordances: **Edit** (in-cockpit) and
 * **Open in VS Code** (bring it into the editor/workspace). Save writes the file
 * — via `savePrd` (also syncs the Linear project overview) when `sync`, else via
 * the generic `saveFile`. Content flows through previewFile→fileContent, so the
 * host's watcher re-renders on any change (cockpit, VS Code, or the agent).
 */
function EditableDoc({ name, path, sync = false, hero = false }: { name: string; path: string; sync?: boolean; hero?: boolean }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const msg = e.data as { type?: string; path?: string; content?: string; error?: string };
      if (msg?.type !== "fileContent" || msg.path !== path) return;
      if (msg.error) setError(msg.error);
      else {
        setError(null);
        setContent(msg.content ?? "");
      }
    };
    window.addEventListener("message", onMessage);
    vscode.postMessage({ type: "previewFile", path });
    return () => window.removeEventListener("message", onMessage);
  }, [path]);

  const save = () => {
    vscode.postMessage(sync ? { type: "savePrd", content: draft } : { type: "saveFile", path, content: draft });
    setContent(draft); // optimistic; the host's write triggers a fresh fileContent too
    setEditing(false);
  };

  return (
    <article>
      <div className="flex items-center gap-2 pt-3 pb-1 border-b border-border mb-1">
        <span className="codicon codicon-book text-link text-[12px]" />
        {hero ? (
          <>
            <h3 className="text-[13px] font-semibold">{name}</h3>
            <span className="font-mono text-[10px] text-fg-muted truncate">{baseName(path)}</span>
          </>
        ) : (
          <span className="font-mono text-[11px] text-fg-muted truncate">{name}</span>
        )}
        <span className="ml-auto flex items-center gap-2 shrink-0">
          <button
            type="button"
            aria-label={`Open ${name} in VS Code`}
            title="Open in VS Code (bring it into the editor)"
            className="flex items-center text-fg-muted hover:text-link"
            onClick={() => vscode.postMessage({ type: "openFile", path })}
          >
            <span className="codicon codicon-link-external text-[12px]" />
          </button>
          {editing ? (
            <>
              <button type="button" onClick={() => setEditing(false)} className="text-[11px] text-fg-muted hover:text-fg">
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                title={sync ? "Save to the repo and sync to the Linear project overview" : "Save to the repo file"}
                className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-active text-active-fg hover:opacity-90"
              >
                <span className={`codicon ${sync ? "codicon-cloud-upload" : "codicon-save"} text-[11px]`} />
                {sync ? "Save & sync" : "Save"}
              </button>
            </>
          ) : (
            content !== null && (
              <button
                type="button"
                onClick={() => {
                  setDraft(content ?? "");
                  setEditing(true);
                }}
                title={sync ? "Edit (saves the repo file; syncs to Linear when a key is set)" : "Edit this doc (saves the repo file)"}
                className="flex items-center gap-1 text-[11px] text-fg-muted hover:text-link"
              >
                <span className="codicon codicon-edit text-[11px]" />
                Edit
              </button>
            )
          )}
        </span>
      </div>
      {error ? (
        <p role="alert" className="text-red text-[11px] italic py-2">
          {error}
        </p>
      ) : content === null ? (
        <div className="flex items-center gap-2 text-fg-muted text-[11px] py-2">
          <span className="codicon codicon-loading codicon-modifier-spin" />
          Loading…
        </div>
      ) : editing ? (
        <textarea
          aria-label={`Edit ${name}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          className={`w-full ${hero ? "h-[60vh]" : "h-[40vh]"} resize-y bg-bg text-fg border border-border rounded p-2 my-1 font-mono text-[12px] leading-relaxed focus:outline-none focus:border-link`}
        />
      ) : (
        <div className="md-body text-[12.5px] leading-relaxed" dangerouslySetInnerHTML={{ __html: mdToHtml(content) }} />
      )}
    </article>
  );
}
