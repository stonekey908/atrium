/**
 * Pure (no `vscode` import) cockpit data + HTML helpers, so they can be
 * unit-tested without the VS Code runtime. extension.ts wires these to the
 * real Webview (asWebviewUri / cspSource).
 */

export type Priority = "urgent" | "high" | "med" | "low";
export type TicketState = "todo" | "doing" | "review" | "done";
export type StageStatus = "done" | "active" | "todo";
export type ActivityKind = "pickup" | "plan" | "phase" | "close" | "commit";

export interface TestSummary {
  passed: number;
  failed: number;
  missing: number;
}
export interface ActivityItem {
  kind: ActivityKind;
  text: string;
  when: string;
}
export interface Ticket {
  id: string;
  title: string;
  priority: Priority;
  state: TicketState;
  spec: string[];
  tests: TestSummary;
  activity: ActivityItem[];
}
export interface Wave {
  name: string;
  tickets: Ticket[];
}
export interface Stage {
  key: string;
  label: string;
  status: StageStatus;
}
export interface Spike {
  id: string;
  code: string;
  gatesWave: string;
  state: TicketState;
}
export interface GitInfo {
  branch: string;
  dirty: boolean;
  ahead: number;
  behind: number;
}

export interface InitPayload {
  project: string;
  branch: string;
  folders: string[];
  stages: Stage[];
  waves: Wave[];
  spikes?: Spike[];
  /** Real workspace git status for the status strip (STO-2170); absent if the
   *  workspace isn't a git repo. */
  git?: GitInfo;
  /** Where the board came from + how fresh it is (shown as a header chip). */
  source?: "snapshot" | "live";
  generatedAt?: string;
  /** Non-fatal load problem (e.g. malformed snapshot); webview shows a banner. */
  error?: string;
}

/** Tier-1 pipeline. Real status comes from wave rollups later. */
export const STAGES: Stage[] = [
  { key: "plan", label: "Plan", status: "done" },
  { key: "design", label: "Design", status: "done" },
  { key: "ux", label: "UX", status: "done" },
  { key: "build", label: "Build", status: "active" },
  { key: "uat", label: "UAT", status: "todo" },
  { key: "release", label: "Release", status: "todo" },
];

/** Stand-in for Linear data until the MCP integration lands (Wave 0.5). */
export const STUB_WAVES: Wave[] = [
  {
    name: "Wave 0 · Visual layer",
    tickets: [
      {
        id: "STO-2095",
        title: "AppShell — folder canvas + rails",
        priority: "high",
        state: "done",
        tests: { passed: 13, failed: 0, missing: 0 },
        spec: [
          "280px file-tree rail + folder page + 44px icon rail",
          "Header, drop zone, 4-col file grid, activity feed",
        ],
        activity: [
          { kind: "pickup", text: "Picked up — planning 3 slices", when: "May 4" },
          { kind: "close", text: "Closed · merged to main", when: "May 5" },
        ],
      },
      {
        id: "STO-2099",
        title: "Live git status in title-bar chip",
        priority: "med",
        state: "done",
        tests: { passed: 30, failed: 0, missing: 0 },
        spec: [
          "Branch name + amber dirty dot + ↑/↓ ahead/behind",
          "fs-watcher rooted at repo top-level, 500ms debounce",
        ],
        activity: [
          { kind: "pickup", text: "Picked up STO-2099", when: "May 6" },
          { kind: "plan", text: "Plan locked — 3 vertical slices", when: "May 6" },
          { kind: "phase", text: "UAT 5/5 pass", when: "May 6" },
          { kind: "close", text: "Closed · merged (1b59deb)", when: "May 6" },
        ],
      },
    ],
  },
  {
    name: "Wave 0.5 · Wave & ticket rail",
    tickets: [
      {
        id: "STO-2181",
        title: "Left rail mode toggle (Waves ↔ Files) + ⌘1",
        priority: "urgent",
        state: "doing",
        tests: { passed: 0, failed: 0, missing: 4 },
        spec: [
          "Single toggle switches rail between Waves and Files",
          "⌘1 keybinding + draggable resize handle",
          "State persists across reloads",
        ],
        activity: [{ kind: "pickup", text: "Picked up — in progress", when: "today" }],
      },
      {
        id: "STO-2182",
        title: "Waves pane — project rollup + collapsible cards",
        priority: "high",
        state: "todo",
        tests: { passed: 0, failed: 0, missing: 0 },
        spec: ["Project rollup header", "Collapsible wave cards with progress bars"],
        activity: [],
      },
      {
        id: "STO-2186",
        title: "Test discovery — count pass / fail / missing",
        priority: "med",
        state: "todo",
        tests: { passed: 0, failed: 0, missing: 0 },
        spec: ["Auto-find unit tests per ticket", "Roll up pass / fail / missing counts"],
        activity: [],
      },
    ],
  },
  {
    name: "Wave 1 · CLI bridge",
    tickets: [
      {
        id: "STO-2146",
        title: "Spike T-110 — permission-mode respawn?",
        priority: "urgent",
        state: "todo",
        tests: { passed: 0, failed: 0, missing: 1 },
        spec: ["Does a mid-session permission-mode change require a respawn?", "~30 min spike, gates Wave 1"],
        activity: [],
      },
      {
        id: "STO-2164",
        title: "Conversation strip — stream-json renderer",
        priority: "urgent",
        state: "todo",
        tests: { passed: 0, failed: 0, missing: 0 },
        spec: [
          "Render assistant deltas, tool cards, inline diffs",
          "Permission prompts as inline allow / deny",
        ],
        activity: [],
      },
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

/** Builds the sandboxed webview document with a strict, nonce-based CSP.
 *  `font-src ${cspSource}` lets the bundled codicon font load. */
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
