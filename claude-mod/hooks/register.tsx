/**
 * Atrium as a Claude Code mod. One pane (`/atrium`) with three views — the
 * sprint board as grouped lists, the wave PRDs rendered as markdown, and the
 * design mockups as links — plus a status-line entry for the ticket you're
 * on, and the project conventions + current ticket briefed to the model.
 *
 * Data comes through the Linear MCP connector (`$.tool.call` on its tools):
 * no API key lives here. Writes (status changes) go the same way.
 */
import { atom, read, update } from "claude-code";
import type { EngineInterface, PluginOptions, Register } from "claude-code";

import type { AtriumBoard, AtriumFileRef, AtriumFullStatus, AtriumTicket, AtriumView, AtriumWave, AtriumWaveFiles } from "../types";
import {
  STATE_LABEL,
  STATUS_PICKS,
  activeTickets,
  basename,
  boardFromIssues,
  computeRollup,
  currentSprint,
  groupByState,
  matchProject,
  nextStatus,
  resolveActiveTicket,
} from "./board";
import { fetchDescription, fetchIssues, fetchProjectNames, findLinearTools, writeStatus, type Call, type LinearTools } from "./linear";
import { AGENT_BRIEFING, workingOnText } from "./briefing";
import { join, resolveWaveFiles } from "./wave-files";

const PANE = "atrium";
const TITLE = "Atrium";
/** A board older than this is re-pulled when a turn ends (the cockpit's "refresh on focus"). */
const STALE_MS = 2 * 60 * 1000;
/** `Markdown` draws at most this many characters. */
const MARKDOWN_MAX = 10_000;

// ── State: everything a drawing reads lives in $.state (a hot reload keeps it) ──
const board = atom({ plugin: "atrium", key: "board" } as const, null);
const load = atom({ plugin: "atrium", key: "load" } as const, { phase: "idle", message: null, at: null });
const view = atom({ plugin: "atrium", key: "view" } as const, "board");
const waveSel = atom({ plugin: "atrium", key: "wave" } as const, null);
const selected = atom({ plugin: "atrium", key: "selected" } as const, null);
const descriptions = atom({ plugin: "atrium", key: "descriptions" } as const, {});
const branch = atom({ plugin: "atrium", key: "branch" } as const, "");
const files = atom({ plugin: "atrium", key: "files" } as const, {});
const buildPrd = atom({ plugin: "atrium", key: "buildPrd" } as const, null);
const doc = atom({ plugin: "atrium", key: "doc" } as const, null);
const projects = atom({ plugin: "atrium", key: "projects" } as const, []);
const project = atom({ plugin: "atrium", key: "project" } as const, null);
const showDone = atom({ plugin: "atrium", key: "showDone" } as const, false);
const syncing = atom({ plugin: "atrium", key: "syncing" } as const, null);

interface Settings {
  linearServer: string;
  project: string;
  wavePrefix: string;
  pollSeconds: number;
  openOnStart: boolean;
  briefModel: boolean;
}

function readSettings(options: PluginOptions): Settings {
  const s = (k: string, d: string) => (typeof options[k] === "string" ? (options[k] as string) : d);
  const n = (k: string, d: number) => (typeof options[k] === "number" ? (options[k] as number) : d);
  const b = (k: string, d: boolean) => (typeof options[k] === "boolean" ? (options[k] as boolean) : d);
  return {
    linearServer: s("linearServer", "Linear"),
    project: s("project", ""),
    wavePrefix: s("wavePrefix", "ATR Wave"),
    pollSeconds: Math.max(0, n("pollSeconds", 0)),
    openOnStart: b("openOnStart", false),
    briefModel: b("briefModel", true),
  };
}

type McpName = `mcp__${string}__${string}`;

/** `$.tool.call` as the adapter wants it: tool name + arguments in, the plain result out. */
const callOf =
  ($: EngineInterface): Call =>
  async (tool, input) => {
    const r = await $.tool.call({ tool: tool as McpName, ...input });
    return { text: r.text, isError: r.isError, deny: r.deny, result: r.result };
  };

