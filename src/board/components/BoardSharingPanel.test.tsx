import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { BoardMember } from "../boardMembers"

const { listBoardMembersMock, inviteBoardMemberMock, removeBoardMemberMock } = vi.hoisted(() => ({
 listBoardMembersMock: vi.fn(),
 inviteBoardMemberMock: vi.fn(),
 removeBoardMemberMock: vi.fn(),
}))

vi.mock("../boardMembers", async () => {
 const actual = await vi.importActual<typeof import("../boardMembers")>("../boardMembers")
 return {
  ...actual,
  listBoardMembers: listBoardMembersMock,
  inviteBoardMember: inviteBoardMemberMock,
  removeBoardMember: removeBoardMemberMock,
 }
})

import { BoardSharingPanel } from "./BoardSharingPanel"

const members: BoardMember[] = [
 { userId: "owner-1", role: "owner", displayName: "Owner" },
 { userId: "editor-1", role: "editor", displayName: "Editor One" },
]

beforeEach(() => {
 vi.clearAllMocks()
 listBoardMembersMock.mockResolvedValue(members)
})

describe("BoardSharingPanel", () => {
 it("loads and shows the member list", async () => {
  render(<BoardSharingPanel boardId="board-1" onClose={vi.fn()} />)

  expect(await screen.findByText("Owner")).toBeInTheDocument()
  expect(screen.getByText("Editor One")).toBeInTheDocument()
  expect(listBoardMembersMock).toHaveBeenCalledWith("board-1")
 })

 it("shows a load error message when fetching members fails", async () => {
  listBoardMembersMock.mockRejectedValue(new Error("network down"))

  render(<BoardSharingPanel boardId="board-1" onClose={vi.fn()} />)

  expect(await screen.findByText("無法載入成員列表")).toBeInTheDocument()
 })

 it("requires an email before inviting", async () => {
  const user = userEvent.setup()
  render(<BoardSharingPanel boardId="board-1" onClose={vi.fn()} />)
  await screen.findByText("Owner")

  await user.click(screen.getByRole("button", { name: "送出邀請" }))

  expect(screen.getByText("請輸入 email")).toBeInTheDocument()
  expect(inviteBoardMemberMock).not.toHaveBeenCalled()
 })

 it("invites a member and refreshes the list on success", async () => {
  const user = userEvent.setup()
  inviteBoardMemberMock.mockResolvedValue(undefined)
  render(<BoardSharingPanel boardId="board-1" onClose={vi.fn()} />)
  await screen.findByText("Owner")

  await user.type(screen.getByPlaceholderText("對方的 email"), "friend@example.com")
  await user.click(screen.getByRole("button", { name: "送出邀請" }))

  await waitFor(() => expect(inviteBoardMemberMock).toHaveBeenCalledWith("board-1", "friend@example.com"))
  expect(listBoardMembersMock).toHaveBeenCalledTimes(2)
  expect(screen.getByPlaceholderText("對方的 email")).toHaveValue("")
 })

 it.each([
  ["user not found", "找不到使用者，請確認對方 email 是否已註冊帳號"],
  ["not authorized", "只有 board 建立者才能邀請協作者"],
  ["some unexpected db error", "邀請失敗，請稍後再試"],
 ])("shows a specific message when invite fails with %s", async (raw, friendly) => {
  const user = userEvent.setup()
  inviteBoardMemberMock.mockRejectedValue(new Error(raw))
  render(<BoardSharingPanel boardId="board-1" onClose={vi.fn()} />)
  await screen.findByText("Owner")

  await user.type(screen.getByPlaceholderText("對方的 email"), "friend@example.com")
  await user.click(screen.getByRole("button", { name: "送出邀請" }))

  expect(await screen.findByText(friendly)).toBeInTheDocument()
 })

 it("removes a member and refreshes the list on success", async () => {
  const user = userEvent.setup()
  removeBoardMemberMock.mockResolvedValue(undefined)
  render(<BoardSharingPanel boardId="board-1" onClose={vi.fn()} />)
  await screen.findByText("Editor One")

  await user.click(screen.getByRole("button", { name: "移除" }))

  await waitFor(() => expect(removeBoardMemberMock).toHaveBeenCalledWith("board-1", "editor-1"))
  expect(listBoardMembersMock).toHaveBeenCalledTimes(2)
 })

 it("does not offer a remove button for the owner", async () => {
  render(<BoardSharingPanel boardId="board-1" onClose={vi.fn()} />)
  await screen.findByText("Owner")

  expect(screen.getAllByRole("button", { name: "移除" })).toHaveLength(1)
 })

 it("shows an error message when removing a member fails", async () => {
  const user = userEvent.setup()
  removeBoardMemberMock.mockRejectedValue(new Error("boom"))
  render(<BoardSharingPanel boardId="board-1" onClose={vi.fn()} />)
  await screen.findByText("Editor One")

  await user.click(screen.getByRole("button", { name: "移除" }))

  expect(await screen.findByText("移除失敗，請稍後再試")).toBeInTheDocument()
 })

 it("calls onClose when the close button is clicked", async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(<BoardSharingPanel boardId="board-1" onClose={onClose} />)
  await screen.findByText("Owner")

  const closeButtons = screen.getAllByRole("button", { name: "關閉" })
  await user.click(closeButtons[closeButtons.length - 1])

  expect(onClose).toHaveBeenCalledTimes(1)
 })
})
