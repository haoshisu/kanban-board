import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { defaultBoardStatuses } from './boardStorage'
import type { Board, BoardInput } from './types'

type BoardRow = {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

const normalizeBoardInput = (input: BoardInput): BoardInput => ({
  name: input.name.trim(),
  description: input.description.trim(),
})

const createOptimisticId = () => {
  if (crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const mapBoardRow = (row: BoardRow): Board => ({
  id: row.id,
  name: row.name,
  description: row.description ?? '',
  statuses: defaultBoardStatuses,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const useBoards = (ownerId: string | undefined) => {
  const [boards, setBoards] = useState<Board[]>([])
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null)
  const [isLoadingBoards, setIsLoadingBoards] = useState(false)
  const [boardError, setBoardError] = useState('')

  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === selectedBoardId) ?? null,
    [boards, selectedBoardId],
  )

  useEffect(() => {
    if (!ownerId) {
      return
    }

    let isMounted = true

    const loadBoards = async () => {
      setIsLoadingBoards(true)
      setBoardError('')

      const { data, error } = await supabase
        .from('boards')
        .select('id, name, description, created_at, updated_at')
        .eq('owner_id', ownerId)
        .order('updated_at', { ascending: false })

      if (!isMounted) {
        return
      }

      if (error) {
        setBoardError(error.message)
        setBoards([])
        setSelectedBoardId(null)
        setIsLoadingBoards(false)
        return
      }

      const nextBoards = data.map(mapBoardRow)
      setBoards(nextBoards)
      setSelectedBoardId((currentId) => {
        if (nextBoards.some((board) => board.id === currentId)) {
          return currentId
        }

        return nextBoards[0]?.id ?? null
      })
      setIsLoadingBoards(false)
    }

    void loadBoards()

    return () => {
      isMounted = false
    }
  }, [ownerId])

  const selectBoard = (id: string) => {
    setSelectedBoardId(id)
  }

  const createBoard = async (input: BoardInput) => {
    const normalizedInput = normalizeBoardInput(input)

    if (!ownerId || !normalizedInput.name) {
      return null
    }

    setBoardError('')
    const now = new Date().toISOString()
    const optimisticBoard: Board = {
      id: createOptimisticId(),
      name: normalizedInput.name,
      description: normalizedInput.description,
      statuses: defaultBoardStatuses,
      createdAt: now,
      updatedAt: now,
    }

    setBoards((currentBoards) => [optimisticBoard, ...currentBoards])
    setSelectedBoardId(optimisticBoard.id)

    const { data, error } = await supabase
      .from('boards')
      .insert({
        id: optimisticBoard.id,
        owner_id: ownerId,
        name: normalizedInput.name,
        description: normalizedInput.description,
      })
      .select('id, name, description, created_at, updated_at')
      .single()

    if (error) {
      setBoardError(error.message)
      setBoards((currentBoards) => {
        const nextBoards = currentBoards.filter(
          (board) => board.id !== optimisticBoard.id,
        )

        setSelectedBoardId((currentId) =>
          currentId === optimisticBoard.id ? nextBoards[0]?.id ?? null : currentId,
        )

        return nextBoards
      })
      return null
    }

    const board = mapBoardRow(data)
    setBoards((currentBoards) =>
      currentBoards.map((currentBoard) =>
        currentBoard.id === optimisticBoard.id ? board : currentBoard,
      ),
    )

    return board
  }

  const updateBoard = async (id: string, input: BoardInput) => {
    const normalizedInput = normalizeBoardInput(input)

    if (!normalizedInput.name) {
      return null
    }

    setBoardError('')
    const previousBoard = boards.find((board) => board.id === id)

    if (!previousBoard) {
      return null
    }

    const optimisticBoard: Board = {
      ...previousBoard,
      name: normalizedInput.name,
      description: normalizedInput.description,
      updatedAt: new Date().toISOString(),
    }

    setBoards((currentBoards) =>
      currentBoards.map((board) => (board.id === id ? optimisticBoard : board)),
    )

    const { data, error } = await supabase
      .from('boards')
      .update({
        name: normalizedInput.name,
        description: normalizedInput.description,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, name, description, created_at, updated_at')
      .single()

    if (error) {
      setBoardError(error.message)
      setBoards((currentBoards) =>
        currentBoards.map((board) => (board.id === id ? previousBoard : board)),
      )
      return null
    }

    const updatedBoard = mapBoardRow(data)
    setBoards((currentBoards) =>
      currentBoards.map((board) => (board.id === id ? updatedBoard : board)),
    )

    return updatedBoard
  }

  const deleteBoard = async (id: string) => {
    setBoardError('')
    const previousBoards = boards
    const previousSelectedBoardId = selectedBoardId
    const nextBoards = boards.filter((board) => board.id !== id)

    setBoards(nextBoards)

    if (selectedBoardId === id) {
      setSelectedBoardId(nextBoards[0]?.id ?? null)
    }

    const { error } = await supabase.from('boards').delete().eq('id', id)

    if (error) {
      setBoardError(error.message)
      setBoards(previousBoards)
      setSelectedBoardId(previousSelectedBoardId)
      return
    }
  }

  return {
    boards,
    selectedBoard,
    isLoadingBoards,
    boardError,
    selectBoard,
    createBoard,
    updateBoard,
    deleteBoard,
  }
}
