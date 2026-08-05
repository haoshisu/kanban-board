import { act, renderHook } from "@testing-library/react"
import type { RealtimePostgresUpdatePayload } from "@supabase/supabase-js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Board } from "./types"
import { defaultBoardStatuses } from "./boardStorage"
import { useBoards } from "./useBoards"
import type { BoardRow } from "./boardUtils"
import type { PendingMutation } from "../sync/localReplicaTypes"

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
 useOfflineSyncMock,
 stageBoardUpsertMock,
 stageBoardDeleteMock,
 requestSyncMock,
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
 useOfflineSyncMock: vi.fn(),
 stageBoardUpsertMock: vi.fn(),
 stageBoardDeleteMock: vi.fn(),
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

vi.mock("../sync/offlineSyncContext", () => ({
 useOfflineSync: useOfflineSyncMock,
}))

vi.mock("../sync/pendingMutationRepository", () => ({
 stageBoardUpsert: stageBoardUpsertMock,
 stageBoardDelete: stageBoardDeleteMock,
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

type BoardLoadResult = {
 data: BoardRow[]
 error: { message: string } | null
}

describe("useBoards local mode", () => {
 beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(fixedNow))
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "board-new") })

  isLocalDataModeMock.mockReturnValue(true)
  loadBoardsMock.mockReturnValue([])
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
   ownerId: "owner-1",
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

describe("useBoards network/staged-mutation mode", () => {
 const defaultOfflineSync = () => ({
  isOnline: true,
  isRemoteReady: true,
  mutations: [] as PendingMutation[],
  pendingEntityKeys: new Set<string>(),
  requestSync: requestSyncMock,
  retrySync: vi.fn(),
  syncRevision: 0,
  syncState: { status: "synced" as const, pendingCount: 0 },
 })

 const createBoardSelectMock = ({
  loadResult = { data: [], error: null },
  loadPromise,
 }: {
  loadResult?: BoardLoadResult
  loadPromise?: Promise<BoardLoadResult>
 }) => {
  const orderMock = vi.fn(() => loadPromise ?? Promise.resolve(loadResult))
  const loadSelectMock = vi.fn(() => ({ order: orderMock }))
  const fromMock = vi.fn(() => ({ select: loadSelectMock }))

  getSupabaseMock.mockResolvedValue({ from: fromMock })

  return { fromMock, loadSelectMock, orderMock }
 }

 beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(fixedNow))
  vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "board-new") })

  isLocalDataModeMock.mockReturnValue(false)
  readCachedBoardsMock.mockResolvedValue([])
  replaceCachedBoardsMock.mockResolvedValue(undefined)
  deleteCachedTasksByBoardMock.mockResolvedValue(undefined)
  persistBoardRealtimePayloadMock.mockResolvedValue(undefined)
  stageBoardUpsertMock.mockReset().mockResolvedValue(undefined)
  stageBoardDeleteMock.mockReset().mockResolvedValue(undefined)
  requestSyncMock.mockReset()
  useOfflineSyncMock.mockReturnValue(defaultOfflineSync())
  createBoardSelectMock({})
 })

 afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
 })

 it("hydrates from the cached replica on mount", async () => {
  const cachedBoard = createBoardFixture({ id: "cached-board", name: "Cached board" })
  readCachedBoardsMock.mockResolvedValue([cachedBoard])
  createBoardSelectMock({ loadPromise: new Promise(() => undefined) })

  const { result } = renderHook(() => useBoards("owner-1"))

  await flushLocalEffect()

  expect(readCachedBoardsMock).toHaveBeenCalledWith("owner-1")
  expect(result.current.boards).toEqual([cachedBoard])
 })

 it("stages a board upsert and requests a sync when creating a board", async () => {
  const existingRow = createBoardRow({ id: "board-1" })
  createBoardSelectMock({ loadResult: { data: [existingRow], error: null } })

  const { result } = renderHook(() => useBoards("owner-1"))
  await flushLocalEffect()

  let createdBoard: Board | null = null
  await act(async () => {
   createdBoard = await result.current.createBoard({ name: "新 board", description: "新描述" })
  })

  expect(createdBoard).not.toBeNull()
  expect(stageBoardUpsertMock).toHaveBeenCalledWith("owner-1", expect.objectContaining({ name: "新 board" }))
  expect(requestSyncMock).toHaveBeenCalled()
  expect(result.current.boards.some((board) => board.name === "新 board")).toBe(true)
 })

 it("rolls back an optimistic create and reports the error when staging fails", async () => {
  const error = new Error("stage failed")
  stageBoardUpsertMock.mockRejectedValue(error)

  const { result } = renderHook(() => useBoards("owner-1"))
  await flushLocalEffect()

  let createdBoard: Board | null = null
  await act(async () => {
   createdBoard = await result.current.createBoard({ name: "新 board", description: "" })
  })

  expect(createdBoard).toBeNull()
  expect(result.current.boards.some((board) => board.name === "新 board")).toBe(false)
  expect(result.current.boardError).toBe("無法把 Board 儲存到此裝置")
  expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
   area: "local-replica",
   action: "stageBoardCreate",
   ownerId: "owner-1",
  })
 })

 it("stages a board update and requests a sync", async () => {
  const existingRow = createBoardRow({ id: "board-1", name: "產品開發" })
  createBoardSelectMock({ loadResult: { data: [existingRow], error: null } })

  const { result } = renderHook(() => useBoards("owner-1"))
  await flushLocalEffect()

  let updatedBoard: Board | null = null
  await act(async () => {
   updatedBoard = await result.current.updateBoard("board-1", { name: "已更新", description: "新描述" })
  })

  expect(updatedBoard).not.toBeNull()
  expect(stageBoardUpsertMock).toHaveBeenCalledWith("owner-1", expect.objectContaining({ name: "已更新" }))
  expect(requestSyncMock).toHaveBeenCalled()
  expect(result.current.boards[0].name).toBe("已更新")
 })

 it("rolls back an optimistic update and reports the error when staging fails", async () => {
  const error = new Error("stage failed")
  const existingRow = createBoardRow({ id: "board-1", name: "產品開發" })
  createBoardSelectMock({ loadResult: { data: [existingRow], error: null } })
  stageBoardUpsertMock.mockRejectedValue(error)

  const { result } = renderHook(() => useBoards("owner-1"))
  await flushLocalEffect()

  let updatedBoard: Board | null = null
  await act(async () => {
   updatedBoard = await result.current.updateBoard("board-1", { name: "已更新", description: "" })
  })

  expect(updatedBoard).toBeNull()
  expect(result.current.boards[0].name).toBe("產品開發")
  expect(result.current.boardError).toBe("無法把 Board 修改儲存到此裝置")
  expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
   area: "local-replica",
   action: "stageBoardUpdate",
   ownerId: "owner-1",
  })
 })

 it("stages a board delete, removes it optimistically, and requests a sync", async () => {
  const rows = [createBoardRow({ id: "board-1" }), createBoardRow({ id: "board-2", name: "第二個 board" })]
  createBoardSelectMock({ loadResult: { data: rows, error: null } })

  const { result } = renderHook(() => useBoards("owner-1"))
  await flushLocalEffect()

  await act(async () => {
   await result.current.deleteBoard("board-1")
  })

  expect(stageBoardDeleteMock).toHaveBeenCalledWith("owner-1", expect.objectContaining({ id: "board-1" }))
  expect(requestSyncMock).toHaveBeenCalled()
  expect(result.current.boards.some((board) => board.id === "board-1")).toBe(false)
 })

 it("rolls back an optimistic delete and reports the error when staging fails", async () => {
  const error = new Error("stage failed")
  const rows = [createBoardRow({ id: "board-1" }), createBoardRow({ id: "board-2", name: "第二個 board" })]
  createBoardSelectMock({ loadResult: { data: rows, error: null } })
  stageBoardDeleteMock.mockRejectedValue(error)

  const { result } = renderHook(() => useBoards("owner-1"))
  await flushLocalEffect()

  await act(async () => {
   await result.current.deleteBoard("board-1")
  })

  expect(result.current.boards.some((board) => board.id === "board-1")).toBe(true)
  expect(result.current.boardError).toBe("無法在此裝置刪除 Board")
  expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
   area: "local-replica",
   action: "stageBoardDelete",
   ownerId: "owner-1",
  })
 })

 it("reconciles an incoming realtime update through the registered onChange handler", async () => {
  const existingRow = createBoardRow({ id: "board-1", version: 1 })
  createBoardSelectMock({ loadResult: { data: [existingRow], error: null } })

  const { result } = renderHook(() => useBoards("owner-1"))
  await flushLocalEffect()

  const realtimeOptions = realtimeTableRefreshMock.mock.calls.at(-1)?.[0] as
   | { onChange: (payload: RealtimePostgresUpdatePayload<BoardRow>) => void }
   | undefined
  if (!realtimeOptions) throw new Error("Realtime options were not registered")

  const realtimePayload: RealtimePostgresUpdatePayload<BoardRow> = {
   schema: "public",
   table: "boards",
   commit_timestamp: "2026-06-05T13:00:00.000Z",
   errors: [],
   eventType: "UPDATE",
   new: createBoardRow({ id: "board-1", name: "Realtime board", version: 2 }),
   old: { id: "board-1", version: 1 },
  }

  act(() => {
   realtimeOptions.onChange(realtimePayload)
  })

  expect(persistBoardRealtimePayloadMock).toHaveBeenCalledWith("owner-1", realtimePayload)
  expect(result.current.boards.find((board) => board.id === "board-1")?.name).toBe("Realtime board")
 })

 it("returns null without staging when creating without an owner id", async () => {
  const { result } = renderHook(() => useBoards(undefined))

  let createdBoard: Board | null = null
  await act(async () => {
   createdBoard = await result.current.createBoard({ name: "新 board", description: "" })
  })

  expect(createdBoard).toBeNull()
  expect(stageBoardUpsertMock).not.toHaveBeenCalled()
 })
})
