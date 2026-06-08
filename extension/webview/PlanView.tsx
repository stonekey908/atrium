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
      <div className="mx-auto w-full max-w-[760px] px-4 py-4 flex flex-col gap-5">
        <header>
          <h2 className="text-[20px] tracking-tight" style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}>
            Plan · acceptance criteria
          </h2>
          <p className="text-fg-muted text-[12px] mt-1">
            Each wave's acceptance criteria from Linear. UAT cases are derived one-to-one from these.
          </p>
        </header>
        {waves.length === 0 ? (
          <p className="text-fg-muted italic text-[12px]">No acceptance criteria on the board yet.</p>
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
    <section className="border border-border rounded-md p-3 flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-[13px] truncate">{wave.name}</h3>
        {waveTouchesUi(wave) && <FastTrackChip />}
        <span className="ml-auto font-mono text-[11px] text-fg-muted shrink-0" title="UAT cases derived from acceptance criteria">
          {roll.total} UAT cases
        </span>
      </div>
      {tickets.map((t) => (
        <div key={t.id} className="pl-2 border-l-2 border-border">
          <div className="flex items-center gap-2 text-[12px]">
            <span className="font-mono text-fg-muted shrink-0">{t.id}</span>
            <span className="truncate">{t.title}</span>
          </div>
          <ul className="mt-1 flex flex-col gap-1">
            {t.spec.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[12px]">
                <span className="codicon codicon-circle-large-outline text-fg-muted text-[12px] mt-0.5 shrink-0" />
                <span className="flex-1">{s}</span>
                <span className="font-mono text-[10px] text-fg-muted shrink-0">{t.id}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
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
