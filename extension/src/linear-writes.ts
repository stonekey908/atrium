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

/**
 * Maps one of our four kanban columns onto a team's workflow-state id. Resolved
 * from the team's real states (not hardcoded) so custom names work:
 *   done   → first `completed`
 *   todo   → first `unstarted`, else first `backlog`
 *   review → the `started` state whose name matches /review/i, else first started
 *   doing  → the other `started` (not /review/i), else first started
 * Returns null if the team has no state of the needed type.
 */
export function resolveStateId(states: WorkflowState[], target: TicketState): string | null {
  const started = states.filter((s) => s.type === "started");
  if (target === "done") return states.find((s) => s.type === "completed")?.id ?? null;
  if (target === "todo")
    return (states.find((s) => s.type === "unstarted") ?? states.find((s) => s.type === "backlog"))?.id ?? null;
  if (target === "review") return (started.find((s) => /review/i.test(s.name)) ?? started[0])?.id ?? null;
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
