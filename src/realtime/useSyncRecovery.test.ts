import { renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useSyncRecovery } from "./useSyncRecovery"

const setVisibility = (value: string) => {
 Object.defineProperty(document, "visibilityState", { value, configurable: true })
}

describe("useSyncRecovery", () => {
 afterEach(() => {
  setVisibility("visible")
 })

 it("calls onRecover when the window comes back online", () => {
  const onRecover = vi.fn()
  renderHook(() => useSyncRecovery(onRecover))

  window.dispatchEvent(new Event("online"))

  expect(onRecover).toHaveBeenCalledTimes(1)
 })

 it("calls onRecover when the document becomes visible, but not when hidden", () => {
  const onRecover = vi.fn()
  renderHook(() => useSyncRecovery(onRecover))

  setVisibility("hidden")
  document.dispatchEvent(new Event("visibilitychange"))
  expect(onRecover).not.toHaveBeenCalled()

  setVisibility("visible")
  document.dispatchEvent(new Event("visibilitychange"))
  expect(onRecover).toHaveBeenCalledTimes(1)
 })

 it("does not attach listeners when disabled", () => {
  const onRecover = vi.fn()
  renderHook(() => useSyncRecovery(onRecover, false))

  window.dispatchEvent(new Event("online"))
  setVisibility("visible")
  document.dispatchEvent(new Event("visibilitychange"))

  expect(onRecover).not.toHaveBeenCalled()
 })

 it("calls the latest onRecover after it changes across renders", () => {
  const firstRecover = vi.fn()
  const secondRecover = vi.fn()
  const { rerender } = renderHook(({ onRecover }) => useSyncRecovery(onRecover), {
   initialProps: { onRecover: firstRecover },
  })

  rerender({ onRecover: secondRecover })
  window.dispatchEvent(new Event("online"))

  expect(firstRecover).not.toHaveBeenCalled()
  expect(secondRecover).toHaveBeenCalledTimes(1)
 })

 it("removes listeners on unmount", () => {
  const onRecover = vi.fn()
  const { unmount } = renderHook(() => useSyncRecovery(onRecover))

  unmount()
  window.dispatchEvent(new Event("online"))
  setVisibility("visible")
  document.dispatchEvent(new Event("visibilitychange"))

  expect(onRecover).not.toHaveBeenCalled()
 })
})
