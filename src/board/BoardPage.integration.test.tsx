import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BoardPage from './BoardPage'
import type { Board } from './types'
import type { Task } from '../task'

vi.hoisted(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    disconnect() {}
    observe() {}
    unobserve() {}
  }
})

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
  setUser: vi.fn(),
  withScope: vi.fn((callback: (scope: unknown) => void) => {
    callback({
      setContext: vi.fn(),
      setTag: vi.fn(),
    })
  }),
}))

const localDataModeKey = 'kanban-board:e2e'
const boardStorageKey = 'kanban-board:boards'
const taskStorageKey = 'kanban-board:tasks'
const generatedId = '00000000-0000-4000-8000-000000000000'
const createdBoardId = '00000000-0000-4000-8000-000000000001'
const createdTaskId = '00000000-0000-4000-8000-000000000002'

const statuses = [
  { key: 'todo', title: '尚未開始' },
  { key: 'inProgress', title: '進行中' },
  { key: 'done', title: '已完成' },
] as const

const createBoard = (overrides: Partial<Board> = {}): Board => ({
  id: 'board-1',
  name: '產品開發',
  description: 'Roadmap',
  statuses: [...statuses],
  createdAt: '2026-06-04T00:00:00.000Z',
  updatedAt: '2026-06-04T00:00:00.000Z',
  ...overrides,
})

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  boardId: 'board-1',
  title: '設計登入流程',
  description: 'Login UX',
  statusKey: 'todo',
  position: 0,
  createdAt: '2026-06-04T00:00:00.000Z',
  updatedAt: '2026-06-04T00:00:00.000Z',
  ...overrides,
})

const renderBoardPage = () =>
  render(
    <BoardPage
      userEmail="you@example.com"
      userId="local-you@example.com"
      onLogout={vi.fn()}
    />,
  )

const readStoredBoards = () =>
  JSON.parse(localStorage.getItem(boardStorageKey) ?? '[]') as Board[]

const readStoredTasks = () =>
  JSON.parse(localStorage.getItem(taskStorageKey) ?? '[]') as Task[]

const storeBoards = (boards: Board[]) => {
  localStorage.setItem(boardStorageKey, JSON.stringify(boards))
}

const storeTasks = (tasks: Task[]) => {
  localStorage.setItem(taskStorageKey, JSON.stringify(tasks))
}

const getBoardForm = (submitName: string) =>
  screen.getByRole('button', { name: submitName }).closest('form') as HTMLFormElement

const createBoardFromUi = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
  description = `${name} description`,
) => {
  await user.click(screen.getByRole('button', { name: '+ 新增 Board' }))

  const form = getBoardForm('建立 board')

  await user.clear(within(form).getByLabelText('Board 名稱'))
  await user.type(within(form).getByLabelText('Board 名稱'), name)
  await user.clear(within(form).getByLabelText('描述'))
  await user.type(within(form).getByLabelText('描述'), description)
  await user.click(within(form).getByRole('button', { name: '建立 board' }))

  expect(await screen.findByRole('heading', { level: 2, name })).toBeVisible()
}

const createTaskFromUi = async (
  user: ReturnType<typeof userEvent.setup>,
  statusName: string,
  title: string,
  description = `${title} description`,
) => {
  const statusColumn = screen.getByLabelText(`${statusName} 欄位`)

  await user.click(within(statusColumn).getByRole('button', { name: '新增 task' }))
  await user.type(screen.getByLabelText('Task 標題'), title)
  await user.type(screen.getAllByLabelText('描述').at(-1) as HTMLElement, description)
  await user.click(screen.getByRole('button', { name: '建立 task' }))

  expect(
    await within(statusColumn).findByLabelText(`Task ${title}`),
  ).toBeVisible()
}

