import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task } from './types'
import { useTasks } from './useTasks'
import type { TaskRow } from './taskUtils'

const {
  captureAppErrorMock,
  getSupabaseMock,
  isLocalDataModeMock,
  loadTasksMock,
  saveTasksMock,
} = vi.hoisted(() => ({
  captureAppErrorMock: vi.fn(),
  getSupabaseMock: vi.fn(),
  isLocalDataModeMock: vi.fn(),
  loadTasksMock: vi.fn(),
  saveTasksMock: vi.fn(),
}))

vi.mock('../lib/errorReporting', () => ({
  captureAppError: captureAppErrorMock,
}))

vi.mock('../lib/localDataMode', () => ({
  isLocalDataMode: isLocalDataModeMock,
}))

vi.mock('../lib/supabase', () => ({
  getSupabase: getSupabaseMock,
}))

vi.mock('./taskStorage', () => ({
  loadTasks: loadTasksMock,
  saveTasks: saveTasksMock,
}))

const fixedNow = '2026-06-05T12:00:00.000Z'

const createTaskFixture = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  boardId: 'board-1',
  title: '設計登入流程',
  description: 'Login UX',
  statusKey: 'todo',
  position: 0,
  version: 1,
  createdAt: '2026-06-04T00:00:00.000Z',
  updatedAt: '2026-06-04T00:00:00.000Z',
  ...overrides,
})

const createTaskRow = (overrides: Partial<TaskRow> = {}): TaskRow => ({
  id: 'task-1',
  board_id: 'board-1',
  title: '設計登入流程',
  description: 'Login UX',
  status: 'todo',
  position: 0,
  version: 1,
  created_at: '2026-06-04T00:00:00.000Z',
  updated_at: '2026-06-04T00:00:00.000Z',
  ...overrides,
})

const flushLocalEffect = async () => {
  await act(async () => {
    await Promise.resolve()
  })
}

const createTaskSupabaseMock = ({
  loadResult = { data: [], error: null },
  insertResult = { data: null, error: null },
  insertThrows = null,
  updateResult = { data: null, error: null },
  updateThrows = null,
  deleteResult = { data: { id: 'task-1' }, error: null },
  deleteThrows = null,
  deleteByBoardResult = { error: null },
  deleteByBoardThrows = null,
}: {
  loadResult?: { data: TaskRow[]; error: { message: string } | null }
  insertResult?: { data: TaskRow | null; error: { message: string } | null }
  insertThrows?: Error | null
  updateResult?: { data: TaskRow | null; error: { message: string } | null }
  updateThrows?: Error | null
  deleteResult?: {
    data?: { id: string } | null
    error: { message: string } | null
  }
  deleteThrows?: Error | null
  deleteByBoardResult?: { error: { message: string } | null }
  deleteByBoardThrows?: Error | null
}) => {
  const secondOrderMock = vi.fn().mockResolvedValue(loadResult)
  const firstOrderMock = vi.fn(() => ({ order: secondOrderMock }))
  const loadEqMock = vi.fn(() => ({ order: firstOrderMock }))
  const loadSelectMock = vi.fn(() => ({ eq: loadEqMock }))

  const insertSingleMock = insertThrows
    ? vi.fn().mockRejectedValue(insertThrows)
    : vi.fn().mockResolvedValue(insertResult)
  const insertSelectMock = vi.fn(() => ({ single: insertSingleMock }))
  const insertMock = vi.fn(() => ({ select: insertSelectMock }))

  const updateMaybeSingleMock = updateThrows
    ? vi.fn().mockRejectedValue(updateThrows)
    : vi.fn().mockResolvedValue(updateResult)
  const updateSelectMock = vi.fn(() => ({ maybeSingle: updateMaybeSingleMock }))
  const updateVersionEqMock = vi.fn(() => ({ select: updateSelectMock }))
  const updateEqMock = vi.fn(() => ({ eq: updateVersionEqMock }))
  const updateMock = vi.fn(() => ({ eq: updateEqMock }))

  const deleteTaskMaybeSingleMock = deleteThrows
    ? vi.fn().mockRejectedValue(deleteThrows)
    : vi.fn().mockResolvedValue(deleteResult)
  const deleteTaskSelectMock = vi.fn(() => ({
    maybeSingle: deleteTaskMaybeSingleMock,
  }))
  const deleteTaskVersionEqMock = vi.fn(() => ({
    select: deleteTaskSelectMock,
  }))
  const deleteTaskEqMock = vi.fn((column: string, value: string) => {
    void column
    void value

    return { eq: deleteTaskVersionEqMock }
  })
  const deleteBoardEqMock = deleteByBoardThrows
    ? vi.fn().mockRejectedValue(deleteByBoardThrows)
    : vi.fn().mockResolvedValue(deleteByBoardResult)
  const deleteMock = vi.fn(() => ({
    eq: vi.fn((column: string, value: string) =>
      column === 'board_id'
        ? deleteBoardEqMock(column, value)
        : deleteTaskEqMock(column, value),
    ),
  }))

  const fromMock = vi.fn(() => ({
    delete: deleteMock,
    insert: insertMock,
    select: loadSelectMock,
    update: updateMock,
  }))

  getSupabaseMock.mockResolvedValue({ from: fromMock })

  return {
    deleteBoardEqMock,
    deleteMock,
    deleteTaskEqMock,
    fromMock,
    insertMock,
    loadEqMock,
    updateMock,
  }
}

