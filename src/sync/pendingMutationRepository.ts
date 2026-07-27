import type { Board } from "../board/types"
import type { Task } from "../task/types"
import { getLocalReplicaDb } from "./localReplicaDb"
import type { MutationConflict, PendingEntityType, PendingMutation, PendingOperation } from "./localReplicaTypes"

const createMutationId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

const mutationKey = (
 ownerId: string,
 entityType: PendingEntityType,
 entityId: string,
): [string, PendingEntityType, string] => [ownerId, entityType, entityId]

const normalizePendingMutation = (mutation: PendingMutation): PendingMutation => ({
 ...mutation,
 status: mutation.status ?? "pending",
 nextAttemptAt: mutation.nextAttemptAt ?? 0,
})

const buildMutation = ({
 current,
 ownerId,
 entityType,
 entityId,
 boardId,
 operation,
 payload,
 baseVersion,
}: {
 current?: PendingMutation
 ownerId: string
 entityType: PendingEntityType
 entityId: string
 boardId?: string
 operation: PendingOperation
 payload: Board | Task | null
 baseVersion: number
}): PendingMutation => {
 const now = Date.now()

 return {
  ownerId,
  entityType,
  entityId,
  boardId,
  operation,
  mutationId: createMutationId(),
  baseVersion: current?.baseVersion ?? baseVersion,
  payload,
  createdAt: current?.createdAt ?? now,
  updatedAt: now,
  status: current?.status === "blocked" ? "blocked" : "pending",
  failureKind: current?.status === "blocked" ? current.failureKind : undefined,
  attempts: 0,
  nextAttemptAt: 0,
  lastError: current?.status === "blocked" ? current.lastError : undefined,
  conflict: current?.status === "blocked" ? current.conflict : undefined,
 }
}

export const readPendingMutations = async (ownerId: string) => {
 const database = await getLocalReplicaDb()
 const mutations = await database.getAllFromIndex("pendingMutations", "by-owner", ownerId)
 return mutations.map(normalizePendingMutation)
}

export const readRunnableMutations = async (ownerId: string, now = Date.now()) => {
 const mutations = await readPendingMutations(ownerId)
 return mutations.filter((mutation) => mutation.status === "pending" && mutation.nextAttemptAt <= now)
}

export const stageBoardUpsert = async (ownerId: string, board: Board) => {
 const database = await getLocalReplicaDb()
 const transaction = database.transaction(["boards", "pendingMutations"], "readwrite")
 const key = mutationKey(ownerId, "board", board.id)
 const current = await transaction.objectStore("pendingMutations").get(key)

 await transaction.objectStore("boards").put({
  ownerId,
  boardId: board.id,
  board,
  cachedAt: Date.now(),
 })
 await transaction.objectStore("pendingMutations").put(
  buildMutation({
   current,
   ownerId,
   entityType: "board",
   entityId: board.id,
   operation: "upsert",
   payload: board,
   baseVersion: board.version,
  }),
 )
 await transaction.done
}

export const stageTaskUpsert = async (ownerId: string, task: Task) => {
 const database = await getLocalReplicaDb()
 const transaction = database.transaction(["tasks", "pendingMutations"], "readwrite")
 const key = mutationKey(ownerId, "task", task.id)
 const current = await transaction.objectStore("pendingMutations").get(key)

 await transaction.objectStore("tasks").put({
  ownerId,
  boardId: task.boardId,
  taskId: task.id,
  task,
  cachedAt: Date.now(),
 })
 await transaction.objectStore("pendingMutations").put(
  buildMutation({
   current,
   ownerId,
   entityType: "task",
   entityId: task.id,
   boardId: task.boardId,
   operation: "upsert",
   payload: task,
   baseVersion: task.version,
  }),
 )
 await transaction.done
}

export const stageTaskDelete = async (ownerId: string, task: Task) => {
 const database = await getLocalReplicaDb()
 const transaction = database.transaction(["tasks", "pendingMutations"], "readwrite")
 const key = mutationKey(ownerId, "task", task.id)
 const current = await transaction.objectStore("pendingMutations").get(key)

 await transaction.objectStore("tasks").delete([ownerId, task.id])
 await transaction.objectStore("pendingMutations").put(
  buildMutation({
   current,
   ownerId,
   entityType: "task",
   entityId: task.id,
   boardId: task.boardId,
   operation: "delete",
   payload: null,
   baseVersion: task.version,
  }),
 )
 await transaction.done
}

export const stageBoardDelete = async (ownerId: string, board: Board) => {
 const database = await getLocalReplicaDb()
 const transaction = database.transaction(["boards", "tasks", "pendingMutations"], "readwrite")
 const mutationStore = transaction.objectStore("pendingMutations")
 const current = await mutationStore.get(mutationKey(ownerId, "board", board.id))
 const taskKeys = await transaction.objectStore("tasks").index("by-owner-board").getAllKeys([ownerId, board.id])
 const taskMutationKeys = await mutationStore.index("by-owner-board").getAllKeys([ownerId, board.id])

 await transaction.objectStore("boards").delete([ownerId, board.id])
 await Promise.all(taskKeys.map((key) => transaction.objectStore("tasks").delete(key)))
 await Promise.all(taskMutationKeys.map((key) => mutationStore.delete(key)))
 await mutationStore.put(
  buildMutation({
   current,
   ownerId,
   entityType: "board",
   entityId: board.id,
   operation: "delete",
   payload: null,
   baseVersion: board.version,
  }),
 )
 await transaction.done
}

