import * as vscode from "vscode";
import { buildHtml, getNonce, STUB_WAVES, type InitPayload } from "./cockpit-html";

/**
 * Atrium Cockpit — VS Code extension host (POC).
 *
 * Architecture proof: the cockpit UI is a React webview (built by Vite into
 * dist/webview). All editor / git / terminal / extension-ecosystem features are
 * VS Code's own — this extension only adds the Linear/PRD/sprint cockpit on top
 * and brokers messages between the webview and Node-land (where real Linear-MCP
 * / `claude` stream-json calls will live in Wave 1).
 */
export function activate(context: vscode.ExtensionContext): void {
  // 1. Cockpit in the Activity Bar (the "it's a real part of VS Code" surface).
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      CockpitViewProvider.viewType,
      new CockpitViewProvider(context.extensionUri),
    ),
  );

  // 2. Same cockpit as a full editor-area tab (the "dashboard beside my code" surface).
  context.subscriptions.push(
    vscode.commands.registerCommand("atrium.openDashboard", () => {
      const panel = vscode.window.createWebviewPanel(
        "atrium.dashboard",
        "Atrium · Cockpit",
        vscode.ViewColumn.Active,
        webviewOptions(context.extensionUri),
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

/** The webview <-> host message channel. This is where real integrations land. */
function wireMessages(webview: vscode.Webview): void {
  webview.onDidReceiveMessage((msg: { type?: string; id?: string; title?: string }) => {
    switch (msg?.type) {
      case "ready":
        // Webview booted → push it the project state. Today: real workspace
        // folders + a stubbed wave/ticket rollup. Tomorrow: Linear MCP.
        void webview.postMessage({ type: "init", payload: buildInitPayload() });
        return;
      case "openTicket":
        vscode.window.showInformationMessage(
          `Atrium · ${msg.id} — would open Spec / Tests / Activity inline (Wave 0.5).`,
        );
        return;
      case "runClaude":
        vscode.window.showInformationMessage(
          `Atrium · would spawn  claude -p "${msg.title}"  over the stream-json bridge (Wave 1).`,
        );
        return;
    }
  });
}

function buildInitPayload(): InitPayload {
  const folders = (vscode.workspace.workspaceFolders ?? []).map((f) => f.name);
  return {
    project: vscode.workspace.name ?? folders[0] ?? "workspace",
    branch: "claude/vs-plugin-architecture",
    folders,
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
