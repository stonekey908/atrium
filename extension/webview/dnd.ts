import type { TicketState } from "./types";

/**
 * Shared drag payload for the board. The sprint kanban and the horizon wave
 * list both produce and accept these, so a card can be dragged within the
 * sprint (state/reorder), up from a wave into the sprint (promote), or back
 * down into another wave (demote). `fromWaveLabel` lets a drop target tell a
 * same-wave move from a cross-wave one.
 */
export const DND_MIME = "application/x-atrium-card";

export interface DragPayload {
  id: string;
  linearId?: string;
  fromState: TicketState;
  /** The Linear label of the wave the card was dragged from. */
  fromWaveLabel?: string;
  sortOrder: number;
}

export function setDrag(e: React.DragEvent, payload: DragPayload): void {
  e.dataTransfer.setData(DND_MIME, JSON.stringify(payload));
  e.dataTransfer.effectAllowed = "move";
}

export function getDrag(e: React.DragEvent): DragPayload | null {
  const raw = e.dataTransfer.getData(DND_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}