describe('useTasks local mode', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(fixedNow))
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'task-new') })

    isLocalDataModeMock.mockReturnValue(true)
    loadTasksMock.mockReturnValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('returns empty tasks when board id is missing', () => {
    const { result } = renderHook(() => useTasks(null))

    expect(result.current.tasks).toEqual([])
    expect(loadTasksMock).not.toHaveBeenCalled()
    expect(getSupabaseMock).not.toHaveBeenCalled()
  })

  it('loads only tasks for the current board', async () => {
    const boardTask = createTaskFixture({ id: 'task-1', boardId: 'board-1' })
    const otherBoardTask = createTaskFixture({
      id: 'task-2',
      boardId: 'board-2',
      title: '其他 board task',
    })
    loadTasksMock.mockReturnValue([boardTask, otherBoardTask])

    const { result } = renderHook(() => useTasks('board-1'))

    await flushLocalEffect()

    expect(result.current.tasks).toEqual([boardTask])
    expect(result.current.isLoadingTasks).toBe(false)
    expect(result.current.taskError).toBe('')
    expect(getSupabaseMock).not.toHaveBeenCalled()
  })

  it('sorts tasks by status key and position', async () => {
    const tasks = [
      createTaskFixture({ id: 'todo-2', statusKey: 'todo', position: 2 }),
      createTaskFixture({ id: 'done-1', statusKey: 'done', position: 1 }),
      createTaskFixture({ id: 'todo-0', statusKey: 'todo', position: 0 }),
      createTaskFixture({ id: 'done-0', statusKey: 'done', position: 0 }),
    ]
    loadTasksMock.mockReturnValue(tasks)

    const { result } = renderHook(() => useTasks('board-1'))

    await flushLocalEffect()

    expect(result.current.tasks.map((task) => task.id)).toEqual([
      'done-0',
      'done-1',
      'todo-0',
      'todo-2',
    ])
  })

  it('creates a task with the next position and saves all stored tasks', async () => {
    const existingTask = createTaskFixture({
      id: 'task-1',
      statusKey: 'todo',
      position: 2,
    })
    const otherBoardTask = createTaskFixture({
      id: 'task-2',
      boardId: 'board-2',
      title: '其他 board task',
    })
    loadTasksMock.mockReturnValue([existingTask, otherBoardTask])

    const { result } = renderHook(() => useTasks('board-1'))

    await flushLocalEffect()
    expect(result.current.tasks).toEqual([existingTask])

    let createdTask: Task | null = null

    await act(async () => {
      createdTask = await result.current.createTask({
        title: '  新 task  ',
        description: '  新描述  ',
        statusKey: 'todo',
      })
    })

    const expectedTask = {
      id: 'task-new',
      boardId: 'board-1',
      title: '新 task',
      description: '新描述',
      statusKey: 'todo' as const,
      position: 3,
      version: 0,
      createdAt: fixedNow,
      updatedAt: fixedNow,
    }

    expect(createdTask).toEqual(expectedTask)
    expect(result.current.tasks).toEqual([existingTask, expectedTask])
    expect(saveTasksMock).toHaveBeenCalledWith([
      existingTask,
      otherBoardTask,
      expectedTask,
    ])
  })

  it('does not create a task with an empty title', async () => {
    const existingTask = createTaskFixture({ id: 'task-1' })
    loadTasksMock.mockReturnValue([existingTask])

    const { result } = renderHook(() => useTasks('board-1'))

    await flushLocalEffect()
    expect(result.current.tasks).toEqual([existingTask])

    let createdTask: Task | null = null

    await act(async () => {
      createdTask = await result.current.createTask({
        title: '   ',
        description: '新描述',
        statusKey: 'todo',
      })
    })

    expect(createdTask).toBeNull()
    expect(result.current.tasks).toEqual([existingTask])
    expect(saveTasksMock).not.toHaveBeenCalled()
  })

  it('updates a task and recalculates position when status changes', async () => {
    const task = createTaskFixture({ id: 'task-1', statusKey: 'todo', position: 0 })
    const doneTask = createTaskFixture({
      id: 'task-2',
      title: '已完成 task',
      statusKey: 'done',
      position: 4,
    })
    loadTasksMock.mockReturnValue([task, doneTask])

    const { result } = renderHook(() => useTasks('board-1'))

    await flushLocalEffect()
    expect(result.current.tasks.map((currentTask) => currentTask.id)).toEqual([
      'task-2',
      'task-1',
    ])

    let updatedTask: Task | null = null

    await act(async () => {
      updatedTask = await result.current.updateTask('task-1', {
        title: '  已更新  ',
        description: '  新描述  ',
        statusKey: 'done',
      })
    })

    const expectedTask = {
      ...task,
      title: '已更新',
      description: '新描述',
      statusKey: 'done' as const,
      position: 5,
      version: 2,
      updatedAt: fixedNow,
    }

    expect(updatedTask).toEqual(expectedTask)
    expect(result.current.tasks).toEqual([doneTask, expectedTask])
    expect(saveTasksMock).toHaveBeenCalledWith([expectedTask, doneTask])
  })

  it('deletes a task from state and storage', async () => {
    const task = createTaskFixture({ id: 'task-1' })
    const otherTask = createTaskFixture({ id: 'task-2', title: '保留 task' })
    loadTasksMock.mockReturnValue([task, otherTask])

    const { result } = renderHook(() => useTasks('board-1'))

    await flushLocalEffect()
    expect(result.current.tasks).toEqual([task, otherTask])

    await act(async () => {
      await result.current.deleteTask('task-1')
    })

    expect(result.current.tasks).toEqual([otherTask])
    expect(saveTasksMock).toHaveBeenCalledWith([otherTask])
  })

  it('moves a task to another status and saves the updated stored tasks', async () => {
    const task = createTaskFixture({ id: 'task-1', statusKey: 'todo', position: 0 })
    const doneTask = createTaskFixture({
      id: 'task-2',
      title: '已完成 task',
      statusKey: 'done',
      position: 2,
    })
    loadTasksMock.mockReturnValue([task, doneTask])

    const { result } = renderHook(() => useTasks('board-1'))

    await flushLocalEffect()
    expect(result.current.tasks.map((currentTask) => currentTask.id)).toEqual([
      'task-2',
      'task-1',
    ])

    await act(async () => {
      await result.current.moveTaskStatus('task-1', 'done')
    })

    const movedTask = {
      ...task,
      statusKey: 'done' as const,
      position: 3,
      version: 2,
      updatedAt: fixedNow,
    }

    expect(result.current.tasks).toEqual([doneTask, movedTask])
    expect(saveTasksMock).toHaveBeenCalledWith([movedTask, doneTask])
  })

  it('does not save when moving a task to the same status', async () => {
    const task = createTaskFixture({ id: 'task-1', statusKey: 'todo' })
    loadTasksMock.mockReturnValue([task])

    const { result } = renderHook(() => useTasks('board-1'))

    await flushLocalEffect()
    expect(result.current.tasks).toEqual([task])

    await act(async () => {
      await result.current.moveTaskStatus('task-1', 'todo')
    })

    expect(result.current.tasks).toEqual([task])
    expect(saveTasksMock).not.toHaveBeenCalled()
  })

  it('deletes tasks by board from state and storage', async () => {
    const boardTask = createTaskFixture({ id: 'task-1', boardId: 'board-1' })
    const otherBoardTask = createTaskFixture({
      id: 'task-2',
      boardId: 'board-2',
      title: '其他 board task',
    })
    loadTasksMock.mockReturnValue([boardTask, otherBoardTask])

    const { result } = renderHook(() => useTasks('board-1'))

    await flushLocalEffect()
    expect(result.current.tasks).toEqual([boardTask])

    await act(async () => {
      await result.current.deleteTasksByBoard('board-1')
    })

    expect(result.current.tasks).toEqual([])
    expect(saveTasksMock).toHaveBeenCalledWith([otherBoardTask])
  })
})