describe('BoardPage integration', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(localDataModeKey, 'true')
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => generatedId),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('creates and selects a board while saving it to local storage', async () => {
    const user = userEvent.setup()

    vi.mocked(crypto.randomUUID).mockReturnValueOnce(createdBoardId)
    renderBoardPage()

    expect(await screen.findByText('尚未建立 board')).toBeVisible()

    await createBoardFromUi(user, '產品開發', 'Roadmap')

    expect(screen.getByRole('article', { name: 'Board 產品開發' })).toBeVisible()
    expect(screen.getAllByText('Roadmap')).toHaveLength(2)

    expect(readStoredBoards()).toEqual([
      {
        id: createdBoardId,
        name: '產品開發',
        description: 'Roadmap',
        statuses: [...statuses],
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    ])
  })

  it('updates a board in the UI and local storage', async () => {
    const user = userEvent.setup()

    storeBoards([createBoard()])
    renderBoardPage()

    expect(await screen.findByRole('heading', { level: 2, name: '產品開發' })).toBeVisible()

    await user.click(
      within(screen.getByRole('article', { name: 'Board 產品開發' })).getByRole('button', {
        name: '修改',
      }),
    )

    const editForm = getBoardForm('儲存修改')
    await user.clear(within(editForm).getByLabelText('Board 名稱'))
    await user.type(within(editForm).getByLabelText('Board 名稱'), '產品開發 v2')
    await user.clear(within(editForm).getByLabelText('描述'))
    await user.type(within(editForm).getByLabelText('描述'), '更新後的描述')
    await user.click(within(editForm).getByRole('button', { name: '儲存修改' }))

    expect(await screen.findByRole('heading', { level: 2, name: '產品開發 v2' })).toBeVisible()
    expect(screen.getAllByText('更新後的描述')).toHaveLength(2)
    expect(readStoredBoards()).toMatchObject([
      {
        id: 'board-1',
        name: '產品開發 v2',
        description: '更新後的描述',
        updatedAt: expect.any(String),
      },
    ])
  })

  it('creates a task in a board status column and saves it to local storage', async () => {
    const user = userEvent.setup()

    vi.mocked(crypto.randomUUID).mockReturnValueOnce(createdTaskId)
    storeBoards([createBoard()])
    renderBoardPage()

    expect(await screen.findByRole('heading', { level: 2, name: '產品開發' })).toBeVisible()

    await createTaskFromUi(user, '尚未開始', '設計登入流程', 'Login UX')

    expect(readStoredTasks()).toEqual([
      {
        id: createdTaskId,
        boardId: 'board-1',
        title: '設計登入流程',
        description: 'Login UX',
        statusKey: 'todo',
        position: 0,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    ])
  })

  it('moves a task to another status through the edit form', async () => {
    const user = userEvent.setup()

    storeBoards([createBoard()])
    storeTasks([createTask()])
    renderBoardPage()

    const todoColumn = await screen.findByLabelText('尚未開始 欄位')
    const inProgressColumn = screen.getByLabelText('進行中 欄位')
    const taskCard = await within(todoColumn).findByLabelText('Task 設計登入流程')

    await user.click(within(taskCard).getByRole('button', { name: '修改' }))
    await user.selectOptions(screen.getByLabelText('狀態'), 'inProgress')
    await user.click(screen.getByRole('button', { name: '儲存修改' }))

    expect(
      await within(inProgressColumn).findByLabelText('Task 設計登入流程'),
    ).toBeVisible()
    expect(
      within(todoColumn).queryByLabelText('Task 設計登入流程'),
    ).not.toBeInTheDocument()
    expect(readStoredTasks()).toMatchObject([
      {
        id: 'task-1',
        statusKey: 'inProgress',
        position: 0,
        updatedAt: expect.any(String),
      },
    ])
  })

  it('shows only tasks for the selected board when switching boards', async () => {
    const user = userEvent.setup()

    storeBoards([
      createBoard({ id: 'board-1', name: '產品開發' }),
      createBoard({ id: 'board-2', name: '行銷計畫' }),
    ])
    storeTasks([
      createTask({ id: 'task-1', boardId: 'board-1', title: '產品 task' }),
      createTask({ id: 'task-2', boardId: 'board-2', title: '行銷 task' }),
    ])
    renderBoardPage()

    expect(await screen.findByRole('heading', { level: 2, name: '產品開發' })).toBeVisible()
    expect(await screen.findByLabelText('Task 產品 task')).toBeVisible()
    expect(screen.queryByLabelText('Task 行銷 task')).not.toBeInTheDocument()

    await user.click(
      within(screen.getByRole('article', { name: 'Board 行銷計畫' })).getByRole('button', {
        name: /行銷計畫/,
      }),
    )

    expect(await screen.findByRole('heading', { level: 2, name: '行銷計畫' })).toBeVisible()
    expect(await screen.findByLabelText('Task 行銷 task')).toBeVisible()
    expect(screen.queryByLabelText('Task 產品 task')).not.toBeInTheDocument()
  })

  it('deletes a board and its tasks after confirmation', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    storeBoards([
      createBoard({ id: 'board-1', name: '產品開發' }),
      createBoard({ id: 'board-2', name: '行銷計畫' }),
    ])
    storeTasks([
      createTask({ id: 'task-1', boardId: 'board-1', title: '產品 task' }),
      createTask({ id: 'task-2', boardId: 'board-2', title: '行銷 task' }),
    ])
    renderBoardPage()

    expect(await screen.findByRole('heading', { level: 2, name: '產品開發' })).toBeVisible()

    await user.click(
      within(screen.getByRole('article', { name: 'Board 產品開發' })).getByRole('button', {
        name: '刪除',
      }),
    )

    await waitFor(() => {
      expect(screen.queryByRole('article', { name: 'Board 產品開發' })).not.toBeInTheDocument()
    })

    expect(confirmSpy).toHaveBeenCalledWith('確定要刪除「產品開發」嗎？')
    expect(screen.getByRole('article', { name: 'Board 行銷計畫' })).toBeVisible()
    expect(readStoredBoards()).toMatchObject([{ id: 'board-2' }])
    expect(readStoredTasks()).toMatchObject([{ id: 'task-2', boardId: 'board-2' }])
  })
})
