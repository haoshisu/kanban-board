import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { captureAppError } from "../lib/errorReporting"
import { isLocalDataMode } from "../lib/localDataMode"
import { getSupabase } from "../lib/supabase"
import { useRealtimeTableRefresh } from "../realtime/useRealtimeTableRefresh"
import { deleteCachedTasksByBoard } from "../sync/taskCacheRepository"
import { readCachedBoards, replaceCachedBoards } from "../sync/boardCacheRepository"
import { enqueueLocalReplicaWrite } from "../sync/localReplicaWriteQueue"
import { persistBoardRealtimePayload } from "../sync/boardRealtimeCache"
import { stageBoardDelete, stageBoardUpsert } from "../sync/pendingMutationRepository"
import { useOfflineSync } from "../sync/offlineSyncContext"
import type { PendingMutation } from "../sync/localReplicaTypes"
import { applyBoardRealtimePayload } from "./boardRealtime"
import { defaultBoardStatuses, loadBoards, saveBoards } from "./boardStorage"
import { mapBoardRow, normalizeBoardInput, type BoardRow } from "./boardUtils"
import type { Board, BoardInput } from "./types"

export const BOARD_SELECT_COLUMNS = "id, owner_id, name, description, version, created_at, updated_at" as const

const createOptimisticId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

const applyPendingBoards = (boards: Board[], mutations: PendingMutation[]) =>
 mutations
  .filter((mutation) => mutation.entityType === "board")
  .reduce((currentBoards, mutation) => {
   if (mutation.operation === "delete") {
    return currentBoards.filter((board) => board.id !== mutation.entityId)
   }

   const board = mutation.payload as Board
   const exists = currentBoards.some((currentBoard) => currentBoard.id === board.id)
   return exists
    ? currentBoards.map((currentBoard) => (currentBoard.id === board.id ? board : currentBoard))
    : [board, ...currentBoards]
  }, boards)