describe('useTasks Supabase mode', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(fixedNow))
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'task-new') })

    isLocalDataModeMock.mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('loads tasks from Supabase', async () => {
    const rows = [
      createTaskRow({ id: 'task-1', status: 'in_progress', position: 1 }),
      createTaskRow({ id: 'task-2', title: '完成 task', status: 'done' }),
    ]
    const { loadEqMock } = createTaskSupabaseMock({
      loadResult: { data: rows, error: null },
    })

    const { result } = renderHook(() => useTasks('board-1'))

    await flushLocalEffect()

    expect(loadEqMock).toHaveBeenCalledWith('board_id', 'board-1')
    expect(result.current.tasks).toEqual([
      createTaskFixture({
        id: 'task-2',
        title: '完成 task',
        statusKey: 'done',
      }),
      createTaskFixture({
        id: 'task-1',
        statusKey: 'inProgress',
        position: 1,
      }),
    ])
    expect(result.current.isLoadingTasks).toBe(false)
  })

  it('clears tasks and shows the Supabase load error', async () => {
    createTaskSupabaseMock({
      loadResult: { data: [], error: { message: 'Load failed' } },
    })

    const { result } = renderHook(() => useTasks('board-1'))

    await flushLocalEffect()

    expect(result.current.tasks).toEqual([])
    expect(result.current.taskError).toBe('Load failed')
    expect(result.current.isLoadingTasks).toBe(false)
  })

  it('captures thrown load errors and shows a fallback message', async () => {
    const error = new Error('network down')
    getSupabaseMock.mockRejectedValue(error)

    const { result } = renderHook(() => useTasks('board-1'))

    await flushLocalEffect()

    expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
      area: 'tasks',
      action: 'refreshTasks',
      boardId: 'board-1',
    })
    expect(result.current.tasks).toEqual([])
    expect(result.current.taskError).toBe('載入 tasks 時發生錯誤，請稍後再試')
  })

  it('creates a task and replaces the optimistic task with Supabase data', async () => {
    const existingRow = createTaskRow({ id: 'task-1', position: 2 })
    const createdRow = createTaskRow({
      id: 'task-new',
      title: '新 task',
      description: '新描述',
      status: 'todo',
      position: 3,
      created_at: '2026-06-05T13:00:00.000Z',
      updated_at: '2026-06-05T13:00:00.000Z',
    })
    const { insertMock } = createTaskSupabaseMock({
      loadResult: { data: [existingRow], error: null },
      insertResult: { data: createdRow, error: null },
    })

    const { result } = renderHook(() => useTasks('board-1'))
    await flushLocalEffect()

    let createdTask: Task | null = null

    await act(async () => {
      createdTask = await result.current.createTask({
        title: '  新 task  ',
        description: '  新描述  ',
        statusKey: 'todo',
      })
    })

    const expectedTask = createTaskFixture({
      id: 'task-new',
      title: '新 task',
      description: '新描述',
      position: 3,
      createdAt: '2026-06-05T13:00:00.000Z',
      updatedAt: '2026-06-05T13:00:00.000Z',
    })

    expect(insertMock).toHaveBeenCalledWith({
      id: 'task-new',
      board_id: 'board-1',
      title: '新 task',
      description: '新描述',
      status: 'todo',
      position: 3,
    })
    expect(createdTask).toEqual(expectedTask)
    expect(result.current.tasks).toEqual([
      createTaskFixture({ id: 'task-1', position: 2 }),
      expectedTask,
    ])
  })

  it('rolls back an optimistic task when create returns an error', async () => {
    createTaskSupabaseMock({
      loadResult: { data: [createTaskRow({ id: 'task-1' })], error: null },
      insertResult: { data: null, error: { message: 'Create failed' } },
    })

    const { result } = renderHook(() => useTasks('board-1'))
    await flushLocalEffect()

    let createdTask: Task | null = null

    await act(async () => {
      createdTask = await result.current.createTask({
        title: '新 task',
        description: '',
        statusKey: 'todo',
      })
    })

    expect(createdTask).toBeNull()
    expect(result.current.tasks).toEqual([createTaskFixture({ id: 'task-1' })])
    expect(result.current.taskError).toBe('Create failed')
  })

  it('captures thrown create errors and rolls back the optimistic task', async () => {
    const error = new Error('create exploded')
    createTaskSupabaseMock({
      loadResult: { data: [createTaskRow({ id: 'task-1' })], error: null },
      insertThrows: error,
    })

    const { result } = renderHook(() => useTasks('board-1'))
    await flushLocalEffect()

    let createdTask: Task | null = null

    await act(async () => {
      createdTask = await result.current.createTask({
        title: '新 task',
        description: '',
        statusKey: 'todo',
      })
    })

    expect(createdTask).toBeNull()
    expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
      area: 'tasks',
      action: 'createTask',
      boardId: 'board-1',
      statusKey: 'todo',
    })
    expect(result.current.tasks).toEqual([createTaskFixture({ id: 'task-1' })])
    expect(result.current.taskError).toBe('建立 task 時發生錯誤，請稍後再試')
  })

  it('returns null without Supabase when creating without board id', async () => {
    const { result } = renderHook(() => useTasks(null))

    let createdTask: Task | null = null

    await act(async () => {
      createdTask = await result.current.createTask({
        title: '新 task',
        description: '',
        statusKey: 'todo',
      })
    })

    expect(createdTask).toBeNull()
    expect(getSupabaseMock).not.toHaveBeenCalled()
  })

  it('updates a task with Supabase data', async () => {
    const updatedRow = createTaskRow({
      id: 'task-1',
      title: '已更新',
      description: '新描述',
      status: 'done',
      position: 0,
      version: 2,
      updated_at: '2026-06-05T13:00:00.000Z',
    })
    const { updateMock } = createTaskSupabaseMock({
      loadResult: { data: [createTaskRow({ id: 'task-1' })], error: null },
      updateResult: { data: updatedRow, error: null },
    })

    const { result } = renderHook(() => useTasks('board-1'))
    await flushLocalEffect()

    let updatedTask: Task | null = null

    await act(async () => {
      updatedTask = await result.current.updateTask('task-1', {
        title: '  已更新  ',
        description: '  新描述  ',
        statusKey: 'done',
      })
    })

    expect(updateMock).toHaveBeenCalledWith({
      title: '已更新',
      description: '新描述',
      status: 'done',
      position: 0,
      updated_at: fixedNow,
    })
    expect(updatedTask).toEqual(
      createTaskFixture({
        id: 'task-1',
        title: '已更新',
        description: '新描述',
        statusKey: 'done',
        version: 2,
        updatedAt: '2026-06-05T13:00:00.000Z',
      }),
    )
    expect(result.current.tasks[0]).toEqual(updatedTask)
  })

  it('rolls back a task update when Supabase returns an error', async () => {
    const previousTask = createTaskFixture({ id: 'task-1' })
    createTaskSupabaseMock({
      loadResult: { data: [createTaskRow({ id: 'task-1' })], error: null },
      updateResult: { data: null, error: { message: 'Update failed' } },
    })

    const { result } = renderHook(() => useTasks('board-1'))
    await flushLocalEffect()

    let updatedTask: Task | null = null

    await act(async () => {
      updatedTask = await result.current.updateTask('task-1', {
        title: '已更新',
        description: '',
        statusKey: 'todo',
      })
    })

    expect(updatedTask).toBeNull()
    expect(result.current.tasks).toEqual([previousTask])
    expect(result.current.taskError).toBe('Update failed')
  })

  it('captures thrown update errors and rolls back the optimistic task', async () => {
    const error = new Error('update exploded')
    const previousTask = createTaskFixture({ id: 'task-1' })
    createTaskSupabaseMock({
      loadResult: { data: [createTaskRow({ id: 'task-1' })], error: null },
      updateThrows: error,
    })

    const { result } = renderHook(() => useTasks('board-1'))
    await flushLocalEffect()

    let updatedTask: Task | null = null

    await act(async () => {
      updatedTask = await result.current.updateTask('task-1', {
        title: '已更新',
        description: '',
        statusKey: 'done',
      })
    })

    expect(updatedTask).toBeNull()
    expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
      area: 'tasks',
      action: 'updateTask',
      boardId: 'board-1',
      taskId: 'task-1',
      statusKey: 'done',
    })
    expect(result.current.tasks).toEqual([previousTask])
    expect(result.current.taskError).toBe('更新 task 時發生錯誤，請稍後再試')
  })

  it('returns null without Supabase when updating a missing task', async () => {
    const { updateMock } = createTaskSupabaseMock({
      loadResult: { data: [createTaskRow({ id: 'task-1' })], error: null },
    })

    const { result } = renderHook(() => useTasks('board-1'))
    await flushLocalEffect()

    let updatedTask: Task | null = null

    await act(async () => {
      updatedTask = await result.current.updateTask('missing-task', {
        title: '已更新',
        description: '',
        statusKey: 'todo',
      })
    })

    expect(updatedTask).toBeNull()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('deletes a task through Supabase', async () => {
    const rows = [
      createTaskRow({ id: 'task-1' }),
      createTaskRow({ id: 'task-2', title: '保留 task' }),
    ]
    const { deleteTaskEqMock } = createTaskSupabaseMock({
      loadResult: { data: rows, error: null },
      deleteResult: { data: { id: 'task-1' }, error: null },
    })

    const { result } = renderHook(() => useTasks('board-1'))
    await flushLocalEffect()

    await act(async () => {
      await result.current.deleteTask('task-1')
    })

    expect(deleteTaskEqMock).toHaveBeenCalledWith('id', 'task-1')
    expect(result.current.tasks).toEqual([
      createTaskFixture({ id: 'task-2', title: '保留 task' }),
    ])
  })

  it('rolls back a task delete when Supabase returns an error', async () => {
    const rows = [
      createTaskRow({ id: 'task-1' }),
      createTaskRow({ id: 'task-2', title: '保留 task' }),
    ]
    createTaskSupabaseMock({
      loadResult: { data: rows, error: null },
      deleteResult: { error: { message: 'Delete failed' } },
    })

    const { result } = renderHook(() => useTasks('board-1'))
    await flushLocalEffect()

    await act(async () => {
      await result.current.deleteTask('task-1')
    })

    expect(result.current.tasks).toEqual([
      createTaskFixture({ id: 'task-2', title: '保留 task' }),
      createTaskFixture({ id: 'task-1' }),
    ])
    expect(result.current.taskError).toBe('Delete failed')
  })

  it('captures thrown delete errors and rolls back the deleted task', async () => {
    const error = new Error('delete exploded')
    const rows = [
      createTaskRow({ id: 'task-1' }),
      createTaskRow({ id: 'task-2', title: '保留 task' }),
    ]
    createTaskSupabaseMock({
      loadResult: { data: rows, error: null },
      deleteThrows: error,
    })

    const { result } = renderHook(() => useTasks('board-1'))
    await flushLocalEffect()

    await act(async () => {
      await result.current.deleteTask('task-1')
    })

    expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
      area: 'tasks',
      action: 'deleteTask',
      boardId: 'board-1',
      taskId: 'task-1',
    })
    expect(result.current.tasks).toEqual([
      createTaskFixture({ id: 'task-2', title: '保留 task' }),
      createTaskFixture({ id: 'task-1' }),
    ])
    expect(result.current.taskError).toBe('刪除 task 時發生錯誤，請稍後再試')
  })

  it('does not call Supabase when deleting a missing task', async () => {
    const { deleteMock } = createTaskSupabaseMock({
      loadResult: { data: [createTaskRow({ id: 'task-1' })], error: null },
    })

    const { result } = renderHook(() => useTasks('board-1'))
    await flushLocalEffect()

    await act(async () => {
      await result.current.deleteTask('missing-task')
    })

    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('moves a task and replaces it with Supabase data', async () => {
    const movedRow = createTaskRow({
      id: 'task-1',
      status: 'done',
      position: 1,
      version: 2,
      updated_at: '2026-06-05T13:00:00.000Z',
    })
    const { updateMock } = createTaskSupabaseMock({
      loadResult: {
        data: [
          createTaskRow({ id: 'task-1', status: 'todo', position: 0 }),
          createTaskRow({ id: 'task-2', status: 'done', position: 0 }),
        ],
        error: null,
      },
      updateResult: { data: movedRow, error: null },
    })

    const { result } = renderHook(() => useTasks('board-1'))
    await flushLocalEffect()

    await act(async () => {
      await result.current.moveTaskStatus('task-1', 'done')
    })

    expect(updateMock).toHaveBeenCalledWith({
      status: 'done',
      position: 1,
      updated_at: fixedNow,
    })
    expect(result.current.tasks).toEqual([
      createTaskFixture({ id: 'task-2', statusKey: 'done' }),
      createTaskFixture({
        id: 'task-1',
        statusKey: 'done',
        position: 1,
        version: 2,
        updatedAt: '2026-06-05T13:00:00.000Z',
      }),
    ])
  })

  it('rolls back a task move when Supabase returns an error', async () => {
    const previousTask = createTaskFixture({
      id: 'task-1',
      statusKey: 'todo',
      position: 0,
    })
    createTaskSupabaseMock({
      loadResult: { data: [createTaskRow({ id: 'task-1' })], error: null },
      updateResult: { data: null, error: { message: 'Move failed' } },
    })

    const { result } = renderHook(() => useTasks('board-1'))
    await flushLocalEffect()

    await act(async () => {
      await result.current.moveTaskStatus('task-1', 'done')
    })

    expect(result.current.tasks).toEqual([previousTask])
    expect(result.current.taskError).toBe('Move failed')
  })

  it('captures thrown move errors and rolls back the moved task', async () => {
    const error = new Error('move exploded')
    const previousTask = createTaskFixture({
      id: 'task-1',
      statusKey: 'todo',
      position: 0,
    })
    createTaskSupabaseMock({
      loadResult: { data: [createTaskRow({ id: 'task-1' })], error: null },
      updateThrows: error,
    })

    const { result } = renderHook(() => useTasks('board-1'))
    await flushLocalEffect()

    await act(async () => {
      await result.current.moveTaskStatus('task-1', 'done')
    })

    expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
      area: 'tasks',
      action: 'moveTaskStatus',
      boardId: 'board-1',
      taskId: 'task-1',
      statusKey: 'done',
    })
    expect(result.current.tasks).toEqual([previousTask])
    expect(result.current.taskError).toBe('移動 task 時發生錯誤，請稍後再試')
  })

  it('does not call Supabase when moving a missing task', async () => {
    const { updateMock } = createTaskSupabaseMock({
      loadResult: { data: [createTaskRow({ id: 'task-1' })], error: null },
    })

    const { result } = renderHook(() => useTasks('board-1'))
    await flushLocalEffect()

    await act(async () => {
      await result.current.moveTaskStatus('missing-task', 'done')
    })

    expect(updateMock).not.toHaveBeenCalled()
  })

  it('deletes tasks by board through Supabase', async () => {
    const { deleteBoardEqMock } = createTaskSupabaseMock({
      loadResult: {
        data: [createTaskRow({ id: 'task-1', board_id: 'board-1' })],
        error: null,
      },
      deleteByBoardResult: { error: null },
    })

    const { result } = renderHook(() => useTasks('board-1'))
    await flushLocalEffect()

    await act(async () => {
      await result.current.deleteTasksByBoard('board-1')
    })

    expect(deleteBoardEqMock).toHaveBeenCalledWith('board_id', 'board-1')
    expect(result.current.tasks).toEqual([])
  })

  it('keeps tasks when deleting tasks by board returns an error', async () => {
    const boardTask = createTaskRow({ id: 'task-1', board_id: 'board-1' })
    createTaskSupabaseMock({
      loadResult: { data: [boardTask], error: null },
      deleteByBoardResult: { error: { message: 'Delete board tasks failed' } },
    })

    const { result } = renderHook(() => useTasks('board-1'))
    await flushLocalEffect()

    await act(async () => {
      await result.current.deleteTasksByBoard('board-1')
    })

    expect(result.current.tasks).toEqual([createTaskFixture({ id: 'task-1' })])
    expect(result.current.taskError).toBe('Delete board tasks failed')
  })

  it('captures thrown delete by board errors and keeps current tasks', async () => {
    const error = new Error('delete board tasks exploded')
    createTaskSupabaseMock({
      loadResult: {
        data: [createTaskRow({ id: 'task-1', board_id: 'board-1' })],
        error: null,
      },
      deleteByBoardThrows: error,
    })

    const { result } = renderHook(() => useTasks('board-1'))
    await flushLocalEffect()

    await act(async () => {
      await result.current.deleteTasksByBoard('board-1')
    })

    expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
      area: 'tasks',
      action: 'deleteTasksByBoard',
      boardId: 'board-1',
    })
    expect(result.current.tasks).toEqual([createTaskFixture({ id: 'task-1' })])
    expect(result.current.taskError).toBe('刪除 board tasks 時發生錯誤，請稍後再試')
  })
})
