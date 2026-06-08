import * as vscode from "vscode";
import { buildHtml, getNonce, STAGES, STUB_WAVES, type InitPayload } from "./cockpit-html";

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
      wireMessages(panel.webview);
    }),
  );
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
    wireMessages(view.webview);
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
    if (msg?.type === "ready") {
      void webview.postMessage({ type: "init", payload: buildInitPayload() });
    }
  });
}

function buildInitPayload(): InitPayload {
  const folders = (vscode.workspace.workspaceFolders ?? []).map((f) => f.name);
  return {
    project: vscode.workspace.name ?? folders[0] ?? "workspace",
    branch: "claude/vs-plugin-architecture",
    folders,
    stages: STAGES,
    waves: STUB_WAVES,
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
