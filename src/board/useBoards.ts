import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { captureAppError } from "../lib/errorReporting";
import { isLocalDataMode } from "../lib/localDataMode";
import { getSupabase } from "../lib/supabase";
import { defaultBoardStatuses, loadBoards as loadStoredBoards, saveBoards } from "./boardStorage";
import { mapBoardRow, normalizeBoardInput } from "./boardUtils";
import type { Board, BoardInput } from "./types";
import type { BoardRow } from "./boardUtils";
import { useRealtimeTableRefresh } from "../realtime/useRealtimeTableRefresh";
import { useSyncRecovery } from "../realtime/useSyncRecovery";

const createOptimisticId = () => {
 if (crypto.randomUUID) {
  return crypto.randomUUID();
 }

 return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const useBoards = (ownerId: string | undefined) => {
 const [boards, setBoards] = useState<Board[]>([]);
 const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
 const [isLoadingBoards, setIsLoadingBoards] = useState(false);
 const [boardError, setBoardError] = useState("");
 const loadRequestIdRef = useRef(0);
 const localDataMode = isLocalDataMode();

 const selectedBoard = useMemo(
  () => boards.find((board) => board.id === selectedBoardId) ?? null,
  [boards, selectedBoardId],
 );

 const refreshBoards = useCallback(
  async (showLoading = false) => {
   if (!ownerId || localDataMode) return;
   const requestId = ++loadRequestIdRef.current;
   if (showLoading) {
    setIsLoadingBoards(true);
   }
   try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
     .from("boards")
     .select("id,name,description,created_at, updated_at")
     .eq("owner_id", ownerId)
     .order("updated_at", { ascending: false });

    if (requestId !== loadRequestIdRef.current) return;

    if (error) {
     setBoardError(error.message);
     return;
    }
    const nextBoards = data.map(mapBoardRow);
    setBoards(nextBoards);
    setSelectedBoardId((currentId) => {
     if (nextBoards.some((board) => board.id === currentId)) return currentId;
     return nextBoards[0]?.id ?? null;
    });
   } catch (error) {
    if (requestId !== loadRequestIdRef.current) return;
    captureAppError(error, {
     area: "board",
     action: "refreshTasks",
     ownerId,
    });
   } finally {
    if (showLoading && requestId === loadRequestIdRef.current) setIsLoadingBoards(false);
   }
  },
  [localDataMode, ownerId],
 );

 const boardRealtimeStatus = useRealtimeTableRefresh({
  channelName: `boards:${ownerId ?? "anonymous"}`,
  table: "boards",
  enabled: Boolean(ownerId) && !localDataMode,
  onRefresh: () => refreshBoards(false),
 });

 const selectBoard = useCallback((id: string) => {
  setSelectedBoardId(id);
 }, []);

 const createBoard = useCallback(
  async (input: BoardInput) => {
   const normalizedInput = normalizeBoardInput(input);

   if (!ownerId || !normalizedInput.name) {
    return null;
   }

   setBoardError("");
   const now = new Date().toISOString();
   const optimisticBoard: Board = {
    id: createOptimisticId(),
    name: normalizedInput.name,
    description: normalizedInput.description,
    statuses: defaultBoardStatuses,
    createdAt: now,
    updatedAt: now,
   };

   setBoards((currentBoards) => [optimisticBoard, ...currentBoards]);
   setSelectedBoardId(optimisticBoard.id);

   if (isLocalDataMode()) {
    const nextBoards = [optimisticBoard, ...boards];

    setBoards(nextBoards);
    saveBoards(nextBoards);

    return optimisticBoard;
   }

   let data: BoardRow | null = null;
   let error: { message: string } | null;

   try {
    const supabase = await getSupabase();
    const result = await supabase
     .from("boards")
     .insert({
      id: optimisticBoard.id,
      owner_id: ownerId,
      name: normalizedInput.name,
      description: normalizedInput.description,
     })
     .select("id, name, description, created_at, updated_at")
     .single();

    data = result.data;
    error = result.error;
   } catch (caughtError) {
    captureAppError(caughtError, {
     area: "boards",
     action: "createBoard",
     ownerId,
    });
    error = { message: "建立 board 時發生錯誤，請稍後再試" };
   }

   if (!data && !error) {
    error = { message: "建立 board 時沒有收到有效資料" };
   }

   if (error) {
    setBoardError(error.message);
    setBoards((currentBoards) => {
     const nextBoards = currentBoards.filter((board) => board.id !== optimisticBoard.id);

     setSelectedBoardId((currentId) => (currentId === optimisticBoard.id ? (nextBoards[0]?.id ?? null) : currentId));

     return nextBoards;
    });
    return null;
   }

   if (!data) {
    return null;
   }

   const board = mapBoardRow(data);
   setBoards((currentBoards) =>
    currentBoards.map((currentBoard) => (currentBoard.id === optimisticBoard.id ? board : currentBoard)),
   );

   return board;
  },
  [boards, ownerId],
 );

 const updateBoard = useCallback(
  async (id: string, input: BoardInput) => {
   const normalizedInput = normalizeBoardInput(input);

   if (!normalizedInput.name) {
    return null;
   }

   setBoardError("");
   const previousBoard = boards.find((board) => board.id === id);

   if (!previousBoard) {
    return null;
   }

   const optimisticBoard: Board = {
    ...previousBoard,
    name: normalizedInput.name,
    description: normalizedInput.description,
    updatedAt: new Date().toISOString(),
   };

   setBoards((currentBoards) => currentBoards.map((board) => (board.id === id ? optimisticBoard : board)));

   if (isLocalDataMode()) {
    const nextBoards = boards.map((board) => (board.id === id ? optimisticBoard : board));

    setBoards(nextBoards);
    saveBoards(nextBoards);

    return optimisticBoard;
   }

   let data: BoardRow | null = null;
   let error: { message: string } | null;

   try {
    const supabase = await getSupabase();
    const result = await supabase
     .from("boards")
     .update({
      name: normalizedInput.name,
      description: normalizedInput.description,
      updated_at: new Date().toISOString(),
     })
     .eq("id", id)
     .select("id, name, description, created_at, updated_at")
     .single();

    data = result.data;
    error = result.error;
   } catch (caughtError) {
    captureAppError(caughtError, {
     area: "boards",
     action: "updateBoard",
     boardId: id,
    });
    error = { message: "更新 board 時發生錯誤，請稍後再試" };
   }

   if (!data && !error) {
    error = { message: "更新 board 時沒有收到有效資料" };
   }

   if (error) {
    setBoardError(error.message);
    setBoards((currentBoards) => currentBoards.map((board) => (board.id === id ? previousBoard : board)));
    return null;
   }

   if (!data) {
    return null;
   }

   const updatedBoard = mapBoardRow(data);
   setBoards((currentBoards) => currentBoards.map((board) => (board.id === id ? updatedBoard : board)));

   return updatedBoard;
  },
  [boards],
 );

 const deleteBoard = useCallback(
  async (id: string) => {
   setBoardError("");
   const previousBoards = boards;
   const previousSelectedBoardId = selectedBoardId;
   const nextBoards = boards.filter((board) => board.id !== id);

   setBoards(nextBoards);

   if (selectedBoardId === id) {
    setSelectedBoardId(nextBoards[0]?.id ?? null);
   }

   if (isLocalDataMode()) {
    saveBoards(nextBoards);
    return;
   }

   let error: { message: string } | null;

   try {
    const supabase = await getSupabase();
    const result = await supabase.from("boards").delete().eq("id", id);

    error = result.error;
   } catch (caughtError) {
    captureAppError(caughtError, {
     area: "boards",
     action: "deleteBoard",
     boardId: id,
    });
    error = { message: "刪除 board 時發生錯誤，請稍後再試" };
   }

   if (error) {
    setBoardError(error.message);
    setBoards(previousBoards);
    setSelectedBoardId(previousSelectedBoardId);
    return;
   }
  },
  [boards, selectedBoardId],
 );

 useEffect(() => {
  if (!ownerId) return;

  if (isLocalDataMode()) {
   let isMounted = true;

   const loadLocalBoards = async () => {
    await Promise.resolve();

    if (!isMounted) {
     return;
    }

    const nextBoards = loadStoredBoards();

    setBoards(nextBoards);
    setSelectedBoardId(nextBoards[0]?.id ?? null);
    setIsLoadingBoards(false);
   };

   void loadLocalBoards();

   return () => {
    isMounted = false;
   };
  }

  let isMounted = true;

  const loadBoards = async () => {
   setIsLoadingBoards(true);
   setBoardError("");

   try {
    const supabase = await getSupabase();

    const { data, error } = await supabase
     .from("boards")
     .select("id, name, description, created_at, updated_at")
     .eq("owner_id", ownerId)
     .order("updated_at", { ascending: false });

    if (!isMounted) {
     return;
    }

    if (error) {
     setBoardError(error.message);
     setBoards([]);
     setSelectedBoardId(null);
     setIsLoadingBoards(false);
     return;
    }

    const nextBoards = data.map(mapBoardRow);
    setBoards(nextBoards);
    setSelectedBoardId((currentId) => {
     if (nextBoards.some((board) => board.id === currentId)) {
      return currentId;
     }

     return nextBoards[0]?.id ?? null;
    });
    setIsLoadingBoards(false);
   } catch (error) {
    captureAppError(error, {
     area: "boards",
     action: "loadBoards",
     ownerId,
    });

    if (isMounted) {
     setBoardError("載入 boards 時發生錯誤，請稍後再試");
     setBoards([]);
     setSelectedBoardId(null);
     setIsLoadingBoards(false);
    }
   }
  };

  void loadBoards();

  return () => {
   isMounted = false;
  };
 }, [ownerId]);

 useSyncRecovery(() => refreshBoards(false), Boolean(ownerId) && !localDataMode);

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
 };
};