const fsOf = ($: EngineInterface) => ({
  list: (path: string) => $.fs.list(path),
  exists: (path: string) => $.fs.exists(path),
  read: (path: string) => $.fs.read(path),
});

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 40)}\n\n_… truncated (${text.length} chars)_`;
}

function fileHref(path: string): string {
  return `file://${encodeURI(path)}`;
}

// Module variables start over on a reload; `register` and `session.start` run again and refill them.
let settings: Settings = readSettings({});
let tools: LinearTools | null = null;
let root = "";
let inflight: Promise<void> | null = null;

// ── Loading ────────────────────────────────────────────────────────────────

async function refreshBranch($: EngineInterface): Promise<string> {
  let name = "";
  try {
    const r = await $.process.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], { cwd: root || undefined, timeoutMs: 3000 });
    if (r.exitCode === 0) name = r.stdout.trim();
  } catch {
    /* not a repo, or no git: the strip drops its branch cell */
  }
  await update($, branch, () => name);
  return name;
}

async function updateStatusLine($: EngineInterface): Promise<void> {
  const b = await read($, board);
  if (!b) return $.ui.status(undefined);
  const t = resolveActiveTicket(b.waves, await read($, branch));
  if (t) return $.ui.status(`${t.id} · ${t.status}`);
  const sprint = currentSprint(b.waves);
  if (!sprint) return $.ui.status(`${b.project} · all shipped`);
  const r = computeRollup(sprint.tickets);
  $.ui.status(`${sprint.name.split(" · ")[0]} · ${r.done}/${r.total} done`);
}

async function resolveProject($: EngineInterface, call: Call): Promise<string | null> {
  let chosen = await read($, project);
  if (!chosen && settings.project) chosen = settings.project;
  if (!chosen) {
    const stored = await $.store.get(`project:${root}`);
    if (typeof stored === "string" && stored) chosen = stored;
  }
  if (tools?.listProjects) {
    try {
      const names = await fetchProjectNames(call, tools.listProjects);
      await update($, projects, () => names);
      if (!chosen) chosen = matchProject([basename(root)], names);
    } catch {
      /* the picker is a convenience; a pinned or stored project still works */
    }
  }
  await update($, project, () => chosen);
  return chosen;
}

