import { renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import type { PendingMutation } from "./localReplicaTypes"

const {
 captureAppErrorMock,
 isLocalDataModeMock,
 useOnlineStatusMock,
 readPendingMutationsMock,
 retryPendingMutationsNowMock,
 flushPendingMutationsMock,
} = vi.hoisted(() => ({
 captureAppErrorMock: vi.fn(),
 isLocalDataModeMock: vi.fn(),
 useOnlineStatusMock: vi.fn(),
 readPendingMutationsMock: vi.fn(),
 retryPendingMutationsNowMock: vi.fn(),
 flushPendingMutationsMock: vi.fn(),
}))

vi.mock("../lib/errorReporting", () => ({ captureAppError: captureAppErrorMock }))
vi.mock("../lib/localDataMode", () => ({ isLocalDataMode: isLocalDataModeMock }))
vi.mock("../realtime/useOnlineStatus", () => ({ useOnlineStatus: useOnlineStatusMock }))
vi.mock("./pendingMutationRepository", () => ({
 readPendingMutations: readPendingMutationsMock,
 retryPendingMutationsNow: retryPendingMutationsNowMock,
}))
vi.mock("./supabaseSyncEngine", () => ({ flushPendingMutations: flushPendingMutationsMock }))

import { OfflineSyncProvider } from "./OfflineSyncProvider"
import { useOfflineSync } from "./offlineSyncContext"

const mutation = (id: string): PendingMutation =>
 ({
  id,
  entityType: "board",
  entityId: id,
  ownerId: "owner-1",
 }) as unknown as PendingMutation

const wrapper = (ownerId?: string) =>
 function Wrapper({ children }: { children: ReactNode }) {
  return <OfflineSyncProvider ownerId={ownerId}>{children}</OfflineSyncProvider>
 }

const renderProvider = (ownerId?: string) => renderHook(() => useOfflineSync(), { wrapper: wrapper(ownerId) })

describe("OfflineSyncProvider", () => {
 beforeEach(() => {
  isLocalDataModeMock.mockReturnValue(false)
  useOnlineStatusMock.mockReturnValue(true)
  readPendingMutationsMock.mockReset().mockResolvedValue([])
  retryPendingMutationsNowMock.mockReset()
  flushPendingMutationsMock.mockReset().mockResolvedValue({ remaining: [], blockedCount: 0, nextRetryAt: undefined })
  captureAppErrorMock.mockReset()
 })

 afterEach(() => {
  vi.useRealTimers()
 })

 it("resets to synced immediately when there is no ownerId", async () => {
  const { result } = renderProvider(undefined)

  expect(result.current.syncState).toEqual({ status: "synced", pendingCount: 0 })
  expect(result.current.mutations).toEqual([])
  expect(result.current.isRemoteReady).toBe(true)
  expect(readPendingMutationsMock).not.toHaveBeenCalled()
 })

 it("resets to synced immediately in local data mode even with an ownerId", async () => {
  isLocalDataModeMock.mockReturnValue(true)
  const { result } = renderProvider("owner-1")

  expect(result.current.syncState).toEqual({ status: "synced", pendingCount: 0 })
  expect(readPendingMutationsMock).not.toHaveBeenCalled()
 })

 it("reports offline status without flushing when the network is down", async () => {
  useOnlineStatusMock.mockReturnValue(false)
  readPendingMutationsMock.mockResolvedValue([mutation("a"), mutation("b")])

  const { result } = renderProvider("owner-1")

  await waitFor(() => expect(result.current.syncState).toEqual({ status: "offline", pendingCount: 2 }))
  expect(flushPendingMutationsMock).not.toHaveBeenCalled()
 })

 it("syncs to a synced state on the happy path", async () => {
  readPendingMutationsMock.mockResolvedValue([mutation("a")])
  flushPendingMutationsMock.mockResolvedValue({ remaining: [], blockedCount: 0, nextRetryAt: undefined })

  const { result } = renderProvider("owner-1")

  await waitFor(() => expect(result.current.syncState).toEqual({ status: "synced", pendingCount: 0 }))
  await waitFor(() => expect(result.current.isRemoteReady).toBe(true))
 })

 it("reports a blocked status when the flush reports blocked mutations", async () => {
  readPendingMutationsMock.mockResolvedValue([mutation("a")])
  flushPendingMutationsMock.mockResolvedValue({
   remaining: [mutation("a")],
   blockedCount: 1,
   nextRetryAt: undefined,
  })

  const { result } = renderProvider("owner-1")

  await waitFor(() =>
   expect(result.current.syncState).toEqual({
    status: "blocked",
    pendingCount: 1,
    message: "1 項變更與遠端資料衝突，本機變更已保留",
   }),
  )
 })

 it("reports an error status when mutations remain without being blocked", async () => {
  readPendingMutationsMock.mockResolvedValue([mutation("a")])
  flushPendingMutationsMock.mockResolvedValue({
   remaining: [mutation("a")],
   blockedCount: 0,
   nextRetryAt: undefined,
  })

  const { result } = renderProvider("owner-1")

  await waitFor(() =>
   expect(result.current.syncState).toEqual({
    status: "error",
    pendingCount: 1,
    message: "部分變更將自動重試",
   }),
  )
 })

 it("schedules another sync when the flush reports a nextRetryAt", async () => {
  vi.useFakeTimers()
  readPendingMutationsMock.mockResolvedValue([])
  flushPendingMutationsMock.mockResolvedValue({
   remaining: [],
   blockedCount: 0,
   nextRetryAt: Date.now() + 5000,
  })

  renderProvider("owner-1")

  await vi.waitFor(() => expect(readPendingMutationsMock).toHaveBeenCalledTimes(1))

  await vi.advanceTimersByTimeAsync(5000)

  await vi.waitFor(() => expect(readPendingMutationsMock).toHaveBeenCalledTimes(2))
 })

 it("retries with exponential backoff when flushing throws", async () => {
  vi.useFakeTimers()
  readPendingMutationsMock.mockResolvedValueOnce([mutation("a")]).mockResolvedValue([mutation("a")])
  flushPendingMutationsMock.mockRejectedValue(new Error("boom"))

  const { result } = renderProvider("owner-1")

  await vi.waitFor(() =>
   expect(result.current.syncState).toEqual({ status: "error", pendingCount: 1, message: "boom" }),
  )
  expect(captureAppErrorMock).toHaveBeenCalledWith(
   expect.any(Error),
   expect.objectContaining({ area: "offline-sync", action: "flushPendingMutations" }),
  )

  await vi.advanceTimersByTimeAsync(1000)
  await vi.waitFor(() => expect(flushPendingMutationsMock).toHaveBeenCalledTimes(2))

  await vi.advanceTimersByTimeAsync(1999)
  expect(flushPendingMutationsMock).toHaveBeenCalledTimes(2)

  await vi.advanceTimersByTimeAsync(1)
  await vi.waitFor(() => expect(flushPendingMutationsMock).toHaveBeenCalledTimes(3))
 })

 it("does not update state after the effect is cancelled mid-flight", async () => {
  let resolveFlush: (value: unknown) => void = () => {}
  readPendingMutationsMock.mockResolvedValue([mutation("a")])
  flushPendingMutationsMock.mockReturnValue(
   new Promise((resolve) => {
    resolveFlush = resolve
   }),
  )

  const { unmount } = renderProvider("owner-1")

  await waitFor(() => expect(readPendingMutationsMock).toHaveBeenCalled())

  unmount()
  resolveFlush({ remaining: [], blockedCount: 0, nextRetryAt: undefined })

  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(captureAppErrorMock).not.toHaveBeenCalled()
 })

 it("retrySync calls retryPendingMutationsNow and triggers another sync", async () => {
  retryPendingMutationsNowMock.mockResolvedValue(undefined)

  const { result } = renderProvider("owner-1")
  await waitFor(() => expect(readPendingMutationsMock).toHaveBeenCalledTimes(1))

  result.current.retrySync()

  await waitFor(() => expect(retryPendingMutationsNowMock).toHaveBeenCalledWith("owner-1"))
  await waitFor(() => expect(readPendingMutationsMock).toHaveBeenCalledTimes(2))
 })

 it("retrySync reports an error when retryPendingMutationsNow rejects", async () => {
  retryPendingMutationsNowMock.mockRejectedValue(new Error("retry failed"))

  const { result } = renderProvider("owner-1")
  await waitFor(() => expect(readPendingMutationsMock).toHaveBeenCalledTimes(1))

  result.current.retrySync()

  await waitFor(() =>
   expect(captureAppErrorMock).toHaveBeenCalledWith(
    expect.any(Error),
    expect.objectContaining({ area: "offline-sync", action: "retryPendingMutationsNow" }),
   ),
  )
 })

 it("retrySync is a no-op without an ownerId", async () => {
  const { result } = renderProvider(undefined)

  result.current.retrySync()

  expect(retryPendingMutationsNowMock).not.toHaveBeenCalled()
 })

 it("triggers a sync only when the document becomes visible", async () => {
  Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true })

  renderProvider("owner-1")
  await waitFor(() => expect(readPendingMutationsMock).toHaveBeenCalledTimes(1))

  document.dispatchEvent(new Event("visibilitychange"))
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(readPendingMutationsMock).toHaveBeenCalledTimes(1)

  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })
  document.dispatchEvent(new Event("visibilitychange"))

  await waitFor(() => expect(readPendingMutationsMock).toHaveBeenCalledTimes(2))
 })

 it("does not attach a visibility listener in local data mode", async () => {
  isLocalDataModeMock.mockReturnValue(true)
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })

  renderProvider("owner-1")
  expect(readPendingMutationsMock).not.toHaveBeenCalled()

  document.dispatchEvent(new Event("visibilitychange"))
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(readPendingMutationsMock).not.toHaveBeenCalled()
 })
})
