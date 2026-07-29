import type { Task } from "../task/types";
import { getLocalReplicaDb } from "./localReplicaDb";
import type { CachedTaskRecord } from "./localReplicaTypes";

export const readCachedTasks = async (ownerId: string, boardId: string): Promise<Task[]> => {
 const database = await getLocalReplicaDb();

 const records = await database.getAllFromIndex("tasks", "by-owner-board", [ownerId, boardId]);

 return records.map((record) => record.task);
};

export const replaceCachedTasks = async (ownerId: string, boardId: string, tasks: Task[]) => {
 const database = await getLocalReplicaDb();
 const transaction = database.transaction("tasks", "readwrite");
 const boardIndex = transaction.store.index("by-owner-board");

 const existingKeys = await boardIndex.getAllKeys([ownerId, boardId]);

 await Promise.all(existingKeys.map((key) => transaction.store.delete(key)));

 const cachedAt = Date.now();

 await Promise.all(
  tasks.map((task) => {
   const record: CachedTaskRecord = {
    ownerId,
    boardId,
    taskId: task.id,
    task,
    cachedAt,
   };

   return transaction.store.put(record);
  }),
 );

 await transaction.done;
};

export const upsertCachedTask = async (ownerId: string, task: Task) => {
 const database = await getLocalReplicaDb();
 const transaction = database.transaction("tasks", "readwrite");
 const key: [string, string] = [ownerId, task.id];

 const currentRecord = await transaction.store.get(key);

 if (currentRecord && currentRecord.task.version >= task.version) {
  await transaction.done;
  return;
 }

 await transaction.store.put({
  ownerId,
  boardId: task.boardId,
  taskId: task.id,
  task,
  cachedAt: Date.now(),
 });

 await transaction.done;
};

export const deleteCachedTask = async (ownerId: string, taskId: string) => {
 const database = await getLocalReplicaDb();
 await database.delete("tasks", [ownerId, taskId]);
};

export const deleteCachedTasksByBoard = async (ownerId: string, boardId: string) => {
 const database = await getLocalReplicaDb();
 const transaction = database.transaction("tasks", "readwrite");
 const boardIndex = transaction.store.index("by-owner-board");

 const keys = await boardIndex.getAllKeys([ownerId, boardId]);

 await Promise.all(keys.map((key) => transaction.store.delete(key)));

 await transaction.done;
};

export const clearCachedTasks = async (ownerId: string) => {
 const database = await getLocalReplicaDb();
 const transaction = database.transaction("tasks", "readwrite");
 const ownerIndex = transaction.store.index("by-owner");

 const keys = await ownerIndex.getAllKeys(ownerId);

 await Promise.all(keys.map((key) => transaction.store.delete(key)));

 await transaction.done;
};