async function loadBoard($: EngineInterface): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    await update($, load, (s) => ({ ...s, phase: "loading" as const, message: null }));
    try {
      const call = callOf($);
      if (!root) root = await $.session.root();
      if (!tools) tools = findLinearTools((await $.tool.list()).map((t) => t.name), settings.linearServer);
      if (!tools) {
        throw new Error("No Linear MCP tools are connected (looked for mcp__<server>__list_issues). Connect the Linear connector, then /atrium refresh.");
      }
      const chosen = await resolveProject($, call);
      if (!chosen) throw new Error(`No Linear project matches the folder "${basename(root)}". Pick one below, or run /atrium project <name>.`);

      const issues = await fetchIssues(call, tools.listIssues, chosen);
      const now = await $.clock.now();
      const next = boardFromIssues(issues, { projectName: chosen, generatedAt: new Date(now).toISOString(), wavePrefix: settings.wavePrefix });

      const fs = fsOf($);
      const resolved: Record<string, AtriumWaveFiles> = {};
      for (const w of next.waves) resolved[w.name] = await resolveWaveFiles(fs, root, w.label || w.name);
      const prdPath = join(root, "docs", "PRD.md");
      const hasPrd = await fs.exists(prdPath).catch(() => false);

      await refreshBranch($);
      await update($, board, () => next);
      await update($, files, () => resolved);
      await update($, buildPrd, () => (hasPrd ? prdPath : null));
      await update($, load, () => ({ phase: "ready" as const, message: null, at: now }));
      await updateStatusLine($);
    } catch (err) {
      const text = message(err);
      await update($, load, (s) => ({ ...s, phase: "error" as const, message: text }));
      $.ui.toast(`Atrium: ${text}`, { timeoutMs: 8000 });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

async function ensureDescription($: EngineInterface, id: string): Promise<void> {
  if (!tools?.getIssue) return;
  const known = await read($, descriptions);
  if (known[id] !== undefined) return;
  try {
    const text = await fetchDescription(callOf($), tools.getIssue, id);
    await update($, descriptions, (d) => ({ ...d, [id]: text }));
  } catch (err) {
    $.ui.toast(`Atrium: ${message(err)}`);
  }
}

async function moveTicket($: EngineInterface, id: string, status: AtriumFullStatus): Promise<void> {
  if (!tools?.saveIssue) {
    $.ui.toast("Atrium: the Linear connector offers no save_issue tool here, so status changes are read-only.");
    return;
  }
  await update($, syncing, () => id);
  try {
    await writeStatus(callOf($), tools.saveIssue, id, status);
    $.ui.toast(`${id} → ${status}`);
  } catch (err) {
    $.ui.toast(`Atrium: ${message(err)}`, { timeoutMs: 8000 });
  } finally {
    await update($, syncing, () => null);
  }
  await loadBoard($);
}

async function openDoc($: EngineInterface, path: string): Promise<void> {
  try {
    const text = await $.fs.read(path);
    await update($, doc, () => ({ path, text }));
  } catch (err) {
    $.ui.toast(`Atrium: ${message(err)}`);
  }
}

async function openPane($: EngineInterface, focus: boolean): Promise<void> {
  await $.ui.open(focus ? { id: PANE, title: TITLE, focus: true } : { id: PANE, title: TITLE });
}

export const register: Register = (on, options) => {
  settings = readSettings(options);
  tools = null;
  root = "";
  inflight = null;

  // ── Session ────────────────────────────────────────────────────────────────

  on("session.start", async ($, e, next) => {
    root = e.cwd;
    await $.command.register({
      name: "atrium",
      description: "Open the Atrium cockpit: sprint board, current ticket, wave PRDs and mockups",
      argumentHint: "[refresh | board | prd | design | brief | project <name>]",
    });
    if (settings.openOnStart && e.surface !== null) void openPane($, false);
    // The board load outlives this dispatch: hand it to the clock.
    $.clock.after(0, () => void loadBoard($));
    if (settings.pollSeconds > 0) $.clock.every(settings.pollSeconds * 1000, () => void loadBoard($));
    return next(e);
  });

  on("command.run", { command: "atrium" }, async ($, e) => {
    const [verb = "", ...rest] = e.args.trim().split(/\s+/);
    const arg = rest.join(" ").trim();
    switch (verb.toLowerCase()) {
      case "refresh":
        await loadBoard($);
        return { text: (await read($, load)).phase === "ready" ? "Atrium board refreshed." : `Atrium: ${(await read($, load)).message ?? "not loaded"}` };
      case "brief":
        return { text: AGENT_BRIEFING };
      case "project": {
        if (!arg) return { text: `Atrium project: ${(await read($, project)) ?? "(none)"}. Usage: /atrium project <name>` };
        await update($, project, () => arg);
        if (root) await $.store.set(`project:${root}`, arg);
        await loadBoard($);
        await openPane($, true);
        return { text: `Atrium now shows the "${arg}" project.` };
      }
      case "board":
      case "prd":
      case "design":
        await update($, view, () => verb.toLowerCase() as AtriumView);
        await openPane($, true);
        return { text: `Atrium pane opened on ${verb.toLowerCase()}.` };
      case "":
        await openPane($, true);
        if ((await read($, board)) === null) $.clock.after(0, () => void loadBoard($));
        return { text: "Atrium pane opened." };
      default:
        return { text: "Usage: /atrium [refresh | board | prd | design | brief | project <name>]" };
    }
  });

  // A Linear write by the model (or by this mod) → the board re-pulls shortly after.
  on("tool.call", { tool: /^mcp__[^_].*__(save_issue|create_issue|update_issue|create_comment|save_comment)$/ }, async ($, e, next) => {
    const ran = await next(e);
    if (ran.deny === undefined && ran.isError === undefined) $.clock.after(1500, () => void loadBoard($));
    return ran;
  });

  // The branch may have changed during the turn; a stale board re-pulls (refresh-on-focus).
  on("turn.complete", async ($, e, next) => {
    await refreshBranch($);
    await updateStatusLine($);
    const state = await read($, load);
    const now = await $.clock.now();
    if (state.phase !== "loading" && (state.at === null || now - state.at > STALE_MS)) $.clock.after(0, () => void loadBoard($));
    return next(e);
  });

  // The conventions and the current ticket ride the system prompt.
  on("prompt.compose", async ($, e, next) => {
    const composed = await next(e);
    if (!settings.briefModel) return composed;
    const sections = [...composed.sections, { id: "atrium:conventions", text: AGENT_BRIEFING, scope: "session" as const }];
    const b = await read($, board);
    if (b) {
      const current = await read($, branch);
      const t = resolveActiveTicket(b.waves, current);
      const full = t ? (await read($, descriptions))[t.id] ?? null : null;
      sections.push({ id: "atrium:working-on", text: workingOnText(b, t, current, full), scope: "session" as const });
    }
    return { sections };
  });

  // ── The pane ───────────────────────────────────────────────────────────────

  on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Link, Markdown } = $.ui.resolve(e);
    const width = e.props.bodyColumns;
    const narrow = width < 70;

    const [b, state, current, which, sel, known, allFiles, prdPath, open, names, chosen, doneShown, busy] = await Promise.all([
      read($, board),
      read($, load),
      read($, view),
      read($, waveSel),
      read($, selected),
      read($, descriptions),
      read($, files),
      read($, buildPrd),
      read($, doc),
      read($, projects),
      read($, project),
      read($, showDone),
      read($, syncing),
    ]);
    const gitBranch = await read($, branch);

    const tab = (v: AtriumView, label: string, hotkey: string) => (
      <Button key={`view:${v}`} label={current === v ? `[${label}]` : label} hotkey={hotkey} plain onPress={() => update($, view, () => v)} />
    );

    const header = (
      <Box flexDirection="row" gap={1} justifyContent="space-between">
        <Box flexDirection="row" gap={1}>
          <Text bold>Atrium</Text>
          <Text dimColor wrap="truncate-end">
            {b ? `· ${b.project}` : chosen ? `· ${chosen}` : ""}
          </Text>
        </Box>
        <Box flexDirection="row" gap={1}>
          {tab("board", "Board", "b")}
          {tab("prd", "PRD", "p")}
          {tab("design", "Design", "d")}
          <Button key="refresh" label={state.phase === "loading" ? "…" : "↻"} hotkey="r" plain onPress={() => loadBoard($)} />
        </Box>
      </Box>
    );

    const status = (() => {
      if (state.phase === "loading" && !b) return <Text dimColor>Pulling the board from Linear…</Text>;
      if (state.phase === "error") return <Text color="red" wrap="wrap">{state.message}</Text>;
      if (state.phase === "idle" && !b) return <Text dimColor>Not loaded yet. Press ↻ or run /atrium refresh.</Text>;
      return null;
    })();

    // No project matched: the picker.
    const picker =
      !b && names.length > 0 && !chosen ? (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>Pick the Linear project this folder belongs to:</Text>
          {names.slice(0, 30).map((name) => (
            <Button
              key={`proj:${name}`}
              label={name}
              plain
              onPress={async () => {
                await update($, project, () => name);
                if (root) await $.store.set(`project:${root}`, name);
                await loadBoard($);
              }}
            />
          ))}
        </Box>
      ) : null;

    // Working-on strip.
    const active = b ? resolveActiveTicket(b.waves, gitBranch) : null;
    const strip = b ? (
      <Box flexDirection="column" marginTop={1}>
        {active ? (
          <Box flexDirection="row" gap={1}>
            <Text bold color="green">▶</Text>
            <Text bold>{active.id}</Text>
            <Text wrap="truncate-end">{active.title}</Text>
            <Text dimColor>· {active.status}</Text>
            {!narrow && <Link href={active.url} label="open ↗" />}
          </Box>
        ) : (
          <Text dimColor wrap="truncate-end">
            ▷ No ticket matches {gitBranch ? `branch ${gitBranch}` : "the current branch"}.
          </Text>
        )}
      </Box>
    ) : null;

    const waves = b?.waves ?? [];
    const sprint = b ? currentSprint(waves, which) : null;
    const pinned = which ? waves.find((w) => w.name === which) : undefined;
    const shown: AtriumWave | null = sprint ?? pinned ?? waves[0] ?? null;
    const shownIdx = shown ? waves.indexOf(shown) : -1;
    const stepWave = (delta: number) => {
      const next = waves[shownIdx + delta];
      if (next) void update($, waveSel, () => next.name);
    };

    const waveHeader = shown ? (
      <Box flexDirection="row" gap={1} marginTop={1} justifyContent="space-between">
        <Box flexDirection="row" gap={1}>
          <Text bold wrap="truncate-end">{shown.name}</Text>
          {(() => {
            const r = computeRollup(shown.tickets);
            return (
              <Text dimColor>
                {shown.stage ? `${shown.stage} · ` : ""}
                {r.done}/{r.total} done{r.doing + r.review > 0 ? ` · ${r.doing + r.review} active` : ""}
              </Text>
            );
          })()}
          {sprint && shown === currentSprint(waves) && <Text color="cyan">← current</Text>}
        </Box>
        <Box flexDirection="row" gap={1}>
          <Button key="wave:prev" label="◂" hotkey="k" plain dimColor={shownIdx <= 0} onPress={() => stepWave(-1)} />
          <Text dimColor>
            {shownIdx + 1}/{waves.length}
          </Text>
          <Button key="wave:next" label="▸" hotkey="j" plain dimColor={shownIdx >= waves.length - 1} onPress={() => stepWave(1)} />
        </Box>
      </Box>
    ) : null;

    const ticketRow = (t: AtriumTicket) => {
      const isSel = sel === t.id;
      const mark = t.priority === "urgent" ? "‼" : t.priority === "high" ? "!" : " ";
      const label = `${isSel ? "▾" : "▸"} ${t.id}  ${t.title}`;
      return (
        <Box key={`row:${t.id}`} flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Text color={t.priority === "urgent" ? "red" : t.priority === "high" ? "yellow" : undefined}>{mark}</Text>
            <Button
              key={`t:${t.id}`}
              label={label.length > width - 6 ? `${label.slice(0, Math.max(10, width - 9))}…` : label}
              plain
              onPress={async () => {
                const now = (await read($, selected)) === t.id ? null : t.id;
                await update($, selected, () => now);
                if (now) await ensureDescription($, now);
              }}
            />
          </Box>
          {isSel && ticketDetail(t)}
        </Box>
      );
    };

    const ticketDetail = (t: AtriumTicket) => {
      const text = (known[t.id] ?? t.description ?? "").trim();
      const next = nextStatus(t.status);
      return (
        <Box flexDirection="column" marginLeft={4} marginBottom={1}>
          <Box flexDirection="row" gap={1} flexWrap="wrap">
            <Text dimColor>{t.status} · {t.priority}</Text>
            <Link href={t.url} label="open in Linear ↗" />
            {busy === t.id && <Text color="yellow">syncing…</Text>}
          </Box>
          <Box flexDirection="row" gap={1} flexWrap="wrap">
            {next && (
              <Button key={`s:${t.id}:next`} label={`→ ${next}`} variant="primary" onPress={() => moveTicket($, t.id, next)} />
            )}
            {STATUS_PICKS.filter((s) => s !== t.status && s !== next).map((s) => (
              <Button key={`s:${t.id}:${s}`} label={s} plain dimColor onPress={() => moveTicket($, t.id, s)} />
            ))}
          </Box>
          {text ? <Markdown text={truncate(text, 4000)} /> : <Text dimColor>No description.</Text>}
          {t.branch && <Text dimColor wrap="truncate-end">branch: {t.branch}</Text>}
        </Box>
      );
    };

    const boardView = shown ? (
      <Box flexDirection="column">
        {waveHeader}
        {groupByState(shown).map(({ state: s, tickets }) => {
          if (tickets.length === 0) return null;
          const collapsed = s === "done" && !doneShown;
          const glyph = s === "doing" ? "●" : s === "review" ? "◐" : s === "todo" ? "○" : "✓";
          return (
            <Box key={`g:${s}`} flexDirection="column" marginTop={1}>
              <Box flexDirection="row" gap={1}>
                <Text bold dimColor={s === "done"}>
                  {glyph} {STATE_LABEL[s]} ({tickets.length})
                </Text>
                {s === "done" && (
                  <Button key="done:toggle" label={collapsed ? "show" : "hide"} plain dimColor onPress={() => update($, showDone, (v) => !v)} />
                )}
              </Box>
              {!collapsed && tickets.map(ticketRow)}
            </Box>
          );
        })}
        {activeTickets(shown.tickets).length === 0 && <Text dimColor>No active tickets in this wave.</Text>}
        {waves.length > 1 && (
          <Box marginTop={1}>
            <Text dimColor wrap="wrap">
              {waves
                .filter((w) => w !== shown)
                .map((w) => {
                  const r = computeRollup(w.tickets);
                  return `${w.name.split(" · ")[0]} ${r.done}/${r.total}`;
                })
                .join(" · ")}
            </Text>
          </Box>
        )}
      </Box>
    ) : b ? (
      <Text dimColor wrap="wrap">{'No waves yet. Label tickets "Wave 1 · <theme>" (or any sprint-ish label) and they appear here.'}</Text>
    ) : null;

    const fileButton = (f: AtriumFileRef, prefix: string) => (
      <Button
        key={`doc:${f.path}`}
        label={`${open?.path === f.path ? "▾" : "▸"} ${prefix}${f.name}`}
        plain
        onPress={() => (open?.path === f.path ? update($, doc, () => null) : openDoc($, f.path))}
      />
    );

    const prdView = b ? (
      <Box flexDirection="column" marginTop={1}>
        {prdPath && (
          <Box flexDirection="column">
            <Text bold>Build PRD</Text>
            {fileButton({ name: "docs/PRD.md", path: prdPath, kind: "md" }, "")}
          </Box>
        )}
        {waveHeader}
        {(() => {
          const wf = shown ? allFiles[shown.name] : undefined;
          const list = wf ? [...(wf.prd ? [wf.prd] : []), ...wf.docs] : [];
          if (!shown) return null;
          if (list.length === 0) {
            const n = shown.label || shown.name;
            return <Text dimColor wrap="wrap">No PRD for this wave. Convention: docs/waves/wave-{n.match(/\d+(\.\d+)?/)?.[0] ?? "<n>"}.md (or map it in .atrium/waves.json).</Text>;
          }
          return list.map((f) => fileButton(f, f === wf?.prd ? "PRD · " : "doc · "));
        })()}
        {open && (
          <Box flexDirection="column" marginTop={1} borderStyle="round" paddingX={1}>
            <Text dimColor wrap="truncate-start">{open.path}</Text>
            <Markdown text={truncate(open.text, MARKDOWN_MAX)} />
          </Box>
        )}
      </Box>
    ) : null;

    const designView = b ? (
      <Box flexDirection="column" marginTop={1}>
        {waveHeader}
        {(() => {
          const wf = shown ? allFiles[shown.name] : undefined;
          if (!shown) return null;
          if (!wf || wf.mockups.length === 0) {
            return <Text dimColor wrap="wrap">No mockups for this wave. Convention: wave-{"<n>"}-{"<name>"}.html or .png in files/, docs/, mockups/ or design/.</Text>;
          }
          return (
            <Box flexDirection="column">
              <Text dimColor wrap="wrap">The terminal can't render HTML or images — these open in your browser (ctrl/cmd-click).</Text>
              {wf.mockups.map((m) => (
                <Box key={`m:${m.path}`} flexDirection="row" gap={1}>
                  <Text dimColor>{m.kind === "html" ? "⌗" : m.kind === "image" ? "▣" : "✎"}</Text>
                  <Link href={fileHref(m.path)} label={m.name} />
                  {!narrow && <Text dimColor wrap="truncate-start">{m.path.startsWith(root) ? m.path.slice(root.length + 1) : m.path}</Text>}
                </Box>
              ))}
            </Box>
          );
        })()}
      </Box>
    ) : null;

    return (
      <Box flexDirection="column" paddingX={1}>
        {header}
        {status}
        {picker}
        {strip}
        {current === "board" ? boardView : current === "prd" ? prdView : designView}
      </Box>
    );
  });
};
