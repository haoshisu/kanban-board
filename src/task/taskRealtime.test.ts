import type {
  RealtimePostgresDeletePayload,
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
} from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { applyTaskRealtimePayload, upsertTaskByVersion } from './taskRealtime'
import type { TaskRow } from './taskUtils'
import type { Task } from './types'

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  boardId: 'board-1',
  title: 'Task',
  description: '',
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
  title: 'Task',
  description: '',
  status: 'todo',
  position: 0,
  version: 1,
  created_at: '2026-06-04T00:00:00.000Z',
  updated_at: '2026-06-04T00:00:00.000Z',
  ...overrides,
})

const payloadBase = {
  schema: 'public',
  table: 'tasks',
  commit_timestamp: '2026-06-05T00:00:00.000Z',
  errors: [],
}

describe('upsertTaskByVersion', () => {
  it('inserts an unknown task', () => {
    const incomingTask = createTask({ id: 'task-2' })

    expect(upsertTaskByVersion([createTask()], incomingTask)).toEqual([
      createTask(),
      incomingTask,
    ])
  })

  it('replaces a task with a newer version', () => {
    const incomingTask = createTask({ title: 'New title', version: 2 })

    expect(upsertTaskByVersion([createTask()], incomingTask)).toEqual([
      incomingTask,
    ])
  })

  it('ignores the same version', () => {
    const currentTasks = [createTask()]

    expect(
      upsertTaskByVersion(currentTasks, createTask({ title: 'Duplicate' })),
    ).toBe(currentTasks)
  })

  it('ignores an older version', () => {
    const currentTasks = [createTask({ version: 3 })]

    expect(
      upsertTaskByVersion(currentTasks, createTask({ title: 'Old', version: 2 })),
    ).toBe(currentTasks)
  })
})

describe('applyTaskRealtimePayload', () => {
  it('maps and applies an updated task from the current board', () => {
    const payload: RealtimePostgresUpdatePayload<TaskRow> = {
      ...payloadBase,
      eventType: 'UPDATE',
      new: createTaskRow({ title: 'Remote title', version: 2 }),
      old: { id: 'task-1', version: 1 },
    }

    expect(applyTaskRealtimePayload([createTask()], 'board-1', payload)).toEqual([
      createTask({ title: 'Remote title', version: 2 }),
    ])
  })

  it('ignores inserted tasks from another board', () => {
    const currentTasks = [createTask()]
    const payload: RealtimePostgresInsertPayload<TaskRow> = {
      ...payloadBase,
      eventType: 'INSERT',
      new: createTaskRow({ id: 'task-2', board_id: 'board-2' }),
      old: {},
    }

    expect(applyTaskRealtimePayload(currentTasks, 'board-1', payload)).toBe(
      currentTasks,
    )
  })

  it('removes a deleted task by id', () => {
    const remainingTask = createTask({ id: 'task-2' })
    const payload: RealtimePostgresDeletePayload<TaskRow> = {
      ...payloadBase,
      eventType: 'DELETE',
      new: {},
      old: { id: 'task-1' },
    }

    expect(
      applyTaskRealtimePayload(
        [createTask(), remainingTask],
        'board-1',
        payload,
      ),
    ).toEqual([remainingTask])
  })
})
