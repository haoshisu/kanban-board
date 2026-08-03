import { mapBoardRow, type BoardRow } from "../board/boardUtils"
import type { Board } from "../board/types"
import { getSupabase } from "../lib/supabase"
import { mapTaskRow, statusKeyToDbStatus, type TaskRow } from "../task/taskUtils"
import type { Task } from "../task/types"
import type { PendingMutation } from "./localReplicaTypes"
import {
 acknowledgeMutation,
 readPendingMutations,
 readRunnableMutations,
 recordConflictFailure,
 recordPermanentFailure,
 recordTransientFailure,
} from "./pendingMutationRepository"
import { classifySyncError, SyncConflictError, type SyncConflictDetails } from "./syncError"

const BOARD_COLUMNS = "id, owner_id, name, description, version, created_at, updated_at" as const
const TASK_COLUMNS = "id, board_id, title, description, status, position, version, created_at, updated_at" as const
const MAX_FLUSH_PASSES = 10

export type FlushResult = {
 syncedCount: number
 retryingCount: number
 blockedCount: number
 remaining: PendingMutation[]
 nextRetryAt?: number
}

type FailedBoardCreate = {
 kind: "transient" | "conflict" | "permanent"
 message: string
}

const ownerFlushes = new Map<string, Promise<FlushResult>>()

const mutationPriority = (mutation: PendingMutation) => {
 if (mutation.entityType === "board" && mutation.operation === "upsert") return 0
 if (mutation.entityType === "task" && mutation.operation === "upsert") return 1
 if (mutation.entityType === "task" && mutation.operation === "delete") return 2
 return 3
}

const sortMutations = (mutations: PendingMutation[]) =>
 [...mutations].sort(
  (first, second) => mutationPriority(first) - mutationPriority(second) || first.createdAt - second.createdAt,
 )

const sameBoardContent = (remote: Board, local: Board) =>
 remote.id === local.id && remote.name === local.name && remote.description === local.description

const sameTaskContent = (remote: Task, local: Task) =>
 remote.id === local.id &&
 remote.boardId === local.boardId &&
 remote.title === local.title &&
 remote.description === local.description &&
 remote.statusKey === local.statusKey &&
 remote.position === local.position

const fetchRemoteBoard = async (boardId: string) => {
 const supabase = await getSupabase()
 const result = await supabase.from("boards").select(BOARD_COLUMNS).eq("id", boardId).maybeSingle()

 if (result.error) throw result.error
 return result.data ? mapBoardRow(result.data as BoardRow) : null
}

const fetchRemoteTask = async (taskId: string) => {
 const supabase = await getSupabase()
 const result = await supabase.from("tasks").select(TASK_COLUMNS).eq("id", taskId).maybeSingle()

 if (result.error) throw result.error
 return result.data ? mapTaskRow(result.data as TaskRow) : null
}

const conflict = (message: string, mutation: PendingMutation, remotePayload: Board | Task | null) =>
 new SyncConflictError(message, {
  entityId: mutation.entityId,
  baseVersion: mutation.baseVersion,
  remoteVersion: remotePayload?.version,
  localPayload: mutation.payload,
  remotePayload,
 })

const insertBoard = async (mutation: PendingMutation, board: Board): Promise<Board> => {
 const supabase = await getSupabase()
 const result = await supabase
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
  .single()

 if (!result.error) return mapBoardRow(result.data as BoardRow)

 const remoteBoard = await fetchRemoteBoard(board.id)
 if (!remoteBoard) throw result.error
 if (sameBoardContent(remoteBoard, board)) return remoteBoard

 throw conflict("相同 ID 的 Board 已存在不同內容", mutation, remoteBoard)
}

const updateBoard = async (mutation: PendingMutation, board: Board): Promise<Board> => {
 const supabase = await getSupabase()
 const result = await supabase
  .from("boards")
  .update({
   name: board.name,
   description: board.description,
   updated_at: board.updatedAt,
  })
  .eq("id", board.id)
  .eq("version", mutation.baseVersion)
  .select(BOARD_COLUMNS)
  .maybeSingle()

 if (result.error) throw result.error
 if (result.data) return mapBoardRow(result.data as BoardRow)

 const remoteBoard = await fetchRemoteBoard(board.id)
 throw conflict(remoteBoard ? "Board 已被其他裝置修改" : "Board 已被其他裝置刪除", mutation, remoteBoard)
}

const syncBoardUpsert = (mutation: PendingMutation) => {
 const board = mutation.payload as Board
 return mutation.baseVersion === 0 ? insertBoard(mutation, board) : updateBoard(mutation, board)
}

const insertTask = async (mutation: PendingMutation, task: Task): Promise<Task> => {
 const supabase = await getSupabase()
 const result = await supabase
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
  .single()

 if (!result.error) return mapTaskRow(result.data as TaskRow)

 const remoteTask = await fetchRemoteTask(task.id)
 if (!remoteTask) throw result.error
 if (sameTaskContent(remoteTask, task)) return remoteTask

 throw conflict("相同 ID 的 Task 已存在不同內容", mutation, remoteTask)
}

const updateTask = async (mutation: PendingMutation, task: Task): Promise<Task> => {
 const supabase = await getSupabase()
 const result = await supabase
  .from("tasks")
  .update({
   title: task.title,
   description: task.description,
   status: statusKeyToDbStatus[task.statusKey],
   position: task.position,
   updated_at: task.updatedAt,
  })
  .eq("id", task.id)
  .eq("version", mutation.baseVersion)
  .select(TASK_COLUMNS)
  .maybeSingle()

 if (result.error) throw result.error
 if (result.data) return mapTaskRow(result.data as TaskRow)

 const remoteTask = await fetchRemoteTask(task.id)
 throw conflict(remoteTask ? "Task 已被其他裝置修改" : "Task 已被其他裝置刪除", mutation, remoteTask)
}

