import { act, renderHook } from "@testing-library/react"
import type {
 RealtimePostgresDeletePayload,
 RealtimePostgresUpdatePayload,
} from "@supabase/supabase-js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Task } from "./types"
import { useTasks } from "./useTasks"
import type { TaskRow } from "./taskUtils"
import type { PendingMutation } from "../sync/localReplicaTypes"

const {
 captureAppErrorMock,
 getSupabaseMock,
 isLocalDataModeMock,
 loadTasksMock,
 saveTasksMock,
 readCachedTasksMock,
 replaceCachedTasksMock,
 deleteCachedTaskMock,
 deleteCachedTasksByBoardMock,
 upsertCachedTaskMock,
 enqueueLocalReplicaWriteMock,
 persistTaskRealtimePayloadMock,
 realtimeTableRefreshMock,
 useOfflineSyncMock,
 stageTaskUpsertMock,
 stageTaskDeleteMock,
 requestSyncMock,
} = vi.hoisted(() => ({
 captureAppErrorMock: vi.fn(),
 getSupabaseMock: vi.fn(),
 isLocalDataModeMock: vi.fn(),
 loadTasksMock: vi.fn(),
 saveTasksMock: vi.fn(),
 readCachedTasksMock: vi.fn(),
 replaceCachedTasksMock: vi.fn(),
 deleteCachedTaskMock: vi.fn(),
 deleteCachedTasksByBoardMock: vi.fn(),
 upsertCachedTaskMock: vi.fn(),
 enqueueLocalReplicaWriteMock: vi.fn((_resourceKey: string, write: () => Promise<void>) => write()),
 persistTaskRealtimePayloadMock: vi.fn(),
 realtimeTableRefreshMock: vi.fn((options: unknown) => {
  void options
  return "connected"
 }),
 useOfflineSyncMock: vi.fn(),
 stageTaskUpsertMock: vi.fn(),
 stageTaskDeleteMock: vi.fn(),
 requestSyncMock: vi.fn(),
}))

vi.mock("../lib/errorReporting", () => ({
 captureAppError: captureAppErrorMock,
}))

vi.mock("../lib/localDataMode", () => ({
 isLocalDataMode: isLocalDataModeMock,
}))

vi.mock("../lib/supabase", () => ({
 getSupabase: getSupabaseMock,
}))

vi.mock("./taskStorage", () => ({
 loadTasks: loadTasksMock,
 saveTasks: saveTasksMock,
}))

vi.mock("../sync/taskCacheRepository", () => ({
 deleteCachedTask: deleteCachedTaskMock,
 deleteCachedTasksByBoard: deleteCachedTasksByBoardMock,
 readCachedTasks: readCachedTasksMock,
 replaceCachedTasks: replaceCachedTasksMock,
 upsertCachedTask: upsertCachedTaskMock,
}))

vi.mock("../sync/localReplicaWriteQueue", () => ({
 enqueueLocalReplicaWrite: enqueueLocalReplicaWriteMock,
}))

vi.mock("../sync/taskRealtimeCache", () => ({
 persistTaskRealtimePayload: persistTaskRealtimePayloadMock,
}))

vi.mock("../realtime/useRealtimeTableRefresh", () => ({
 useRealtimeTableRefresh: realtimeTableRefreshMock,
}))

vi.mock("../sync/offlineSyncContext", () => ({
 useOfflineSync: useOfflineSyncMock,
}))

vi.mock("../sync/pendingMutationRepository", () => ({
 stageTaskUpsert: stageTaskUpsertMock,
 stageTaskDelete: stageTaskDeleteMock,
}))

const fixedNow = "2026-06-05T12:00:00.000Z"

const createTaskFixture = (overrides: Partial<Task> = {}): Task => ({
 id: "task-1",
 boardId: "board-1",
 title: "設計登入流程",
 description: "Login UX",
 statusKey: "todo",
 position: 0,
 version: 1,
 createdAt: "2026-06-04T00:00:00.000Z",
 updatedAt: "2026-06-04T00:00:00.000Z",
 ...overrides,
})

