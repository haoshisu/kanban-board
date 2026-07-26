import type { Board } from "../board/types";
import { mapBoardRow, type BoardRow } from "../board/boardUtils";
import { getSupabase } from "../lib/supabase";
import type { Task } from "../task/types";
import {
 mapTaskRow,
 statusKeyToDbStatus,
 type TaskRow,
} from "../task/taskUtils";
import type { PendingMutation } from "./localReplicaTypes";
import {
 acknowledgeMutation,
 readPendingMutations,
 recordMutationFailure,
} from "./pendingMutationRepository";

const BOARD_COLUMNS =
 "id, owner_id, name, description, version, created_at, updated_at" as const;
const TASK_COLUMNS =
 "id, board_id, title, description, status, position, version, created_at, updated_at" as const;
const MAX_CONFLICT_RETRIES = 3;

const ownerFlushes = new Map<string, Promise<void>>();

const getErrorMessage = (error: unknown) =>
 error instanceof Error ? error.message : "同步時發生未知錯誤";

const mutationPriority = (mutation: PendingMutation) => {
 if (mutation.entityType === "board" && mutation.operation === "upsert") return 0;
 if (mutation.entityType === "task" && mutation.operation === "upsert") return 1;
 if (mutation.entityType === "task" && mutation.operation === "delete") return 2;
 return 3;
};

const sortMutations = (mutations: PendingMutation[]) =>
 [...mutations].sort(
  (first, second) =>
   mutationPriority(first) - mutationPriority(second) ||
   first.createdAt - second.createdAt,
 );

const syncBoardUpsert = async (mutation: PendingMutation): Promise<Board> => {
 const board = mutation.payload as Board;
 const supabase = await getSupabase();

 for (let attempt = 0; attempt < MAX_CONFLICT_RETRIES; attempt += 1) {
  const remoteResult = await supabase
   .from("boards")
   .select(BOARD_COLUMNS)
   .eq("id", board.id)
   .maybeSingle();

  if (remoteResult.error) throw remoteResult.error;

  if (!remoteResult.data) {
   const insertResult = await supabase
    .from("boards")
    .insert({
     id: board.id,
     owner_id: mutation.ownerId,
     name: board.name,
     description: board.description,
     created_at: board.createdAt,
     updated_at: board.updatedAt,
    })
    .select(BOARD_COLUMNS)
    .single();

   if (insertResult.error) {
    // Insert 可能已成功但 response 在網路中遺失；重新讀取可安全重試。
    continue;
   }

   return mapBoardRow(insertResult.data as BoardRow);
  }

  const updateResult = await supabase
   .from("boards")
   .update({
    name: board.name,
    description: board.description,
    updated_at: board.updatedAt,
   })
   .eq("id", board.id)
   .eq("version", remoteResult.data.version)
   .select(BOARD_COLUMNS)
   .maybeSingle();

  if (updateResult.error) throw updateResult.error;
  if (updateResult.data) return mapBoardRow(updateResult.data as BoardRow);
 }

 throw new Error("Board 在同步期間持續被其他裝置更新，稍後會再試");
};

const syncTaskUpsert = async (mutation: PendingMutation): Promise<Task> => {
 const task = mutation.payload as Task;
 const supabase = await getSupabase();

 for (let attempt = 0; attempt < MAX_CONFLICT_RETRIES; attempt += 1) {
  const remoteResult = await supabase
   .from("tasks")
   .select(TASK_COLUMNS)
   .eq("id", task.id)
   .maybeSingle();

  if (remoteResult.error) throw remoteResult.error;

  if (!remoteResult.data) {
   const insertResult = await supabase
    .from("tasks")
    .insert({
     id: task.id,
     board_id: task.boardId,
     title: task.title,
     description: task.description,
     status: statusKeyToDbStatus[task.statusKey],
     position: task.position,
     created_at: task.createdAt,
     updated_at: task.updatedAt,
    })
    .select(TASK_COLUMNS)
    .single();

   if (insertResult.error) continue;
   return mapTaskRow(insertResult.data as TaskRow);
  }

  const updateResult = await supabase
   .from("tasks")
   .update({
    title: task.title,
    description: task.description,
    status: statusKeyToDbStatus[task.statusKey],
    position: task.position,
    updated_at: task.updatedAt,
   })
   .eq("id", task.id)
   .eq("version", remoteResult.data.version)
   .select(TASK_COLUMNS)
   .maybeSingle();

  if (updateResult.error) throw updateResult.error;
  if (updateResult.data) return mapTaskRow(updateResult.data as TaskRow);
 }

 throw new Error("Task 在同步期間持續被其他裝置更新，稍後會再試");
};

const syncDelete = async (mutation: PendingMutation) => {
 const supabase = await getSupabase();

 if (mutation.entityType === "task") {
  const result = await supabase.from("tasks").delete().eq("id", mutation.entityId);
  if (result.error) throw result.error;
  return;
 }

 const tasksResult = await supabase.from("tasks").delete().eq("board_id", mutation.entityId);
 if (tasksResult.error) throw tasksResult.error;

 const boardResult = await supabase.from("boards").delete().eq("id", mutation.entityId);
 if (boardResult.error) throw boardResult.error;
};

const syncOneMutation = async (mutation: PendingMutation) => {
 if (mutation.operation === "delete") {
  await syncDelete(mutation);
  await acknowledgeMutation(mutation);
  return;
 }

 const confirmed =
  mutation.entityType === "board"
   ? await syncBoardUpsert(mutation)
   : await syncTaskUpsert(mutation);

 await acknowledgeMutation(mutation, confirmed);
};

const runOwnerFlush = async (ownerId: string) => {
 // 重新讀取直到 outbox 為空，確保同步 request 期間新增的操作也會接著處理。
 while (true) {
  const mutations = sortMutations(await readPendingMutations(ownerId));
  if (mutations.length === 0) return;

  for (const mutation of mutations) {
   try {
    await syncOneMutation(mutation);
   } catch (error) {
    const message = getErrorMessage(error);
    await recordMutationFailure(mutation, message);
    throw new Error(message, { cause: error });
   }
  }
 }
};

export const flushPendingMutations = (ownerId: string) => {
 const running = ownerFlushes.get(ownerId);
 if (running) return running;

 const flush = runOwnerFlush(ownerId).finally(() => {
  if (ownerFlushes.get(ownerId) === flush) ownerFlushes.delete(ownerId);
 });

 ownerFlushes.set(ownerId, flush);
 return flush;
};
