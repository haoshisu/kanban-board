import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { BoardStatusKey } from "../board";
import { captureAppError } from "../lib/errorReporting";
import { isLocalDataMode } from "../lib/localDataMode";
import { getSupabase } from "../lib/supabase";
import { useRealtimeTableRefresh } from "../realtime/useRealtimeTableRefresh";
import { useOfflineSync } from "../sync/offlineSyncContext";
import { enqueueLocalReplicaWrite } from "../sync/localReplicaWriteQueue";
import type { PendingMutation } from "../sync/localReplicaTypes";
import {
 stageTaskDelete,
 stageTaskUpsert,
} from "../sync/pendingMutationRepository";
import {
 deleteCachedTasksByBoard,
 readCachedTasks,
 replaceCachedTasks,
} from "../sync/taskCacheRepository";
import { persistTaskRealtimePayload } from "../sync/taskRealtimeCache";
import { applyTaskRealtimePayload } from "./taskRealtime";
import { loadTasks, saveTasks } from "./taskStorage";
import {
 getNextPosition,
 mapTaskRow,
 normalizeTaskInput,
 type TaskRow,
} from "./taskUtils";
import type { Task, TaskInput } from "./types";

export const TASK_SELECT_COLUMNS =
 "id, board_id, title, description, status, position, version, created_at, updated_at" as const;

const createOptimisticId = () =>
 crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const applyPendingTasks = (
 tasks: Task[],
 boardId: string,
 mutations: PendingMutation[],
) =>
 mutations
  .filter(
   (mutation) =>
    mutation.entityType === "task" && mutation.boardId === boardId,
  )
  .reduce((currentTasks, mutation) => {
   if (mutation.operation === "delete") {
    return currentTasks.filter((task) => task.id !== mutation.entityId);
   }

   const task = mutation.payload as Task;
   const exists = currentTasks.some((currentTask) => currentTask.id === task.id);
   return exists
    ? currentTasks.map((currentTask) => (currentTask.id === task.id ? task : currentTask))
    : [...currentTasks, task];
  }, tasks);

