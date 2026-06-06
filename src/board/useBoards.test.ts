import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Board } from './types'
import { defaultBoardStatuses } from './boardStorage'
import { useBoards } from './useBoards'
import type { BoardRow } from './boardUtils'

const {
  captureAppErrorMock,
  getSupabaseMock,
  isLocalDataModeMock,
  loadBoardsMock,
  saveBoardsMock,
} = vi.hoisted(() => ({
  captureAppErrorMock: vi.fn(),
  getSupabaseMock: vi.fn(),
  isLocalDataModeMock: vi.fn(),
  loadBoardsMock: vi.fn(),
  saveBoardsMock: vi.fn(),
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

vi.mock('./boardStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./boardStorage')>()

  return {
    ...actual,
    loadBoards: loadBoardsMock,
    saveBoards: saveBoardsMock,
  }
})

const fixedNow = '2026-06-05T12:00:00.000Z'

const createBoardFixture = (overrides: Partial<Board> = {}): Board => ({
  id: 'board-1',
  name: '產品開發',
  description: 'Roadmap',
  statuses: defaultBoardStatuses,
  createdAt: '2026-06-04T00:00:00.000Z',
  updatedAt: '2026-06-04T00:00:00.000Z',
  ...overrides,
})

const createBoardRow = (overrides: Partial<BoardRow> = {}): BoardRow => ({
  id: 'board-1',
  name: '產品開發',
  description: 'Roadmap',
  created_at: '2026-06-04T00:00:00.000Z',
  updated_at: '2026-06-04T00:00:00.000Z',
  ...overrides,
})

const flushLocalEffect = async () => {
  await act(async () => {
    await Promise.resolve()
  })
}

const createBoardSupabaseMock = ({
  loadResult = { data: [], error: null },
  insertResult = { data: null, error: null },
  insertThrows = null,
  updateResult = { data: null, error: null },
  updateThrows = null,
  deleteResult = { error: null },
  deleteThrows = null,
}: {
  loadResult?: { data: BoardRow[]; error: { message: string } | null }
  insertResult?: { data: BoardRow | null; error: { message: string } | null }
  insertThrows?: Error | null
  updateResult?: { data: BoardRow | null; error: { message: string } | null }
  updateThrows?: Error | null
  deleteResult?: { error: { message: string } | null }
  deleteThrows?: Error | null
}) => {
  const orderMock = vi.fn().mockResolvedValue(loadResult)
  const loadEqMock = vi.fn(() => ({ order: orderMock }))
  const loadSelectMock = vi.fn(() => ({ eq: loadEqMock }))

  const insertSingleMock = insertThrows
    ? vi.fn().mockRejectedValue(insertThrows)
    : vi.fn().mockResolvedValue(insertResult)
  const insertSelectMock = vi.fn(() => ({ single: insertSingleMock }))
  const insertMock = vi.fn(() => ({ select: insertSelectMock }))

  const updateSingleMock = updateThrows
    ? vi.fn().mockRejectedValue(updateThrows)
    : vi.fn().mockResolvedValue(updateResult)
  const updateSelectMock = vi.fn(() => ({ single: updateSingleMock }))
  const updateEqMock = vi.fn(() => ({ select: updateSelectMock }))
  const updateMock = vi.fn(() => ({ eq: updateEqMock }))

  const deleteEqMock = deleteThrows
    ? vi.fn().mockRejectedValue(deleteThrows)
    : vi.fn().mockResolvedValue(deleteResult)
  const deleteMock = vi.fn(() => ({ eq: deleteEqMock }))

  const fromMock = vi.fn(() => ({
    delete: deleteMock,
    insert: insertMock,
    select: loadSelectMock,
    update: updateMock,
  }))

  getSupabaseMock.mockResolvedValue({ from: fromMock })

  return {
    deleteEqMock,
    deleteMock,
    fromMock,
    insertMock,
    loadEqMock,
    updateMock,
  }
}

describe('useBoards local mode', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(fixedNow))
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'board-new') })

    isLocalDataModeMock.mockReturnValue(true)
    loadBoardsMock.mockReturnValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('does not load boards when owner id is missing', () => {
    const { result } = renderHook(() => useBoards(undefined))

    expect(result.current.boards).toEqual([])
    expect(result.current.selectedBoard).toBeNull()
    expect(loadBoardsMock).not.toHaveBeenCalled()
    expect(getSupabaseMock).not.toHaveBeenCalled()
  })

  it('loads stored boards and selects the first board', async () => {
    const boards = [
      createBoardFixture({ id: 'board-1', name: '第一個 board' }),
      createBoardFixture({ id: 'board-2', name: '第二個 board' }),
    ]
    loadBoardsMock.mockReturnValue(boards)

    const { result } = renderHook(() => useBoards('owner-1'))

    await flushLocalEffect()

    expect(result.current.boards).toEqual(boards)
    expect(result.current.selectedBoard).toEqual(boards[0])
    expect(result.current.isLoadingBoards).toBe(false)
    expect(result.current.boardError).toBe('')
    expect(getSupabaseMock).not.toHaveBeenCalled()
  })

  it('selects a board', async () => {
    const boards = [
      createBoardFixture({ id: 'board-1' }),
      createBoardFixture({ id: 'board-2', name: '第二個 board' }),
    ]
    loadBoardsMock.mockReturnValue(boards)

    const { result } = renderHook(() => useBoards('owner-1'))

    await flushLocalEffect()
    expect(result.current.selectedBoard).toEqual(boards[0])

    act(() => {
      result.current.selectBoard('board-2')
    })

    expect(result.current.selectedBoard).toEqual(boards[1])
  })

  it('creates a board and saves it before the current boards', async () => {
    const existingBoard = createBoardFixture({ id: 'board-1' })
    loadBoardsMock.mockReturnValue([existingBoard])

    const { result } = renderHook(() => useBoards('owner-1'))

    await flushLocalEffect()
    expect(result.current.boards).toEqual([existingBoard])

    let createdBoard: Board | null = null

    await act(async () => {
      createdBoard = await result.current.createBoard({
        name: '  新 board  ',
        description: '  新描述  ',
      })
    })

    const expectedBoard = {
      id: 'board-new',
      name: '新 board',
      description: '新描述',
      statuses: defaultBoardStatuses,
      createdAt: fixedNow,
      updatedAt: fixedNow,
    }

    expect(createdBoard).toEqual(expectedBoard)
    expect(result.current.boards).toEqual([expectedBoard, existingBoard])
    expect(result.current.selectedBoard).toEqual(expectedBoard)
    expect(saveBoardsMock).toHaveBeenCalledWith([expectedBoard, existingBoard])
    expect(getSupabaseMock).not.toHaveBeenCalled()
  })

  it('does not create a board with an empty name', async () => {
    const existingBoard = createBoardFixture({ id: 'board-1' })
    loadBoardsMock.mockReturnValue([existingBoard])

    const { result } = renderHook(() => useBoards('owner-1'))

    await flushLocalEffect()
    expect(result.current.boards).toEqual([existingBoard])

    let createdBoard: Board | null = null

    await act(async () => {
      createdBoard = await result.current.createBoard({
        name: '   ',
        description: '描述',
      })
    })

    expect(createdBoard).toBeNull()
    expect(result.current.boards).toEqual([existingBoard])
    expect(saveBoardsMock).not.toHaveBeenCalled()
  })

  it('updates a board and saves the updated list', async () => {
    const board = createBoardFixture({ id: 'board-1' })
    loadBoardsMock.mockReturnValue([board])

    const { result } = renderHook(() => useBoards('owner-1'))

    await flushLocalEffect()
    expect(result.current.boards).toEqual([board])

    let updatedBoard: Board | null = null

    await act(async () => {
      updatedBoard = await result.current.updateBoard('board-1', {
        name: '  已更新  ',
        description: '  新描述  ',
      })
    })

    const expectedBoard = {
      ...board,
      name: '已更新',
      description: '新描述',
      updatedAt: fixedNow,
    }

    expect(updatedBoard).toEqual(expectedBoard)
    expect(result.current.boards).toEqual([expectedBoard])
    expect(saveBoardsMock).toHaveBeenCalledWith([expectedBoard])
  })

  it('does not update a board with an empty name', async () => {
    const board = createBoardFixture({ id: 'board-1' })
    loadBoardsMock.mockReturnValue([board])

    const { result } = renderHook(() => useBoards('owner-1'))

    await flushLocalEffect()
    expect(result.current.boards).toEqual([board])

    let updatedBoard: Board | null = null

    await act(async () => {
      updatedBoard = await result.current.updateBoard('board-1', {
        name: '   ',
        description: '新描述',
      })
    })

    expect(updatedBoard).toBeNull()
    expect(result.current.boards).toEqual([board])
    expect(saveBoardsMock).not.toHaveBeenCalled()
  })

  it('deletes a board and selects the next available board', async () => {
    const boards = [
      createBoardFixture({ id: 'board-1' }),
      createBoardFixture({ id: 'board-2', name: '第二個 board' }),
    ]
    loadBoardsMock.mockReturnValue(boards)

    const { result } = renderHook(() => useBoards('owner-1'))

    await flushLocalEffect()
    expect(result.current.selectedBoard).toEqual(boards[0])

    await act(async () => {
      await result.current.deleteBoard('board-1')
    })

    expect(result.current.boards).toEqual([boards[1]])
    expect(result.current.selectedBoard).toEqual(boards[1])
    expect(saveBoardsMock).toHaveBeenCalledWith([boards[1]])
  })
})

