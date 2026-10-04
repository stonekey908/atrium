// The atrium mod's state contract: every value it keeps in `$.state`, and the
// data types those values are made of. Self-contained by design (no imports),
// so `claude plugin validate` can hold the hooks module to it. The hooks
// module imports its types from here; nothing is duplicated.

export type AtriumPriority = "urgent" | "high" | "med" | "low";
export type AtriumTicketState = "todo" | "doing" | "review" | "done";
export type AtriumFullStatus =
  | "Backlog"
  | "Todo"
  | "In Progress"
  | "In Review"
  | "Done"
  | "Canceled"
  | "Duplicate";

export type AtriumTicket = {
  /** The tracker identifier, e.g. STO-2574. */
  id: string;
  title: string;
  url: string;
  priority: AtriumPriority;
  /** The four board columns; Canceled/Duplicate park in `todo` and are flagged via `status`. */
  state: AtriumTicketState;
  /** The exact tracker status. */
  status: AtriumFullStatus;
  /** Bullet lines of the description — the acceptance criteria. */
  spec: string[];
  /** The description as the list call returned it (the tracker truncates long ones). */
  description: string | null;
  /** The tracker's own suggested branch name, when it has one. */
  branch: string | null;
};

export type AtriumWave = {
  /** Display name, e.g. "Wave 7 · Editable docs & Linear sync". */
  name: string;
  /** The tracker label the wave was detected from; "" for the Unsorted bucket. */
  label: string;
  /** Pipeline stage derived from ticket states: plan | build | release; "" for Unsorted. */
  stage: string;
  tickets: AtriumTicket[];
};

export type AtriumBoard = {
  project: string;
  generatedAt: string;
  waves: AtriumWave[];
};

export type AtriumFileKind = "md" | "html" | "image" | "figma";

export type AtriumFileRef = {
  name: string;
  /** Absolute path. */
  path: string;
  kind: AtriumFileKind;
};

export type AtriumWaveFiles = {
  prd: AtriumFileRef | null;
  docs: AtriumFileRef[];
  mockups: AtriumFileRef[];
};

export type AtriumLoad = {
  phase: "idle" | "loading" | "ready" | "error";
  message: string | null;
  /** When the board was last loaded, ms since the epoch. */
  at: number | null;
};

export type AtriumView = "board" | "prd" | "design";

export type AtriumDoc = {
  path: string;
  text: string;
};

declare module "claude-code" {
  interface PluginState {
    atrium: {
      board: AtriumBoard | null;
      load: AtriumLoad;
      view: AtriumView;
      /** The wave shown on the board; null = the detected current sprint. */
      wave: string | null;
      /** The ticket whose detail is expanded. */
      selected: string | null;
      /** Full descriptions fetched on demand, by ticket id. */
      descriptions: Record<string, string>;
      /** The current git branch ("" when not a repo). */
      branch: string;
      /** Resolved PRD/docs/mockups per wave name. */
      files: Record<string, AtriumWaveFiles>;
      /** The build-level PRD (docs/PRD.md), absolute path, when it exists. */
      buildPrd: string | null;
      /** The document open in the PRD view. */
      doc: AtriumDoc | null;
      /** Every project name the tracker listed (the picker when none matches). */
      projects: string[];
      /** The project the board shows. */
      project: string | null;
      showDone: boolean;
      /** The ticket id whose status write is in flight. */
      syncing: string | null;
    };
  }
}
