import type { BoardStatusKey } from '../board'
import type { Database } from '../lib/database.types'
import type { Task, TaskInput } from './types'

export type TaskStatus = Database['public']['Tables']['tasks']['Row']['status']

export type TaskRow = {
  id: string
  board_id: string
  title: string
  description: string | null
  status: TaskStatus
  position: number
  created_at: string
  updated_at: string
}

export const statusKeyToDbStatus: Record<BoardStatusKey, TaskStatus> = {
  todo: 'todo',
  inProgress: 'in_progress',
  done: 'done',
}

export const dbStatusToStatusKey: Record<TaskStatus, BoardStatusKey> = {
  todo: 'todo',
  in_progress: 'inProgress',
  done: 'done',
}

export const normalizeTaskInput = (input: TaskInput): TaskInput => ({
  title: input.title.trim(),
  description: input.description.trim(),
  statusKey: input.statusKey,
})

export const mapTaskRow = (row: TaskRow): Task => ({
  id: row.id,
  boardId: row.board_id,
  title: row.title,
  description: row.description ?? '',
  statusKey: dbStatusToStatusKey[row.status],
  position: row.position,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const getNextPosition = (tasks: Task[], statusKey: BoardStatusKey) => {
  const positions = tasks
    .filter((task) => task.statusKey === statusKey)
    .map((task) => task.position)

  return positions.length ? Math.max(...positions) + 1 : 0
}
