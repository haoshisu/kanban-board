import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Board } from "../board/types"
import type { Task } from "../task/types"
import type { PendingMutation } from "./localReplicaTypes"

const {
 getSupabaseMock,
 acknowledgeMutationMock,
 readPendingMutationsMock,
 readRunnableMutationsMock,
 recordConflictFailureMock,
 recordPermanentFailureMock,
 recordTransientFailureMock,
} = vi.hoisted(() => ({
 getSupabaseMock: vi.fn(),
 acknowledgeMutationMock: vi.fn(),
 readPendingMutationsMock: vi.fn(),
 readRunnableMutationsMock: vi.fn(),
 recordConflictFailureMock: vi.fn(),
 recordPermanentFailureMock: vi.fn(),
 recordTransientFailureMock: vi.fn(),
}))

vi.mock("../lib/supabase", () => ({ getSupabase: getSupabaseMock }))
vi.mock("./pendingMutationRepository", () => ({
 acknowledgeMutation: acknowledgeMutationMock,
 readPendingMutations: readPendingMutationsMock,
 readRunnableMutations: readRunnableMutationsMock,
 recordConflictFailure: recordConflictFailureMock,
 recordPermanentFailure: recordPermanentFailureMock,
 recordTransientFailure: recordTransientFailureMock,
}))

import { flushPendingMutations } from "./supabaseSyncEngine"

const board: Board = {
 id: "board-1",
 name: "Board",
 description: "",
 statuses: [],
 version: 0,
 createdAt: "2026-01-01T00:00:00.000Z",
 updatedAt: "2026-01-01T00:00:00.000Z",
}

const task: Task = {
 id: "task-1",
 boardId: board.id,
 title: "Task",
 description: "",
 statusKey: "todo",
 position: 0,
 version: 0,
 createdAt: board.createdAt,
 updatedAt: board.updatedAt,
}

const mutation = (
 entityType: "board" | "task",
 payload: Board | Task,
 createdAt: number,
 baseVersion = 0,
): PendingMutation => ({
 ownerId: "owner-1",
 entityType,
 entityId: payload.id,
 boardId: entityType === "task" ? (payload as Task).boardId : undefined,
 operation: "upsert",
 mutationId: `${entityType}-mutation`,
 baseVersion,
 payload,
 createdAt,
 updatedAt: createdAt,
 status: "pending",
 attempts: 0,
 nextAttemptAt: 0,
})

const boardRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
 id: board.id,
 owner_id: "owner-1",
 name: board.name,
 description: board.description,
 version: 1,
 created_at: board.createdAt,
 updated_at: board.updatedAt,
 ...overrides,
})

const taskRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
 id: task.id,
 board_id: task.boardId,
 title: task.title,
 description: task.description,
 status: "todo",
 position: task.position,
 version: 1,
 created_at: task.createdAt,
 updated_at: task.updatedAt,
 ...overrides,
})

const createQueryBuilder = (result: { data: Record<string, unknown> | null; error: unknown }) => {
 const builder = {
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
  maybeSingle: vi.fn(),
 }

 builder.insert.mockReturnValue(builder)
 builder.update.mockReturnValue(builder)
 builder.delete.mockReturnValue(builder)
 builder.eq.mockReturnValue(builder)
 builder.select.mockReturnValue(builder)
 builder.single.mockResolvedValue(result)
 builder.maybeSingle.mockResolvedValue(result)
 return builder
}

beforeEach(() => {
 vi.clearAllMocks()
 acknowledgeMutationMock.mockResolvedValue(undefined)
 readPendingMutationsMock.mockResolvedValue([])
 readRunnableMutationsMock.mockResolvedValue([])
 recordConflictFailureMock.mockResolvedValue(undefined)
 recordPermanentFailureMock.mockResolvedValue(undefined)
 recordTransientFailureMock.mockResolvedValue(undefined)
})