const createTaskRow = (overrides: Partial<TaskRow> = {}): TaskRow => ({
 id: "task-1",
 board_id: "board-1",
 title: "設計登入流程",
 description: "Login UX",
 status: "todo",
 position: 0,
 version: 1,
 created_at: "2026-06-04T00:00:00.000Z",
 updated_at: "2026-06-04T00:00:00.000Z",
 ...overrides,
})

const flushLocalEffect = async () => {
 await act(async () => {
  await Promise.resolve()
 })
}

type TaskLoadResult = {
 data: TaskRow[]
 error: { message: string } | null
}

describe("useTasks local mode", () => {
 beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(fixedNow))
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "task-new") })

  isLocalDataModeMock.mockReturnValue(true)
  loadTasksMock.mockReturnValue([])
  useOfflineSyncMock.mockReturnValue({
   isOnline: true,
   isRemoteReady: true,
   mutations: [],
   pendingEntityKeys: new Set<string>(),
   requestSync: requestSyncMock,
   retrySync: vi.fn(),
   syncRevision: 0,
   syncState: { status: "synced", pendingCount: 0 },
  })
 })

 afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
 })

 it("returns empty tasks when board id is missing", () => {
  const { result } = renderHook(() => useTasks(null))

  expect(result.current.tasks).toEqual([])
  expect(loadTasksMock).not.toHaveBeenCalled()
  expect(getSupabaseMock).not.toHaveBeenCalled()
 })

 it("loads only tasks for the current board", async () => {
  const boardTask = createTaskFixture({ id: "task-1", boardId: "board-1" })
  const otherBoardTask = createTaskFixture({
   id: "task-2",
   boardId: "board-2",
   title: "其他 board task",
  })
  loadTasksMock.mockReturnValue([boardTask, otherBoardTask])

  const { result } = renderHook(() => useTasks("board-1"))

  await flushLocalEffect()

  expect(result.current.tasks).toEqual([boardTask])
  expect(result.current.isLoadingTasks).toBe(false)
  expect(result.current.taskError).toBe("")
  expect(getSupabaseMock).not.toHaveBeenCalled()
 })

 it("sorts tasks by status key and position", async () => {
  const tasks = [
   createTaskFixture({ id: "todo-2", statusKey: "todo", position: 2 }),
   createTaskFixture({ id: "done-1", statusKey: "done", position: 1 }),
   createTaskFixture({ id: "todo-0", statusKey: "todo", position: 0 }),
   createTaskFixture({ id: "done-0", statusKey: "done", position: 0 }),
  ]
  loadTasksMock.mockReturnValue(tasks)

  const { result } = renderHook(() => useTasks("board-1"))

  await flushLocalEffect()

  expect(result.current.tasks.map((task) => task.id)).toEqual(["done-0", "done-1", "todo-0", "todo-2"])
 })

 it("creates a task with the next position and saves all stored tasks", async () => {
  const existingTask = createTaskFixture({
   id: "task-1",
   statusKey: "todo",
   position: 2,
  })
  const otherBoardTask = createTaskFixture({
   id: "task-2",
   boardId: "board-2",
   title: "其他 board task",
  })
  loadTasksMock.mockReturnValue([existingTask, otherBoardTask])

  const { result } = renderHook(() => useTasks("board-1"))

  await flushLocalEffect()
  expect(result.current.tasks).toEqual([existingTask])

  let createdTask: Task | null = null

  await act(async () => {
   createdTask = await result.current.createTask({
    title: "  新 task  ",
    description: "  新描述  ",
    statusKey: "todo",
   })
  })

  const expectedTask = {
   id: "task-new",
   boardId: "board-1",
   title: "新 task",
   description: "新描述",
   statusKey: "todo" as const,
   position: 3,
   version: 0,
   createdAt: fixedNow,
   updatedAt: fixedNow,
  }

  expect(createdTask).toEqual(expectedTask)
  expect(result.current.tasks).toEqual([existingTask, expectedTask])
  expect(saveTasksMock).toHaveBeenCalledWith([existingTask, otherBoardTask, expectedTask])
 })

 it("does not create a task with an empty title", async () => {
  const existingTask = createTaskFixture({ id: "task-1" })
  loadTasksMock.mockReturnValue([existingTask])

  const { result } = renderHook(() => useTasks("board-1"))

  await flushLocalEffect()
  expect(result.current.tasks).toEqual([existingTask])

  let createdTask: Task | null = null

  await act(async () => {
   createdTask = await result.current.createTask({
    title: "   ",
    description: "新描述",
    statusKey: "todo",
   })
  })

  expect(createdTask).toBeNull()
  expect(result.current.tasks).toEqual([existingTask])
  expect(saveTasksMock).not.toHaveBeenCalled()
 })

 it("updates a task and recalculates position when status changes", async () => {
  const task = createTaskFixture({ id: "task-1", statusKey: "todo", position: 0 })
  const doneTask = createTaskFixture({
   id: "task-2",
   title: "已完成 task",
   statusKey: "done",
   position: 4,
  })
  loadTasksMock.mockReturnValue([task, doneTask])

  const { result } = renderHook(() => useTasks("board-1"))

  await flushLocalEffect()
  expect(result.current.tasks.map((currentTask) => currentTask.id)).toEqual(["task-2", "task-1"])

  let updatedTask: Task | null = null

  await act(async () => {
   updatedTask = await result.current.updateTask("task-1", {
    title: "  已更新  ",
    description: "  新描述  ",
    statusKey: "done",
   })
  })

  const expectedTask = {
   ...task,
   title: "已更新",
   description: "新描述",
   statusKey: "done" as const,
   position: 5,
   version: 2,
   updatedAt: fixedNow,
  }

  expect(updatedTask).toEqual(expectedTask)
  expect(result.current.tasks).toEqual([doneTask, expectedTask])
  expect(saveTasksMock).toHaveBeenCalledWith([expectedTask, doneTask])
 })

 it("deletes a task from state and storage", async () => {
  const task = createTaskFixture({ id: "task-1" })
  const otherTask = createTaskFixture({ id: "task-2", title: "保留 task" })
  loadTasksMock.mockReturnValue([task, otherTask])

  const { result } = renderHook(() => useTasks("board-1"))

  await flushLocalEffect()
  expect(result.current.tasks).toEqual([task, otherTask])

  await act(async () => {
   await result.current.deleteTask("task-1")
  })

  expect(result.current.tasks).toEqual([otherTask])
  expect(saveTasksMock).toHaveBeenCalledWith([otherTask])
 })

 it("moves a task to another status and saves the updated stored tasks", async () => {
  const task = createTaskFixture({ id: "task-1", statusKey: "todo", position: 0 })
  const doneTask = createTaskFixture({
   id: "task-2",
   title: "已完成 task",
   statusKey: "done",
   position: 2,
  })
  loadTasksMock.mockReturnValue([task, doneTask])

  const { result } = renderHook(() => useTasks("board-1"))

  await flushLocalEffect()
  expect(result.current.tasks.map((currentTask) => currentTask.id)).toEqual(["task-2", "task-1"])

  await act(async () => {
   await result.current.moveTaskStatus("task-1", "done")
  })

  const movedTask = {
   ...task,
   statusKey: "done" as const,
   position: 3,
   version: 2,
   updatedAt: fixedNow,
  }

  expect(result.current.tasks).toEqual([doneTask, movedTask])
  expect(saveTasksMock).toHaveBeenCalledWith([movedTask, doneTask])
 })

 it("does not save when moving a task to the same status", async () => {
  const task = createTaskFixture({ id: "task-1", statusKey: "todo" })
  loadTasksMock.mockReturnValue([task])

  const { result } = renderHook(() => useTasks("board-1"))

  await flushLocalEffect()
  expect(result.current.tasks).toEqual([task])

  await act(async () => {
   await result.current.moveTaskStatus("task-1", "todo")
  })

  expect(result.current.tasks).toEqual([task])
  expect(saveTasksMock).not.toHaveBeenCalled()
 })

 it("deletes tasks by board from state and storage", async () => {
  const boardTask = createTaskFixture({ id: "task-1", boardId: "board-1" })
  const otherBoardTask = createTaskFixture({
   id: "task-2",
   boardId: "board-2",
   title: "其他 board task",
  })
  loadTasksMock.mockReturnValue([boardTask, otherBoardTask])

  const { result } = renderHook(() => useTasks("board-1"))

  await flushLocalEffect()
  expect(result.current.tasks).toEqual([boardTask])

  await act(async () => {
   await result.current.deleteTasksByBoard("board-1")
  })

  expect(result.current.tasks).toEqual([])
  expect(saveTasksMock).toHaveBeenCalledWith([otherBoardTask])
 })
})

