import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AiTaskBreakdownPanel } from "./AiTaskBreakdownPanel"
import type { AiTaskBreakdownResult } from "./AiTaskBreakdownPanel"
import type { BoardStatus } from "../../board"

const statuses: BoardStatus[] = [
 { key: "todo", title: "待處理" },
 { key: "inProgress", title: "進行中" },
]

const promptInput = () => screen.getByPlaceholderText("例如：做一個登入與註冊功能，包含錯誤提示和測試")

const renderPanel = (overrides: Partial<Parameters<typeof AiTaskBreakdownPanel>[0]> = {}) => {
 const onGenerateTasks = vi.fn<(prompt: string) => Promise<AiTaskBreakdownResult>>()
 const onCreateTasks = vi.fn()
 const utils = render(
  <AiTaskBreakdownPanel
   onCreateTasks={onCreateTasks}
   onGenerateTasks={onGenerateTasks}
   statuses={statuses}
   {...overrides}
  />,
 )
 return { onGenerateTasks, onCreateTasks, ...utils }
}

const generateSuccessfully = async (
 user: ReturnType<typeof userEvent.setup>,
 onGenerateTasks: ReturnType<typeof vi.fn>,
 result: AiTaskBreakdownResult,
) => {
 onGenerateTasks.mockResolvedValueOnce(result)
 await user.type(promptInput(), "拆解登入功能")
 await user.click(screen.getByRole("button", { name: "產生 tasks" }))
 await waitFor(() => expect(onGenerateTasks).toHaveBeenCalled())
}