export const useBoards = (ownerId: string | undefined) => {
 const localMode = isLocalDataMode()
 const { isOnline, isRemoteReady, mutations, pendingEntityKeys, requestSync, syncRevision } = useOfflineSync()
 const dataKey = `${ownerId ?? ""}::${localMode ? "local" : "remote"}`
 const initialBoards = ownerId && localMode ? loadBoards() : []
 const [boards, setBoards] = useState<Board[]>(initialBoards)
 const [selectedBoardId, setSelectedBoardId] = useState<string | null>(initialBoards[0]?.id ?? null)
 const [loadedDataKey, setLoadedDataKey] = useState(dataKey)
 const [isLoadingBoards, setIsLoadingBoards] = useState(Boolean(ownerId) && !localMode)
 const [boardError, setBoardError] = useState("")
 const loadRequestIdRef = useRef(0)
 const liveDataRevisionRef = useRef(0)
 const snapshotInFlightRef = useRef(false)
 const queuedRealtimeRef = useRef<RealtimePostgresChangesPayload<BoardRow>[]>([])

 if (dataKey !== loadedDataKey) {
  const nextBoards = ownerId && localMode ? loadBoards() : []
  setLoadedDataKey(dataKey)
  setBoards(nextBoards)
  setSelectedBoardId(nextBoards[0]?.id ?? null)
  setBoardError("")
  setIsLoadingBoards(Boolean(ownerId) && !localMode)
 }

 const selectedBoard = useMemo(
  () => boards.find((board) => board.id === selectedBoardId) ?? null,
  [boards, selectedBoardId],
 )

 const refreshBoards = useCallback(
  async (showLoading = false) => {
   if (!ownerId || localMode || !isOnline || !isRemoteReady) return
   const requestId = ++loadRequestIdRef.current
   snapshotInFlightRef.current = true
   queuedRealtimeRef.current = []
   if (showLoading) setIsLoadingBoards(true)

   try {
    const supabase = await getSupabase()
    const { data, error } = await supabase
     .from("boards")
     .select(BOARD_SELECT_COLUMNS)
     .order("updated_at", { ascending: false })

    if (requestId !== loadRequestIdRef.current) return
    if (error) throw error

    let remoteBoards = (data ?? []).map(mapBoardRow)
    for (const payload of queuedRealtimeRef.current) {
     remoteBoards = applyBoardRealtimePayload(remoteBoards, payload)
    }
    const nextBoards = applyPendingBoards(remoteBoards, mutations)
    liveDataRevisionRef.current += 1
    setBoards(nextBoards)
    setSelectedBoardId((currentId) =>
     nextBoards.some((board) => board.id === currentId) ? currentId : (nextBoards[0]?.id ?? null),
    )
    void enqueueLocalReplicaWrite(`boards:${ownerId}`, () => replaceCachedBoards(ownerId, nextBoards)).catch(
     (error: unknown) => captureAppError(error, { area: "local-replica", action: "replaceBoards", ownerId }),
    )
   } catch (error) {
    if (requestId !== loadRequestIdRef.current) return
    captureAppError(error, { area: "boards", action: "refreshBoards", ownerId })
    setBoardError("載入 boards 時發生錯誤，將繼續顯示本機資料")
   } finally {
    if (requestId === loadRequestIdRef.current) {
     snapshotInFlightRef.current = false
     queuedRealtimeRef.current = []
     setIsLoadingBoards(false)
    }
   }
  },
  [isOnline, isRemoteReady, localMode, mutations, ownerId],
 )

 const handleRealtimeChange = useCallback(
  (payload: RealtimePostgresChangesPayload<BoardRow>) => {
   const id = payload.eventType === "DELETE" ? payload.old.id : payload.new.id
   if (typeof id === "string" && pendingEntityKeys.has(`board:${id}`)) return
   if (snapshotInFlightRef.current) queuedRealtimeRef.current.push(payload)
   liveDataRevisionRef.current += 1

   setBoards((current) => {
    const next = applyBoardRealtimePayload(current, payload)
    setSelectedBoardId((currentId) =>
     next.some((board) => board.id === currentId) ? currentId : (next[0]?.id ?? null),
    )
    return next
   })

   if (!ownerId) return
   void enqueueLocalReplicaWrite(`boards:${ownerId}`, () => persistBoardRealtimePayload(ownerId, payload)).catch(
    (error: unknown) => captureAppError(error, { area: "local-replica", action: "persistBoardRealtime", ownerId }),
   )

   if (payload.eventType === "DELETE" && typeof payload.old.id === "string") {
    void enqueueLocalReplicaWrite(`tasks:${ownerId}:${payload.old.id}`, () =>
     deleteCachedTasksByBoard(ownerId, payload.old.id as string),
    )
   }
  },
  [ownerId, pendingEntityKeys],
 )

 const boardRealtimeStatus = useRealtimeTableRefresh({
  channelName: `boards:${ownerId ?? "anonymous"}`,
  table: "boards",
  enabled: Boolean(ownerId) && !localMode && isOnline && isRemoteReady,
  onChange: handleRealtimeChange,
  onRefresh: () => refreshBoards(false),
 })

 const selectBoard = useCallback((id: string) => setSelectedBoardId(id), [])

 const createBoard = useCallback(
  async (input: BoardInput) => {
   const normalized = normalizeBoardInput(input)
   if (!ownerId || !normalized.name) return null

   const now = new Date().toISOString()
   const board: Board = {
    id: createOptimisticId(),
    ownerId: ownerId,
    name: normalized.name,
    description: normalized.description,
    statuses: defaultBoardStatuses,
    version: 0,
    createdAt: now,
    updatedAt: now,
   }
   setBoardError("")
   setBoards((current) => [board, ...current])
   setSelectedBoardId(board.id)

   if (localMode) {
    saveBoards([board, ...boards])
    return board
   }

   try {
    await stageBoardUpsert(ownerId, board)
    requestSync()
    return board
   } catch (error) {
    setBoards((current) => current.filter((item) => item.id !== board.id))
    setBoardError("無法把 Board 儲存到此裝置")
    captureAppError(error, { area: "local-replica", action: "stageBoardCreate", ownerId })
    return null
   }
  },
  [boards, localMode, ownerId, requestSync],
 )

 const updateBoard = useCallback(
  async (id: string, input: BoardInput) => {
   const normalized = normalizeBoardInput(input)
   const previous = boards.find((board) => board.id === id)
   if (!previous || !normalized.name || !ownerId) return null

   const board = {
    ...previous,
    name: normalized.name,
    description: normalized.description,
    updatedAt: new Date().toISOString(),
   }
   setBoardError("")
   setBoards((current) => current.map((item) => (item.id === id ? board : item)))

   if (localMode) {
    const localBoard = { ...board, version: previous.version + 1 }
    const next = boards.map((item) => (item.id === id ? localBoard : item))
    setBoards(next)
    saveBoards(next)
    return localBoard
   }

   try {
    await stageBoardUpsert(ownerId, board)
    requestSync()
    return board
   } catch (error) {
    setBoards((current) => current.map((item) => (item.id === id ? previous : item)))
    setBoardError("無法把 Board 修改儲存到此裝置")
    captureAppError(error, { area: "local-replica", action: "stageBoardUpdate", ownerId })
    return null
   }
  },
  [boards, localMode, ownerId, requestSync],
 )

 const deleteBoard = useCallback(
  async (id: string) => {
   const board = boards.find((item) => item.id === id)
   if (!board || !ownerId) return
   const previousBoards = boards
   const previousSelectedId = selectedBoardId
   const next = boards.filter((item) => item.id !== id)
   setBoardError("")
   setBoards(next)
   if (selectedBoardId === id) setSelectedBoardId(next[0]?.id ?? null)

   if (localMode) {
    saveBoards(next)
    return
   }

   try {
    await stageBoardDelete(ownerId, board)
    requestSync()
   } catch (error) {
    setBoards(previousBoards)
    setSelectedBoardId(previousSelectedId)
    setBoardError("無法在此裝置刪除 Board")
    captureAppError(error, { area: "local-replica", action: "stageBoardDelete", ownerId })
   }
  },
  [boards, localMode, ownerId, requestSync, selectedBoardId],
 )

 useEffect(() => {
  if (!ownerId || localMode) return
  let cancelled = false
  const revisionAtStart = liveDataRevisionRef.current
  void readCachedBoards(ownerId)
   .then((cached) => {
    if (cancelled || cached.length === 0 || revisionAtStart !== liveDataRevisionRef.current) return
    const next = applyPendingBoards(cached, mutations)
    setBoards(next)
    setSelectedBoardId((currentId) =>
     next.some((board) => board.id === currentId) ? currentId : (next[0]?.id ?? null),
    )
    setIsLoadingBoards(false)
   })
   .catch((error: unknown) => captureAppError(error, { area: "local-replica", action: "readBoards", ownerId }))
  return () => {
   cancelled = true
  }
 }, [localMode, mutations, ownerId])

 useEffect(() => {
  if (!ownerId || localMode || !isOnline || !isRemoteReady) return
  // This starts an external fetch; refreshBoards owns the associated loading state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  void refreshBoards(true)
 }, [isOnline, isRemoteReady, localMode, ownerId, refreshBoards, syncRevision])

 return {
  boards,
  selectedBoard,
  isLoadingBoards: isOnline ? isLoadingBoards : false,
  boardError,
  boardRealtimeStatus,
  selectBoard,
  createBoard,
  updateBoard,
  deleteBoard,
 }
}
