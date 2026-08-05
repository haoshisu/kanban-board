import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { getSupabaseMock, captureAppErrorMock } = vi.hoisted(() => ({
 getSupabaseMock: vi.fn(),
 captureAppErrorMock: vi.fn(),
}))

vi.mock("../lib/supabase", () => ({ getSupabase: getSupabaseMock }))
vi.mock("../lib/errorReporting", () => ({ captureAppError: captureAppErrorMock }))

import { useRealtimeTableRefresh } from "./useRealtimeTableRefresh"

type SubscribeCallback = (status: string, error?: Error) => void
type ChangeHandler = (payload: unknown) => void

const buildChannel = () => {
 let subscribeCallback: SubscribeCallback = () => {}
 let changeHandler: ChangeHandler = () => {}

 const channel = {
  on: vi.fn((_event: string, _filter: unknown, handler: ChangeHandler) => {
   changeHandler = handler
   return channel
  }),
  subscribe: vi.fn((callback: SubscribeCallback) => {
   subscribeCallback = callback
   return channel
  }),
 }

 return {
  channel,
  fireStatus: (status: string, error?: Error) => subscribeCallback(status, error),
  fireChange: (payload: unknown) => changeHandler(payload),
 }
}

describe("useRealtimeTableRefresh", () => {
 beforeEach(() => {
  captureAppErrorMock.mockReset()
 })

 it("stays disabled and never calls getSupabase when enabled is false", () => {
  const onChange = vi.fn()
  const onRefresh = vi.fn()

  const { result } = renderHook(() =>
   useRealtimeTableRefresh({
    channelName: "boards",
    table: "boards",
    enabled: false,
    onChange,
    onRefresh,
   }),
  )

  expect(result.current).toBe("disabled")
  expect(getSupabaseMock).not.toHaveBeenCalled()
 })

 it("becomes connected and calls onRefresh once subscribed", async () => {
  const { channel, fireStatus } = buildChannel()
  const removeChannel = vi.fn()
  getSupabaseMock.mockResolvedValue({ channel: vi.fn(() => channel), removeChannel })
  const onChange = vi.fn()
  const onRefresh = vi.fn()

  const { result } = renderHook(() =>
   useRealtimeTableRefresh({
    channelName: "boards",
    table: "boards",
    enabled: true,
    onChange,
    onRefresh,
   }),
  )

  await waitFor(() => expect(channel.subscribe).toHaveBeenCalled())
  fireStatus("SUBSCRIBED")

  await waitFor(() => expect(result.current).toBe("connected"))
  await waitFor(() => expect(onRefresh).toHaveBeenCalled())
 })

 it("invokes onChange for incoming payloads but not after unmount", async () => {
  const { channel, fireChange } = buildChannel()
  getSupabaseMock.mockResolvedValue({ channel: vi.fn(() => channel), removeChannel: vi.fn() })
  const onChange = vi.fn()

  const { unmount } = renderHook(() =>
   useRealtimeTableRefresh({
    channelName: "boards",
    table: "boards",
    enabled: true,
    onChange,
    onRefresh: vi.fn(),
   }),
  )

  await waitFor(() => expect(channel.on).toHaveBeenCalled())

  fireChange({ eventType: "INSERT" })
  expect(onChange).toHaveBeenCalledWith({ eventType: "INSERT" })

  unmount()
  onChange.mockClear()
  fireChange({ eventType: "UPDATE" })
  expect(onChange).not.toHaveBeenCalled()
 })

 it("reports an error status on CHANNEL_ERROR", async () => {
  const { channel, fireStatus } = buildChannel()
  getSupabaseMock.mockResolvedValue({ channel: vi.fn(() => channel), removeChannel: vi.fn() })

  const { result } = renderHook(() =>
   useRealtimeTableRefresh({
    channelName: "boards",
    table: "boards",
    enabled: true,
    onChange: vi.fn(),
    onRefresh: vi.fn(),
   }),
  )

  await waitFor(() => expect(channel.subscribe).toHaveBeenCalled())
  const channelError = new Error("channel down")
  fireStatus("CHANNEL_ERROR", channelError)

  await waitFor(() => expect(result.current).toBe("error"))
  expect(captureAppErrorMock).toHaveBeenCalledWith(
   channelError,
   expect.objectContaining({ area: "realtime", action: "subscribe", table: "boards" }),
  )
 })

 it("reports an error status on TIMED_OUT", async () => {
  const { channel, fireStatus } = buildChannel()
  getSupabaseMock.mockResolvedValue({ channel: vi.fn(() => channel), removeChannel: vi.fn() })

  const { result } = renderHook(() =>
   useRealtimeTableRefresh({
    channelName: "boards",
    table: "boards",
    enabled: true,
    onChange: vi.fn(),
    onRefresh: vi.fn(),
   }),
  )

  await waitFor(() => expect(channel.subscribe).toHaveBeenCalled())
  fireStatus("TIMED_OUT")

  await waitFor(() => expect(result.current).toBe("error"))
  expect(captureAppErrorMock).toHaveBeenCalledWith(
   expect.any(Error),
   expect.objectContaining({ area: "realtime", action: "subscribe" }),
  )
 })

 it("captures an error when onRefresh rejects", async () => {
  const { channel, fireStatus } = buildChannel()
  getSupabaseMock.mockResolvedValue({ channel: vi.fn(() => channel), removeChannel: vi.fn() })
  const onRefresh = vi.fn().mockRejectedValue(new Error("refresh failed"))

  renderHook(() =>
   useRealtimeTableRefresh({
    channelName: "boards",
    table: "boards",
    enabled: true,
    onChange: vi.fn(),
    onRefresh,
   }),
  )

  await waitFor(() => expect(channel.subscribe).toHaveBeenCalled())
  fireStatus("SUBSCRIBED")

  await waitFor(() =>
   expect(captureAppErrorMock).toHaveBeenCalledWith(
    expect.any(Error),
    expect.objectContaining({ area: "realtime", action: "refresh" }),
   ),
  )
 })

 it("reports an error status when getSupabase rejects", async () => {
  getSupabaseMock.mockRejectedValue(new Error("no client"))

  const { result } = renderHook(() =>
   useRealtimeTableRefresh({
    channelName: "boards",
    table: "boards",
    enabled: true,
    onChange: vi.fn(),
    onRefresh: vi.fn(),
   }),
  )

  await waitFor(() => expect(result.current).toBe("error"))
  expect(captureAppErrorMock).toHaveBeenCalledWith(
   expect.any(Error),
   expect.objectContaining({ area: "realtime", action: "initialize" }),
  )
 })

 it("removes the channel on cleanup", async () => {
  const { channel } = buildChannel()
  const removeChannel = vi.fn()
  getSupabaseMock.mockResolvedValue({ channel: vi.fn(() => channel), removeChannel })

  const { unmount } = renderHook(() =>
   useRealtimeTableRefresh({
    channelName: "boards",
    table: "boards",
    enabled: true,
    onChange: vi.fn(),
    onRefresh: vi.fn(),
   }),
  )

  await waitFor(() => expect(channel.subscribe).toHaveBeenCalled())
  unmount()

  await waitFor(() => expect(removeChannel).toHaveBeenCalledWith(channel))
 })
})
