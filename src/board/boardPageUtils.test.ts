import { describe, expect, it } from 'vitest'
import { getValidDragMove, groupTasksByStatus } from './boardPageUtils'
import type { Task } from '../task'

const task = (id: string, statusKey: Task['statusKey']): Task => ({
  id,
  boardId: 'board-1',
  title: id,
  description: '',
  statusKey,
  position: 0,
  version: 1,
  createdAt: '2026-06-04T00:00:00.000Z',
  updatedAt: '2026-06-04T00:00:00.000Z',
})

describe('boardPageUtils', () => {
  it('groups tasks by status', () => {
    const todoTask = task('todo-task', 'todo')
    const doneTask = task('done-task', 'done')

    expect(groupTasksByStatus([todoTask, doneTask])).toEqual({
      todo: [todoTask],
      inProgress: [],
      done: [doneTask],
    })
  })

  it('returns empty arrays for empty status groups', () => {
    expect(groupTasksByStatus([])).toEqual({
      todo: [],
      inProgress: [],
      done: [],
    })
  })

  it('returns a drag move for a valid drag event', () => {
    expect(
      getValidDragMove({
        operation: {
          source: { data: { taskId: 'task-1' } },
          target: { data: { statusKey: 'done' } },
        },
      }),
    ).toEqual({
      taskId: 'task-1',
      statusKey: 'done',
    })
  })

  it('returns null for canceled drag events', () => {
    expect(
      getValidDragMove({
        canceled: true,
        operation: {
          source: { data: { taskId: 'task-1' } },
          target: { data: { statusKey: 'done' } },
        },
      }),
    ).toBeNull()
  })

  it('returns null when the task id is missing', () => {
    expect(
      getValidDragMove({
        operation: {
          source: { data: {} },
          target: { data: { statusKey: 'done' } },
        },
      }),
    ).toBeNull()
  })

  it('returns null when the status key is invalid', () => {
    expect(
      getValidDragMove({
        operation: {
          source: { data: { taskId: 'task-1' } },
          target: { data: { statusKey: 'blocked' } },
        },
      }),
    ).toBeNull()
  })
})