describe('useBoards Supabase mode', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(fixedNow))
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'board-new') })

    isLocalDataModeMock.mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('loads boards from Supabase and selects the first board', async () => {
    const rows = [
      createBoardRow({ id: 'board-1', name: '第一個 board' }),
      createBoardRow({ id: 'board-2', name: '第二個 board' }),
    ]
    const { fromMock, loadEqMock } = createBoardSupabaseMock({
      loadResult: { data: rows, error: null },
    })

    const { result } = renderHook(() => useBoards('owner-1'))

    await flushLocalEffect()

    expect(fromMock).toHaveBeenCalledWith('boards')
    expect(loadEqMock).toHaveBeenCalledWith('owner_id', 'owner-1')
    expect(result.current.boards).toEqual([
      createBoardFixture({
        id: 'board-1',
        name: '第一個 board',
      }),
      createBoardFixture({
        id: 'board-2',
        name: '第二個 board',
      }),
    ])
    expect(result.current.selectedBoard?.id).toBe('board-1')
    expect(result.current.isLoadingBoards).toBe(false)
  })

  it('clears boards and shows the Supabase load error', async () => {
    createBoardSupabaseMock({
      loadResult: { data: [], error: { message: 'Load failed' } },
    })

    const { result } = renderHook(() => useBoards('owner-1'))

    await flushLocalEffect()

    expect(result.current.boards).toEqual([])
    expect(result.current.selectedBoard).toBeNull()
    expect(result.current.boardError).toBe('Load failed')
    expect(result.current.isLoadingBoards).toBe(false)
  })

  it('captures thrown load errors and shows a fallback message', async () => {
    const error = new Error('network down')
    getSupabaseMock.mockRejectedValue(error)

    const { result } = renderHook(() => useBoards('owner-1'))

    await flushLocalEffect()

    expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
      area: 'boards',
      action: 'loadBoards',
      ownerId: 'owner-1',
    })
    expect(result.current.boards).toEqual([])
    expect(result.current.boardError).toBe('載入 boards 時發生錯誤，請稍後再試')
  })

  it('creates a board and replaces the optimistic board with Supabase data', async () => {
    const existingRow = createBoardRow({ id: 'board-1' })
    const createdRow = createBoardRow({
      id: 'board-from-db',
      name: '新 board',
      description: '新描述',
      created_at: '2026-06-05T13:00:00.000Z',
      updated_at: '2026-06-05T13:00:00.000Z',
    })
    const { insertMock } = createBoardSupabaseMock({
      loadResult: { data: [existingRow], error: null },
      insertResult: { data: createdRow, error: null },
    })

    const { result } = renderHook(() => useBoards('owner-1'))
    await flushLocalEffect()

    let createdBoard: Board | null = null

    await act(async () => {
      createdBoard = await result.current.createBoard({
        name: '  新 board  ',
        description: '  新描述  ',
      })
    })

    const expectedBoard = createBoardFixture({
      id: 'board-from-db',
      name: '新 board',
      description: '新描述',
      createdAt: '2026-06-05T13:00:00.000Z',
      updatedAt: '2026-06-05T13:00:00.000Z',
    })

    expect(insertMock).toHaveBeenCalledWith({
      id: 'board-new',
      owner_id: 'owner-1',
      name: '新 board',
      description: '新描述',
    })
    expect(createdBoard).toEqual(expectedBoard)
    expect(result.current.boards).toEqual([
      expectedBoard,
      createBoardFixture({ id: 'board-1' }),
    ])
  })

  it('rolls back an optimistic board when create returns an error', async () => {
    const existingRow = createBoardRow({ id: 'board-1' })
    createBoardSupabaseMock({
      loadResult: { data: [existingRow], error: null },
      insertResult: { data: null, error: { message: 'Create failed' } },
    })

    const { result } = renderHook(() => useBoards('owner-1'))
    await flushLocalEffect()

    let createdBoard: Board | null = null

    await act(async () => {
      createdBoard = await result.current.createBoard({
        name: '新 board',
        description: '',
      })
    })

    expect(createdBoard).toBeNull()
    expect(result.current.boards).toEqual([createBoardFixture({ id: 'board-1' })])
    expect(result.current.selectedBoard?.id).toBe('board-1')
    expect(result.current.boardError).toBe('Create failed')
  })

  it('captures thrown create errors and rolls back the optimistic board', async () => {
    const error = new Error('create exploded')
    createBoardSupabaseMock({
      loadResult: { data: [createBoardRow({ id: 'board-1' })], error: null },
      insertThrows: error,
    })

    const { result } = renderHook(() => useBoards('owner-1'))
    await flushLocalEffect()

    let createdBoard: Board | null = null

    await act(async () => {
      createdBoard = await result.current.createBoard({
        name: '新 board',
        description: '',
      })
    })

    expect(createdBoard).toBeNull()
    expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
      area: 'boards',
      action: 'createBoard',
      ownerId: 'owner-1',
    })
    expect(result.current.boards).toEqual([createBoardFixture({ id: 'board-1' })])
    expect(result.current.boardError).toBe('建立 board 時發生錯誤，請稍後再試')
  })

  it('updates a board with Supabase data', async () => {
    const updatedRow = createBoardRow({
      id: 'board-1',
      name: '已更新',
      description: '新描述',
      updated_at: '2026-06-05T13:00:00.000Z',
    })
    const { updateMock } = createBoardSupabaseMock({
      loadResult: { data: [createBoardRow({ id: 'board-1' })], error: null },
      updateResult: { data: updatedRow, error: null },
    })

    const { result } = renderHook(() => useBoards('owner-1'))
    await flushLocalEffect()

    let updatedBoard: Board | null = null

    await act(async () => {
      updatedBoard = await result.current.updateBoard('board-1', {
        name: '  已更新  ',
        description: '  新描述  ',
      })
    })

    expect(updateMock).toHaveBeenCalledWith({
      name: '已更新',
      description: '新描述',
      updated_at: fixedNow,
    })
    expect(updatedBoard).toEqual(
      createBoardFixture({
        id: 'board-1',
        name: '已更新',
        description: '新描述',
        updatedAt: '2026-06-05T13:00:00.000Z',
      }),
    )
    expect(result.current.boards[0]).toEqual(updatedBoard)
  })

  it('rolls back a board update when Supabase returns an error', async () => {
    const previousBoard = createBoardFixture({ id: 'board-1' })
    createBoardSupabaseMock({
      loadResult: { data: [createBoardRow({ id: 'board-1' })], error: null },
      updateResult: { data: null, error: { message: 'Update failed' } },
    })

    const { result } = renderHook(() => useBoards('owner-1'))
    await flushLocalEffect()

    let updatedBoard: Board | null = null

    await act(async () => {
      updatedBoard = await result.current.updateBoard('board-1', {
        name: '已更新',
        description: '',
      })
    })

    expect(updatedBoard).toBeNull()
    expect(result.current.boards).toEqual([previousBoard])
    expect(result.current.boardError).toBe('Update failed')
  })

  it('captures thrown update errors and rolls back the optimistic board', async () => {
    const error = new Error('update exploded')
    const previousBoard = createBoardFixture({ id: 'board-1' })
    createBoardSupabaseMock({
      loadResult: { data: [createBoardRow({ id: 'board-1' })], error: null },
      updateThrows: error,
    })

    const { result } = renderHook(() => useBoards('owner-1'))
    await flushLocalEffect()

    let updatedBoard: Board | null = null

    await act(async () => {
      updatedBoard = await result.current.updateBoard('board-1', {
        name: '已更新',
        description: '',
      })
    })

    expect(updatedBoard).toBeNull()
    expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
      area: 'boards',
      action: 'updateBoard',
      boardId: 'board-1',
    })
    expect(result.current.boards).toEqual([previousBoard])
    expect(result.current.boardError).toBe('更新 board 時發生錯誤，請稍後再試')
  })

  it('returns null without calling Supabase when updating a missing board', async () => {
    const { updateMock } = createBoardSupabaseMock({
      loadResult: { data: [createBoardRow({ id: 'board-1' })], error: null },
    })

    const { result } = renderHook(() => useBoards('owner-1'))
    await flushLocalEffect()

    let updatedBoard: Board | null = null

    await act(async () => {
      updatedBoard = await result.current.updateBoard('missing-board', {
        name: '已更新',
        description: '',
      })
    })

    expect(updatedBoard).toBeNull()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('deletes a board through Supabase', async () => {
    const rows = [
      createBoardRow({ id: 'board-1' }),
      createBoardRow({ id: 'board-2', name: '第二個 board' }),
    ]
    const { deleteEqMock } = createBoardSupabaseMock({
      loadResult: { data: rows, error: null },
      deleteResult: { error: null },
    })

    const { result } = renderHook(() => useBoards('owner-1'))
    await flushLocalEffect()

    await act(async () => {
      await result.current.deleteBoard('board-1')
    })

    expect(deleteEqMock).toHaveBeenCalledWith('id', 'board-1')
    expect(result.current.boards).toEqual([
      createBoardFixture({ id: 'board-2', name: '第二個 board' }),
    ])
    expect(result.current.selectedBoard?.id).toBe('board-2')
  })

  it('rolls back a board delete when Supabase returns an error', async () => {
    const rows = [
      createBoardRow({ id: 'board-1' }),
      createBoardRow({ id: 'board-2', name: '第二個 board' }),
    ]
    createBoardSupabaseMock({
      loadResult: { data: rows, error: null },
      deleteResult: { error: { message: 'Delete failed' } },
    })

    const { result } = renderHook(() => useBoards('owner-1'))
    await flushLocalEffect()

    await act(async () => {
      await result.current.deleteBoard('board-1')
    })

    expect(result.current.boards).toEqual([
      createBoardFixture({ id: 'board-1' }),
      createBoardFixture({ id: 'board-2', name: '第二個 board' }),
    ])
    expect(result.current.selectedBoard?.id).toBe('board-1')
    expect(result.current.boardError).toBe('Delete failed')
  })

  it('captures thrown delete errors and rolls back the deleted board', async () => {
    const error = new Error('delete exploded')
    const rows = [
      createBoardRow({ id: 'board-1' }),
      createBoardRow({ id: 'board-2', name: '第二個 board' }),
    ]
    createBoardSupabaseMock({
      loadResult: { data: rows, error: null },
      deleteThrows: error,
    })

    const { result } = renderHook(() => useBoards('owner-1'))
    await flushLocalEffect()

    await act(async () => {
      await result.current.deleteBoard('board-1')
    })

    expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
      area: 'boards',
      action: 'deleteBoard',
      boardId: 'board-1',
    })
    expect(result.current.boards).toEqual([
      createBoardFixture({ id: 'board-1' }),
      createBoardFixture({ id: 'board-2', name: '第二個 board' }),
    ])
    expect(result.current.selectedBoard?.id).toBe('board-1')
    expect(result.current.boardError).toBe('刪除 board 時發生錯誤，請稍後再試')
  })

  it('returns null without Supabase when creating without owner id', async () => {
    const { result } = renderHook(() => useBoards(undefined))

    let createdBoard: Board | null = null

    await act(async () => {
      createdBoard = await result.current.createBoard({
        name: '新 board',
        description: '',
      })
    })

    expect(createdBoard).toBeNull()
    expect(getSupabaseMock).not.toHaveBeenCalled()
  })
})
