/**
 * Linear through the MCP connector. The mod never holds an API key: it calls
 * the Linear MCP server's tools (`mcp__<server>__list_issues` and friends)
 * through `$.tool.call`, exactly as the model would. Everything here takes a
 * `Call` function so it unit-tests against canned tool results.
 */
import type { AtriumFullStatus } from "../types";
import type { LinearIssueLite } from "./board";

export interface LinearTools {
  server: string;
  listIssues: string;
  getIssue: string | null;
  saveIssue: string | null;
  listProjects: string | null;
}

const TOOL_RE = /^mcp__(.+)__(list_issues|get_issue|save_issue|list_projects)$/;

/**
 * Finds the Linear MCP server among the connected tools: the configured server
 * name first, else any server whose name mentions linear, else any server that
 * offers `list_issues`. Null when no tracker tools are connected.
 */
export function findLinearTools(names: readonly string[], preferredServer?: string): LinearTools | null {
  const byServer = new Map<string, Map<string, string>>();
  for (const name of names) {
    const m = TOOL_RE.exec(name);
    if (!m) continue;
    const server = m[1] as string;
    const tool = m[2] as string;
    if (!byServer.has(server)) byServer.set(server, new Map());
    byServer.get(server)?.set(tool, name);
  }
  const servers = Array.from(byServer.keys()).filter((s) => byServer.get(s)?.has("list_issues"));
  if (servers.length === 0) return null;
  const want = (preferredServer ?? "").toLowerCase();
  const server =
    servers.find((s) => want && s.toLowerCase() === want) ??
    servers.find((s) => /linear/i.test(s)) ??
    (servers[0] as string);
  const tools = byServer.get(server) as Map<string, string>;
  return {
    server,
    listIssues: tools.get("list_issues") as string,
    getIssue: tools.get("get_issue") ?? null,
    saveIssue: tools.get("save_issue") ?? null,
    listProjects: tools.get("list_projects") ?? null,
  };
}

/** What a tool call hands back, as the mod reads it off `$.tool.call`. */
export interface CallResult {
  text?: string;
  isError?: true;
  deny?: string;
  result?: unknown;
}

export type Call = (tool: string, input: Record<string, unknown>) => Promise<CallResult>;

/** The JSON an MCP tool answered, or a thrown Error naming what went wrong. */
export function parseJson(res: CallResult, what: string): unknown {
  if (res.deny !== undefined) throw new Error(`${what} was refused: ${res.deny}`);
  if (res.isError) throw new Error(`${what} failed: ${(res.text ?? "").slice(0, 200)}`);
  let text = res.text;
  if (text === undefined) {
    const r = res.result as { content?: { type?: string; text?: string }[] } | undefined;
    text = r?.content?.filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n");
  }
  if (!text) throw new Error(`${what} returned nothing`);
  try {
    return JSON.parse(text);
  } catch {
    const start = text.search(/[[{]/);
    if (start >= 0) {
      try {
        return JSON.parse(text.slice(start));
      } catch {
        /* fall through */
      }
    }
    throw new Error(`${what} returned something that is not JSON: ${text.slice(0, 120)}`);
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/** One issue as `list_issues` / `get_issue` return it → the flat shape the board maps. */
export function issueFromMcp(raw: unknown): LinearIssueLite | null {
  if (!isObject(raw)) return null;
  const identifier = str(raw.id) ?? str(raw.identifier);
  const title = str(raw.title);
  if (!identifier || !title) return null;
  const pri = raw.priority;
  const priority = typeof pri === "number" ? pri : isObject(pri) && typeof pri.value === "number" ? pri.value : 0;
  const labelsRaw = Array.isArray(raw.labels) ? raw.labels : [];
  const labels = labelsRaw
    .map((l) => (typeof l === "string" ? l : isObject(l) ? str(l.name) : null))
    .filter((l): l is string => l !== null);
  const status = isObject(raw.status) ? str(raw.status.name) : str(raw.status);
  const statusType = str(raw.statusType) ?? (isObject(raw.status) ? str(raw.status.type) : null) ?? (isObject(raw.state) ? str(raw.state.type) : null);
  return {
    id: str(raw.uuid) ?? identifier,
    identifier,
    title,
    url: str(raw.url) ?? "",
    priority,
    stateType: statusType ?? "unstarted",
    stateName: status ?? "",
    labels,
    description: str(raw.description),
    branch: str(raw.gitBranchName),
  };
}

/** Every issue of the project, following the cursor; bounded to 20 pages. */
export async function fetchIssues(call: Call, tool: string, project: string): Promise<LinearIssueLite[]> {
  const out: LinearIssueLite[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page++) {
    const input: Record<string, unknown> = {
      project,
      limit: 250,
      includeArchived: false,
      fields: ["id", "uuid", "title", "url", "priority", "status", "statusType", "labels", "description", "gitBranchName"],
    };
    if (cursor) input.cursor = cursor;
    const data = parseJson(await call(tool, input), "Listing issues");
    const list = isObject(data) && Array.isArray(data.issues) ? data.issues : Array.isArray(data) ? data : [];
    for (const raw of list) {
      const issue = issueFromMcp(raw);
      if (issue) out.push(issue);
    }
    const more = isObject(data) && data.hasNextPage === true && typeof data.cursor === "string" ? data.cursor : null;
    if (!more || more === cursor) break;
    cursor = more;
  }
  return out;
}

/** The names of every project the tracker lists (one page of 50 per call, bounded). */
export async function fetchProjectNames(call: Call, tool: string): Promise<string[]> {
  const names: string[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    const input: Record<string, unknown> = { limit: 50, fields: ["id", "name"] };
    if (cursor) input.cursor = cursor;
    const data = parseJson(await call(tool, input), "Listing projects");
    const list = isObject(data) && Array.isArray(data.projects) ? data.projects : Array.isArray(data) ? data : [];
    for (const p of list) if (isObject(p) && typeof p.name === "string") names.push(p.name);
    const more = isObject(data) && data.hasNextPage === true && typeof data.cursor === "string" ? data.cursor : null;
    if (!more || more === cursor) break;
    cursor = more;
  }
  return names;
}

/** The full description of one issue (the list call truncates long ones). */
export async function fetchDescription(call: Call, tool: string, id: string): Promise<string> {
  const data = parseJson(await call(tool, { id }), `Reading ${id}`);
  return (isObject(data) && str(data.description)) || "";
}

/** Moves an issue to a status by its name; throws with the tracker's reason. */
export async function writeStatus(call: Call, tool: string, id: string, status: AtriumFullStatus): Promise<void> {
  parseJson(await call(tool, { id, state: status }), `Moving ${id} to ${status}`);
}
