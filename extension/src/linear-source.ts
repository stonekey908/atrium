/**
 * Live Linear source. Isolated from `board.ts` so the pure model/mapper stays
 * SDK-free (and cheap to test). One paginated GraphQL query pulls every project
 * issue with its labels + state in a single round-trip per page — no N+1 over
 * relation accessors — then hands the flattened rows to the pure `boardFromIssues`.
 */
import { LinearClient } from "@linear/sdk";
import {
  boardFromIssues,
  validateBoard,
  type Board,
  type BoardSource,
  type LinearIssueLite,
} from "./board";

const ISSUES_QUERY = `
  query AtriumIssues($project: String!, $after: String) {
    issues(filter: { project: { name: { eq: $project } } }, first: 100, after: $after) {
      nodes {
        id
        identifier
        title
        url
        priority
        sortOrder
        state { type name }
        labels { nodes { name } }
        description
        comments { nodes { body createdAt } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

interface IssuesResponse {
  issues: {
    nodes: {
      id: string;
      identifier: string;
      title: string;
      url: string;
      priority: number;
      sortOrder: number;
      state: { type: string; name: string };
      labels: { nodes: { name: string }[] };
      description: string | null;
      comments: { nodes: { body: string; createdAt: string }[] };
    }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

async function fetchAllIssues(client: LinearClient, projectName: string): Promise<LinearIssueLite[]> {
  const out: LinearIssueLite[] = [];
  let after: string | undefined;
  do {
    const res = await client.client.rawRequest<IssuesResponse, { project: string; after?: string }>(
      ISSUES_QUERY,
      { project: projectName, after },
    );
    const conn = res.data?.issues;
    if (!conn) break;
    for (const n of conn.nodes) {
      out.push({
        id: n.id,
        identifier: n.identifier,
        title: n.title,
        url: n.url,
        priority: n.priority,
        sortOrder: n.sortOrder,
        stateType: n.state.type,
        stateName: n.state.name,
        labels: n.labels.nodes.map((l) => l.name),
        description: n.description,
        comments: n.comments.nodes.map((c) => ({ body: c.body, createdAt: c.createdAt })),
      });
    }
    after = conn.pageInfo.hasNextPage ? (conn.pageInfo.endCursor ?? undefined) : undefined;
  } while (after);
  return out;
}

export interface LinearSourceOptions {
  apiKey: string;
  projectName: string;
  generatedAt: string;
}

/** Pulls the board live from Linear. Falls back is handled by the caller. */
export class LinearSdkSource implements BoardSource {
  constructor(private readonly opts: LinearSourceOptions) {}

  async load(): Promise<Board> {
    const client = new LinearClient({ apiKey: this.opts.apiKey });
    const issues = await fetchAllIssues(client, this.opts.projectName);
    if (issues.length === 0) {
      throw new Error(`No issues found for Linear project "${this.opts.projectName}" — check the project name and API key.`);
    }
    return validateBoard(
      boardFromIssues(issues, { projectName: this.opts.projectName, generatedAt: this.opts.generatedAt }),
    );
  }
}
