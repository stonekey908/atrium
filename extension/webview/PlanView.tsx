import { useState } from "react";
import { vscode } from "./vscode";
import { waveUatRollup, waveTouchesUi } from "./views";
import { mdInlineToHtml } from "./markdown";
import type { InitPayload, Wave, WaveFileRef } from "./types";

/**
 * Plan canvas (STO-2167): the source-of-truth acceptance criteria for each wave,
 * pulled from Linear, with each criterion tagged to its ticket. UAT cases derive
 * 1:1 from these (STO-2187), and a fast-track gate warns on UI waves (STO-2169).
 *
 * Wave headers are sticky and hand off as you scroll (accordion-style), each
 * wave collapses individually, and a toolbar collapses/expands them all.
 * Read-only — editing the spec is VS Code's own markdown editing.
 */
export function PlanView({ init }: { init: InitPayload }) {
  const waves = init.waves.filter((w) => w.tickets.some((t) => t.spec.length > 0));
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const allCollapsed = waves.length > 0 && waves.every((w) => collapsed.has(w.name));

  const toggle = (name: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const toggleAll = () => setCollapsed(allCollapsed ? new Set() : new Set(waves.map((w) => w.name)));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[920px]">
        {/* Sticky toolbar — title + collapse/expand all. Keep h-9 in sync with
            the wave headers' top-9 offset below. */}
        <div className="sticky top-0 z-20 h-9 flex items-center gap-3 px-6 bg-bg border-b border-border">
          <h2 className="text-[13px] font-semibold tracking-tight">Plan · acceptance criteria</h2>
          {waves.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="ml-auto flex items-center gap-1 text-[11px] text-fg-muted hover:text-fg"
            >
              <span className={`codicon ${allCollapsed ? "codicon-unfold" : "codicon-fold"} text-[12px]`} />
              {allCollapsed ? "Expand all" : "Collapse all"}
            </button>
          )}
        </div>
        {waves.length === 0 ? (
          <p className="text-fg-muted italic text-[13px] px-6 py-4">No acceptance criteria on the board yet.</p>
        ) : (
          waves.map((w) => (
            <WavePlan key={w.name} wave={w} collapsed={collapsed.has(w.name)} onToggle={() => toggle(w.name)} />
          ))
        )}
      </div>
    </div>
  );
}

function WavePlan({ wave, collapsed, onToggle }: { wave: Wave; collapsed: boolean; onToggle: () => void }) {
  const roll = waveUatRollup(wave);
  const tickets = wave.tickets.filter((t) => t.spec.length > 0);
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="sticky top-9 z-10 w-full flex items-baseline gap-2 px-6 py-2.5 bg-bg border-b border-border hover:bg-hover text-left"
      >
        <span
          className={`codicon ${collapsed ? "codicon-chevron-right" : "codicon-chevron-down"} text-fg-muted self-center`}
        />
        <h3 className="font-semibold text-[14px]">{wave.name}</h3>
        {waveTouchesUi(wave) && <FastTrackChip />}
        <span
          className="ml-auto font-mono text-[11px] text-fg-muted shrink-0"
          title="UAT cases derived from acceptance criteria"
        >
          {roll.total} criteria
        </span>
      </button>
      {!collapsed && (
        <div className="flex flex-col gap-4 px-6 py-4">
          {wave.files?.prd && <PrdChip prd={wave.files.prd} />}
          {tickets.map((t) => (
            <div key={t.id} className="grid grid-cols-[88px_1fr] gap-x-4 gap-y-1.5 items-start">
              <a
                href={t.url}
                onClick={(e) => {
                  if (!t.url) return;
                  e.preventDefault();
                  vscode.postMessage({ type: "openLinear", url: t.url });
                }}
                className="font-mono text-[11px] text-fg-muted hover:text-link pt-0.5"
                title={`Open ${t.id} in Linear`}
              >
                {t.id}
              </a>
              <div className="text-[13px] font-medium leading-snug">{t.title}</div>
              <span />
              <ul className="flex flex-col gap-1.5">
                {t.spec.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[12.5px] text-fg leading-relaxed">
                    <span className="text-fg-muted/60 select-none pt-px">—</span>
                    {/* Criteria are Linear markdown — render inline styles, not raw **bold** (STO-2494). */}
                    <span className="md-inline" dangerouslySetInnerHTML={{ __html: mdInlineToHtml(s) }} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** The wave's PRD/spec doc, resolved from the repo (STO-2478) — icon-only link
 *  that opens it in VS Code; editing stays a repo-file concern, Atrium only
 *  surfaces it. */
function PrdChip({ prd }: { prd: WaveFileRef }) {
  return (
    <button
      type="button"
      onClick={() => vscode.postMessage({ type: "openFile", path: prd.path })}
      className="self-start flex items-center gap-1 text-[11px] text-fg-muted hover:text-link"
      aria-label={`Open ${prd.name} in VS Code`}
      title={`PRD · open ${prd.name} in VS Code`}
    >
      <span className="codicon codicon-book text-[13px]" />
      <span className="uppercase tracking-wide text-[9px]">PRD</span>
    </button>
  );
}

/** Fast-track gate (STO-2169): warns that a UI wave should pair data-model ↔ design. */
function FastTrackChip() {
  return (
    <span
      className="flex items-center gap-1 px-1.5 rounded-full bg-yellow/15 text-yellow text-[9px] uppercase tracking-wide shrink-0 self-center"
      title="Fast-track gated — this wave touches UI. /design-first recommends pairing the data model with a wireframe before Build; skipping risks a UI/backend mismatch."
    >
      <span className="codicon codicon-warning text-[9px]" />
      UI · design-first
    </span>
  );
}
