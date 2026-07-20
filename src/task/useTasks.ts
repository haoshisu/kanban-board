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

const createOptimisticId = () => {
 if (crypto.randomUUID) {
  return crypto.randomUUID();
 }

 return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const useTasks = (boardId: string | null) => {
 const [tasks, setTasks] = useState<Task[]>([]);
 const [isLoadingTasks, setIsLoadingTasks] = useState(false);
 const [taskError, setTaskError] = useState("");
 const loadRequestIdRef = useRef(0);
 const localDataMode = isLocalDataMode();

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
     .select("id,board_id,title,description,status,position,created_at,updated_at")
     .eq("board_id", boardId)
     .order("status", { ascending: true })
     .order("position", { ascending: true });

    // 如果使用者已切到其他 board，忽略舊 request。
    if (requestId !== loadRequestIdRef.current) return;

    if (error) {
     setTaskError(error.message);
    }
    setTasks(data?.map(mapTaskRow) ?? []);
   } catch (error) {
    if (requestId !== loadRequestIdRef.current) return;
    captureAppError(error, {
     area: "tasks",
     action: "refreshTasks",
     boardId,
    });
    setTaskError("無法載入tasks，請稍後在試");
   } finally {
    if (showLoading && requestId === loadRequestIdRef.current) {
     setIsLoadingTasks(false);
    }
   }
  },
  [boardId, localDataMode],
 );

 const sortedTasks = useMemo(() => {
  if (!boardId) return;

  return [...tasks].sort((firstTask, secondTask) => {
   if (firstTask.statusKey !== secondTask.statusKey) {
    return firstTask.statusKey.localeCompare(secondTask.statusKey);
   }

   return firstTask.position - secondTask.position;
  });
 }, [boardId, tasks]);

 useEffect(() => {
  loadRequestIdRef.current += 1;
  if (!boardId) {
   setTasks([]);
   setIsLoadingTasks(false);
   return;
  }
  if (localDataMode) {
   setTasks(loadStoredTasks().filter((task) => task.boardId === boardId));
   setIsLoadingTasks(false);
   return;
  }
  void refreshTasks(true);
  return () => {
   loadRequestIdRef.current += 1;
  };
 }, [boardId, localDataMode, refreshTasks]);

 const taskRealtimeStatus = useRealtimeTableRefresh({
  channelName: `tasks:${boardId ?? "none"}`,
  table: "tasks",
  enabled: Boolean(boardId) && !localDataMode,
  onRefresh: () => refreshTasks(false),
 });

 const createTask = useCallback(
  async (input: TaskInput) => {
   if (!boardId) {
    return null;
   }

   const normalizedInput = normalizeTaskInput(input);

   if (!normalizedInput.title) {
    return null;
   }

   setTaskError("");
   const now = new Date().toISOString();
   const optimisticTask: Task = {
    id: createOptimisticId(),
    boardId,
    title: normalizedInput.title,
    description: normalizedInput.description,
    statusKey: normalizedInput.statusKey,
    position: getNextPosition(tasks, normalizedInput.statusKey),
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
     .select("id, board_id, title, description, status, position, created_at, updated_at")
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
   setTasks((currentTasks) =>
    currentTasks.map((currentTask) => (currentTask.id === optimisticTask.id ? task : currentTask)),
   );

   return task;
  },
  [boardId, tasks],
 );

 const updateTask = useCallback(
  async (id: string, input: TaskInput) => {
   const normalizedInput = normalizeTaskInput(input);

   if (!normalizedInput.title) {
    return null;
   }

   const currentTask = tasks.find((task) => task.id === id);

   if (!currentTask) {
    return null;
   }

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
    const nextTasks = tasks.map((task) => (task.id === id ? optimisticTask : task));
    const allTasks = loadStoredTasks().map((task) => (task.id === id ? optimisticTask : task));

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
     .update({
      title: normalizedInput.title,
      description: normalizedInput.description,
      status: statusKeyToDbStatus[normalizedInput.statusKey],
      position,
      updated_at: new Date().toISOString(),
     })
     .eq("id", id)
     .select("id, board_id, title, description, status, position, created_at, updated_at")
     .single();

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

   if (!data && !error) {
    error = { message: "更新 task 時沒有收到有效資料" };
   }

   if (error) {
    setTaskError(error.message);
    setTasks((currentTasks) => currentTasks.map((task) => (task.id === id ? currentTask : task)));
    return null;
   }

   if (!data) {
    return null;
   }

   const updatedTask = mapTaskRow(data);
   setTasks((currentTasks) => currentTasks.map((task) => (task.id === id ? updatedTask : task)));

   return updatedTask;
  },
  [tasks],
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

   let error: { message: string } | null;

   try {
    const supabase = await getSupabase();
    const result = await supabase.from("tasks").delete().eq("id", id);

    error = result.error;
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
  [tasks],
 );

 const moveTaskStatus = useCallback(
  async (id: string, statusKey: BoardStatusKey) => {
   const currentTask = tasks.find((task) => task.id === id);

   if (!currentTask || currentTask.statusKey === statusKey) {
    return;
   }

   const nextPosition = getNextPosition(tasks, statusKey);

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
   );

   if (isLocalDataMode()) {
    const movedTask = {
     ...currentTask,
     statusKey,
     position: nextPosition,
     updatedAt: new Date().toISOString(),
    };
    const nextTasks = tasks.map((task) => (task.id === id ? movedTask : task));
    const allTasks = loadStoredTasks().map((task) => (task.id === id ? movedTask : task));

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
     .select("id, board_id, title, description, status, position, created_at, updated_at")
     .single();

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

   if (!data && !error) {
    error = { message: "移動 task 時沒有收到有效資料" };
   }

   if (error) {
    setTaskError(error.message);
    setTasks((currentTasks) => currentTasks.map((task) => (task.id === id ? currentTask : task)));
    return;
   }

   if (!data) {
    return;
   }

   const updatedTask = mapTaskRow(data);
   setTasks((currentTasks) => currentTasks.map((task) => (task.id === id ? updatedTask : task)));
  },
  [tasks],
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
