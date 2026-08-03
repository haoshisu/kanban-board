import { beforeEach, describe, expect, it, vi } from "vitest"

const { getSupabaseMock } = vi.hoisted(() => ({
 getSupabaseMock: vi.fn(),
}))

vi.mock("../lib/supabase", () => ({ getSupabase: getSupabaseMock }))

import { getInviteErrorMessage, inviteBoardMember, listBoardMembers, removeBoardMember } from "./boardMembers"

beforeEach(() => {
 vi.clearAllMocks()
})

describe("listBoardMembers", () => {
 it("maps rows into BoardMember objects", async () => {
  const eq = vi.fn().mockResolvedValue({
   data: [
    { user_id: "user-1", role: "editor", profiles: { display_name: "Alice" } },
    { user_id: "user-2", role: "editor", profiles: null },
   ],
   error: null,
  })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select })
  getSupabaseMock.mockResolvedValue({ from })

  const members = await listBoardMembers("board-1")

  expect(from).toHaveBeenCalledWith("board_members")
  expect(eq).toHaveBeenCalledWith("board_id", "board-1")
  expect(members).toEqual([
   { userId: "user-1", role: "editor", displayName: "Alice" },
   { userId: "user-2", role: "editor", displayName: null },
  ])
 })

 it("throws when the query fails", async () => {
  const error = new Error("boom")
  const eq = vi.fn().mockResolvedValue({ data: null, error })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select })
  getSupabaseMock.mockResolvedValue({ from })

  await expect(listBoardMembers("board-1")).rejects.toThrow("boom")
 })
})

describe("inviteBoardMember", () => {
 it("calls the invite_board_member RPC with the board id and email", async () => {
  const rpc = vi.fn().mockResolvedValue({ error: null })
  getSupabaseMock.mockResolvedValue({ rpc })

  await inviteBoardMember("board-1", "friend@example.com")

  expect(rpc).toHaveBeenCalledWith("invite_board_member", {
   p_board_id: "board-1",
   p_email: "friend@example.com",
  })
 })

 it("throws the underlying error when the RPC fails", async () => {
  const rpc = vi.fn().mockResolvedValue({ error: new Error("user not found") })
  getSupabaseMock.mockResolvedValue({ rpc })

  await expect(inviteBoardMember("board-1", "nobody@example.com")).rejects.toThrow("user not found")
 })
})

describe("removeBoardMember", () => {
 it("deletes the board_members row for the given board and user", async () => {
  const eqUser = vi.fn().mockResolvedValue({ error: null })
  const eqBoard = vi.fn().mockReturnValue({ eq: eqUser })
  const del = vi.fn().mockReturnValue({ eq: eqBoard })
  const from = vi.fn().mockReturnValue({ delete: del })
  getSupabaseMock.mockResolvedValue({ from })

  await removeBoardMember("board-1", "user-1")

  expect(from).toHaveBeenCalledWith("board_members")
  expect(eqBoard).toHaveBeenCalledWith("board_id", "board-1")
  expect(eqUser).toHaveBeenCalledWith("user_id", "user-1")
 })

 it("throws when the delete fails", async () => {
  const error = new Error("boom")
  const eqUser = vi.fn().mockResolvedValue({ error })
  const eqBoard = vi.fn().mockReturnValue({ eq: eqUser })
  const del = vi.fn().mockReturnValue({ eq: eqBoard })
  const from = vi.fn().mockReturnValue({ delete: del })
  getSupabaseMock.mockResolvedValue({ from })

  await expect(removeBoardMember("board-1", "user-1")).rejects.toThrow("boom")
 })
})

describe("getInviteErrorMessage", () => {
 it.each([
  ["board not found", "找不到這個 board"],
  ["not authorized", "只有 board 建立者才能邀請協作者"],
  ["user not found", "找不到使用者，請確認對方 email 是否已註冊帳號"],
  ["cannot invite the board owner", "不能邀請自己"],
 ])("maps %s to a friendly message", (raw, friendly) => {
  expect(getInviteErrorMessage(new Error(raw))).toBe(friendly)
 })

 it("falls back to a generic message for unknown errors", () => {
  expect(getInviteErrorMessage(new Error("some unexpected db error"))).toBe("邀請失敗，請稍後再試")
  expect(getInviteErrorMessage("not an Error instance")).toBe("邀請失敗，請稍後再試")
 })
})
