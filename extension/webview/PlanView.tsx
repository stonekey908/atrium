import { vscode } from "./vscode";
import { waveUatRollup, waveTouchesUi } from "./views";
import type { InitPayload, Wave } from "./types";

/**
 * Plan canvas (STO-2167): the source-of-truth acceptance criteria for each wave,
 * pulled from Linear, with each criterion tagged to its ticket. UAT cases derive
 * 1:1 from these (STO-2187), and a fast-track gate warns on UI waves (STO-2169).
 * Read-only — editing the spec is VS Code's own markdown editing.
 */
export function PlanView({ init }: { init: InitPayload }) {
  const waves = init.waves.filter((w) => w.tickets.some((t) => t.spec.length > 0));
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[920px] px-6 py-6 flex flex-col gap-7">
        <header>
          <h2 className="text-[22px] tracking-tight" style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}>
            Plan · acceptance criteria
          </h2>
          <p className="text-fg-muted text-[12.5px] mt-1.5 leading-relaxed">
            Each wave's acceptance criteria, read live from Linear. UAT cases derive one-to-one from these.
          </p>
        </header>
        {waves.length === 0 ? (
          <p className="text-fg-muted italic text-[13px]">No acceptance criteria on the board yet.</p>
        ) : (
          waves.map((w) => <WavePlan key={w.name} wave={w} />)
        )}
      </div>
    </div>
  );
}

function WavePlan({ wave }: { wave: Wave }) {
  const roll = waveUatRollup(wave);
  const tickets = wave.tickets.filter((t) => t.spec.length > 0);
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline gap-2 pb-1.5 border-b border-border">
        <h3 className="font-semibold text-[14px]">{wave.name}</h3>
        {waveTouchesUi(wave) && <FastTrackChip />}
        <span
          className="ml-auto font-mono text-[11px] text-fg-muted shrink-0"
          title="UAT cases derived from acceptance criteria"
        >
          {roll.total} criteria
        </span>
      </div>
      <div className="flex flex-col gap-4 pl-1">
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
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Fast-track gate (STO-2169): warns that a UI wave should pair data-model ↔ design. */
function FastTrackChip() {
  return (
    <span
      className="flex items-center gap-1 px-1.5 rounded-full bg-yellow/15 text-yellow text-[9px] uppercase tracking-wide shrink-0"
      title="Fast-track gated — this wave touches UI. /design-first recommends pairing the data model with a wireframe before Build; skipping risks a UI/backend mismatch."
    >
      <span className="codicon codicon-warning text-[9px]" />
      UI · design-first
    </span>
  );
}