describe("useTasks network/staged-mutation mode", () => {
 const createTaskSelectMock = ({
  loadResult = { data: [], error: null },
  loadPromise,
 }: {
  loadResult?: TaskLoadResult
  loadPromise?: Promise<TaskLoadResult>
 }) => {
  const secondOrderMock = vi.fn(() => loadPromise ?? Promise.resolve(loadResult))
  const firstOrderMock = vi.fn(() => ({ order: secondOrderMock }))
  const loadEqMock = vi.fn(() => ({ order: firstOrderMock }))
  const loadSelectMock = vi.fn(() => ({ eq: loadEqMock }))
  const fromMock = vi.fn(() => ({ select: loadSelectMock }))

  getSupabaseMock.mockResolvedValue({ from: fromMock })

  return { fromMock, loadEqMock }
 }

 beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(fixedNow))
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "task-new") })

  isLocalDataModeMock.mockReturnValue(false)
  readCachedTasksMock.mockResolvedValue([])
  replaceCachedTasksMock.mockResolvedValue(undefined)
  deleteCachedTasksByBoardMock.mockResolvedValue(undefined)
  persistTaskRealtimePayloadMock.mockResolvedValue(undefined)
  stageTaskUpsertMock.mockReset().mockResolvedValue(undefined)
  stageTaskDeleteMock.mockReset().mockResolvedValue(undefined)
  requestSyncMock.mockReset()
  useOfflineSyncMock.mockReturnValue({
   isOnline: true,
   isRemoteReady: true,
   mutations: [] as PendingMutation[],
   pendingEntityKeys: new Set<string>(),
   requestSync: requestSyncMock,
   retrySync: vi.fn(),
   syncRevision: 0,
   syncState: { status: "synced" as const, pendingCount: 0 },
  })
  createTaskSelectMock({})
 })

 afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
 })

 it("hydrates from the cached replica on mount", async () => {
  const cachedTask = createTaskFixture({ id: "cached-task", title: "Cached task" })
  readCachedTasksMock.mockResolvedValue([cachedTask])
  createTaskSelectMock({ loadPromise: new Promise(() => undefined) })

  const { result } = renderHook(() => useTasks("board-1", "owner-1"))

  await flushLocalEffect()

  expect(readCachedTasksMock).toHaveBeenCalledWith("owner-1", "board-1")
  expect(result.current.tasks).toEqual([cachedTask])
 })

 it("stages a task upsert and requests a sync when creating a task", async () => {
  const existingRow = createTaskRow({ id: "task-1" })
  createTaskSelectMock({ loadResult: { data: [existingRow], error: null } })

  const { result } = renderHook(() => useTasks("board-1", "owner-1"))
  await flushLocalEffect()

  let createdTask: Task | null = null
  await act(async () => {
   createdTask = await result.current.createTask({ title: "新 task", description: "", statusKey: "todo" })
  })

  expect(createdTask).not.toBeNull()
  expect(stageTaskUpsertMock).toHaveBeenCalledWith("owner-1", expect.objectContaining({ title: "新 task" }))
  expect(requestSyncMock).toHaveBeenCalled()
  expect(result.current.tasks.some((task) => task.title === "新 task")).toBe(true)
 })

 it("rolls back an optimistic create and reports the error when staging fails", async () => {
  const error = new Error("stage failed")
  stageTaskUpsertMock.mockRejectedValue(error)

  const { result } = renderHook(() => useTasks("board-1", "owner-1"))
  await flushLocalEffect()

  let createdTask: Task | null = null
  await act(async () => {
   createdTask = await result.current.createTask({ title: "新 task", description: "", statusKey: "todo" })
  })

  expect(createdTask).toBeNull()
  expect(result.current.tasks.some((task) => task.title === "新 task")).toBe(false)
  expect(result.current.taskError).toBe("無法把 Task 儲存到此裝置")
  expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
   area: "local-replica",
   action: "stageTaskCreate",
   ownerId: "owner-1",
  })
 })

 it("stages a task update and requests a sync", async () => {
  const existingRow = createTaskRow({ id: "task-1", title: "設計登入流程" })
  createTaskSelectMock({ loadResult: { data: [existingRow], error: null } })

  const { result } = renderHook(() => useTasks("board-1", "owner-1"))
  await flushLocalEffect()

  let updatedTask: Task | null = null
  await act(async () => {
   updatedTask = await result.current.updateTask("task-1", {
    title: "已更新",
    description: "",
    statusKey: "todo",
   })
  })

  expect(updatedTask).not.toBeNull()
  expect(stageTaskUpsertMock).toHaveBeenCalledWith("owner-1", expect.objectContaining({ title: "已更新" }))
  expect(requestSyncMock).toHaveBeenCalled()
  expect(result.current.tasks[0].title).toBe("已更新")
 })

 it("rolls back an optimistic update and reports the error when staging fails", async () => {
  const error = new Error("stage failed")
  const existingRow = createTaskRow({ id: "task-1", title: "設計登入流程" })
  createTaskSelectMock({ loadResult: { data: [existingRow], error: null } })
  stageTaskUpsertMock.mockRejectedValue(error)

  const { result } = renderHook(() => useTasks("board-1", "owner-1"))
  await flushLocalEffect()

  let updatedTask: Task | null = null
  await act(async () => {
   updatedTask = await result.current.updateTask("task-1", {
    title: "已更新",
    description: "",
    statusKey: "todo",
   })
  })

  expect(updatedTask).toBeNull()
  expect(result.current.tasks[0].title).toBe("設計登入流程")
  expect(result.current.taskError).toBe("無法把 Task 修改儲存到此裝置")
  expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
   area: "local-replica",
   action: "stageTaskUpdate",
   ownerId: "owner-1",
  })
 })

 it("stages a task delete, removes it optimistically, and requests a sync", async () => {
  const rows = [createTaskRow({ id: "task-1" }), createTaskRow({ id: "task-2", title: "保留 task" })]
  createTaskSelectMock({ loadResult: { data: rows, error: null } })

  const { result } = renderHook(() => useTasks("board-1", "owner-1"))
  await flushLocalEffect()

  await act(async () => {
   await result.current.deleteTask("task-1")
  })

  expect(stageTaskDeleteMock).toHaveBeenCalledWith("owner-1", expect.objectContaining({ id: "task-1" }))
  expect(requestSyncMock).toHaveBeenCalled()
  expect(result.current.tasks.some((task) => task.id === "task-1")).toBe(false)
 })

 it("rolls back an optimistic delete and reports the error when staging fails", async () => {
  const error = new Error("stage failed")
  const rows = [createTaskRow({ id: "task-1" }), createTaskRow({ id: "task-2", title: "保留 task" })]
  createTaskSelectMock({ loadResult: { data: rows, error: null } })
  stageTaskDeleteMock.mockRejectedValue(error)

  const { result } = renderHook(() => useTasks("board-1", "owner-1"))
  await flushLocalEffect()

  await act(async () => {
   await result.current.deleteTask("task-1")
  })

  expect(result.current.tasks.some((task) => task.id === "task-1")).toBe(true)
  expect(result.current.taskError).toBe("無法在此裝置刪除 Task")
  expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
   area: "local-replica",
   action: "stageTaskDelete",
   ownerId: "owner-1",
  })
 })

 it("stages a task move and requests a sync", async () => {
  const existingRow = createTaskRow({ id: "task-1", status: "todo", position: 0 })
  createTaskSelectMock({ loadResult: { data: [existingRow], error: null } })

  const { result } = renderHook(() => useTasks("board-1", "owner-1"))
  await flushLocalEffect()

  await act(async () => {
   await result.current.moveTaskStatus("task-1", "done")
  })

  expect(stageTaskUpsertMock).toHaveBeenCalledWith(
   "owner-1",
   expect.objectContaining({ id: "task-1", statusKey: "done" }),
  )
  expect(requestSyncMock).toHaveBeenCalled()
  expect(result.current.tasks[0].statusKey).toBe("done")
 })

 it("rolls back a task move and reports the error when staging fails", async () => {
  const error = new Error("stage failed")
  const existingRow = createTaskRow({ id: "task-1", status: "todo", position: 0 })
  createTaskSelectMock({ loadResult: { data: [existingRow], error: null } })
  stageTaskUpsertMock.mockRejectedValue(error)

  const { result } = renderHook(() => useTasks("board-1", "owner-1"))
  await flushLocalEffect()

  await act(async () => {
   await result.current.moveTaskStatus("task-1", "done")
  })

  expect(result.current.tasks[0].statusKey).toBe("todo")
  expect(result.current.taskError).toBe("無法在此裝置儲存拖曳結果")
  expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
   area: "local-replica",
   action: "stageTaskMove",
   ownerId: "owner-1",
  })
 })

 it("deletes cached tasks by board", async () => {
  const rows = [createTaskRow({ id: "task-1", board_id: "board-1" })]
  createTaskSelectMock({ loadResult: { data: rows, error: null } })

  const { result } = renderHook(() => useTasks("board-1", "owner-1"))
  await flushLocalEffect()

  await act(async () => {
   await result.current.deleteTasksByBoard("board-1")
  })

  expect(deleteCachedTasksByBoardMock).toHaveBeenCalledWith("owner-1", "board-1")
  expect(result.current.tasks).toEqual([])
 })

 it("reconciles an incoming realtime update through the registered onChange handler", async () => {
  const existingRow = createTaskRow({ id: "task-1", version: 1 })
  createTaskSelectMock({ loadResult: { data: [existingRow], error: null } })

  const { result } = renderHook(() => useTasks("board-1", "owner-1"))
  await flushLocalEffect()

  const realtimeOptions = realtimeTableRefreshMock.mock.calls.at(-1)?.[0] as
   | { onChange: (payload: RealtimePostgresUpdatePayload<TaskRow>) => void }
   | undefined
  if (!realtimeOptions) throw new Error("Realtime options were not registered")

  const realtimePayload: RealtimePostgresUpdatePayload<TaskRow> = {
   schema: "public",
   table: "tasks",
   commit_timestamp: "2026-06-05T13:00:00.000Z",
   errors: [],
   eventType: "UPDATE",
   new: createTaskRow({ id: "task-1", title: "Realtime task", version: 2 }),
   old: { id: "task-1", version: 1 },
  }

  act(() => {
   realtimeOptions.onChange(realtimePayload)
  })

  expect(persistTaskRealtimePayloadMock).toHaveBeenCalledWith("owner-1", "board-1", realtimePayload)
  expect(result.current.tasks.find((task) => task.id === "task-1")?.title).toBe("Realtime task")
 })

 it("reconciles an incoming realtime delete through the registered onChange handler", async () => {
  const existingRow = createTaskRow({ id: "task-1" })
  createTaskSelectMock({ loadResult: { data: [existingRow], error: null } })

  const { result } = renderHook(() => useTasks("board-1", "owner-1"))
  await flushLocalEffect()

  const realtimeOptions = realtimeTableRefreshMock.mock.calls.at(-1)?.[0] as
   | { onChange: (payload: RealtimePostgresDeletePayload<TaskRow>) => void }
   | undefined
  if (!realtimeOptions) throw new Error("Realtime options were not registered")

  act(() => {
   realtimeOptions.onChange({
    schema: "public",
    table: "tasks",
    commit_timestamp: "2026-06-05T13:00:00.000Z",
    errors: [],
    eventType: "DELETE",
    new: {},
    old: { id: "task-1", version: 1 },
   })
  })

  expect(result.current.tasks.some((task) => task.id === "task-1")).toBe(false)
 })

 it("returns null without staging when creating without an owner id", async () => {
  const { result } = renderHook(() => useTasks("board-1"))

  let createdTask: Task | null = null
  await act(async () => {
   createdTask = await result.current.createTask({ title: "新 task", description: "", statusKey: "todo" })
  })

  expect(createdTask).toBeNull()
  expect(stageTaskUpsertMock).not.toHaveBeenCalled()
 })
})
