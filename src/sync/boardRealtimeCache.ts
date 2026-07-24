import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { mapBoardRow } from "../board/boardUtils";
import type { BoardRow } from "../board/boardUtils";
import { deleteCachedBoard, upsertCachedBoard } from "./boardCacheRepository";

export const persistBoardRealtimePayload = async (
 ownerId: string,
 payload: RealtimePostgresChangesPayload<BoardRow>,
) => {
 if (payload.eventType === "DELETE") {
  const deletedId = payload.old.id;

  if (typeof deletedId === "string") {
   await deleteCachedBoard(ownerId, deletedId);
  }

  return;
 }

 if (payload.new.owner_id !== ownerId) {
  return;
 }

 await upsertCachedBoard(ownerId, mapBoardRow(payload.new));
};
