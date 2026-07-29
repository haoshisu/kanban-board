import { act, renderHook } from "@testing-library/react"
import type { RealtimePostgresUpdatePayload } from "@supabase/supabase-js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Board } from "./types"
import { defaultBoardStatuses } from "./boardStorage"
import { useBoards } from "./useBoards"
import type { BoardRow } from "./boardUtils"

const {
 captureAppErrorMock,
 getSupabaseMock,
 isLocalDataModeMock,
 loadBoardsMock,
 saveBoardsMock,
 readCachedBoardsMock,
 replaceCachedBoardsMock,
 deleteCachedBoardMock,
 deleteCachedTasksByBoardMock,
 upsertCachedBoardMock,
 enqueueLocalReplicaWriteMock,
 persistBoardRealtimePayloadMock,
 realtimeTableRefreshMock,
} = vi.hoisted(() => ({
 captureAppErrorMock: vi.fn(),
 getSupabaseMock: vi.fn(),
 isLocalDataModeMock: vi.fn(),
 loadBoardsMock: vi.fn(),
 saveBoardsMock: vi.fn(),
 readCachedBoardsMock: vi.fn(),
 replaceCachedBoardsMock: vi.fn(),
 deleteCachedBoardMock: vi.fn(),
 deleteCachedTasksByBoardMock: vi.fn(),
 upsertCachedBoardMock: vi.fn(),
 enqueueLocalReplicaWriteMock: vi.fn((_resourceKey: string, write: () => Promise<void>) => write()),
 persistBoardRealtimePayloadMock: vi.fn(),
 realtimeTableRefreshMock: vi.fn((options: unknown) => {
  void options
  return "connected"
 }),
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

vi.mock("./boardStorage", async (importOriginal) => {
 const actual = await importOriginal<typeof import("./boardStorage")>()

 return {
  ...actual,
  loadBoards: loadBoardsMock,
  saveBoards: saveBoardsMock,
 }
})

vi.mock("../sync/boardCacheRepository", () => ({
 deleteCachedBoard: deleteCachedBoardMock,
 readCachedBoards: readCachedBoardsMock,
 replaceCachedBoards: replaceCachedBoardsMock,
 upsertCachedBoard: upsertCachedBoardMock,
}))

vi.mock("../sync/taskCacheRepository", () => ({
 deleteCachedTasksByBoard: deleteCachedTasksByBoardMock,
}))

vi.mock("../sync/localReplicaWriteQueue", () => ({
 enqueueLocalReplicaWrite: enqueueLocalReplicaWriteMock,
}))

vi.mock("../sync/boardRealtimeCache", () => ({
 persistBoardRealtimePayload: persistBoardRealtimePayloadMock,
}))

vi.mock("../realtime/useRealtimeTableRefresh", () => ({
 useRealtimeTableRefresh: realtimeTableRefreshMock,
}))

const fixedNow = "2026-06-05T12:00:00.000Z"

const createBoardFixture = (overrides: Partial<Board> = {}): Board => ({
 id: "board-1",
 name: "產品開發",
 description: "Roadmap",
 statuses: defaultBoardStatuses,
 version: 1,
 createdAt: "2026-06-04T00:00:00.000Z",
 updatedAt: "2026-06-04T00:00:00.000Z",
 ...overrides,
})

const createBoardRow = (overrides: Partial<BoardRow> = {}): BoardRow => ({
 id: "board-1",
 owner_id: "owner-1",
 name: "產品開發",
 description: "Roadmap",
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

const createDeferred = <Value,>() => {
 let resolve!: (value: Value) => void

 const promise = new Promise<Value>((nextResolve) => {
  resolve = nextResolve
 })

 return { promise, resolve }
}

type BoardLoadResult = {
 data: BoardRow[]
 error: { message: string } | null
}

const createBoardSupabaseMock = ({
 loadResult = { data: [], error: null },
 loadPromise,
 insertResult = { data: null, error: null },
 insertThrows = null,
 updateResult = { data: null, error: null },
 updateThrows = null,
 deleteResult = { data: { id: "board-1" }, error: null },
 deleteThrows = null,
}: {
 loadResult?: BoardLoadResult
 loadPromise?: Promise<BoardLoadResult>
 insertResult?: { data: BoardRow | null; error: { message: string } | null }
 insertThrows?: Error | null
 updateResult?: { data: BoardRow | null; error: { message: string } | null }
 updateThrows?: Error | null
 deleteResult?: {
  data?: { id: string } | null
  error: { message: string } | null
 }
 deleteThrows?: Error | null
}) => {
 const orderMock = vi.fn(() => loadPromise ?? Promise.resolve(loadResult))
 const loadEqMock = vi.fn(() => ({ order: orderMock }))
 const loadSelectMock = vi.fn(() => ({ eq: loadEqMock }))

 const insertSingleMock = insertThrows
  ? vi.fn().mockRejectedValue(insertThrows)
  : vi.fn().mockResolvedValue(insertResult)
 const insertSelectMock = vi.fn(() => ({ single: insertSingleMock }))
 const insertMock = vi.fn(() => ({ select: insertSelectMock }))

 const updateMaybeSingleMock = updateThrows
  ? vi.fn().mockRejectedValue(updateThrows)
  : vi.fn().mockResolvedValue(updateResult)
 const updateSelectMock = vi.fn(() => ({
  maybeSingle: updateMaybeSingleMock,
 }))
 const updateVersionEqMock = vi.fn(() => ({ select: updateSelectMock }))
 const updateEqMock = vi.fn(() => ({ eq: updateVersionEqMock }))
 const updateMock = vi.fn(() => ({ eq: updateEqMock }))

 const deleteMaybeSingleMock = deleteThrows
  ? vi.fn().mockRejectedValue(deleteThrows)
  : vi.fn().mockResolvedValue(deleteResult)
 const deleteSelectMock = vi.fn(() => ({
  maybeSingle: deleteMaybeSingleMock,
 }))
 const deleteVersionEqMock = vi.fn(() => ({ select: deleteSelectMock }))
 const deleteEqMock = vi.fn(() => ({ eq: deleteVersionEqMock }))
 const deleteMock = vi.fn(() => ({ eq: deleteEqMock }))

 const fromMock = vi.fn(() => ({
  delete: deleteMock,
  insert: insertMock,
  select: loadSelectMock,
  update: updateMock,
 }))

 getSupabaseMock.mockResolvedValue({ from: fromMock })

 return {
  deleteEqMock,
  deleteMock,
  fromMock,
  insertMock,
  loadEqMock,
  updateMock,
 }
}

describe("useBoards local mode", () => {
 beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(fixedNow))
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "board-new") })

  isLocalDataModeMock.mockReturnValue(true)
  loadBoardsMock.mockReturnValue([])
 })

 afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
 })

 it("does not load boards when owner id is missing", () => {
  const { result } = renderHook(() => useBoards(undefined))

  expect(result.current.boards).toEqual([])
  expect(result.current.selectedBoard).toBeNull()
  expect(loadBoardsMock).not.toHaveBeenCalled()
  expect(getSupabaseMock).not.toHaveBeenCalled()
 })

 it("loads stored boards and selects the first board", async () => {
  const boards = [
   createBoardFixture({ id: "board-1", name: "第一個 board" }),
   createBoardFixture({ id: "board-2", name: "第二個 board" }),
  ]
  loadBoardsMock.mockReturnValue(boards)

  const { result } = renderHook(() => useBoards("owner-1"))

  await flushLocalEffect()

  expect(result.current.boards).toEqual(boards)
  expect(result.current.selectedBoard).toEqual(boards[0])
  expect(result.current.isLoadingBoards).toBe(false)
  expect(result.current.boardError).toBe("")
  expect(getSupabaseMock).not.toHaveBeenCalled()
 })

 it("selects a board", async () => {
  const boards = [createBoardFixture({ id: "board-1" }), createBoardFixture({ id: "board-2", name: "第二個 board" })]
  loadBoardsMock.mockReturnValue(boards)

  const { result } = renderHook(() => useBoards("owner-1"))

  await flushLocalEffect()
  expect(result.current.selectedBoard).toEqual(boards[0])

  act(() => {
   result.current.selectBoard("board-2")
  })

  expect(result.current.selectedBoard).toEqual(boards[1])
 })

 it("creates a board and saves it before the current boards", async () => {
  const existingBoard = createBoardFixture({ id: "board-1" })
  loadBoardsMock.mockReturnValue([existingBoard])

  const { result } = renderHook(() => useBoards("owner-1"))

  await flushLocalEffect()
  expect(result.current.boards).toEqual([existingBoard])

  let createdBoard: Board | null = null

  await act(async () => {
   createdBoard = await result.current.createBoard({
    name: "  新 board  ",
    description: "  新描述  ",
   })
  })

  const expectedBoard = {
   id: "board-new",
   name: "新 board",
   description: "新描述",
   statuses: defaultBoardStatuses,
   version: 0,
   createdAt: fixedNow,
   updatedAt: fixedNow,
  }

  expect(createdBoard).toEqual(expectedBoard)
  expect(result.current.boards).toEqual([expectedBoard, existingBoard])
  expect(result.current.selectedBoard).toEqual(expectedBoard)
  expect(saveBoardsMock).toHaveBeenCalledWith([expectedBoard, existingBoard])
  expect(getSupabaseMock).not.toHaveBeenCalled()
 })

 it("does not create a board with an empty name", async () => {
  const existingBoard = createBoardFixture({ id: "board-1" })
  loadBoardsMock.mockReturnValue([existingBoard])

  const { result } = renderHook(() => useBoards("owner-1"))

  await flushLocalEffect()
  expect(result.current.boards).toEqual([existingBoard])

  let createdBoard: Board | null = null

  await act(async () => {
   createdBoard = await result.current.createBoard({
    name: "   ",
    description: "描述",
   })
  })

  expect(createdBoard).toBeNull()
  expect(result.current.boards).toEqual([existingBoard])
  expect(saveBoardsMock).not.toHaveBeenCalled()
 })

 it("updates a board and saves the updated list", async () => {
  const board = createBoardFixture({ id: "board-1" })
  loadBoardsMock.mockReturnValue([board])

  const { result } = renderHook(() => useBoards("owner-1"))

  await flushLocalEffect()
  expect(result.current.boards).toEqual([board])

  let updatedBoard: Board | null = null

  await act(async () => {
   updatedBoard = await result.current.updateBoard("board-1", {
    name: "  已更新  ",
    description: "  新描述  ",
   })
  })

  const expectedBoard = {
   ...board,
   name: "已更新",
   description: "新描述",
   version: 2,
   updatedAt: fixedNow,
  }

  expect(updatedBoard).toEqual(expectedBoard)
  expect(result.current.boards).toEqual([expectedBoard])
  expect(saveBoardsMock).toHaveBeenCalledWith([expectedBoard])
 })

 it("does not update a board with an empty name", async () => {
  const board = createBoardFixture({ id: "board-1" })
  loadBoardsMock.mockReturnValue([board])

  const { result } = renderHook(() => useBoards("owner-1"))

  await flushLocalEffect()
  expect(result.current.boards).toEqual([board])

  let updatedBoard: Board | null = null

  await act(async () => {
   updatedBoard = await result.current.updateBoard("board-1", {
    name: "   ",
    description: "新描述",
   })
  })

  expect(updatedBoard).toBeNull()
  expect(result.current.boards).toEqual([board])
  expect(saveBoardsMock).not.toHaveBeenCalled()
 })

 it("deletes a board and selects the next available board", async () => {
  const boards = [createBoardFixture({ id: "board-1" }), createBoardFixture({ id: "board-2", name: "第二個 board" })]
  loadBoardsMock.mockReturnValue(boards)

  const { result } = renderHook(() => useBoards("owner-1"))

  await flushLocalEffect()
  expect(result.current.selectedBoard).toEqual(boards[0])

  await act(async () => {
   await result.current.deleteBoard("board-1")
  })

  expect(result.current.boards).toEqual([boards[1]])
  expect(result.current.selectedBoard).toEqual(boards[1])
  expect(saveBoardsMock).toHaveBeenCalledWith([boards[1]])
 })
})

