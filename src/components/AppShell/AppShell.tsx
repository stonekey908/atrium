/**
 * AppShell — Atrium's three-column application shell.
 *
 * Layout: 280px left rail · 1fr main · 320px right rail. Full viewport height,
 * CSS grid via Tailwind arbitrary value.
 *
 * Scope (T-004 / STO-2095): structural placeholders only. No state, no routing,
 * no data wiring. Real composer / turns / tab content land in later wave tickets.
 *
 * Visual contract: `files/atrium-v5.html`. All colours flow through design tokens
 * (bg-background, border-border, text-muted-foreground, etc.) — no raw hex.
 */
export function AppShell() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr_320px] bg-background text-foreground">
      {/* ───── Left rail ───── */}
      <aside className="flex flex-col border-r border-border bg-background">
        {/* Section 1 — Workspaces / Projects */}
        <section className="flex flex-col">
          <h2 className="px-3 pt-3 pb-2 font-mono text-2xs uppercase tracking-widest text-muted-foreground">
            Workspaces
          </h2>
          <ul className="flex flex-col">
            <li className="flex items-center gap-2 px-3 py-1.5 text-sm text-foreground">
              <span className="h-3.5 w-3.5 rounded-full border border-border" aria-hidden />
              <span className="flex-1 truncate">Stonekey</span>
              <span className="font-mono text-2xs text-muted-foreground">12</span>
            </li>
            <li className="flex items-center gap-2 px-3 py-1.5 text-sm text-foreground">
              <span className="h-3.5 w-3.5 rounded-full border border-border" aria-hidden />
              <span className="flex-1 truncate">Personal</span>
              <span className="font-mono text-2xs text-muted-foreground">3</span>
            </li>
          </ul>
          <h2 className="px-3 pt-3 pb-2 font-mono text-2xs uppercase tracking-widest text-muted-foreground">
            Projects
          </h2>
          <ul className="flex flex-col">
            <li className="flex items-center gap-2 px-3 py-1.5 text-sm text-foreground">
              <span className="h-3.5 w-3.5 rounded-full border border-border" aria-hidden />
              <span className="flex-1 truncate">Atrium</span>
              <span className="font-mono text-2xs text-muted-foreground">7</span>
            </li>
            <li className="flex items-center gap-2 px-3 py-1.5 text-sm text-foreground">
              <span className="h-3.5 w-3.5 rounded-full border border-border" aria-hidden />
              <span className="flex-1 truncate">Glassbox</span>
              <span className="font-mono text-2xs text-muted-foreground">4</span>
            </li>
            <li className="flex items-center gap-2 px-3 py-1.5 text-sm text-foreground">
              <span className="h-3.5 w-3.5 rounded-full border border-border" aria-hidden />
              <span className="flex-1 truncate">Lighthouse</span>
              <span className="font-mono text-2xs text-muted-foreground">2</span>
            </li>
          </ul>
        </section>

        {/* Section 2 — Active sessions */}
        <section className="flex flex-col border-t border-border">
          <h2 className="px-3 pt-3 pb-2 font-mono text-2xs uppercase tracking-widest text-muted-foreground">
            Active Sessions
          </h2>
          <ul className="flex flex-col">
            <li className="flex items-center gap-2 px-3 py-1.5 text-sm text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald" aria-hidden />
              <span className="flex-1 truncate">T-004 shell</span>
              <span className="font-mono text-2xs text-muted-foreground">12:42</span>
            </li>
            <li className="flex items-center gap-2 px-3 py-1.5 text-sm text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald" aria-hidden />
              <span className="flex-1 truncate">UAT pass-2</span>
              <span className="font-mono text-2xs text-muted-foreground">11:08</span>
            </li>
          </ul>
        </section>

        {/* Section 3 — User card pinned to bottom */}
        <section className="mt-auto flex items-center gap-3 border-t border-border px-3 py-3">
          <span className="h-7 w-7 shrink-0 rounded-full bg-muted" aria-hidden />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm text-foreground">Nick Elias</span>
            <span className="truncate text-xs text-muted-foreground">
              user@example.com
            </span>
          </div>
        </section>
      </aside>

      {/* ───── Main ───── */}
      <main className="flex flex-col bg-background">
        {/* Conversation pane */}
        <div className="flex flex-1 items-center justify-center overflow-auto">
          <p className="font-serif text-3xl italic text-muted-foreground">
            Conversation pane
          </p>
        </div>
        {/* Composer */}
        <div className="flex h-16 items-center border-t border-border px-4">
          <span className="font-mono text-2xs uppercase tracking-widest text-muted-foreground">
            Composer · ⌘↵ to send
          </span>
        </div>
      </main>

      {/* ───── Right rail ───── */}
      <aside className="flex flex-col border-l border-border bg-background">
        {/* Tab bar */}
        <nav className="flex h-9 items-end border-b border-border" aria-label="Right rail tabs">
          <span className="px-3 py-2 text-sm text-foreground border-b-2 border-foreground -mb-px">
            Files
          </span>
          <span className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
            MCP
          </span>
          <span className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
            Context
          </span>
        </nav>
        {/* Body placeholder */}
        <div className="flex flex-1 items-center justify-center">
          <p className="font-serif text-2xl italic text-muted-foreground">Files panel</p>
        </div>
      </aside>
    </div>
  );
}