describe("AiTaskBreakdownPanel", () => {
 afterEach(() => {
  vi.unstubAllGlobals()
 })

 it("shows an error and skips generation when the prompt is empty", async () => {
  const user = userEvent.setup()
  const { onGenerateTasks } = renderPanel()

  await user.click(screen.getByRole("button", { name: "產生 tasks" }))

  expect(onGenerateTasks).not.toHaveBeenCalled()
  expect(await screen.findByText("請輸入想拆解的需求")).toBeVisible()
 })

 it("renders the generated draft tasks pre-selected", async () => {
  const user = userEvent.setup()
  const { onGenerateTasks } = renderPanel()

  await generateSuccessfully(user, onGenerateTasks, {
   ok: true,
   tasks: [{ title: "設計登入頁", description: "含表單驗證", status: "todo" }],
  })

  expect(await screen.findByText("設計登入頁")).toBeVisible()
  expect(screen.getByText("含表單驗證")).toBeVisible()
  expect(screen.getByRole("checkbox")).toBeChecked()
  expect(screen.getByText("1 個已選")).toBeVisible()
 })

 it("shows the skeleton while generation is pending", async () => {
  const user = userEvent.setup()
  const { onGenerateTasks } = renderPanel()
  let resolveGenerate: (value: AiTaskBreakdownResult) => void = () => {}
  onGenerateTasks.mockReturnValueOnce(
   new Promise((resolve) => {
    resolveGenerate = resolve
   }),
  )

  await user.type(promptInput(), "拆解登入功能")
  await user.click(screen.getByRole("button", { name: "產生 tasks" }))

  expect(await screen.findByText("AI 正在重新拆解 tasks")).toBeVisible()

  resolveGenerate({ ok: true, tasks: [{ title: "設計登入頁", description: "", status: "todo" }] })

  await waitFor(() => expect(screen.queryByText("AI 正在重新拆解 tasks")).not.toBeInTheDocument())
 })

 it("shows the failure message when generation reports ok: false", async () => {
  const user = userEvent.setup()
  const { onGenerateTasks } = renderPanel()

  await generateSuccessfully(user, onGenerateTasks, {
   ok: false,
   reason: "invalid_response",
   message: "AI 拆任務失敗，請稍後再試",
  })

  expect(await screen.findByText("AI 拆任務失敗，請稍後再試")).toBeVisible()
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
 })

 it("shows a message when every generated task title is blank", async () => {
  const user = userEvent.setup()
  const { onGenerateTasks } = renderPanel()

  await generateSuccessfully(user, onGenerateTasks, {
   ok: true,
   tasks: [{ title: "   ", description: "", status: "todo" }],
  })

  expect(await screen.findByText("目前沒有產生可加入的 task，請換個描述再試一次")).toBeVisible()
 })

 it("falls back to the default status when the returned status is unknown", async () => {
  const user = userEvent.setup()
  const { onGenerateTasks } = renderPanel({ defaultStatusKey: "inProgress" })

  await generateSuccessfully(user, onGenerateTasks, {
   ok: true,
   tasks: [{ title: "設計登入頁", description: "", status: "not-a-real-status" as never }],
  })

  expect(await screen.findByText("進行中")).toBeVisible()
 })

 it("shows an error when generation throws", async () => {
  const user = userEvent.setup()
  const { onGenerateTasks } = renderPanel()
  onGenerateTasks.mockRejectedValueOnce(new Error("boom"))

  await user.type(promptInput(), "拆解登入功能")
  await user.click(screen.getByRole("button", { name: "產生 tasks" }))

  expect(await screen.findByText("AI 拆任務失敗，請稍後再試")).toBeVisible()
  expect(screen.getByRole("button", { name: "產生 tasks" })).toBeEnabled()
 })

 it("does not regenerate when the prompt is cleared before clicking regenerate", async () => {
  const user = userEvent.setup()
  const { onGenerateTasks } = renderPanel()

  await generateSuccessfully(user, onGenerateTasks, {
   ok: true,
   tasks: [{ title: "設計登入頁", description: "", status: "todo" }],
  })
  await screen.findByText("設計登入頁")

  await user.clear(promptInput())
  await user.click(screen.getByRole("button", { name: "重新產生" }))

  expect(onGenerateTasks).toHaveBeenCalledTimes(1)
  expect(await screen.findByText("請輸入想拆解的需求")).toBeVisible()
 })

 it("toggling a task updates the selected count and what gets created", async () => {
  const user = userEvent.setup()
  const { onGenerateTasks, onCreateTasks } = renderPanel()

  await generateSuccessfully(user, onGenerateTasks, {
   ok: true,
   tasks: [
    { title: "設計登入頁", description: "", status: "todo" },
    { title: "撰寫測試", description: "", status: "todo" },
   ],
  })
  await screen.findByText("設計登入頁")

  const checkboxes = screen.getAllByRole("checkbox")
  await user.click(checkboxes[0])
  expect(screen.getByText("1 個已選")).toBeVisible()

  onCreateTasks.mockResolvedValueOnce(undefined)
  await user.click(screen.getByRole("button", { name: "加入 1 個 tasks" }))

  await waitFor(() => expect(onCreateTasks).toHaveBeenCalledWith([{ title: "撰寫測試", description: "", statusKey: "todo" }]))
 })

 it("disables the create button when no tasks are selected", async () => {
  const user = userEvent.setup()
  const { onGenerateTasks } = renderPanel()

  await generateSuccessfully(user, onGenerateTasks, {
   ok: true,
   tasks: [{ title: "設計登入頁", description: "", status: "todo" }],
  })
  await screen.findByText("設計登入頁")

  await user.click(screen.getByRole("checkbox"))

  expect(screen.getByRole("button", { name: "加入 0 個 tasks" })).toBeDisabled()
 })

 it("resets state after successfully creating tasks", async () => {
  const user = userEvent.setup()
  const { onGenerateTasks, onCreateTasks } = renderPanel()

  await generateSuccessfully(user, onGenerateTasks, {
   ok: true,
   tasks: [{ title: "設計登入頁", description: "", status: "todo" }],
  })
  await screen.findByText("設計登入頁")

  onCreateTasks.mockResolvedValueOnce(undefined)
  await user.click(screen.getByRole("button", { name: "加入 1 個 tasks" }))

  await waitFor(() => expect(screen.queryByText("設計登入頁")).not.toBeInTheDocument())
  expect(promptInput()).toHaveValue("")
 })

 it("shows a failure message and keeps drafts when creating tasks rejects", async () => {
  const user = userEvent.setup()
  const { onGenerateTasks, onCreateTasks } = renderPanel()

  await generateSuccessfully(user, onGenerateTasks, {
   ok: true,
   tasks: [{ title: "設計登入頁", description: "", status: "todo" }],
  })
  await screen.findByText("設計登入頁")

  onCreateTasks.mockRejectedValueOnce(new Error("boom"))
  await user.click(screen.getByRole("button", { name: "加入 1 個 tasks" }))

  expect(await screen.findByText("加入 task 失敗，請稍後再試")).toBeVisible()
  expect(screen.getByText("設計登入頁")).toBeVisible()
 })

 it("does not render a description block when the description is blank", async () => {
  const user = userEvent.setup()
  const { onGenerateTasks } = renderPanel()

  await generateSuccessfully(user, onGenerateTasks, {
   ok: true,
   tasks: [{ title: "設計登入頁", description: "   ", status: "todo" }],
  })

  await screen.findByText("設計登入頁")
  expect(screen.queryByText("含表單驗證")).not.toBeInTheDocument()
 })

 it("disables all interactive elements when disabled is true", async () => {
  renderPanel({ disabled: true })

  expect(promptInput()).toBeDisabled()
  expect(screen.getByRole("button", { name: "產生 tasks" })).toBeDisabled()
 })

 it("still generates distinct draft ids when crypto.randomUUID is unavailable", async () => {
  vi.stubGlobal("crypto", undefined)
  const user = userEvent.setup()
  const { onGenerateTasks } = renderPanel()

  await generateSuccessfully(user, onGenerateTasks, {
   ok: true,
   tasks: [
    { title: "設計登入頁", description: "", status: "todo" },
    { title: "撰寫測試", description: "", status: "todo" },
   ],
  })

  expect(await screen.findByText("設計登入頁")).toBeVisible()
  expect(screen.getByText("撰寫測試")).toBeVisible()
  expect(screen.getAllByRole("checkbox")).toHaveLength(2)
 })
})