describe("flushPendingMutations", () => {
 it("creates a pending board before its task even when the task was queued first", async () => {
  const inserts: string[] = []
  const boardMutation = mutation("board", board, 2)
  const taskMutation = mutation("task", task, 1)
  readRunnableMutationsMock.mockResolvedValueOnce([taskMutation, boardMutation]).mockResolvedValueOnce([])

  getSupabaseMock.mockResolvedValue({
   from: (table: "boards" | "tasks") => ({
    select: () => ({
     eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
    }),
    insert: () => {
     inserts.push(table)
     return {
      select: () => ({
       single: async () => ({
        data:
         table === "boards"
          ? {
             id: board.id,
             owner_id: "owner-1",
             name: board.name,
             description: board.description,
             version: 1,
             created_at: board.createdAt,
             updated_at: board.updatedAt,
            }
          : {
             id: task.id,
             board_id: task.boardId,
             title: task.title,
             description: task.description,
             status: "todo",
             position: task.position,
             version: 1,
             created_at: task.createdAt,
             updated_at: task.updatedAt,
            },
        error: null,
       }),
      }),
     }
    },
   }),
  })

  await flushPendingMutations("owner-1")

  expect(inserts).toEqual(["boards", "tasks"])
  expect(acknowledgeMutationMock).toHaveBeenCalledTimes(2)
 })

 it("retains and schedules a mutation when the network write fails", async () => {
  const boardMutation = mutation("board", board, 1)
  readRunnableMutationsMock.mockResolvedValue([boardMutation])
  readPendingMutationsMock.mockResolvedValue([boardMutation])
  getSupabaseMock.mockRejectedValue(new Error("network down"))

  const result = await flushPendingMutations("owner-1")

  expect(result.retryingCount).toBe(1)
  expect(recordTransientFailureMock).toHaveBeenCalledWith(boardMutation, "network down")
  expect(acknowledgeMutationMock).not.toHaveBeenCalled()
 })

 it("uses the mutation baseVersion for a guarded board update", async () => {
  const localBoard = { ...board, name: "Local edit", version: 5 }
  const boardMutation = mutation("board", localBoard, 1, 5)
  const updateBuilder = createQueryBuilder({
   data: boardRow({ name: "Local edit", version: 6 }),
   error: null,
  })

  readRunnableMutationsMock.mockResolvedValue([boardMutation])
  getSupabaseMock.mockResolvedValue({
   from: vi.fn(() => updateBuilder),
  })

  await flushPendingMutations("owner-1")

  expect(updateBuilder.eq).toHaveBeenCalledWith("version", 5)
  expect(acknowledgeMutationMock).toHaveBeenCalledWith(
   boardMutation,
   expect.objectContaining({ name: "Local edit", version: 6 }),
  )
 })

 it("blocks a stale board update instead of rebasing it automatically", async () => {
  const localBoard = { ...board, name: "Local edit", version: 5 }
  const boardMutation = mutation("board", localBoard, 1, 5)
  const updateBuilder = createQueryBuilder({ data: null, error: null })
  const remoteBuilder = createQueryBuilder({
   data: boardRow({ name: "Remote edit", version: 6 }),
   error: null,
  })
  const fromMock = vi.fn().mockReturnValueOnce(updateBuilder).mockReturnValueOnce(remoteBuilder)
  const blockedMutation = {
   ...boardMutation,
   status: "blocked" as const,
   failureKind: "conflict" as const,
  }

  readRunnableMutationsMock.mockResolvedValue([boardMutation])
  readPendingMutationsMock.mockResolvedValue([blockedMutation])
  getSupabaseMock.mockResolvedValue({ from: fromMock })

  const result = await flushPendingMutations("owner-1")

  expect(updateBuilder.eq).toHaveBeenCalledWith("version", 5)
  expect(recordConflictFailureMock).toHaveBeenCalledWith(
   boardMutation,
   "Board 已被其他裝置修改",
   expect.objectContaining({
    remoteVersion: 6,
    remotePayload: expect.objectContaining({ name: "Remote edit", version: 6 }),
   }),
  )
  expect(result.blockedCount).toBe(1)
  expect(acknowledgeMutationMock).not.toHaveBeenCalled()
 })

 it("guards task deletion with the mutation baseVersion", async () => {
  const deleteMutation: PendingMutation = {
   ...mutation("task", { ...task, version: 5 }, 1, 5),
   operation: "delete",
   payload: null,
  }
  const deleteBuilder = createQueryBuilder({
   data: taskRow({ version: 5 }),
   error: null,
  })

  readRunnableMutationsMock.mockResolvedValue([deleteMutation])
  getSupabaseMock.mockResolvedValue({
   from: vi.fn(() => deleteBuilder),
  })

  await flushPendingMutations("owner-1")

  expect(deleteBuilder.eq).toHaveBeenCalledWith("version", 5)
  expect(acknowledgeMutationMock).toHaveBeenCalledWith(deleteMutation)
 })

 it("continues with an independent mutation after one mutation fails", async () => {
  const failedBoard = mutation("board", board, 1)
  const otherBoard = {
   ...board,
   id: "board-2",
   name: "Other board",
  }
  const successfulMutation = mutation("board", otherBoard, 2)
  const insertBuilder = createQueryBuilder({
   data: boardRow({
    id: otherBoard.id,
    name: otherBoard.name,
   }),
   error: null,
  })

  readRunnableMutationsMock.mockResolvedValue([failedBoard, successfulMutation])
  readPendingMutationsMock.mockResolvedValue([failedBoard])
  getSupabaseMock
   .mockRejectedValueOnce(new Error("network down"))
   .mockResolvedValue({ from: vi.fn(() => insertBuilder) })

  await flushPendingMutations("owner-1")

  expect(recordTransientFailureMock).toHaveBeenCalledWith(failedBoard, "network down")
  expect(acknowledgeMutationMock).toHaveBeenCalledWith(successfulMutation, expect.objectContaining({ id: "board-2" }))
 })
})
