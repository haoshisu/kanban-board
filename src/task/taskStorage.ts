import type { Task } from './types'
import { captureAppError } from '../lib/errorReporting'

const TASK_STORAGE_KEY = 'kanban-board:tasks'

const isTask = (value: unknown): value is Task => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const task = value as Partial<Task>

  return (
    typeof task.id === 'string' &&
    typeof task.boardId === 'string' &&
    typeof task.title === 'string' &&
    typeof task.description === 'string' &&
    typeof task.statusKey === 'string' &&
    typeof task.createdAt === 'string' &&
    typeof task.updatedAt === 'string'
  )
}

export const loadTasks = (): Task[] => {
  try {
    const value = localStorage.getItem(TASK_STORAGE_KEY)

    if (!value) {
      return []
    }

    const parsed: unknown = JSON.parse(value)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(isTask)
  } catch (error) {
    captureAppError(error, {
      area: 'storage',
      action: 'loadTasks',
    })
    return []
  }
}

export const saveTasks = (tasks: Task[]) => {
  try {
    localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks))
  } catch (error) {
    captureAppError(error, {
      area: 'storage',
      action: 'saveTasks',
      taskCount: tasks.length,
    })
  }
}