const syncTaskUpsert = (mutation: PendingMutation) => {
 const task = mutation.payload as Task
 return mutation.baseVersion === 0 ? insertTask(mutation, task) : updateTask(mutation, task)
}

const deleteTask = async (mutation: PendingMutation) => {
 const supabase = await getSupabase()
 const result = await supabase
  .from("tasks")
  .delete()
  .eq("id", mutation.entityId)
  .eq("version", mutation.baseVersion)
  .select(TASK_COLUMNS)
  .maybeSingle()

 if (result.error) throw result.error
 if (result.data) return

 const remoteTask = await fetchRemoteTask(mutation.entityId)
 if (!remoteTask) return

 throw conflict("Task 已被修改，無法使用舊版本刪除", mutation, remoteTask)
}

const deleteBoard = async (mutation: PendingMutation) => {
 const supabase = await getSupabase()
 const { data, error } = await supabase
  .from("boards")
  .delete()
  .eq("id", mutation.entityId)
  .eq("version", mutation.baseVersion)
  .select(BOARD_COLUMNS)
  .maybeSingle()

 if (error) throw error
 if (data) return

 const remoteBoard = await fetchRemoteBoard(mutation.entityId)

 // 已被其他裝置刪除，視為刪除成功，保持 outbox idempotent
 if (!remoteBoard) return
 // Board 還存在，表示 version 不同
 throw conflict("Board 已被修改，無法使用舊版本刪除", mutation, remoteBoard)
}

const syncOneMutation = async (mutation: PendingMutation) => {
 if (mutation.operation === "delete") {
  if (mutation.entityType === "board") {
   await deleteBoard(mutation)
  } else {
   await deleteTask(mutation)
  }
  await acknowledgeMutation(mutation)
  return
 }

 const confirmed = mutation.entityType === "board" ? await syncBoardUpsert(mutation) : await syncTaskUpsert(mutation)

 await acknowledgeMutation(mutation, confirmed)
}

const recordFailure = async (mutation: PendingMutation, error: unknown): Promise<FailedBoardCreate> => {
 const failure = classifySyncError(error)

 if (failure.kind === "conflict") {
  const details = failure.conflict as SyncConflictDetails
  await recordConflictFailure(mutation, failure.message, {
   remoteVersion: details.remoteVersion,
   remotePayload: details.remotePayload,
  })
 } else if (failure.kind === "permanent") {
  await recordPermanentFailure(mutation, failure.message)
 } else {
  await recordTransientFailure(mutation, failure.message)
 }

 return {
  kind: failure.kind,
  message: failure.message,
 }
}

const deferDependentTask = async (mutation: PendingMutation, parentFailure: FailedBoardCreate) => {
 const message = `等待 Board 同步完成：${parentFailure.message}`

 if (parentFailure.kind === "transient") {
  await recordTransientFailure(mutation, message)
 } else {
  await recordPermanentFailure(mutation, message)
 }
}

const getNextRetryAt = (mutations: PendingMutation[]) => {
 const now = Date.now()
 return mutations
  .filter((mutation) => mutation.status === "pending")
  .reduce<number | undefined>((earliest, mutation) => {
   const retryAt = Math.max(now, mutation.nextAttemptAt)
   return earliest === undefined ? retryAt : Math.min(earliest, retryAt)
  }, undefined)
}

const runOwnerFlush = async (ownerId: string): Promise<FlushResult> => {
 const processedMutationIds = new Set<string>()
 const failedBoardCreates = new Map<string, FailedBoardCreate>()
 let syncedCount = 0

 for (let pass = 0; pass < MAX_FLUSH_PASSES; pass += 1) {
  const mutations = sortMutations(
   (await readRunnableMutations(ownerId)).filter((mutation) => !processedMutationIds.has(mutation.mutationId)),
  )

  if (mutations.length === 0) break

  for (const mutation of mutations) {
   processedMutationIds.add(mutation.mutationId)

   const parentFailure =
    mutation.entityType === "task" && mutation.boardId ? failedBoardCreates.get(mutation.boardId) : undefined

   if (parentFailure) {
    await deferDependentTask(mutation, parentFailure)
    continue
   }

   try {
    await syncOneMutation(mutation)
    syncedCount += 1
   } catch (error) {
    const failure = await recordFailure(mutation, error)
    const isBoardCreate =
     mutation.entityType === "board" && mutation.operation === "upsert" && mutation.baseVersion === 0

    if (isBoardCreate) {
     failedBoardCreates.set(mutation.entityId, failure)
    }
   }
  }
 }

 const remaining = await readPendingMutations(ownerId)
 return {
  syncedCount,
  retryingCount: remaining.filter((mutation) => mutation.status === "pending").length,
  blockedCount: remaining.filter((mutation) => mutation.status === "blocked").length,
  remaining,
  nextRetryAt: getNextRetryAt(remaining),
 }
}

export const flushPendingMutations = (ownerId: string) => {
 const running = ownerFlushes.get(ownerId)
 if (running) return running

 const flush = runOwnerFlush(ownerId).finally(() => {
  if (ownerFlushes.get(ownerId) === flush) ownerFlushes.delete(ownerId)
 })

 ownerFlushes.set(ownerId, flush)
 return flush
}
