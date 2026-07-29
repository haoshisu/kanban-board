import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Board } from './types'

const captureAppError = vi.hoisted(() => vi.fn())

vi.mock('../lib/errorReporting', () => ({
  captureAppError,
}))

import { loadBoards, saveBoards } from './boardStorage'

const storageKey = 'kanban-board:boards'

const board: Board = {
  id: 'board-1',
  name: '產品開發',
  description: 'Roadmap',
  statuses: [
    { key: 'todo', title: '尚未開始' },
    { key: 'inProgress', title: '進行中' },
    { key: 'done', title: '已完成' },
  ],
  version: 1,
  createdAt: '2026-06-04T00:00:00.000Z',
  updatedAt: '2026-06-04T00:00:00.000Z',
}

describe('boardStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    captureAppError.mockClear()
  })

  it('returns an empty list when no boards are stored', () => {
    expect(loadBoards()).toEqual([])
  })

  it('returns an empty list when stored data is not an array', () => {
    localStorage.setItem(storageKey, JSON.stringify({ boards: [board] }))

    expect(loadBoards()).toEqual([])
  })

  it('filters invalid board entries', () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify([
        board,
        { ...board, id: 123 },
        { ...board, statuses: 'todo' },
      ]),
    )

    expect(loadBoards()).toEqual([board])
  })

  it('adds version 1 to boards stored before versioning was introduced', () => {
    const { version, ...legacyBoard } = board
    void version

    localStorage.setItem(storageKey, JSON.stringify([legacyBoard]))

    expect(loadBoards()).toEqual([board])
  })

  it('reports parse errors and returns an empty list', () => {
    localStorage.setItem(storageKey, '{bad-json')

    expect(loadBoards()).toEqual([])
    expect(captureAppError).toHaveBeenCalledWith(expect.any(SyntaxError), {
      area: 'storage',
      action: 'loadBoards',
    })
  })

  it('saves boards as JSON', () => {
    saveBoards([board])

    expect(JSON.parse(localStorage.getItem(storageKey) ?? '[]')).toEqual([board])
  })
})
