import { useCallback, useEffect, useMemo, useState } from 'react'
import { isLocalDataMode } from '../lib/localDataMode'
import { getSupabase } from '../lib/supabase'
import type { BoardStatusKey } from '../board'
import type { Database } from '../lib/database.types'
import { loadTasks as loadStoredTasks, saveTasks } from './taskStorage'
import type { Task, TaskInput } from './types'

type TaskStatus = Database['public']['Tables']['tasks']['Row']['status']

type TaskRow = {
  id: string
  board_id: string
  title: string
  description: string | null
  status: TaskStatus
  position: number
  created_at: string
  updated_at: string
}

const statusKeyToDbStatus: Record<BoardStatusKey, TaskStatus> = {
  todo: 'todo',
  inProgress: 'in_progress',
  done: 'done',
}

const dbStatusToStatusKey: Record<TaskStatus, BoardStatusKey> = {
  todo: 'todo',
  in_progress: 'inProgress',
  done: 'done',
}

const normalizeTaskInput = (input: TaskInput): TaskInput => ({
  title: input.title.trim(),
  description: input.description.trim(),
  statusKey: input.statusKey,
})

const createOptimisticId = () => {
  if (crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const mapTaskRow = (row: TaskRow): Task => ({
  id: row.id,
  boardId: row.board_id,
  title: row.title,
  description: row.description ?? '',
  statusKey: dbStatusToStatusKey[row.status],
  position: row.position,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const getNextPosition = (tasks: Task[], statusKey: BoardStatusKey) => {
  const positions = tasks
    .filter((task) => task.statusKey === statusKey)
    .map((task) => task.position)

  return positions.length ? Math.max(...positions) + 1 : 0
}

export const useTasks = (boardId: string | null) => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoadingTasks, setIsLoadingTasks] = useState(false)
  const [taskError, setTaskError] = useState('')

  const sortedTasks = useMemo(
    () => {
      if (!boardId) {
        return []
      }

      return [...tasks].sort((firstTask, secondTask) => {
        if (firstTask.statusKey !== secondTask.statusKey) {
          return firstTask.statusKey.localeCompare(secondTask.statusKey)
        }

        return firstTask.position - secondTask.position
      })
    },
    [boardId, tasks],
  )

  useEffect(() => {
    if (!boardId) {
      return
    }

    if (isLocalDataMode()) {
      let isMounted = true

      const loadLocalTasks = async () => {
        await Promise.resolve()

        if (!isMounted) {
          return
        }

        setTasks(loadStoredTasks().filter((task) => task.boardId === boardId))
        setIsLoadingTasks(false)
      }

      void loadLocalTasks()

      return () => {
        isMounted = false
      }
    }

    let isMounted = true

    const loadTasks = async () => {
      setIsLoadingTasks(true)
      setTaskError('')

      const supabase = await getSupabase()

      const { data, error } = await supabase
        .from('tasks')
        .select(
          'id, board_id, title, description, status, position, created_at, updated_at',
        )
        .eq('board_id', boardId)
        .order('status', { ascending: true })
        .order('position', { ascending: true })

      if (!isMounted) {
        return
      }

      if (error) {
        setTaskError(error.message)
        setTasks([])
        setIsLoadingTasks(false)
        return
      }

      setTasks(data.map(mapTaskRow))
      setIsLoadingTasks(false)
    }

    void loadTasks()

    return () => {
      isMounted = false
    }
  }, [boardId])

  const createTask = useCallback(async (input: TaskInput) => {
    if (!boardId) {
      return null
    }

    const normalizedInput = normalizeTaskInput(input)

    if (!normalizedInput.title) {
      return null
    }

    setTaskError('')
    const now = new Date().toISOString()
    const optimisticTask: Task = {
      id: createOptimisticId(),
      boardId,
      title: normalizedInput.title,
      description: normalizedInput.description,
      statusKey: normalizedInput.statusKey,
      position: getNextPosition(tasks, normalizedInput.statusKey),
      createdAt: now,
      updatedAt: now,
    }

    setTasks((currentTasks) => [...currentTasks, optimisticTask])

    if (isLocalDataMode()) {
      const nextTasks = [...tasks, optimisticTask]
      const allTasks = [...loadStoredTasks(), optimisticTask]

      setTasks(nextTasks)
      saveTasks(allTasks)

      return optimisticTask
    }

    const supabase = await getSupabase()
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        id: optimisticTask.id,
        board_id: boardId,
        title: normalizedInput.title,
        description: normalizedInput.description,
        status: statusKeyToDbStatus[normalizedInput.statusKey],
        position: optimisticTask.position,
      })
      .select(
        'id, board_id, title, description, status, position, created_at, updated_at',
      )
      .single()

    if (error) {
      setTaskError(error.message)
      setTasks((currentTasks) =>
        currentTasks.filter((task) => task.id !== optimisticTask.id),
      )
      return null
    }

    const task = mapTaskRow(data)
    setTasks((currentTasks) =>
      currentTasks.map((currentTask) =>
        currentTask.id === optimisticTask.id ? task : currentTask,
      ),
    )

    return task
  }, [boardId, tasks])

  const updateTask = useCallback(async (id: string, input: TaskInput) => {
    const normalizedInput = normalizeTaskInput(input)

    if (!normalizedInput.title) {
      return null
    }

    const currentTask = tasks.find((task) => task.id === id)

    if (!currentTask) {
      return null
    }

    const position =
      currentTask.statusKey === normalizedInput.statusKey
        ? currentTask.position
        : getNextPosition(tasks, normalizedInput.statusKey)

    setTaskError('')
    const optimisticTask: Task = {
      ...currentTask,
      title: normalizedInput.title,
      description: normalizedInput.description,
      statusKey: normalizedInput.statusKey,
      position,
      updatedAt: new Date().toISOString(),
    }

    setTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === id ? optimisticTask : task)),
    )

    if (isLocalDataMode()) {
      const nextTasks = tasks.map((task) => (task.id === id ? optimisticTask : task))
      const allTasks = loadStoredTasks().map((task) =>
        task.id === id ? optimisticTask : task,
      )

      setTasks(nextTasks)
      saveTasks(allTasks)

      return optimisticTask
    }

    const supabase = await getSupabase()
    const { data, error } = await supabase
      .from('tasks')
      .update({
        title: normalizedInput.title,
        description: normalizedInput.description,
        status: statusKeyToDbStatus[normalizedInput.statusKey],
        position,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(
        'id, board_id, title, description, status, position, created_at, updated_at',
      )
      .single()

    if (error) {
      setTaskError(error.message)
      setTasks((currentTasks) =>
        currentTasks.map((task) => (task.id === id ? currentTask : task)),
      )
      return null
    }

    const updatedTask = mapTaskRow(data)
    setTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === id ? updatedTask : task)),
    )

    return updatedTask
  }, [tasks])

  const deleteTask = useCallback(async (id: string) => {
    setTaskError('')
    const deletedTask = tasks.find((task) => task.id === id)

    if (!deletedTask) {
      return
    }

    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== id))

    if (isLocalDataMode()) {
      saveTasks(loadStoredTasks().filter((task) => task.id !== id))
      return
    }

    const supabase = await getSupabase()
    const { error } = await supabase.from('tasks').delete().eq('id', id)

    if (error) {
      setTaskError(error.message)
      setTasks((currentTasks) => [...currentTasks, deletedTask])
      return
    }
  }, [tasks])

  const moveTaskStatus = useCallback(async (id: string, statusKey: BoardStatusKey) => {
    const currentTask = tasks.find((task) => task.id === id)

    if (!currentTask || currentTask.statusKey === statusKey) {
      return
    }

    const nextPosition = getNextPosition(tasks, statusKey)

    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === id
          ? {
              ...task,
              statusKey,
              position: nextPosition,
              updatedAt: new Date().toISOString(),
            }
          : task,
      ),
    )

    if (isLocalDataMode()) {
      const movedTask = {
        ...currentTask,
        statusKey,
        position: nextPosition,
        updatedAt: new Date().toISOString(),
      }
      const nextTasks = tasks.map((task) => (task.id === id ? movedTask : task))
      const allTasks = loadStoredTasks().map((task) =>
        task.id === id ? movedTask : task,
      )

      setTasks(nextTasks)
      saveTasks(allTasks)

      return
    }

    const supabase = await getSupabase()
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: statusKeyToDbStatus[statusKey],
        position: nextPosition,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(
        'id, board_id, title, description, status, position, created_at, updated_at',
      )
      .single()

    if (error) {
      setTaskError(error.message)
      setTasks((currentTasks) =>
        currentTasks.map((task) => (task.id === id ? currentTask : task)),
      )
      return
    }

    const updatedTask = mapTaskRow(data)
    setTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === id ? updatedTask : task)),
    )
  }, [tasks])

  const deleteTasksByBoard = useCallback(async (targetBoardId: string) => {
    setTaskError('')

    if (isLocalDataMode()) {
      saveTasks(loadStoredTasks().filter((task) => task.boardId !== targetBoardId))
      setTasks((currentTasks) =>
        currentTasks.filter((task) => task.boardId !== targetBoardId),
      )
      return
    }

    const supabase = await getSupabase()
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('board_id', targetBoardId)

    if (error) {
      setTaskError(error.message)
      return
    }

    setTasks((currentTasks) =>
      currentTasks.filter((task) => task.boardId !== targetBoardId),
    )
  }, [])

  return {
    tasks: sortedTasks,
    isLoadingTasks,
    taskError,
    createTask,
    updateTask,
    deleteTask,
    moveTaskStatus,
    deleteTasksByBoard,
  }
}
