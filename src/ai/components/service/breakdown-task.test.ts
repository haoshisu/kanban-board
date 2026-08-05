import { beforeEach, describe, expect, it, vi } from "vitest"

const { getSupabaseMock } = vi.hoisted(() => ({ getSupabaseMock: vi.fn() }))

vi.mock("../../../lib/supabase", () => ({ getSupabase: getSupabaseMock }))

import { generateTaskBreakdown } from "./breakdown-task"

describe("generateTaskBreakdown", () => {
 const invokeMock = vi.fn()

 beforeEach(() => {
  invokeMock.mockReset()
  getSupabaseMock.mockReset()
  getSupabaseMock.mockResolvedValue({ functions: { invoke: invokeMock } })
 })

 it("returns a too_vague result for an empty prompt without calling the edge function", async () => {
  const result = await generateTaskBreakdown("")

  expect(result).toEqual({ ok: false, reason: "too_vague", message: "請輸入想拆解的需求" })
  expect(invokeMock).not.toHaveBeenCalled()
 })

 it("returns a too_vague result for a whitespace-only prompt", async () => {
  const result = await generateTaskBreakdown("   ")

  expect(result).toEqual({ ok: false, reason: "too_vague", message: "請輸入想拆解的需求" })
  expect(invokeMock).not.toHaveBeenCalled()
 })

 it("returns an invalid_response result when the edge function errors", async () => {
  invokeMock.mockResolvedValue({ data: null, error: { message: "boom" } })

  const result = await generateTaskBreakdown("拆解一個登入流程")

  expect(result).toEqual({ ok: false, reason: "invalid_response", message: "AI 拆任務失敗，請稍後再試" })
 })

 it("returns the edge function data verbatim on success", async () => {
  const data = { ok: true, tasks: [{ title: "設計登入頁", description: "", status: "todo" }] }
  invokeMock.mockResolvedValue({ data, error: null })

  const result = await generateTaskBreakdown("拆解一個登入流程")

  expect(result).toEqual(data)
 })

 it("calls the edge function with the untrimmed prompt", async () => {
  invokeMock.mockResolvedValue({ data: { ok: true, tasks: [] }, error: null })

  await generateTaskBreakdown("  拆解一個登入流程  ")

  expect(invokeMock).toHaveBeenCalledWith("breakdown-task", { body: { prompt: "  拆解一個登入流程  " } })
 })
})
