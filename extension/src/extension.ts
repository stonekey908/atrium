import * as vscode from "vscode";

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

interface Ticket {
  id: string;
  title: string;
  priority: "urgent" | "high" | "med" | "low";
  state: "todo" | "doing" | "done";
  tests?: string;
}
interface Wave {
  name: string;
  tickets: Ticket[];
}
interface InitPayload {
  project: string;
  branch: string;
  folders: string[];
  waves: Wave[];
}

/** Stand-in for Linear data until the MCP integration lands. */
const STUB_WAVES: Wave[] = [
  {
    name: "Wave 0 · Visual layer",
    tickets: [
      { id: "STO-2095", title: "AppShell — folder canvas + rails", priority: "high", state: "done", tests: "13/13" },
      { id: "STO-2099", title: "Live git status in title-bar chip", priority: "med", state: "done", tests: "30/30" },
    ],
  },
  {
    name: "Wave 0.5 · Wave & ticket rail",
    tickets: [
      { id: "STO-2181", title: "Left rail mode toggle (Waves ↔ Files) + ⌘1", priority: "urgent", state: "doing", tests: "0/4" },
      { id: "STO-2182", title: "Waves pane — project rollup + collapsible cards", priority: "high", state: "todo" },
      { id: "STO-2183", title: "Ticket row component (id, priority, state, meta)", priority: "high", state: "todo" },
      { id: "STO-2186", title: "Test discovery — count pass / fail / missing", priority: "med", state: "todo" },
    ],
  },
  {
    name: "Wave 1 · CLI bridge",
    tickets: [
      { id: "STO-2146", title: "Spike T-110 — permission-mode respawn?", priority: "urgent", state: "todo", tests: "spike" },
      { id: "STO-2164", title: "Conversation strip — stream-json renderer", priority: "urgent", state: "todo" },
    ],
  },
];

function getHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const base = vscode.Uri.joinPath(extensionUri, "dist", "webview");
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(base, "main.js"));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(base, "main.css"));
  const nonce = getNonce();
  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} https: data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
    `font-src ${webview.cspSource} https: data:`,
  ].join("; ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>Atrium Cockpit</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
