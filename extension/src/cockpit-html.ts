/**
 * Pure (no `vscode` import) cockpit data + HTML helpers, so they can be
 * unit-tested without the VS Code runtime. extension.ts wires these to the
 * real Webview (asWebviewUri / cspSource).
 */

export interface Ticket {
  id: string;
  title: string;
  priority: "urgent" | "high" | "med" | "low";
  state: "todo" | "doing" | "done";
  tests?: string;
}
export interface Wave {
  name: string;
  tickets: Ticket[];
}
export interface InitPayload {
  project: string;
  branch: string;
  folders: string[];
  waves: Wave[];
}

/** Stand-in for Linear data until the MCP integration lands (Wave 0.5). */
export const STUB_WAVES: Wave[] = [
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

export function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

export interface HtmlUris {
  scriptUri: string;
  styleUri: string;
  cspSource: string;
  nonce: string;
}

/** Builds the sandboxed webview document with a strict, nonce-based CSP. */
export function buildHtml({ scriptUri, styleUri, cspSource, nonce }: HtmlUris): string {
  const csp = [
    `default-src 'none'`,
    `img-src ${cspSource} https: data:`,
    `style-src ${cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
    `font-src ${cspSource} https: data:`,
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
