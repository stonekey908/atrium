import * as vscode from "vscode";
import { readFileSync } from "fs";
import { join } from "path";
import { buildHtml, getNonce, STAGES, type InitPayload } from "./cockpit-html";
import { validateBoard, EMPTY_BOARD, type Board, type TicketState } from "./board";
import { LinearWriteClient, resolveStateId, type WriteState } from "./linear-writes";
import { getGitStatus } from "./git";
import { getTestFileCount, getDesignRefs } from "./discover";

/**
 * Atrium Cockpit — VS Code extension host (POC).
 *
 * The cockpit is a React webview (built by Vite into dist/webview) that opens
 * as a single full-size editor tab — never a cramped sidebar dock. All
 * editor / file-tree / git / terminal / extension-ecosystem features are VS
 * Code's own; this extension only adds the Linear/PRD/sprint cockpit on top.
 *
 * Entry points (one click each, no second step to "go full screen"):
 *   - a status-bar button ("$(rocket) Atrium")
 *   - the `Atrium: Open Cockpit` command
 *   - ⌘⌥A
 *   - auto-open on startup (atrium.openOnStartup, default on)
 */
export function activate(context: vscode.ExtensionContext): void {
  const extensionUri = context.extensionUri;

  // Open the cockpit as a single editor tab (reused if already open).
  context.subscriptions.push(
    vscode.commands.registerCommand("atrium.openDashboard", () => openCockpit(extensionUri)),
    vscode.commands.registerCommand("atrium.refreshBoard", () => refreshAll()),
  );

  // Persistent one-click entry point in the status bar.
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  statusItem.text = "$(rocket) Atrium";
  statusItem.tooltip = "Open the Atrium cockpit";
  statusItem.command = "atrium.openDashboard";
  statusItem.show();
  context.subscriptions.push(statusItem);

  // Optional auto-refresh (off by default). Restarts when the setting changes.
  setupPolling();
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("atrium.linear.pollSeconds")) setupPolling();
    }),
    { dispose: stopPolling },
  );

  // Auto-open on startup so the cockpit is just there when you open the project.
  const openOnStartup =
    vscode.workspace.getConfiguration("atrium").get<boolean>("openOnStartup") ?? true;
  if (openOnStartup) openCockpit(extensionUri);
}

/** The single cockpit editor tab. Reused across every entry point so we never
 *  stack duplicate tabs. */
let dashboardPanel: vscode.WebviewPanel | undefined;

function openCockpit(extensionUri: vscode.Uri): void {
  if (dashboardPanel) {
    dashboardPanel.reveal(vscode.ViewColumn.Active);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "atrium.dashboard",
    "Atrium · Cockpit",
    vscode.ViewColumn.Active,
    { ...webviewOptions(extensionUri), retainContextWhenHidden: true },
  );
  panel.webview.html = getHtml(panel.webview, extensionUri);
  trackWebview(panel.webview);
  wireMessages(panel.webview);
  dashboardPanel = panel;
  panel.onDidDispose(() => {
    activeWebviews.delete(panel.webview);
    if (dashboardPanel === panel) dashboardPanel = undefined;
  });
}

let pollTimer: ReturnType<typeof setInterval> | undefined;

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
}

/** Reads `atrium.linear.pollSeconds` (0 = off) and (re)arms the auto-refresh
 *  interval. Most useful with a live API key; on the snapshot it's a harmless
 *  re-read. */
function setupPolling(): void {
  stopPolling();
  const seconds = vscode.workspace.getConfiguration("atrium").get<number>("linear.pollSeconds") ?? 0;
  if (seconds > 0) pollTimer = setInterval(() => refreshAll(), seconds * 1000);
}

/** Live cockpit webviews (currently just the dashboard tab) so the refresh
 *  command can re-post init to all of them. */
const activeWebviews = new Set<vscode.Webview>();

function trackWebview(webview: vscode.Webview): void {
  activeWebviews.add(webview);
}

async function postInit(webview: vscode.Webview): Promise<void> {
  void webview.postMessage({ type: "init", payload: await buildInitPayload() });
}

function refreshAll(): void {
  for (const webview of activeWebviews) void postInit(webview);
}

export function deactivate(): void {
  // no-op
}

function webviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
  return {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.joinPath(extensionUri, "dist", "webview")],
  };
}

interface InboundMessage {
  type?: string;
  url?: string;
  /** Sprint-kanban write-back fields. */
  id?: string;
  linearId?: string;
  fromState?: TicketState;
  toState?: WriteState;
  sortOrder?: number;
  /** Cross-wave drag (promote into / demote out of the sprint). */
  toWaveLabel?: string;
  /** Design-canvas + UAT-finding fields. */
  path?: string;
  body?: string;
  verdict?: string;
}

/** Webview <-> host channel. The webview asks once it has booted; we answer
 *  with project state. Drag interactions post mutation intents we write to
 *  Linear and acknowledge with a `mutationResult`. */
function wireMessages(webview: vscode.Webview): void {
  webview.onDidReceiveMessage((msg: InboundMessage) => {
    if (msg?.type === "ready" || msg?.type === "refresh") {
      void postInit(webview);
    } else if (msg?.type === "openLinear" && msg.url) {
      void vscode.env.openExternal(vscode.Uri.parse(msg.url));
    } else if (msg?.type === "moveTicket") {
      void handleMoveTicket(webview, msg);
    } else if (msg?.type === "reorderTicket") {
      void handleReorderTicket(webview, msg);
    } else if (msg?.type === "moveToWave") {
      void handleMoveToWave(webview, msg);
    } else if (msg?.type === "openFile" && msg.path) {
      // Open a design reference in VS Code's own editor (STO-2168).
      void vscode.window.showTextDocument(vscode.Uri.file(msg.path), { preview: true });
    } else if (msg?.type === "addFinding") {
      void handleAddFinding(webview, msg);
    }
  });
}