// Remote writes moved to supabaseSyncEngine; these network-first expectations are
// retained as migration history and replaced by sync engine/outbox tests.
describe.skip("useBoards legacy network-first Supabase mode", () => {
 beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(fixedNow))
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "board-new") })

  isLocalDataModeMock.mockReturnValue(false)
  readCachedBoardsMock.mockResolvedValue([])
  replaceCachedBoardsMock.mockResolvedValue(undefined)
  deleteCachedBoardMock.mockResolvedValue(undefined)
  deleteCachedTasksByBoardMock.mockResolvedValue(undefined)
  upsertCachedBoardMock.mockResolvedValue(undefined)
  persistBoardRealtimePayloadMock.mockResolvedValue(undefined)
 })

 afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
 })

 it("loads boards from Supabase and selects the first board", async () => {
  const rows = [
   createBoardRow({ id: "board-1", name: "第一個 board" }),
   createBoardRow({ id: "board-2", name: "第二個 board" }),
  ]
  const { fromMock, loadEqMock } = createBoardSupabaseMock({
   loadResult: { data: rows, error: null },
  })

  const { result } = renderHook(() => useBoards("owner-1"))

  await flushLocalEffect()

  expect(fromMock).toHaveBeenCalledWith("boards")
  expect(loadEqMock).toHaveBeenCalledWith("owner_id", "owner-1")
  expect(result.current.boards).toEqual([
   createBoardFixture({
    id: "board-1",
    name: "第一個 board",
   }),
   createBoardFixture({
    id: "board-2",
    name: "第二個 board",
   }),
  ])
  expect(result.current.selectedBoard?.id).toBe("board-1")
  expect(result.current.isLoadingBoards).toBe(false)
 })

 it("hydrates cached boards before the Supabase snapshot completes", async () => {
  const snapshotDeferred = createDeferred<BoardLoadResult>()
  const cachedBoard = createBoardFixture({ id: "cached-board", name: "Cached board" })
  const serverRow = createBoardRow({ id: "server-board", name: "Server board" })

  readCachedBoardsMock.mockResolvedValue([cachedBoard])
  createBoardSupabaseMock({ loadPromise: snapshotDeferred.promise })

  const { result } = renderHook(() => useBoards("owner-1"))

  await flushLocalEffect()

  expect(result.current.boards).toEqual([cachedBoard])
  expect(result.current.selectedBoard).toEqual(cachedBoard)
  expect(result.current.isLoadingBoards).toBe(false)

  await act(async () => {
   snapshotDeferred.resolve({ data: [serverRow], error: null })
   await snapshotDeferred.promise
  })

  expect(result.current.boards).toEqual([
   createBoardFixture({ id: "server-board", name: "Server board" }),
  ])
 })

 it("does not let a slower cached board overwrite the Supabase snapshot", async () => {
  const cacheDeferred = createDeferred<Board[]>()
  const serverRow = createBoardRow({ id: "server-board", name: "Server board", version: 2 })

  readCachedBoardsMock.mockReturnValue(cacheDeferred.promise)
  createBoardSupabaseMock({
   loadResult: { data: [serverRow], error: null },
  })

  const { result } = renderHook(() => useBoards("owner-1"))

  await flushLocalEffect()

  expect(result.current.boards).toEqual([
   createBoardFixture({ id: "server-board", name: "Server board", version: 2 }),
  ])

  await act(async () => {
   cacheDeferred.resolve([createBoardFixture({ id: "cached-board", name: "Stale cache" })])
   await cacheDeferred.promise
  })

  expect(result.current.boards).toEqual([
   createBoardFixture({ id: "server-board", name: "Server board", version: 2 }),
  ])
 })

 it("does not let a slower cached board overwrite a Realtime update", async () => {
  const cacheDeferred = createDeferred<Board[]>()
  const snapshotDeferred = createDeferred<BoardLoadResult>()

  readCachedBoardsMock.mockReturnValue(cacheDeferred.promise)
  createBoardSupabaseMock({ loadPromise: snapshotDeferred.promise })

  const { result } = renderHook(() => useBoards("owner-1"))

  await flushLocalEffect()

  const realtimeOptions = realtimeTableRefreshMock.mock.calls.at(-1)?.[0] as
   | {
      onChange: (payload: RealtimePostgresUpdatePayload<BoardRow>) => void
     }
   | undefined

  if (!realtimeOptions) {
   throw new Error("Realtime options were not registered")
  }
  const realtimePayload: RealtimePostgresUpdatePayload<BoardRow> = {
   schema: "public",
   table: "boards",
   commit_timestamp: "2026-06-05T13:00:00.000Z",
   errors: [],
   eventType: "UPDATE",
   new: createBoardRow({ name: "Realtime board", version: 2 }),
   old: { id: "board-1", version: 1 },
  }

  act(() => {
   realtimeOptions.onChange(realtimePayload)
  })

  expect(persistBoardRealtimePayloadMock).toHaveBeenCalledWith(
   "owner-1",
   realtimePayload,
  )
  expect(result.current.boards).toEqual([
   createBoardFixture({ name: "Realtime board", version: 2 }),
  ])

  await act(async () => {
   cacheDeferred.resolve([createBoardFixture({ name: "Stale cache" })])
   await cacheDeferred.promise
  })

  expect(result.current.boards).toEqual([
   createBoardFixture({ name: "Realtime board", version: 2 }),
  ])
 })

 it("replays a Realtime update that arrives while a snapshot is loading", async () => {
  const snapshotDeferred = createDeferred<BoardLoadResult>()

  readCachedBoardsMock.mockResolvedValue([])
  createBoardSupabaseMock({ loadPromise: snapshotDeferred.promise })

  const { result } = renderHook(() => useBoards("owner-1"))

  await flushLocalEffect()

  const realtimeOptions = realtimeTableRefreshMock.mock.calls.at(-1)?.[0] as
   | {
      onChange: (payload: RealtimePostgresUpdatePayload<BoardRow>) => void
     }
   | undefined

  if (!realtimeOptions) {
   throw new Error("Realtime options were not registered")
  }

  const realtimePayload: RealtimePostgresUpdatePayload<BoardRow> = {
   schema: "public",
   table: "boards",
   commit_timestamp: "2026-06-05T13:00:00.000Z",
   errors: [],
   eventType: "UPDATE",
   new: createBoardRow({ name: "Realtime board", version: 2 }),
   old: { id: "board-1", version: 1 },
  }

  act(() => {
   realtimeOptions.onChange(realtimePayload)
  })

  await act(async () => {
   snapshotDeferred.resolve({
    data: [createBoardRow({ name: "Stale snapshot", version: 1 })],
    error: null,
   })
   await snapshotDeferred.promise
  })

  expect(result.current.boards).toEqual([
   createBoardFixture({ name: "Realtime board", version: 2 }),
  ])
  expect(replaceCachedBoardsMock).toHaveBeenLastCalledWith(
   "owner-1",
   [createBoardFixture({ name: "Realtime board", version: 2 })],
  )
 })

 it("ignores a cached board after switching owners", async () => {
  const firstOwnerCacheDeferred = createDeferred<Board[]>()
  const secondOwnerBoard = createBoardFixture({ id: "owner-2-board", name: "Owner 2 board" })

  readCachedBoardsMock.mockImplementation((ownerId: string) =>
   ownerId === "owner-1" ? firstOwnerCacheDeferred.promise : Promise.resolve([secondOwnerBoard]),
  )
  getSupabaseMock.mockReturnValue(new Promise(() => undefined))

  const { result, rerender } = renderHook(
   ({ ownerId }: { ownerId: string }) => useBoards(ownerId),
   { initialProps: { ownerId: "owner-1" } },
  )

  rerender({ ownerId: "owner-2" })
  await flushLocalEffect()

  expect(result.current.boards).toEqual([secondOwnerBoard])

  await act(async () => {
   firstOwnerCacheDeferred.resolve([
    createBoardFixture({ id: "owner-1-board", name: "Owner 1 board" }),
   ])
   await firstOwnerCacheDeferred.promise
  })

  expect(result.current.boards).toEqual([secondOwnerBoard])
 })

 it("continues loading Supabase boards when IndexedDB hydration fails", async () => {
  const cacheError = new Error("IndexedDB unavailable")
  const serverRow = createBoardRow({ id: "server-board", name: "Server board" })

  readCachedBoardsMock.mockRejectedValue(cacheError)
  createBoardSupabaseMock({
   loadResult: { data: [serverRow], error: null },
  })

  const { result } = renderHook(() => useBoards("owner-1"))

  await flushLocalEffect()

  expect(captureAppErrorMock).toHaveBeenCalledWith(cacheError, {
   area: "local-replica",
   action: "readBoards",
   ownerId: "owner-1",
  })
  expect(result.current.boards).toEqual([
   createBoardFixture({ id: "server-board", name: "Server board" }),
  ])
 })

 it("clears boards and shows the Supabase load error", async () => {
  createBoardSupabaseMock({
   loadResult: { data: [], error: { message: "Load failed" } },
  })

  const { result } = renderHook(() => useBoards("owner-1"))

  await flushLocalEffect()

  expect(result.current.boards).toEqual([])
  expect(result.current.selectedBoard).toBeNull()
  expect(result.current.boardError).toBe("Load failed")
  expect(result.current.isLoadingBoards).toBe(false)
 })

 it("captures thrown load errors and shows a fallback message", async () => {
  const error = new Error("network down")
  getSupabaseMock.mockRejectedValue(error)

  const { result } = renderHook(() => useBoards("owner-1"))

  await flushLocalEffect()

  expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
   area: "boards",
   action: "loadBoards",
   ownerId: "owner-1",
  })
  expect(result.current.boards).toEqual([])
  expect(result.current.boardError).toBe("載入 boards 時發生錯誤，請稍後再試")
 })

 it("creates a board and replaces the optimistic board with Supabase data", async () => {
  const existingRow = createBoardRow({ id: "board-1" })
  const createdRow = createBoardRow({
   id: "board-from-db",
   name: "新 board",
   description: "新描述",
   created_at: "2026-06-05T13:00:00.000Z",
   updated_at: "2026-06-05T13:00:00.000Z",
  })
  const { insertMock } = createBoardSupabaseMock({
   loadResult: { data: [existingRow], error: null },
   insertResult: { data: createdRow, error: null },
  })

  const { result } = renderHook(() => useBoards("owner-1"))
  await flushLocalEffect()

  let createdBoard: Board | null = null

  await act(async () => {
   createdBoard = await result.current.createBoard({
    name: "  新 board  ",
    description: "  新描述  ",
   })
  })

  const expectedBoard = createBoardFixture({
   id: "board-from-db",
   name: "新 board",
   description: "新描述",
   createdAt: "2026-06-05T13:00:00.000Z",
   updatedAt: "2026-06-05T13:00:00.000Z",
  })

  expect(insertMock).toHaveBeenCalledWith({
   id: "board-new",
   owner_id: "owner-1",
   name: "新 board",
   description: "新描述",
  })
  expect(createdBoard).toEqual(expectedBoard)
  expect(result.current.boards).toEqual([expectedBoard, createBoardFixture({ id: "board-1" })])
  expect(upsertCachedBoardMock).toHaveBeenCalledWith("owner-1", expectedBoard)
 })

 it("rolls back an optimistic board when create returns an error", async () => {
  const existingRow = createBoardRow({ id: "board-1" })
  createBoardSupabaseMock({
   loadResult: { data: [existingRow], error: null },
   insertResult: { data: null, error: { message: "Create failed" } },
  })

  const { result } = renderHook(() => useBoards("owner-1"))
  await flushLocalEffect()

  let createdBoard: Board | null = null

  await act(async () => {
   createdBoard = await result.current.createBoard({
    name: "新 board",
    description: "",
   })
  })

  expect(createdBoard).toBeNull()
  expect(result.current.boards).toEqual([createBoardFixture({ id: "board-1" })])
  expect(result.current.selectedBoard?.id).toBe("board-1")
  expect(result.current.boardError).toBe("Create failed")
 })

 it("captures thrown create errors and rolls back the optimistic board", async () => {
  const error = new Error("create exploded")
  createBoardSupabaseMock({
   loadResult: { data: [createBoardRow({ id: "board-1" })], error: null },
   insertThrows: error,
  })

  const { result } = renderHook(() => useBoards("owner-1"))
  await flushLocalEffect()

  let createdBoard: Board | null = null

  await act(async () => {
   createdBoard = await result.current.createBoard({
    name: "新 board",
    description: "",
   })
  })

  expect(createdBoard).toBeNull()
  expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
   area: "boards",
   action: "createBoard",
   ownerId: "owner-1",
  })
  expect(result.current.boards).toEqual([createBoardFixture({ id: "board-1" })])
  expect(result.current.boardError).toBe("建立 board 時發生錯誤，請稍後再試")
 })

 it("updates a board with Supabase data", async () => {
  const updatedRow = createBoardRow({
   id: "board-1",
   name: "已更新",
   description: "新描述",
   version: 2,
   updated_at: "2026-06-05T13:00:00.000Z",
  })
  const { updateMock } = createBoardSupabaseMock({
   loadResult: { data: [createBoardRow({ id: "board-1" })], error: null },
   updateResult: { data: updatedRow, error: null },
  })

  const { result } = renderHook(() => useBoards("owner-1"))
  await flushLocalEffect()

  let updatedBoard: Board | null = null

  await act(async () => {
   updatedBoard = await result.current.updateBoard("board-1", {
    name: "  已更新  ",
    description: "  新描述  ",
   })
  })

  expect(updateMock).toHaveBeenCalledWith({
   name: "已更新",
   description: "新描述",
   updated_at: fixedNow,
  })
  expect(updatedBoard).toEqual(
   createBoardFixture({
    id: "board-1",
    name: "已更新",
    description: "新描述",
    version: 2,
    updatedAt: "2026-06-05T13:00:00.000Z",
   }),
  )
  expect(result.current.boards[0]).toEqual(updatedBoard)
  expect(upsertCachedBoardMock).toHaveBeenCalledWith("owner-1", updatedBoard)
 })

 it("rolls back a board update when Supabase returns an error", async () => {
  const previousBoard = createBoardFixture({ id: "board-1" })
  createBoardSupabaseMock({
   loadResult: { data: [createBoardRow({ id: "board-1" })], error: null },
   updateResult: { data: null, error: { message: "Update failed" } },
  })

  const { result } = renderHook(() => useBoards("owner-1"))
  await flushLocalEffect()

  let updatedBoard: Board | null = null

  await act(async () => {
   updatedBoard = await result.current.updateBoard("board-1", {
    name: "已更新",
    description: "",
   })
  })

  expect(updatedBoard).toBeNull()
  expect(result.current.boards).toEqual([previousBoard])
  expect(result.current.boardError).toBe("Update failed")
 })

 it("captures thrown update errors and rolls back the optimistic board", async () => {
  const error = new Error("update exploded")
  const previousBoard = createBoardFixture({ id: "board-1" })
  createBoardSupabaseMock({
   loadResult: { data: [createBoardRow({ id: "board-1" })], error: null },
   updateThrows: error,
  })

  const { result } = renderHook(() => useBoards("owner-1"))
  await flushLocalEffect()

  let updatedBoard: Board | null = null

  await act(async () => {
   updatedBoard = await result.current.updateBoard("board-1", {
    name: "已更新",
    description: "",
   })
  })

  expect(updatedBoard).toBeNull()
  expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
   area: "boards",
   action: "updateBoard",
   boardId: "board-1",
  })
  expect(result.current.boards).toEqual([previousBoard])
  expect(result.current.boardError).toBe("更新 board 時發生錯誤，請稍後再試")
 })

 it("returns null without calling Supabase when updating a missing board", async () => {
  const { updateMock } = createBoardSupabaseMock({
   loadResult: { data: [createBoardRow({ id: "board-1" })], error: null },
  })

  const { result } = renderHook(() => useBoards("owner-1"))
  await flushLocalEffect()

  let updatedBoard: Board | null = null

  await act(async () => {
   updatedBoard = await result.current.updateBoard("missing-board", {
    name: "已更新",
    description: "",
   })
  })

  expect(updatedBoard).toBeNull()
  expect(updateMock).not.toHaveBeenCalled()
 })

 it("deletes a board through Supabase", async () => {
  const rows = [createBoardRow({ id: "board-1" }), createBoardRow({ id: "board-2", name: "第二個 board" })]
  const { deleteEqMock } = createBoardSupabaseMock({
   loadResult: { data: rows, error: null },
   deleteResult: { data: { id: "board-1" }, error: null },
  })

  const { result } = renderHook(() => useBoards("owner-1"))
  await flushLocalEffect()

  await act(async () => {
   await result.current.deleteBoard("board-1")
  })

  expect(deleteEqMock).toHaveBeenCalledWith("id", "board-1")
  expect(deleteCachedBoardMock).toHaveBeenCalledWith("owner-1", "board-1")
  expect(deleteCachedTasksByBoardMock).toHaveBeenCalledWith("owner-1", "board-1")
  expect(result.current.boards).toEqual([createBoardFixture({ id: "board-2", name: "第二個 board" })])
  expect(result.current.selectedBoard?.id).toBe("board-2")
 })

 it("rolls back a board delete when Supabase returns an error", async () => {
  const rows = [createBoardRow({ id: "board-1" }), createBoardRow({ id: "board-2", name: "第二個 board" })]
  createBoardSupabaseMock({
   loadResult: { data: rows, error: null },
   deleteResult: { error: { message: "Delete failed" } },
  })

  const { result } = renderHook(() => useBoards("owner-1"))
  await flushLocalEffect()

  await act(async () => {
   await result.current.deleteBoard("board-1")
  })

  expect(result.current.boards).toEqual([
   createBoardFixture({ id: "board-1" }),
   createBoardFixture({ id: "board-2", name: "第二個 board" }),
  ])
  expect(result.current.selectedBoard?.id).toBe("board-1")
  expect(result.current.boardError).toBe("Delete failed")
 })

 it("captures thrown delete errors and rolls back the deleted board", async () => {
  const error = new Error("delete exploded")
  const rows = [createBoardRow({ id: "board-1" }), createBoardRow({ id: "board-2", name: "第二個 board" })]
  createBoardSupabaseMock({
   loadResult: { data: rows, error: null },
   deleteThrows: error,
  })

  const { result } = renderHook(() => useBoards("owner-1"))
  await flushLocalEffect()

  await act(async () => {
   await result.current.deleteBoard("board-1")
  })

  expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
   area: "boards",
   action: "deleteBoard",
   boardId: "board-1",
  })
  expect(result.current.boards).toEqual([
   createBoardFixture({ id: "board-1" }),
   createBoardFixture({ id: "board-2", name: "第二個 board" }),
  ])
  expect(result.current.selectedBoard?.id).toBe("board-1")
  expect(result.current.boardError).toBe("刪除 board 時發生錯誤，請稍後再試")
 })

 it("returns null without Supabase when creating without owner id", async () => {
  const { result } = renderHook(() => useBoards(undefined))

  let createdBoard: Board | null = null

  await act(async () => {
   createdBoard = await result.current.createBoard({
    name: "新 board",
    description: "",
   })
  })

  expect(createdBoard).toBeNull()
  expect(getSupabaseMock).not.toHaveBeenCalled()
 })
})