const updateCurrentMutation = async (
 mutation: PendingMutation,
 update: (current: PendingMutation) => PendingMutation,
) => {
 const database = await getLocalReplicaDb()
 const transaction = database.transaction("pendingMutations", "readwrite")
 const key = mutationKey(mutation.ownerId, mutation.entityType, mutation.entityId)
 const current = await transaction.store.get(key)

 if (current?.mutationId === mutation.mutationId) {
  await transaction.store.put(update(normalizePendingMutation(current)))
 }
 await transaction.done
}

export const recordTransientFailure = async (mutation: PendingMutation, errorMessage: string) =>
 updateCurrentMutation(mutation, (current) => {
  const attempts = current.attempts + 1
  const delay = Math.min(30_000, 1_000 * 2 ** (attempts - 1))

  return {
   ...current,
   status: "pending",
   failureKind: "transient",
   attempts,
   nextAttemptAt: Date.now() + delay,
   lastError: errorMessage,
   conflict: undefined,
  }
 })

export const recordConflictFailure = async (
 mutation: PendingMutation,
 errorMessage: string,
 conflict: Omit<MutationConflict, "detectedAt">,
) =>
 updateCurrentMutation(mutation, (current) => ({
  ...current,
  status: "blocked",
  failureKind: "conflict",
  attempts: current.attempts + 1,
  nextAttemptAt: 0,
  lastError: errorMessage,
  conflict: {
   ...conflict,
   detectedAt: Date.now(),
  },
 }))

export const recordPermanentFailure = async (mutation: PendingMutation, errorMessage: string) =>
 updateCurrentMutation(mutation, (current) => ({
  ...current,
  status: "blocked",
  failureKind: "permanent",
  attempts: current.attempts + 1,
  nextAttemptAt: 0,
  lastError: errorMessage,
  conflict: undefined,
 }))

export const retryPendingMutationsNow = async (ownerId: string) => {
 const database = await getLocalReplicaDb()
 const transaction = database.transaction("pendingMutations", "readwrite")
 const mutations = await transaction.store.index("by-owner").getAll(ownerId)

 await Promise.all(
  mutations
   .map(normalizePendingMutation)
   .filter((mutation) => mutation.status === "pending")
   .map((mutation) =>
    transaction.store.put({
     ...mutation,
     nextAttemptAt: 0,
    }),
   ),
 )
 await transaction.done
}

export const acknowledgeMutation = async (mutation: PendingMutation, confirmedEntity?: Board | Task) => {
 const database = await getLocalReplicaDb()
 const stores =
  mutation.entityType === "board" ? (["boards", "pendingMutations"] as const) : (["tasks", "pendingMutations"] as const)
 const transaction = database.transaction(stores, "readwrite")
 const mutationStore = transaction.objectStore("pendingMutations")
 const key = mutationKey(mutation.ownerId, mutation.entityType, mutation.entityId)
 const current = await mutationStore.get(key)

 if (!current) {
  await transaction.done
  return
 }

 if (current.mutationId === mutation.mutationId) {
  await mutationStore.delete(key)

  if (confirmedEntity && mutation.entityType === "board") {
   const board = confirmedEntity as Board
   await transaction.objectStore("boards").put({
    ownerId: mutation.ownerId,
    boardId: board.id,
    board,
    cachedAt: Date.now(),
   })
  } else if (confirmedEntity && mutation.entityType === "task") {
   const task = confirmedEntity as Task
   await transaction.objectStore("tasks").put({
    ownerId: mutation.ownerId,
    boardId: task.boardId,
    taskId: task.id,
    task,
    cachedAt: Date.now(),
   })
  }
 } else if (confirmedEntity && current.operation === "upsert" && current.payload) {
  const version = confirmedEntity.version
  const payload = { ...current.payload, version }

  await mutationStore.put({
   ...normalizePendingMutation(current),
   baseVersion: version,
   payload,
   status: "pending",
   failureKind: undefined,
   attempts: 0,
   nextAttemptAt: 0,
   lastError: undefined,
   conflict: undefined,
  })

  if (current.entityType === "board") {
   const board = payload as Board
   await transaction.objectStore("boards").put({
    ownerId: current.ownerId,
    boardId: board.id,
    board,
    cachedAt: Date.now(),
   })
  } else {
   const task = payload as Task
   await transaction.objectStore("tasks").put({
    ownerId: current.ownerId,
    boardId: task.boardId,
    taskId: task.id,
    task,
    cachedAt: Date.now(),
   })
  }
 }

 await transaction.done
}

export const clearPendingMutations = async (ownerId: string) => {
 const database = await getLocalReplicaDb()
 const transaction = database.transaction("pendingMutations", "readwrite")
 const keys = await transaction.store.index("by-owner").getAllKeys(ownerId)
 await Promise.all(keys.map((key) => transaction.store.delete(key)))
 await transaction.done
}
