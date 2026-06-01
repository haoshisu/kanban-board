import type { Board, BoardStatus } from './types'
import { captureAppError } from '../lib/errorReporting'

const BOARD_STORAGE_KEY = 'kanban-board:boards'

export const defaultBoardStatuses: BoardStatus[] = [
  { key: 'todo', title: '尚未開始' },
  { key: 'inProgress', title: '進行中' },
  { key: 'done', title: '已完成' },
]

const isBoard = (value: unknown): value is Board => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const board = value as Partial<Board>

  return (
    typeof board.id === 'string' &&
    typeof board.name === 'string' &&
    typeof board.description === 'string' &&
    Array.isArray(board.statuses) &&
    typeof board.createdAt === 'string' &&
    typeof board.updatedAt === 'string'
  )
}

export const loadBoards = (): Board[] => {
  try {
    const value = localStorage.getItem(BOARD_STORAGE_KEY)

    if (!value) {
      return []
    }

    const parsed: unknown = JSON.parse(value)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(isBoard)
  } catch (error) {
    captureAppError(error, {
      area: 'storage',
      action: 'loadBoards',
    })
    return []
  }
}

export const saveBoards = (boards: Board[]) => {
  try {
    localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(boards))
  } catch (error) {
    captureAppError(error, {
      area: 'storage',
      action: 'saveBoards',
      boardCount: boards.length,
    })
  }
}
