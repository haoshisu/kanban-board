import "fake-indexeddb/auto"
import { deleteDB } from "idb"
import { beforeEach, describe, expect, it } from "vitest"
import type { Board } from "../board/types"
import type { Task } from "../task/types"
import { closeLocalReplicaDb, LOCAL_REPLICA_DB_NAME } from "./localReplicaDb"
import { deleteCachedBoard, readCachedBoards, replaceCachedBoards, upsertCachedBoard } from "./boardCacheRepository"
import {
 deleteCachedTask,
 deleteCachedTasksByBoard,
 readCachedTasks,
 replaceCachedTasks,
 upsertCachedTask,
} from "./taskCacheRepository"
import {
 acknowledgeMutation,
 readRunnableMutations,
 readPendingMutations,
 recordConflictFailure,
 recordTransientFailure,
 retryPendingMutationsNow,
 stageBoardDelete,
 stageBoardUpsert,
 stageTaskUpsert,
} from "./pendingMutationRepository"

const createBoard = (overrides: Partial<Board> = {}): Board => ({
 id: "board-1",
 name: "Board",
 description: "",
 statuses: [
  { key: "todo", title: "Todo" },
  { key: "inProgress", title: "In progress" },
  { key: "done", title: "Done" },
 ],
 version: 1,
 createdAt: "2026-01-01T00:00:00.000Z",
 updatedAt: "2026-01-01T00:00:00.000Z",
 ...overrides,
})

const createTask = (overrides: Partial<Task> = {}): Task => ({
 id: "task-1",
 boardId: "board-1",
 title: "Task",
 description: "",
 statusKey: "todo",
 position: 0,
 version: 1,
 createdAt: "2026-01-01T00:00:00.000Z",
 updatedAt: "2026-01-01T00:00:00.000Z",
 ...overrides,
})

beforeEach(async () => {
 await closeLocalReplicaDb()
 await deleteDB(LOCAL_REPLICA_DB_NAME)
})

describe("board cache repository", () => {
 it("isolates boards by owner", async () => {
  await replaceCachedBoards("owner-1", [createBoard()])

  expect(await readCachedBoards("owner-1")).toHaveLength(1)
  expect(await readCachedBoards("owner-2")).toEqual([])
 })

 it("does not overwrite a newer board", async () => {
  await upsertCachedBoard("owner-1", createBoard({ name: "New", version: 2 }))

  await upsertCachedBoard("owner-1", createBoard({ name: "Old", version: 1 }))

  expect(await readCachedBoards("owner-1")).toEqual([createBoard({ name: "New", version: 2 })])
 })

 it("replaces the owner snapshot and removes missing boards", async () => {
  await replaceCachedBoards("owner-1", [createBoard({ id: "board-1" }), createBoard({ id: "board-2" })])

  await replaceCachedBoards("owner-1", [createBoard({ id: "board-2", version: 2 })])

  expect(await readCachedBoards("owner-1")).toEqual([createBoard({ id: "board-2", version: 2 })])
 })

 it("deletes a cached board without affecting another owner", async () => {
  await replaceCachedBoards("owner-1", [createBoard()])
  await replaceCachedBoards("owner-2", [createBoard()])

  await deleteCachedBoard("owner-1", "board-1")

  expect(await readCachedBoards("owner-1")).toEqual([])
  expect(await readCachedBoards("owner-2")).toEqual([createBoard()])
 })
})

describe("task cache repository", () => {
 it("isolates tasks by board", async () => {
  await replaceCachedTasks("owner-1", "board-1", [createTask()])

  expect(await readCachedTasks("owner-1", "board-1")).toHaveLength(1)

  expect(await readCachedTasks("owner-1", "board-2")).toEqual([])
 })

 it("does not overwrite a newer task", async () => {
  await upsertCachedTask("owner-1", createTask({ title: "New", version: 2 }))

  await upsertCachedTask("owner-1", createTask({ title: "Old", version: 1 }))

  expect(await readCachedTasks("owner-1", "board-1")).toEqual([createTask({ title: "New", version: 2 })])
 })

 it("isolates tasks by owner", async () => {
  await replaceCachedTasks("owner-1", "board-1", [createTask()])

  expect(await readCachedTasks("owner-1", "board-1")).toEqual([createTask()])
  expect(await readCachedTasks("owner-2", "board-1")).toEqual([])
 })

 it("replaces a board snapshot and removes missing tasks", async () => {
  await replaceCachedTasks("owner-1", "board-1", [createTask({ id: "task-1" }), createTask({ id: "task-2" })])

  await replaceCachedTasks("owner-1", "board-1", [createTask({ id: "task-2", version: 2 })])

  expect(await readCachedTasks("owner-1", "board-1")).toEqual([createTask({ id: "task-2", version: 2 })])
 })

 it("deletes one task or all tasks for a board without affecting another board", async () => {
  await replaceCachedTasks("owner-1", "board-1", [createTask({ id: "task-1" }), createTask({ id: "task-2" })])
  await replaceCachedTasks("owner-1", "board-2", [createTask({ id: "task-3", boardId: "board-2" })])

  await deleteCachedTask("owner-1", "task-1")

  expect(await readCachedTasks("owner-1", "board-1")).toEqual([createTask({ id: "task-2" })])

  await deleteCachedTasksByBoard("owner-1", "board-1")

  expect(await readCachedTasks("owner-1", "board-1")).toEqual([])
  expect(await readCachedTasks("owner-1", "board-2")).toEqual([createTask({ id: "task-3", boardId: "board-2" })])
 })
})

