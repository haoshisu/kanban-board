import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { captureAppError } from "../lib/errorReporting"
import { isLocalDataMode } from "../lib/localDataMode"
import { getSupabase } from "../lib/supabase"
import { applyBoardRealtimePayload, upsertBoardByVersion } from "./boardRealtime"
import { defaultBoardStatuses, loadBoards as loadStoredBoards, saveBoards } from "./boardStorage"
import { mapBoardRow, normalizeBoardInput } from "./boardUtils"
import type { Board, BoardInput } from "./types"
import type { BoardRow } from "./boardUtils"
import { useRealtimeTableRefresh } from "../realtime/useRealtimeTableRefresh"
import { useSyncRecovery } from "../realtime/useSyncRecovery"
import {
 deleteCachedBoard,
 readCachedBoards,
 replaceCachedBoards,
 upsertCachedBoard,
} from "../sync/boardCacheRepository"
import { enqueueLocalReplicaWrite } from "../sync/localReplicaWriteQueue"
import { persistBoardRealtimePayload } from "../sync/boardRealtimeCache"
import { deleteCachedTasksByBoard } from "../sync/taskCacheRepository"

export const BOARD_SELECT_COLUMNS = "id, owner_id, name, description, version, created_at, updated_at" as const

const createOptimisticId = () => {
 if (crypto.randomUUID) {
  return crypto.randomUUID()
 }

 return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// 純同步分支（沒有 owner、或 local data mode）可以直接算出初始 boards；
// remote 分支則留給 effect 去做真正的非同步 fetch。
const computeSyncBoards = (localDataMode: boolean): Board[] => {
 if (!localDataMode) return []
 return loadStoredBoards()
}

export const useBoards = (ownerId: string | undefined) => {
 const localDataMode = isLocalDataMode()
 const dataKey = `${ownerId ?? ""}::${localDataMode ? "local" : "remote"}`

 const [boards, setBoards] = useState<Board[]>(() => (ownerId ? computeSyncBoards(localDataMode) : []))
 const [selectedBoardId, setSelectedBoardId] = useState<string | null>(() =>
  ownerId ? (computeSyncBoards(localDataMode)[0]?.id ?? null) : null,
 )
 const [loadedDataKey, setLoadedDataKey] = useState(dataKey)
 const [isLoadingBoards, setIsLoadingBoards] = useState(Boolean(ownerId) && !localDataMode)
 const [boardError, setBoardError] = useState("")
 const loadRequestIdRef = useRef(0)
 //  用途是記錄「畫面是否已經收到 Supabase 或 Realtime 的新資料」。
 // 只要 Supabase 或 Realtime 更新畫面，就把它加一：
 // liveDataRevisionRef.current += 1
 // 如果 IndexedDB 開始讀取時是 0，讀完變成 1，代表期間已經收到更新，這份舊快取就不能再套用。
 const liveDataRevisionRef = useRef(0)
 const isSnapshotInFlightRef = useRef(false)
 const queuedRealtimePayloadsRef = useRef<RealtimePostgresChangesPayload<BoardRow>[]>([])

 // ownerId 或 localDataMode 改變時，在 render 當下直接重設 boards，
 // 不透過 effect + setState，避免多一次 commit 後的 re-render。
 if (dataKey !== loadedDataKey) {
  setLoadedDataKey(dataKey)
  setBoardError("")

  if (!ownerId) {
   setBoards([])
   setSelectedBoardId(null)
   setIsLoadingBoards(false)
  } else if (localDataMode) {
   const nextBoards = computeSyncBoards(true)

   setBoards(nextBoards)
   setSelectedBoardId(nextBoards[0]?.id ?? null)
   setIsLoadingBoards(false)
  } else {
   setIsLoadingBoards(true)
  }
 }

 const selectedBoard = useMemo(
  () => boards.find((board) => board.id === selectedBoardId) ?? null,
  [boards, selectedBoardId],
 )

 const refreshBoards = useCallback(
  async (showLoading = false) => {
   if (!ownerId || localDataMode) return
   const requestId = ++loadRequestIdRef.current
   isSnapshotInFlightRef.current = true
   queuedRealtimePayloadsRef.current = []

   if (showLoading) {
    setIsLoadingBoards(true)
   }
   try {
    const supabase = await getSupabase()
    const { data, error } = await supabase
     .from("boards")
     .select(BOARD_SELECT_COLUMNS)
     .eq("owner_id", ownerId)
     .order("updated_at", { ascending: false })

    if (requestId !== loadRequestIdRef.current) return

    if (error) {
     setBoardError(error.message)
     return
    }
    let nextBoards = data.map(mapBoardRow)

    for (const payload of queuedRealtimePayloadsRef.current) {
     nextBoards = applyBoardRealtimePayload(nextBoards, ownerId, payload)
    }

    queuedRealtimePayloadsRef.current = []
    isSnapshotInFlightRef.current = false
    liveDataRevisionRef.current += 1
    setBoards(nextBoards)
    setSelectedBoardId((currentId) => {
     if (nextBoards.some((board) => board.id === currentId)) return currentId
     return nextBoards[0]?.id ?? null
    })

    // 為什麼使用 void 而不是 await：

    // - 畫面不用等待 IndexedDB 寫完。
    // - IndexedDB 失敗不能阻止 Supabase 資料顯示。
    // - 但失敗仍會由 captureAppError 記錄。
    void enqueueLocalReplicaWrite(
     `boards:${ownerId}`,
     () => replaceCachedBoards(ownerId, nextBoards),
    ).catch((error: unknown) => {
     captureAppError(error, { area: "local-replica", action: "replaceBoards", ownerId })
    })
   } catch (error) {
    if (requestId !== loadRequestIdRef.current) return
    captureAppError(error, {
     area: "boards",
     action: "loadBoards",
     ownerId,
    })
    setBoardError("載入 boards 時發生錯誤，請稍後再試")
   } finally {
    if (requestId === loadRequestIdRef.current) {
     isSnapshotInFlightRef.current = false
     queuedRealtimePayloadsRef.current = []
     setIsLoadingBoards(false)
    }
   }
  },
  [localDataMode, ownerId],
 )

 const handleBoardRealtimeChange = useCallback(
  (payload: RealtimePostgresChangesPayload<BoardRow>) => {
   if (isSnapshotInFlightRef.current) {
    queuedRealtimePayloadsRef.current.push(payload)
   }

   liveDataRevisionRef.current += 1

   setBoards((currentBoards) => {
    const nextBoards = applyBoardRealtimePayload(currentBoards, ownerId, payload)

    setSelectedBoardId((currentId) => {
     if (nextBoards.some((board) => board.id === currentId)) {
      return currentId
     }

     return nextBoards[0]?.id ?? null
    })

    return nextBoards
   })

   if (ownerId) {
    void enqueueLocalReplicaWrite(
     `boards:${ownerId}`,
     () => persistBoardRealtimePayload(ownerId, payload),
    ).catch((error: unknown) => {
     captureAppError(error, {
      area: "local-replica",
      action: "persistBoardRealtime",
      ownerId,
     })
    })

    if (payload.eventType === "DELETE" && typeof payload.old.id === "string") {
     const deletedBoardId = payload.old.id

     void enqueueLocalReplicaWrite(
      `tasks:${ownerId}:${deletedBoardId}`,
      () => deleteCachedTasksByBoard(ownerId, deletedBoardId),
     ).catch((error: unknown) => {
      captureAppError(error, {
       area: "local-replica",
       action: "deleteTasksByBoard",
       ownerId,
       boardId: deletedBoardId,
      })
     })
    }
   }
  },
  [ownerId],
 )

 const boardRealtimeStatus = useRealtimeTableRefresh({
  channelName: `boards:${ownerId ?? "anonymous"}`,
  table: "boards",
  enabled: Boolean(ownerId) && !localDataMode,
  onChange: handleBoardRealtimeChange,
  onRefresh: () => refreshBoards(false),
 })

 const persistConfirmedBoard = useCallback(
  (board: Board) => {
   if (!ownerId) return

   void enqueueLocalReplicaWrite(
    `boards:${ownerId}`,
    () => upsertCachedBoard(ownerId, board),
   ).catch((error: unknown) => {
    captureAppError(error, {
     area: "local-replica",
     action: "upsertBoard",
     ownerId,
     boardId: board.id,
    })
   })
  },
  [ownerId],
 )

 const removeConfirmedBoard = useCallback(
  (boardId: string) => {
   if (!ownerId) return

   void enqueueLocalReplicaWrite(
    `boards:${ownerId}`,
    () => deleteCachedBoard(ownerId, boardId),
   ).catch((error: unknown) => {
    captureAppError(error, {
     area: "local-replica",
     action: "deleteBoard",
     ownerId,
     boardId,
    })
   })

   void enqueueLocalReplicaWrite(
    `tasks:${ownerId}:${boardId}`,
    () => deleteCachedTasksByBoard(ownerId, boardId),
   ).catch((error: unknown) => {
    captureAppError(error, {
     area: "local-replica",
     action: "deleteTasksByBoard",
     ownerId,
     boardId,
    })
   })
  },
  [ownerId],
 )

 const selectBoard = useCallback((id: string) => {
  setSelectedBoardId(id)
 }, [])

 const createBoard = useCallback(
  async (input: BoardInput) => {
   const normalizedInput = normalizeBoardInput(input)

   if (!ownerId || !normalizedInput.name) {
    return null
   }

   setBoardError("")
   const now = new Date().toISOString()
   const optimisticBoard: Board = {
    id: createOptimisticId(),
    name: normalizedInput.name,
    description: normalizedInput.description,
    statuses: defaultBoardStatuses,
    version: 0,
    createdAt: now,
    updatedAt: now,
   }

   setBoards((currentBoards) => [optimisticBoard, ...currentBoards])
   setSelectedBoardId(optimisticBoard.id)

   if (isLocalDataMode()) {
    const nextBoards = [optimisticBoard, ...boards]

    setBoards(nextBoards)
    saveBoards(nextBoards)

    return optimisticBoard
   }

   let data: BoardRow | null = null
   let error: { message: string } | null

   try {
    const supabase = await getSupabase()
    const result = await supabase
     .from("boards")
     .insert({
      id: optimisticBoard.id,
      owner_id: ownerId,
      name: normalizedInput.name,
      description: normalizedInput.description,
     })
     .select(BOARD_SELECT_COLUMNS)
     .single()

    data = result.data
    error = result.error
   } catch (caughtError) {
    captureAppError(caughtError, {
     area: "boards",
     action: "createBoard",
     ownerId,
    })
    error = { message: "建立 board 時發生錯誤，請稍後再試" }
   }

   if (!data && !error) {
    error = { message: "建立 board 時沒有收到有效資料" }
   }

   if (error) {
    setBoardError(error.message)
    setBoards((currentBoards) => {
     const nextBoards = currentBoards.filter((board) => board.id !== optimisticBoard.id)

     setSelectedBoardId((currentId) => (currentId === optimisticBoard.id ? (nextBoards[0]?.id ?? null) : currentId))

     return nextBoards
    })
    return null
   }

   if (!data) {
    return null
   }

   const board = mapBoardRow(data)
   setBoards((currentBoards) => {
    const boardsWithoutOptimisticId =
     board.id === optimisticBoard.id
      ? currentBoards
      : currentBoards.filter((currentBoard) => currentBoard.id !== optimisticBoard.id)

    return upsertBoardByVersion(boardsWithoutOptimisticId, board)
   })
   persistConfirmedBoard(board)

   return board
  },
  [boards, ownerId, persistConfirmedBoard],
 )

 const updateBoard = useCallback(
  async (id: string, input: BoardInput) => {
   const normalizedInput = normalizeBoardInput(input)

   if (!normalizedInput.name) {
    return null
   }

   setBoardError("")
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

   setBoards((currentBoards) => currentBoards.map((board) => (board.id === id ? optimisticBoard : board)))

   if (isLocalDataMode()) {
    const localUpdatedBoard = {
     ...optimisticBoard,
     version: previousBoard.version + 1,
    }
    const nextBoards = boards.map((board) => (board.id === id ? localUpdatedBoard : board))

    setBoards(nextBoards)
    saveBoards(nextBoards)

    return localUpdatedBoard
   }

   let data: BoardRow | null = null
   let error: { message: string } | null

   try {
    const supabase = await getSupabase()
    const result = await supabase
     .from("boards")
     .update({
      name: normalizedInput.name,
      description: normalizedInput.description,
      updated_at: new Date().toISOString(),
     })
     .eq("id", id)
     .eq("version", previousBoard.version)
     .select(BOARD_SELECT_COLUMNS)
     .maybeSingle()

    data = result.data
    error = result.error
   } catch (caughtError) {
    captureAppError(caughtError, {
     area: "boards",
     action: "updateBoard",
     boardId: id,
    })
    error = { message: "更新 board 時發生錯誤，請稍後再試" }
   }

   if (error) {
    setBoardError(error.message)
    setBoards((currentBoards) => currentBoards.map((board) => (board.id === id ? previousBoard : board)))
    return null
   }

   if (!data) {
    setBoardError("這個 Board 已由其他裝置更新，已載入最新內容。")
    await refreshBoards(false)
    return null
   }

   const updatedBoard = mapBoardRow(data)
   setBoards((currentBoards) => upsertBoardByVersion(currentBoards, updatedBoard))
   persistConfirmedBoard(updatedBoard)

   return updatedBoard
  },
  [boards, persistConfirmedBoard, refreshBoards],
 )

 const deleteBoard = useCallback(
  async (id: string) => {
   setBoardError("")
   const previousBoards = boards
   const previousSelectedBoardId = selectedBoardId
   const nextBoards = boards.filter((board) => board.id !== id)

   setBoards(nextBoards)

   if (selectedBoardId === id) {
    setSelectedBoardId(nextBoards[0]?.id ?? null)
   }

   if (isLocalDataMode()) {
    saveBoards(nextBoards)
    return
   }

   let error: { message: string } | null
   let wasDeleted = false

   try {
    const supabase = await getSupabase()
    const deletedBoard = boards.find((board) => board.id === id)

    if (!deletedBoard) {
     return
    }

    const result = await supabase
     .from("boards")
     .delete()
     .eq("id", id)
     .eq("version", deletedBoard.version)
     .select("id")
     .maybeSingle()

    error = result.error
    wasDeleted = Boolean(result.data)

    if (!result.data && !error) {
     setBoardError("這個 Board 已由其他裝置更新，已載入最新內容。")
     await refreshBoards(false)
    }
   } catch (caughtError) {
    captureAppError(caughtError, {
     area: "boards",
     action: "deleteBoard",
     boardId: id,
    })
    error = { message: "刪除 board 時發生錯誤，請稍後再試" }
   }

   if (error) {
    setBoardError(error.message)
    setBoards(previousBoards)
    setSelectedBoardId(previousSelectedBoardId)
    return
   }

   if (wasDeleted) {
    removeConfirmedBoard(id)
   }
  },
  [boards, refreshBoards, removeConfirmedBoard, selectedBoardId],
 )

 useEffect(() => {
  if (!ownerId || localDataMode) return

  let cancelled = false
  const revisionAtStart = liveDataRevisionRef.current

  void readCachedBoards(ownerId)
   .then((cachedBoards) => {
    // 使用者已經切換帳號或 component 已卸載。
    if (cancelled) return

    // IndexedDB 讀取期間已經收到 Supabase 或 Realtime 新資料，
    // 因此不能讓舊快取覆蓋新資料。
    if (revisionAtStart !== liveDataRevisionRef.current) return

    // 沒有快取時繼續顯示 loading，等待 Supabase。
    if (cachedBoards.length === 0) return

    setBoards(cachedBoards)

    setSelectedBoardId((currentId) => {
     const currentBoardStillExists = cachedBoards.some((board) => board.id === currentId)

     if (currentBoardStillExists) {
      return currentId
     }

     return cachedBoards[0]?.id ?? null
    })

    // 快取已經可以顯示，不需要繼續顯示整頁 skeleton。
    setIsLoadingBoards(false)
   })
   .catch((error: unknown) => {
    // IndexedDB 壞掉不能阻止 Supabase 繼續載入。
    captureAppError(error, {
     area: "local-replica",
     action: "readBoards",
     ownerId,
    })
   })

  return () => {
   cancelled = true
  }
 }, [localDataMode, ownerId])

 useEffect(() => {
  loadRequestIdRef.current += 1

  if (!ownerId || localDataMode) return

  // refreshBoards 一開始會同步呼叫 setIsLoadingBoards(true) 才開始 fetch，
  // 這是標準的「開始 fetch 前先亮 loading」寫法，不是可搬到 render 當下算的衍生狀態。
  // eslint-disable-next-line react-hooks/set-state-in-effect
  void refreshBoards(true)

  return () => {
   loadRequestIdRef.current += 1
  }
 }, [ownerId, localDataMode, refreshBoards])

 useSyncRecovery(() => refreshBoards(false), Boolean(ownerId) && !localDataMode)

 return {
  boards,
  selectedBoard,
  isLoadingBoards,
  boardError,
  boardRealtimeStatus,
  selectBoard,
  createBoard,
  updateBoard,
  deleteBoard,
 }
}
