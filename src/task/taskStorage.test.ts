import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task } from './types'

const captureAppError = vi.hoisted(() => vi.fn())

vi.mock('../lib/errorReporting', () => ({
  captureAppError,
}))

import { loadTasks, saveTasks } from './taskStorage'

const storageKey = 'kanban-board:tasks'

const task: Task = {
  id: 'task-1',
  boardId: 'board-1',
  title: '設計登入流程',
  description: 'Login UX',
  statusKey: 'todo',
  position: 0,
  createdAt: '2026-06-04T00:00:00.000Z',
  updatedAt: '2026-06-04T00:00:00.000Z',
}

describe('taskStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    captureAppError.mockClear()
  })

  it('returns an empty list when no tasks are stored', () => {
    expect(loadTasks()).toEqual([])
  })

  it('returns an empty list when stored data is not an array', () => {
    localStorage.setItem(storageKey, JSON.stringify({ tasks: [task] }))

    expect(loadTasks()).toEqual([])
  })

  it('filters invalid task entries', () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify([
        task,
        { ...task, id: 123 },
        { ...task, position: '0' },
      ]),
    )

    expect(loadTasks()).toEqual([task])
  })

  it('reports parse errors and returns an empty list', () => {
    localStorage.setItem(storageKey, '{bad-json')

    expect(loadTasks()).toEqual([])
    expect(captureAppError).toHaveBeenCalledWith(expect.any(SyntaxError), {
      area: 'storage',
      action: 'loadTasks',
    })
  })

  it('saves tasks as JSON', () => {
    saveTasks([task])

    expect(JSON.parse(localStorage.getItem(storageKey) ?? '[]')).toEqual([task])
  })
})