describe("pending mutation repository", () => {
 it("atomically stores a board and its pending upsert", async () => {
  const board = createBoard()

  await stageBoardUpsert("owner-1", board)

  expect(await readCachedBoards("owner-1")).toEqual([board])
  expect(await readPendingMutations("owner-1")).toMatchObject([
   {
    entityType: "board",
    entityId: "board-1",
    operation: "upsert",
    baseVersion: 1,
    payload: board,
    status: "pending",
    nextAttemptAt: 0,
   },
  ])
 })

 it("coalesces repeated task updates while preserving the server base version", async () => {
  await stageTaskUpsert("owner-1", createTask({ title: "First", version: 2 }))
  await stageTaskUpsert("owner-1", createTask({ title: "Latest", version: 2 }))

  const mutations = await readPendingMutations("owner-1")

  expect(mutations).toHaveLength(1)
  expect(mutations[0]).toMatchObject({
   entityType: "task",
   operation: "upsert",
   baseVersion: 2,
   payload: { title: "Latest" },
  })
 })

 it("does not acknowledge a newer mutation with an older in-flight token", async () => {
  await stageTaskUpsert("owner-1", createTask({ title: "First", version: 1 }))
  const [inFlight] = await readPendingMutations("owner-1")
  await stageTaskUpsert("owner-1", createTask({ title: "Newer", version: 1 }))

  await acknowledgeMutation(inFlight, createTask({ title: "First", version: 2 }))

  expect(await readPendingMutations("owner-1")).toMatchObject([
   {
    baseVersion: 2,
    payload: { title: "Newer", version: 2 },
   },
  ])
  expect(await readCachedTasks("owner-1", "board-1")).toMatchObject([{ title: "Newer", version: 2 }])
 })

 it("delays transient failures without blocking other runnable mutations", async () => {
  await stageBoardUpsert("owner-1", createBoard({ id: "board-1" }))
  await stageBoardUpsert("owner-1", createBoard({ id: "board-2" }))
  const [firstMutation] = await readPendingMutations("owner-1")

  await recordTransientFailure(firstMutation, "network down")

  const pending = await readPendingMutations("owner-1")
  const failed = pending.find((mutation) => mutation.entityId === firstMutation.entityId)
  expect(failed).toMatchObject({
   status: "pending",
   failureKind: "transient",
   attempts: 1,
   lastError: "network down",
  })
  expect(failed?.nextAttemptAt).toBeGreaterThan(Date.now())
  expect(await readRunnableMutations("owner-1")).toHaveLength(1)

  await retryPendingMutationsNow("owner-1")
  expect(await readRunnableMutations("owner-1")).toHaveLength(2)
 })

 it("keeps version conflicts blocked until they are explicitly resolved", async () => {
  const localBoard = createBoard({ name: "Local", version: 5 })
  const remoteBoard = createBoard({ name: "Remote", version: 6 })
  await stageBoardUpsert("owner-1", localBoard)
  const [pendingMutation] = await readPendingMutations("owner-1")

  await recordConflictFailure(pendingMutation, "Board 已被其他裝置修改", {
   remoteVersion: remoteBoard.version,
   remotePayload: remoteBoard,
  })

  expect(await readPendingMutations("owner-1")).toMatchObject([
   {
    status: "blocked",
    failureKind: "conflict",
    lastError: "Board 已被其他裝置修改",
    conflict: {
     remoteVersion: 6,
     remotePayload: { name: "Remote" },
    },
   },
  ])
  expect(await readRunnableMutations("owner-1")).toEqual([])
 })

 it("deleting a board removes cached children and their pending writes", async () => {
  const board = createBoard()
  await stageBoardUpsert("owner-1", board)
  await stageTaskUpsert("owner-1", createTask())

  await stageBoardDelete("owner-1", board)

  expect(await readCachedBoards("owner-1")).toEqual([])
  expect(await readCachedTasks("owner-1", "board-1")).toEqual([])
  expect(await readPendingMutations("owner-1")).toMatchObject([
   {
    entityType: "board",
    entityId: "board-1",
    operation: "delete",
   },
  ])
 })
})
