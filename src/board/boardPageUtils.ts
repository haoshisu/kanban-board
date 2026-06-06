import type { Task } from '../task'
import type { BoardStatusKey } from './types'

type DragMoveEvent = {
  canceled?: boolean
  operation: {
    source?: { data?: unknown } | null
    target?: { data?: unknown } | null
  }
}

export type DragMove = {
  taskId: string
  statusKey: BoardStatusKey
}

const isBoardStatusKey = (value: unknown): value is BoardStatusKey =>
  value === 'todo' || value === 'inProgress' || value === 'done'

export const groupTasksByStatus = (tasks: Task[]) =>
  tasks.reduce<Record<BoardStatusKey, Task[]>>(
    (groupedTasks, task) => {
      groupedTasks[task.statusKey].push(task)

      return groupedTasks
    },
    { todo: [], inProgress: [], done: [] },
  )

export const getValidDragMove = (event: DragMoveEvent): DragMove | null => {
  if (event.canceled) {
    return null
  }

  const sourceData = event.operation.source?.data as
    | { taskId?: unknown }
    | undefined
  const targetData = event.operation.target?.data as
    | { statusKey?: unknown }
    | undefined
  const taskId = sourceData?.taskId
  const statusKey = targetData?.statusKey

  if (typeof taskId !== 'string' || !isBoardStatusKey(statusKey)) {
    return null
  }

  return { taskId, statusKey }
}