export const useTasks = (
 boardId: string | null,
 ownerId?: string,
 _legacyIsOnlineOverride?: boolean,
) => {
 void _legacyIsOnlineOverride;
 const localMode = isLocalDataMode();
 const {
  isOnline,
  isRemoteReady,
  mutations,
  pendingEntityKeys,
  requestSync,
  syncRevision,
 } = useOfflineSync();
 const dataKey = `${ownerId ?? ""}::${boardId ?? ""}::${localMode ? "local" : "remote"}`;
 const initialTasks =
  boardId && localMode ? loadTasks().filter((task) => task.boardId === boardId) : [];
 const [tasks, setTasks] = useState<Task[]>(initialTasks);
 const [loadedDataKey, setLoadedDataKey] = useState(dataKey);
 const [isLoadingTasks, setIsLoadingTasks] = useState(
  Boolean(boardId) && !localMode && isOnline,
 );
 const [taskError, setTaskError] = useState("");
 const loadRequestIdRef = useRef(0);
 const liveDataRevisionRef = useRef(0);
 const snapshotInFlightRef = useRef(false);
 const queuedRealtimeRef = useRef<RealtimePostgresChangesPayload<TaskRow>[]>([]);

 if (dataKey !== loadedDataKey) {
  setLoadedDataKey(dataKey);
  setTasks(
   boardId && localMode
    ? loadTasks().filter((task) => task.boardId === boardId)
    : [],
  );
  setTaskError("");
  setIsLoadingTasks(Boolean(boardId) && !localMode && isOnline);
 }

 const sortedTasks = useMemo(
  () =>
   [...tasks].sort(
    (first, second) =>
     first.statusKey.localeCompare(second.statusKey) ||
     first.position - second.position,
   ),
  [tasks],
 );

 const refreshTasks = useCallback(
  async (showLoading = false) => {
   if (!boardId || !ownerId || localMode || !isOnline || !isRemoteReady) return;
   const requestId = ++loadRequestIdRef.current;
   snapshotInFlightRef.current = true;
   queuedRealtimeRef.current = [];
   if (showLoading) setIsLoadingTasks(true);

   try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
     .from("tasks")
     .select(TASK_SELECT_COLUMNS)
     .eq("board_id", boardId)
     .order("status", { ascending: true })
     .order("position", { ascending: true });

    if (requestId !== loadRequestIdRef.current) return;
    if (error) throw error;

    let remoteTasks = (data ?? []).map(mapTaskRow);
    for (const payload of queuedRealtimeRef.current) {
     remoteTasks = applyTaskRealtimePayload(remoteTasks, boardId, payload);
    }
    const next = applyPendingTasks(remoteTasks, boardId, mutations);
    liveDataRevisionRef.current += 1;
    setTasks(next);
    void enqueueLocalReplicaWrite(`tasks:${ownerId}:${boardId}`, () =>
     replaceCachedTasks(ownerId, boardId, next),
    ).catch((error: unknown) =>
     captureAppError(error, {
      area: "local-replica",
      action: "replaceTasks",
      ownerId,
      boardId,
     }),
    );
   } catch (error) {
    if (requestId !== loadRequestIdRef.current) return;
    captureAppError(error, { area: "tasks", action: "refreshTasks", boardId });
    setTaskError("載入 tasks 時發生錯誤，將繼續顯示本機資料");
   } finally {
    if (requestId === loadRequestIdRef.current) {
     snapshotInFlightRef.current = false;
     queuedRealtimeRef.current = [];
     setIsLoadingTasks(false);
    }
   }
  },
  [boardId, isOnline, isRemoteReady, localMode, mutations, ownerId],
 );

 const handleRealtimeChange = useCallback(
  (payload: RealtimePostgresChangesPayload<TaskRow>) => {
   const id = payload.eventType === "DELETE" ? payload.old.id : payload.new.id;
   if (typeof id === "string" && pendingEntityKeys.has(`task:${id}`)) return;
   if (snapshotInFlightRef.current) queuedRealtimeRef.current.push(payload);
   liveDataRevisionRef.current += 1;

   setTasks((current) => applyTaskRealtimePayload(current, boardId, payload));
   if (!ownerId || !boardId) return;
   void enqueueLocalReplicaWrite(`tasks:${ownerId}:${boardId}`, () =>
    persistTaskRealtimePayload(ownerId, boardId, payload),
   ).catch((error: unknown) =>
    captureAppError(error, {
     area: "local-replica",
     action: "persistTaskRealtime",
     ownerId,
     boardId,
    }),
   );
  },
  [boardId, ownerId, pendingEntityKeys],
 );

 const taskRealtimeStatus = useRealtimeTableRefresh({
  channelName: `tasks:${boardId ?? "none"}`,
  table: "tasks",
  enabled: Boolean(boardId) && !localMode && isOnline && isRemoteReady,
  onChange: handleRealtimeChange,
  onRefresh: () => refreshTasks(false),
 });

 const createTask = useCallback(
  async (input: TaskInput) => {
   if (!boardId || (!ownerId && !localMode)) return null;
   const normalized = normalizeTaskInput(input);
   if (!normalized.title) return null;

   const now = new Date().toISOString();
   const task: Task = {
    id: createOptimisticId(),
    boardId,
    title: normalized.title,
    description: normalized.description,
    statusKey: normalized.statusKey,
    position: getNextPosition(tasks, normalized.statusKey),
    version: 0,
    createdAt: now,
    updatedAt: now,
   };
   setTaskError("");
   setTasks((current) => [...current, task]);

   if (localMode) {
    saveTasks([...loadTasks(), task]);
    return task;
   }

   try {
    await stageTaskUpsert(ownerId as string, task);
    requestSync();
    return task;
   } catch (error) {
    setTasks((current) => current.filter((item) => item.id !== task.id));
    setTaskError("無法把 Task 儲存到此裝置");
    captureAppError(error, { area: "local-replica", action: "stageTaskCreate", ownerId });
    return null;
   }
  },
  [boardId, localMode, ownerId, requestSync, tasks],
 );

 const updateTask = useCallback(
  async (id: string, input: TaskInput) => {
   const normalized = normalizeTaskInput(input);
   const previous = tasks.find((task) => task.id === id);
   if (!previous || !normalized.title || (!ownerId && !localMode)) return null;

   const task: Task = {
    ...previous,
    title: normalized.title,
    description: normalized.description,
    statusKey: normalized.statusKey,
    position:
     previous.statusKey === normalized.statusKey
      ? previous.position
      : getNextPosition(tasks, normalized.statusKey),
    updatedAt: new Date().toISOString(),
   };
   setTaskError("");
   setTasks((current) => current.map((item) => (item.id === id ? task : item)));

   if (localMode) {
    const localTask = { ...task, version: previous.version + 1 };
    setTasks((current) => current.map((item) => (item.id === id ? localTask : item)));
    saveTasks(loadTasks().map((item) => (item.id === id ? localTask : item)));
    return localTask;
   }

   try {
    await stageTaskUpsert(ownerId as string, task);
    requestSync();
    return task;
   } catch (error) {
    setTasks((current) => current.map((item) => (item.id === id ? previous : item)));
    setTaskError("無法把 Task 修改儲存到此裝置");
    captureAppError(error, { area: "local-replica", action: "stageTaskUpdate", ownerId });
    return null;
   }
  },
  [localMode, ownerId, requestSync, tasks],
 );

 const deleteTask = useCallback(
  async (id: string) => {
   const task = tasks.find((item) => item.id === id);
   if (!task || (!ownerId && !localMode)) return;
   setTaskError("");
   setTasks((current) => current.filter((item) => item.id !== id));

   if (localMode) {
    saveTasks(loadTasks().filter((item) => item.id !== id));
    return;
   }

   try {
    await stageTaskDelete(ownerId as string, task);
    requestSync();
   } catch (error) {
    setTasks((current) => [...current, task]);
    setTaskError("無法在此裝置刪除 Task");
    captureAppError(error, { area: "local-replica", action: "stageTaskDelete", ownerId });
   }
  },
  [localMode, ownerId, requestSync, tasks],
 );

 const moveTaskStatus = useCallback(
  async (id: string, statusKey: BoardStatusKey) => {
   const previous = tasks.find((task) => task.id === id);
   if (!previous || previous.statusKey === statusKey || (!ownerId && !localMode)) return;

   const task = {
    ...previous,
    statusKey,
    position: getNextPosition(tasks, statusKey),
    updatedAt: new Date().toISOString(),
   };
   setTaskError("");
   setTasks((current) => current.map((item) => (item.id === id ? task : item)));

   if (localMode) {
    const localTask = { ...task, version: previous.version + 1 };
    setTasks((current) => current.map((item) => (item.id === id ? localTask : item)));
    saveTasks(loadTasks().map((item) => (item.id === id ? localTask : item)));
    return;
   }

   try {
    await stageTaskUpsert(ownerId as string, task);
    requestSync();
   } catch (error) {
    setTasks((current) => current.map((item) => (item.id === id ? previous : item)));
    setTaskError("無法在此裝置儲存拖曳結果");
    captureAppError(error, { area: "local-replica", action: "stageTaskMove", ownerId });
   }
  },
  [localMode, ownerId, requestSync, tasks],
 );

 const deleteTasksByBoard = useCallback(
  async (targetBoardId: string) => {
   if (localMode) {
    saveTasks(loadTasks().filter((task) => task.boardId !== targetBoardId));
   }
   setTasks((current) => current.filter((task) => task.boardId !== targetBoardId));
   if (ownerId && !localMode) {
    await enqueueLocalReplicaWrite(`tasks:${ownerId}:${targetBoardId}`, () =>
     deleteCachedTasksByBoard(ownerId, targetBoardId),
    );
   }
  },
  [localMode, ownerId],
 );

 useEffect(() => {
  if (!ownerId || !boardId || localMode) return;
  let cancelled = false;
  const revisionAtStart = liveDataRevisionRef.current;
  void readCachedTasks(ownerId, boardId)
   .then((cached) => {
    if (
     cancelled ||
     cached.length === 0 ||
     revisionAtStart !== liveDataRevisionRef.current
    ) return;
    setTasks(applyPendingTasks(cached, boardId, mutations));
    setIsLoadingTasks(false);
   })
   .catch((error: unknown) =>
    captureAppError(error, {
     area: "local-replica",
     action: "readTasks",
     ownerId,
     boardId,
    }),
   );
  return () => {
   cancelled = true;
  };
 }, [boardId, localMode, mutations, ownerId]);

 useEffect(() => {
  if (!boardId || localMode || !isOnline || !isRemoteReady) return;
  // This starts an external fetch; refreshTasks owns the associated loading state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  void refreshTasks(true);
 }, [boardId, isOnline, isRemoteReady, localMode, refreshTasks, syncRevision]);

 return {
  tasks: sortedTasks,
  isLoadingTasks: isOnline ? isLoadingTasks : false,
  taskError,
  taskRealtimeStatus,
  createTask,
  updateTask,
  deleteTask,
  moveTaskStatus,
  deleteTasksByBoard,
 };
};
