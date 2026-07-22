import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { mapTaskRow } from "./taskUtils";
import type { TaskRow } from "./taskUtils";
import type { Task } from "./types";

export const upsertTaskByVersion = (tasks: Task[], incomingTask: Task): Task[] => {
 const index = tasks.findIndex((task) => task.id === incomingTask.id);
 if (index === -1) return [...tasks, incomingTask];
 const currentTask = tasks[index];

 // 相同 version 代表重複 event 或 REST response。
 // 較小 version 代表延遲抵達的舊資料。
 if (currentTask.version >= incomingTask.version) return tasks;

 const nextTasks = [...tasks];
 nextTasks[index] = incomingTask;

 return nextTasks;
};

export const applyTaskRealtimePayload = (
 tasks: Task[],
 boardId: string | null,
 payload: RealtimePostgresChangesPayload<TaskRow>,
): Task[] => {
 if (payload.eventType === "DELETE") {
  const deletedId = payload.old.id;
  return typeof deletedId === "string" ? tasks.filter((task) => task.id !== deletedId) : tasks;
 }
 const row = payload.new;
 // 目前訂閱可能收到同一使用者其他 board 的資料。
 if (row.board_id !== boardId) return tasks;

 return upsertTaskByVersion(tasks, mapTaskRow(row));
};
