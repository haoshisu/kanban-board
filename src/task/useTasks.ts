import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRealtimeTableRefresh } from "../realtime/useRealtimeTableRefresh";
import { captureAppError } from "../lib/errorReporting";
import { isLocalDataMode } from "../lib/localDataMode";
import { getSupabase } from "../lib/supabase";
import type { BoardStatusKey } from "../board";
import { loadTasks as loadStoredTasks, saveTasks } from "./taskStorage";
import { getNextPosition, mapTaskRow, normalizeTaskInput, statusKeyToDbStatus } from "./taskUtils";
import type { Task, TaskInput } from "./types";
import type { TaskRow } from "./taskUtils";
import { useSyncRecovery } from "../realtime/useSyncRecovery";
import { applyTaskRealtimePayload, upsertTaskByVersion } from "./taskRealtime";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { replaceCachedTasks } from "../sync/taskCacheRepository";

export const TASK_SELECT_COLUMNS =
 "id, board_id, title, description, status, position, version, created_at, updated_at" as const;

const createOptimisticId = () => {
 if (crypto.randomUUID) {
  return crypto.randomUUID();
 }

 return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

// 純同步分支（沒有 board、或 local data mode）可以直接算出初始 tasks；
// remote 分支則留給 effect 去做真正的非同步 fetch。
const computeSyncTasks = (boardId: string | null, localDataMode: boolean): Task[] => {
 if (!boardId) return [];
 if (localDataMode) return loadStoredTasks().filter((task) => task.boardId === boardId);
 return [];
};

export const useTasks = (boardId: string | null, ownerId?: string) => {
 const localDataMode = isLocalDataMode();
 const dataKey = `${boardId ?? ""}::${localDataMode ? "local" : "remote"}`;

 const [tasks, setTasks] = useState<Task[]>(() => computeSyncTasks(boardId, localDataMode));
 const [loadedDataKey, setLoadedDataKey] = useState(dataKey);
 const [isLoadingTasks, setIsLoadingTasks] = useState(false);
 const [taskError, setTaskError] = useState("");
 const loadRequestIdRef = useRef(0);

 // boardId 或 localDataMode 改變時，在 render 當下直接重設 tasks，
 // 不透過 effect + setState，避免多一次 commit 後的 re-render。
 if (dataKey !== loadedDataKey) {
  setLoadedDataKey(dataKey);
  setTaskError("");
  setTasks(computeSyncTasks(boardId, localDataMode));
  setIsLoadingTasks(Boolean(boardId) && !localDataMode);
 }

 const sortedTasks = useMemo(() => {
  if (!boardId) return [];

  return [...tasks].sort((firstTask, secondTask) => {
   if (firstTask.statusKey !== secondTask.statusKey) {
    return firstTask.statusKey.localeCompare(secondTask.statusKey);
   }

   return firstTask.position - secondTask.position;
  });
 }, [boardId, tasks]);

 const refreshTasks = useCallback(
  async (showLoading = false) => {
   if (!boardId || localDataMode) return;

   const requestId = ++loadRequestIdRef.current;

   if (showLoading) {
    setIsLoadingTasks(true);
   }
   setTaskError("");
   try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
     .from("tasks")
     .select(TASK_SELECT_COLUMNS)
     .eq("board_id", boardId)
     .order("status", { ascending: true })
     .order("position", { ascending: true });

    // 如果使用者已切到其他 board，忽略舊 request。
    if (requestId !== loadRequestIdRef.current) return;

    if (error) {
     setTaskError(error.message);
     return;
    }
    const nextTasks = (data ?? []).map(mapTaskRow);
    setTasks(nextTasks);
    setTasks(data?.map(mapTaskRow) ?? []);

    if (ownerId) {
     void replaceCachedTasks(ownerId, boardId, nextTasks).catch((error: unknown) => {
      captureAppError(error, { area: "local-replica", action: "replaceTasks", ownerId, boardId });
     });
    }
   } catch (error) {
    if (requestId !== loadRequestIdRef.current) return;
    captureAppError(error, {
     area: "tasks",
     action: "refreshTasks",
     boardId,
    });
    setTaskError("載入 tasks 時發生錯誤，請稍後再試");
   } finally {
    if (requestId === loadRequestIdRef.current) {
     setIsLoadingTasks(false);
    }
   }
  },
  [boardId, localDataMode, ownerId],
 );

 const handleTaskRealtimeChange = useCallback(
  (payload: RealtimePostgresChangesPayload<TaskRow>) => {
   setTasks((currentTasks) => applyTaskRealtimePayload(currentTasks, boardId, payload));
  },
  [boardId],
 );

 const taskRealtimeStatus = useRealtimeTableRefresh({
  channelName: `tasks:${boardId ?? "none"}`,
  table: "tasks",
  enabled: Boolean(boardId) && !localDataMode,
  onChange: handleTaskRealtimeChange,
  onRefresh: () => refreshTasks(false),
 });

 const createTask = useCallback(
  async (input: TaskInput) => {
   if (!boardId) return null;
   const normalizedInput = normalizeTaskInput(input);
   if (!normalizedInput.title) return null;

   setTaskError("");
   const now = new Date().toISOString();
   const optimisticTask: Task = {
    id: createOptimisticId(),
    boardId,
    title: normalizedInput.title,
    description: normalizedInput.description,
    statusKey: normalizedInput.statusKey,
    position: getNextPosition(tasks, normalizedInput.statusKey),
    version: 0,
    createdAt: now,
    updatedAt: now,
   };

   setTasks((currentTasks) => [...currentTasks, optimisticTask]);

   if (isLocalDataMode()) {
    const nextTasks = [...tasks, optimisticTask];
    const allTasks = [...loadStoredTasks(), optimisticTask];

    setTasks(nextTasks);
    saveTasks(allTasks);

    return optimisticTask;
   }

   let data: TaskRow | null = null;
   let error: { message: string } | null;

   try {
    const supabase = await getSupabase();
    const result = await supabase
     .from("tasks")
     .insert({
      id: optimisticTask.id,
      board_id: boardId,
      title: normalizedInput.title,
      description: normalizedInput.description,
      status: statusKeyToDbStatus[normalizedInput.statusKey],
      position: optimisticTask.position,
     })
     .select(TASK_SELECT_COLUMNS)
     .single();

    data = result.data;
    error = result.error;
   } catch (caughtError) {
    captureAppError(caughtError, {
     area: "tasks",
     action: "createTask",
     boardId,
     statusKey: normalizedInput.statusKey,
    });
    error = { message: "建立 task 時發生錯誤，請稍後再試" };
   }

   if (!data && !error) {
    error = { message: "建立 task 時沒有收到有效資料" };
   }

   if (error) {
    setTaskError(error.message);
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== optimisticTask.id));
    return null;
   }

   if (!data) {
    return null;
   }

   const task = mapTaskRow(data);
   //  setTasks((currentTasks) =>
   //   currentTasks.map((currentTask) => (currentTask.id === optimisticTask.id ? task : currentTask)),
   //  );
   setTasks((currentTasks) => upsertTaskByVersion(currentTasks, task));

   return task;
  },
  [boardId, tasks],
 );

 const updateTask = useCallback(
  async (id: string, input: TaskInput) => {
   const normalizedInput = normalizeTaskInput(input);
   if (!normalizedInput.title) return null;
   const currentTask = tasks.find((task) => task.id === id);
   if (!currentTask) return null;

   const position =
    currentTask.statusKey === normalizedInput.statusKey
     ? currentTask.position
     : getNextPosition(tasks, normalizedInput.statusKey);

   setTaskError("");
   const optimisticTask: Task = {
    ...currentTask,
    title: normalizedInput.title,
    description: normalizedInput.description,
    statusKey: normalizedInput.statusKey,
    position,
    updatedAt: new Date().toISOString(),
   };

   setTasks((currentTasks) => currentTasks.map((task) => (task.id === id ? optimisticTask : task)));

   if (isLocalDataMode()) {
    const localUpdatedTask = {
     ...optimisticTask,
     version: currentTask.version + 1,
    };
    const nextTasks = tasks.map((task) => (task.id === id ? localUpdatedTask : task));
    const allTasks = loadStoredTasks().map((task) => (task.id === id ? localUpdatedTask : task));

    setTasks(nextTasks);
    saveTasks(allTasks);

    return localUpdatedTask;
   }

   let data: TaskRow | null = null;
   let error: { message: string } | null;

   try {
    const supabase = await getSupabase();
    const result = await supabase
     .from("tasks")
     .update({
      title: normalizedInput.title,
      description: normalizedInput.description,
      status: statusKeyToDbStatus[normalizedInput.statusKey],
      position,
      updated_at: new Date().toISOString(),
     })
     .eq("id", id)
     .eq("version", currentTask.version)
     .select(TASK_SELECT_COLUMNS)
     .maybeSingle();

    data = result.data;
    error = result.error;
   } catch (caughtError) {
    captureAppError(caughtError, {
     area: "tasks",
     action: "updateTask",
     boardId: currentTask.boardId,
     taskId: id,
     statusKey: normalizedInput.statusKey,
    });
    error = { message: "更新 task 時發生錯誤，請稍後再試" };
   }

   if (error) {
    setTaskError(error.message);
    setTasks((currentTasks) => currentTasks.map((task) => (task.id === id ? currentTask : task)));
    return null;
   }

   if (!data) {
    setTaskError("這張工作已由其他裝置更新，已載入最新內容。");
    await refreshTasks(false);
    return null;
   }

   const updatedTask = mapTaskRow(data);
   //  setTasks((currentTasks) => currentTasks.map((task) => (task.id === id ? updatedTask : task)));
   setTasks((currentTasks) => upsertTaskByVersion(currentTasks, updatedTask));

   return updatedTask;
  },
  [tasks, refreshTasks],
 );

 const deleteTask = useCallback(
  async (id: string) => {
   setTaskError("");
   const deletedTask = tasks.find((task) => task.id === id);

   if (!deletedTask) {
    return;
   }

   setTasks((currentTasks) => currentTasks.filter((task) => task.id !== id));

   if (isLocalDataMode()) {
    saveTasks(loadStoredTasks().filter((task) => task.id !== id));
    return;
   }

   let data: { id: string } | null;
   let error: { message: string } | null;

   try {
    const supabase = await getSupabase();
    const result = await supabase
     .from("tasks")
     .delete()
     .eq("id", id)
     .eq("version", deletedTask.version)
     .select("id")
     .maybeSingle();

    data = result.data;
    error = result.error;
    if (!data && !error) {
     await refreshTasks(false);
    }
   } catch (caughtError) {
    captureAppError(caughtError, {
     area: "tasks",
     action: "deleteTask",
     boardId: deletedTask.boardId,
     taskId: id,
    });
    error = { message: "刪除 task 時發生錯誤，請稍後再試" };
   }

   if (error) {
    setTaskError(error.message);
    setTasks((currentTasks) => [...currentTasks, deletedTask]);
    return;
   }
  },
  [tasks, refreshTasks],
 );

 const moveTaskStatus = useCallback(
  async (id: string, statusKey: BoardStatusKey) => {
   const currentTask = tasks.find((task) => task.id === id);

   if (!currentTask || currentTask.statusKey === statusKey) return;

   const nextPosition = getNextPosition(tasks, statusKey);

   setTasks((currentTasks) =>
    currentTasks.map((task) =>
     task.id === id
      ? {
         ...task,
         statusKey,
         position: nextPosition,
        }
      : task,
    ),
   );

   if (isLocalDataMode()) {
    const loadMovedTask = {
     ...currentTask,
     statusKey,
     position: nextPosition,
     updatedAt: new Date().toISOString(),
     version: currentTask.version + 1,
    };
    const nextTasks = tasks.map((task) => (task.id === id ? loadMovedTask : task));
    const allTasks = loadStoredTasks().map((task) => (task.id === id ? loadMovedTask : task));

    setTasks(nextTasks);
    saveTasks(allTasks);

    return;
   }

   let data: TaskRow | null = null;
   let error: { message: string } | null;

   try {
    const supabase = await getSupabase();
    const result = await supabase
     .from("tasks")
     .update({
      status: statusKeyToDbStatus[statusKey],
      position: nextPosition,
      updated_at: new Date().toISOString(),
     })
     .eq("id", id)
     .eq("version", currentTask.version)
     .select(TASK_SELECT_COLUMNS)
     .maybeSingle();

    data = result.data;
    error = result.error;
   } catch (caughtError) {
    captureAppError(caughtError, {
     area: "tasks",
     action: "moveTaskStatus",
     boardId: currentTask.boardId,
     taskId: id,
     statusKey,
    });
    error = { message: "移動 task 時發生錯誤，請稍後再試" };
   }

   if (error) {
    setTaskError(error.message);
    setTasks((currentTasks) => currentTasks.map((task) => (task.id === id ? currentTask : task)));
    return;
   }

   if (!data) {
    await refreshTasks(false);
    return;
   }

   const updatedTask = mapTaskRow(data);
   //  setTasks((currentTasks) => currentTasks.map((task) => (task.id === id ? updatedTask : task)));
   setTasks((currentTasks) => upsertTaskByVersion(currentTasks, updatedTask));
  },
  [tasks, refreshTasks],
 );

 const deleteTasksByBoard = useCallback(async (targetBoardId: string) => {
  setTaskError("");

  if (isLocalDataMode()) {
   saveTasks(loadStoredTasks().filter((task) => task.boardId !== targetBoardId));
   setTasks((currentTasks) => currentTasks.filter((task) => task.boardId !== targetBoardId));
   return;
  }

  let error: { message: string } | null;

  try {
   const supabase = await getSupabase();
   const result = await supabase.from("tasks").delete().eq("board_id", targetBoardId);

   error = result.error;
  } catch (caughtError) {
   captureAppError(caughtError, {
    area: "tasks",
    action: "deleteTasksByBoard",
    boardId: targetBoardId,
   });
   error = { message: "刪除 board tasks 時發生錯誤，請稍後再試" };
  }

  if (error) {
   setTaskError(error.message);
   return;
  }

  setTasks((currentTasks) => currentTasks.filter((task) => task.boardId !== targetBoardId));
 }, []);

 useEffect(() => {
  loadRequestIdRef.current += 1;

  if (!boardId || localDataMode) return;

  // refreshTasks 一開始會同步呼叫 setIsLoadingTasks(true) 才開始 fetch，
  // 這是標準的「開始 fetch 前先亮 loading」寫法（React 官方 data-fetching effect 範例也是這樣），
  // 不是可以搬到 render 當下算的「衍生狀態」，因此保留並關閉這條規則。
  // eslint-disable-next-line react-hooks/set-state-in-effect
  void refreshTasks(true);

  return () => {
   loadRequestIdRef.current += 1;
  };
 }, [boardId, localDataMode, refreshTasks]);

 useSyncRecovery(() => refreshTasks(false), Boolean(boardId) && !localDataMode);

 return {
  tasks: sortedTasks,
  isLoadingTasks,
  taskError,
  taskRealtimeStatus,
  createTask,
  updateTask,
  deleteTask,
  moveTaskStatus,
  deleteTasksByBoard,
 };
};
