import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { mapTaskRow } from "../task/taskUtils";
import type { TaskRow } from "../task/taskUtils";
import { deleteCachedTask, upsertCachedTask } from "./taskCacheRepository";

export const persistTaskRealtimePayload = async (
 ownerId: string,
 boardId: string,
 payload: RealtimePostgresChangesPayload<TaskRow>,
) => {
 if (payload.eventType === "DELETE") {
  const deletedId = payload.old.id;

  if (typeof deletedId === "string") {
   await deleteCachedTask(ownerId, deletedId);
  }

  return;
 }

 if (payload.new.board_id !== boardId) {
  return;
 }

 await upsertCachedTask(ownerId, mapTaskRow(payload.new));
};
