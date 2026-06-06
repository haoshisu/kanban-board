import { describe, expect, it } from 'vitest'
import {
  dbStatusToStatusKey,
  getNextPosition,
  mapTaskRow,
  normalizeTaskInput,
  statusKeyToDbStatus,
} from './taskUtils'
import type { Task } from './types'
import type { TaskRow } from './taskUtils'

const taskRow: TaskRow = {
  id: 'task-1',
  board_id: 'board-1',
  title: '設計登入流程',
  description: 'Login UX',
  status: 'in_progress',
  position: 2,
  created_at: '2026-06-04T00:00:00.000Z',
  updated_at: '2026-06-05T00:00:00.000Z',
}

const tasks: Task[] = [
  {
    id: 'task-1',
    boardId: 'board-1',
    title: 'Todo 0',
    description: '',
    statusKey: 'todo',
    position: 0,
    createdAt: '2026-06-04T00:00:00.000Z',
    updatedAt: '2026-06-04T00:00:00.000Z',
  },
  {
    id: 'task-2',
    boardId: 'board-1',
    title: 'Todo 3',
    description: '',
    statusKey: 'todo',
    position: 3,
    createdAt: '2026-06-04T00:00:00.000Z',
    updatedAt: '2026-06-04T00:00:00.000Z',
  },
  {
    id: 'task-3',
    boardId: 'board-1',
    title: 'Done 8',
    description: '',
    statusKey: 'done',
    position: 8,
    createdAt: '2026-06-04T00:00:00.000Z',
    updatedAt: '2026-06-04T00:00:00.000Z',
  },
]

describe('taskUtils', () => {
  it('trims task input fields', () => {
    expect(
      normalizeTaskInput({
        title: '  設計登入流程  ',
        description: '  Login UX  ',
        statusKey: 'todo',
      }),
    ).toEqual({
      title: '設計登入流程',
      description: 'Login UX',
      statusKey: 'todo',
    })
  })

  it('maps database statuses to board status keys', () => {
    expect(dbStatusToStatusKey.in_progress).toBe('inProgress')
  })

  it('maps board status keys to database statuses', () => {
    expect(statusKeyToDbStatus.inProgress).toBe('in_progress')
  })

  it('maps a task row into a task', () => {
    expect(mapTaskRow(taskRow)).toEqual({
      id: taskRow.id,
      boardId: taskRow.board_id,
      title: taskRow.title,
      description: taskRow.description,
      statusKey: 'inProgress',
      position: taskRow.position,
      createdAt: taskRow.created_at,
      updatedAt: taskRow.updated_at,
    })
  })

  it('maps a null row description to an empty string', () => {
    expect(mapTaskRow({ ...taskRow, description: null }).description).toBe('')
  })

  it('returns 0 as the next position for an empty status', () => {
    expect(getNextPosition(tasks, 'inProgress')).toBe(0)
  })

  it('returns max position plus one for the target status', () => {
    expect(getNextPosition(tasks, 'todo')).toBe(4)
  })

  it('ignores tasks from other statuses when calculating the next position', () => {
    expect(getNextPosition(tasks, 'done')).toBe(9)
  })
})
