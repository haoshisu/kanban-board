import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { mapBoardRow } from "./boardUtils";
import type { BoardRow } from "./boardUtils";
import type { Board } from "./types";

export const upsertBoardByVersion = (boards: Board[], incomingBoard: Board): Board[] => {
 const index = boards.findIndex((board) => board.id === incomingBoard.id);

 if (index === -1) {
  return [incomingBoard, ...boards];
 }

 const currentBoard = boards[index];

 if (currentBoard.version >= incomingBoard.version) {
  return boards;
 }

 const nextBoards = [...boards];
 nextBoards[index] = incomingBoard;

 return nextBoards;
};

export const applyBoardRealtimePayload = (
 boards: Board[],
 ownerId: string | undefined,
 payload: RealtimePostgresChangesPayload<BoardRow>,
): Board[] => {
 if (payload.eventType === "DELETE") {
  const deletedId = payload.old.id;

  return typeof deletedId === "string" ? boards.filter((board) => board.id !== deletedId) : boards;
 }

 const row = payload.new;

 if (row.owner_id !== ownerId) {
  return boards;
 }

 return upsertBoardByVersion(boards, mapBoardRow(row));
};