/** Files a UAT finding as a Linear comment on the target ticket (STO-2175/2176). */
async function handleAddFinding(webview: vscode.Webview, msg: InboundMessage): Promise<void> {
  const { id, linearId, body, verdict } = msg;
  if (!id || !body) return;
  const client = getWriteClient();
  if (!client || !linearId) {
    postMutationResult(webview, { id, ok: false, error: "No Linear API key set — can't file findings." });
    return;
  }
  try {
    const tag = verdict ? `**UAT finding · ${verdict}**` : "**UAT finding**";
    const ok = await client.addComment(linearId, `${tag}\n\n${body}`);
    postMutationResult(webview, { id, ok });
  } catch (e) {
    postMutationResult(webview, { id, ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

/** One write client per API key, reused so workflow-state lookups stay cached. */
let writeClient: { key: string; client: LinearWriteClient } | undefined;

function getWriteClient(): LinearWriteClient | null {
  const key = (vscode.workspace.getConfiguration("atrium").get<string>("linear.apiKey") ?? "").trim();
  if (!key) return null;
  if (writeClient?.key !== key) writeClient = { key, client: new LinearWriteClient(key) };
  return writeClient.client;
}

function postMutationResult(
  webview: vscode.Webview,
  result: { id: string; ok: boolean; conflict?: boolean; error?: string },
): void {
  void webview.postMessage({ type: "mutationResult", ...result });
}

/** Drag-to-status: read-before-write (conflict guard), resolve our column onto
 *  the team's real workflow-state id, then `updateIssue`. */
async function handleMoveTicket(webview: vscode.Webview, msg: InboundMessage): Promise<void> {
  const { id, linearId, fromState, toState } = msg;
  if (!id || !toState) return;
  const client = getWriteClient();
  if (!client || !linearId) {
    postMutationResult(webview, { id, ok: false, error: "No Linear API key set — board is read-only." });
    return;
  }
  try {
    const current = await client.readIssue(linearId);
    if (fromState && current.state !== fromState) {
      postMutationResult(webview, { id, ok: false, conflict: true });
      return;
    }
    const stateId = resolveStateId(current.states, toState);
    if (!stateId) {
      postMutationResult(webview, { id, ok: false, error: `No "${toState}" state in this team's workflow.` });
      return;
    }
    const ok = await client.setState(linearId, stateId);
    postMutationResult(webview, { id, ok });
  } catch (e) {
    postMutationResult(webview, { id, ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

/** Cross-wave drag: relabel the issue to the target wave (promote into the
 *  sprint, or demote back to a wave), optionally set its column state, then
 *  refresh so the ticket re-appears in its new wave. */
async function handleMoveToWave(webview: vscode.Webview, msg: InboundMessage): Promise<void> {
  const { id, linearId, toWaveLabel, toState } = msg;
  if (!id || !toWaveLabel) return;
  const client = getWriteClient();
  if (!client || !linearId) {
    postMutationResult(webview, { id, ok: false, error: "No Linear API key set — board is read-only." });
    return;
  }
  try {
    await client.moveToWave(linearId, toWaveLabel);
    if (toState) {
      const current = await client.readIssue(linearId);
      const stateId = resolveStateId(current.states, toState);
      if (stateId) await client.setState(linearId, stateId);
    }
    postMutationResult(webview, { id, ok: true });
    refreshAll(); // re-pull so the ticket shows under its new wave
  } catch (e) {
    postMutationResult(webview, { id, ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

/** Drag-to-reorder: write the new Linear sortOrder. */
async function handleReorderTicket(webview: vscode.Webview, msg: InboundMessage): Promise<void> {
  const { id, linearId, sortOrder } = msg;
  if (!id || typeof sortOrder !== "number") return;
  const client = getWriteClient();
  if (!client || !linearId) {
    postMutationResult(webview, { id, ok: false, error: "No Linear API key set — board is read-only." });
    return;
  }
  try {
    const ok = await client.setSortOrder(linearId, sortOrder);
    postMutationResult(webview, { id, ok });
  } catch (e) {
    postMutationResult(webview, { id, ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

/** Reads the committed snapshot copied next to the compiled host (dist/). On any
 *  failure we degrade to an empty board + an error string the webview surfaces as
 *  a non-fatal banner — never a blank screen. */
function loadSnapshot(): { board: Board; error?: string } {
  try {
    const raw = JSON.parse(readFileSync(join(__dirname, "atrium-board.json"), "utf8"));
    return { board: validateBoard(raw) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { board: EMPTY_BOARD, error: `Couldn't load board snapshot: ${message}` };
  }
}

/** Picks the data source from settings. With `atrium.linear.apiKey` set we pull
 *  live from Linear (SDK loaded lazily); on any live failure we fall back to the
 *  committed snapshot and tell the user why. Without a key we use the snapshot. */
async function loadBoard(): Promise<{ board: Board; error?: string; source: "snapshot" | "live" }> {
  const cfg = vscode.workspace.getConfiguration("atrium");
  const apiKey = (cfg.get<string>("linear.apiKey") ?? "").trim();
  const projectName = (cfg.get<string>("linear.projectName") ?? "").trim() || "Atrium";

  if (!apiKey) return { ...loadSnapshot(), source: "snapshot" };

  try {
    const { LinearSdkSource } = await import("./linear-source");
    const generatedAt = new Date().toISOString().slice(0, 10);
    const board = await new LinearSdkSource({ apiKey, projectName, generatedAt }).load();
    return { board, source: "live" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ...loadSnapshot(),
      error: `Live Linear fetch failed (${message}); showing the committed snapshot.`,
      source: "snapshot",
    };
  }
}

async function buildInitPayload(): Promise<InitPayload> {
  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  const folders = workspaceFolders.map((f) => f.name);
  const root = workspaceFolders[0]?.uri.fsPath;
  const git = root ? await getGitStatus(root) : null;
  const { board, error, source } = await loadBoard();
  return {
    project: board.project || vscode.workspace.name || folders[0] || "workspace",
    branch: git?.branch || "(no branch)",
    git: git ?? undefined,
    testFiles: root ? getTestFileCount(root) : undefined,
    designRefs: root ? getDesignRefs(root) : undefined,
    folders,
    stages: STAGES,
    waves: board.waves,
    spikes: board.spikes,
    source,
    generatedAt: board.generatedAt || undefined,
    error,
  };
}

function getHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const base = vscode.Uri.joinPath(extensionUri, "dist", "webview");
  return buildHtml({
    scriptUri: webview.asWebviewUri(vscode.Uri.joinPath(base, "main.js")).toString(),
    styleUri: webview.asWebviewUri(vscode.Uri.joinPath(base, "main.css")).toString(),
    cspSource: webview.cspSource,
    nonce: getNonce(),
  });
}
