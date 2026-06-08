import * as vscode from "vscode";
import { readFileSync } from "fs";
import { join } from "path";
import { buildHtml, getNonce, STAGES, type InitPayload } from "./cockpit-html";
import { SnapshotSource, EMPTY_BOARD, type Board } from "./board";

/**
 * Atrium Cockpit — VS Code extension host (POC).
 *
 * The cockpit UI is a React webview (built by Vite into dist/webview). All
 * editor / git / terminal / extension-ecosystem features are VS Code's own —
 * this extension only adds the Linear/PRD/sprint cockpit on top and brokers
 * project state to the webview (real Linear-MCP / `claude` calls land in Wave 1).
 */
export function activate(context: vscode.ExtensionContext): void {
  // 1. Cockpit in the Activity Bar.
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      CockpitViewProvider.viewType,
      new CockpitViewProvider(context.extensionUri),
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  );

  // 2. Same cockpit as a full editor-area tab — the full-screen surface.
  context.subscriptions.push(
    vscode.commands.registerCommand("atrium.openDashboard", () => {
      const panel = vscode.window.createWebviewPanel(
        "atrium.dashboard",
        "Atrium · Cockpit",
        vscode.ViewColumn.Active,
        { ...webviewOptions(context.extensionUri), retainContextWhenHidden: true },
      );
      panel.webview.html = getHtml(panel.webview, context.extensionUri);
      trackWebview(panel.webview);
      wireMessages(panel.webview);
      panel.onDidDispose(() => activeWebviews.delete(panel.webview));
    }),
  );

  // 3. Refresh re-reads the board snapshot and re-renders every open cockpit
  //    in place — no relaunch, no new window.
  context.subscriptions.push(
    vscode.commands.registerCommand("atrium.refreshBoard", () => refreshAll()),
  );
}

/** Live cockpit webviews (Activity-Bar view + any dashboard tabs) so the
 *  refresh command can re-post init to all of them. */
const activeWebviews = new Set<vscode.Webview>();

function trackWebview(webview: vscode.Webview): void {
  activeWebviews.add(webview);
}

function postInit(webview: vscode.Webview): void {
  void webview.postMessage({ type: "init", payload: buildInitPayload() });
}

function refreshAll(): void {
  for (const webview of activeWebviews) postInit(webview);
}

export function deactivate(): void {
  // no-op
}

class CockpitViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = "atrium.cockpit";

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    view.webview.options = webviewOptions(this.extensionUri);
    view.webview.html = getHtml(view.webview, this.extensionUri);
    trackWebview(view.webview);
    wireMessages(view.webview);
    view.onDidDispose(() => activeWebviews.delete(view.webview));
  }
}

function webviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
  return {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.joinPath(extensionUri, "dist", "webview")],
  };
}

/** Webview <-> host channel. The webview asks once it has booted; we answer
 *  with project state. Ticket interactions are handled inside the webview. */
function wireMessages(webview: vscode.Webview): void {
  webview.onDidReceiveMessage((msg: { type?: string }) => {
    if (msg?.type === "ready" || msg?.type === "refresh") {
      postInit(webview);
    }
  });
}

/** Reads the committed snapshot copied next to the compiled host (dist/). On any
 *  failure we degrade to an empty board + an error string the webview surfaces as
 *  a non-fatal banner — never a blank screen. */
function loadBoard(): { board: Board; error?: string } {
  try {
    const raw = JSON.parse(readFileSync(join(__dirname, "atrium-board.json"), "utf8"));
    return { board: new SnapshotSource(raw).load() };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { board: EMPTY_BOARD, error: `Couldn't load board snapshot: ${message}` };
  }
}

function buildInitPayload(): InitPayload {
  const folders = (vscode.workspace.workspaceFolders ?? []).map((f) => f.name);
  const { board, error } = loadBoard();
  return {
    project: board.project || vscode.workspace.name || folders[0] || "workspace",
    branch: "claude/vs-plugin-architecture",
    folders,
    stages: STAGES,
    waves: board.waves,
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
