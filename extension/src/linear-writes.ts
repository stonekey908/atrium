/**
 * Linear write-back for the sprint kanban (STO-2469 drag-to-status, STO-2470
 * drag-to-reorder). Kept separate from the read-only `linear-source.ts` so the
 * read path stays write-free, and so the pure state↔workflow resolver unit-tests
 * without the SDK.
 *
 * All writes go through the host (the webview never holds the API key). Every
 * move is pull-then-write: we read the issue's current state first, both to map
 * our four columns onto the team's real workflow-state ids and to detect a
 * conflict (Linear moved out from under the optimistic webview).
 */
import { LinearClient } from "@linear/sdk";
import { mapState, type TicketState } from "./board";

export interface WorkflowState {
  id: string;
  name: string;
  type: string;
}

/** Write target — the four kanban columns plus `backlog` (demote out of the
 *  sprint) and the two terminal states the status picker can set (STO status). */
export type WriteState = TicketState | "backlog" | "canceled" | "duplicate";

/**
 * Maps a write target onto a team's workflow-state id. Resolved from the team's
 * real states (not hardcoded) so custom names work:
 *   done      → first `completed`
 *   backlog   → first `backlog`, else first `unstarted`
 *   todo      → first `unstarted`, else first `backlog`
 *   review    → the `started` state whose name matches /review/i, else first started
 *   doing     → the other `started` (not /review/i), else first started
 *   duplicate → the `canceled` state named /duplicate/i, else first canceled
 *   canceled  → the `canceled` state NOT named /duplicate/i, else first canceled
 * Returns null if the team has no state of the needed type.
 */
export function resolveStateId(states: WorkflowState[], target: WriteState): string | null {
  const started = states.filter((s) => s.type === "started");
  const canceled = states.filter((s) => s.type === "canceled");
  if (target === "done") return states.find((s) => s.type === "completed")?.id ?? null;
  if (target === "backlog")
    return (states.find((s) => s.type === "backlog") ?? states.find((s) => s.type === "unstarted"))?.id ?? null;
  if (target === "todo")
    return (states.find((s) => s.type === "unstarted") ?? states.find((s) => s.type === "backlog"))?.id ?? null;
  if (target === "review") return (started.find((s) => /review/i.test(s.name)) ?? started[0])?.id ?? null;
  if (target === "duplicate") return (canceled.find((s) => /duplicate/i.test(s.name)) ?? canceled[0])?.id ?? null;
  if (target === "canceled") return (canceled.find((s) => !/duplicate/i.test(s.name)) ?? canceled[0])?.id ?? null;
  return (started.find((s) => !/review/i.test(s.name)) ?? started[0])?.id ?? null;
}

export interface IssueSnapshot {
  /** Mapped current state, for the conflict check. */
  state: TicketState;
  teamId: string;
  states: WorkflowState[];
}

const READ_QUERY = `
  query IssueForWrite($id: String!) {
    issue(id: $id) {
      state { type name }
      team { id states { nodes { id name type } } }
    }
  }
`;

interface ReadResponse {
  issue: {
    state: { type: string; name: string };
    team: { id: string; states: { nodes: WorkflowState[] } };
  } | null;
}

/** Thin write client over the Linear GraphQL API. Caches each team's workflow
 *  states after the first read so repeated moves don't re-fetch them. */
export class LinearWriteClient {
  private readonly client: LinearClient;
  private readonly statesByTeam = new Map<string, WorkflowState[]>();

  constructor(apiKey: string) {
    this.client = new LinearClient({ apiKey });
  }

  /** Reads the issue's current mapped state + its team's workflow states. */
  async readIssue(uuid: string): Promise<IssueSnapshot> {
    const res = await this.client.client.rawRequest<ReadResponse, { id: string }>(READ_QUERY, { id: uuid });
    const issue = res.data?.issue;
    if (!issue) throw new Error(`Issue ${uuid} not found`);
    const states = issue.team.states.nodes;
    this.statesByTeam.set(issue.team.id, states);
    return { state: mapState(issue.state.type, issue.state.name), teamId: issue.team.id, states };
  }

  /** Sets the issue's workflow state. Returns true on a successful mutation. */
  async setState(uuid: string, stateId: string): Promise<boolean> {
    const mutation = `
      mutation MoveIssue($id: String!, $stateId: String!) {
        issueUpdate(id: $id, input: { stateId: $stateId }) { success }
      }
    `;
    const res = await this.client.client.rawRequest<{ issueUpdate: { success: boolean } }, { id: string; stateId: string }>(
      mutation,
      { id: uuid, stateId },
    );
    return res.data?.issueUpdate?.success ?? false;
  }

  /** Moves an issue to a different wave by swapping its `ATR Wave …` label for
   *  the target one (keeping all non-wave labels). Used by drag between the
   *  sprint kanban and the horizon list. Returns true on success. */
  async moveToWave(uuid: string, targetLabelName: string): Promise<boolean> {
    const readLabels = `
      query IssueLabels($id: String!) {
        issue(id: $id) {
          labels { nodes { id name } }
          team { labels { nodes { id name } } }
        }
      }
    `;
    const read = await this.client.client.rawRequest<
      { issue: { labels: { nodes: { id: string; name: string }[] }; team: { labels: { nodes: { id: string; name: string }[] } } } | null },
      { id: string }
    >(readLabels, { id: uuid });
    const issue = read.data?.issue;
    if (!issue) throw new Error(`Issue ${uuid} not found`);
    const target = issue.team.labels.nodes.find((l) => l.name === targetLabelName);
    if (!target) throw new Error(`Wave label "${targetLabelName}" not found in the team`);
    // Keep every non-wave label, drop any existing ATR Wave label, add the target.
    const kept = issue.labels.nodes.filter((l) => !/^ATR Wave/i.test(l.name)).map((l) => l.id);
    const labelIds = Array.from(new Set([...kept, target.id]));
    const mutation = `
      mutation MoveWave($id: String!, $labelIds: [String!]!) {
        issueUpdate(id: $id, input: { labelIds: $labelIds }) { success }
      }
    `;
    const res = await this.client.client.rawRequest<{ issueUpdate: { success: boolean } }, { id: string; labelIds: string[] }>(
      mutation,
      { id: uuid, labelIds },
    );
    return res.data?.issueUpdate?.success ?? false;
  }

  /** Posts a comment to an issue — used to file UAT findings (STO-2175/2176). */
  async addComment(issueId: string, body: string): Promise<boolean> {
    const mutation = `
      mutation FileFinding($issueId: String!, $body: String!) {
        commentCreate(input: { issueId: $issueId, body: $body }) { success }
      }
    `;
    const res = await this.client.client.rawRequest<
      { commentCreate: { success: boolean } },
      { issueId: string; body: string }
    >(mutation, { issueId, body });
    return res.data?.commentCreate?.success ?? false;
  }

  /** Sets the issue's sort order (priority within the project). STO-2470. */
  async setSortOrder(uuid: string, sortOrder: number): Promise<boolean> {
    const mutation = `
      mutation ReorderIssue($id: String!, $sortOrder: Float!) {
        issueUpdate(id: $id, input: { sortOrder: $sortOrder }) { success }
      }
    `;
    const res = await this.client.client.rawRequest<
      { issueUpdate: { success: boolean } },
      { id: string; sortOrder: number }
    >(mutation, { id: uuid, sortOrder });
    return res.data?.issueUpdate?.success ?? false;
  }
}
