import type { DBSchema } from "idb";
import type { Board } from "../board";
import type { Task } from "../task";

export type CachedBoardRecord = {
 ownerId: string;
 boardId: string;
 board: Board;
 cachedAt: number;
};

export type CachedTaskRecord = {
 ownerId: string;
 boardId: string;
 taskId: string;
 task: Task;
 cachedAt: number;
};

export type SyncMetadataRecord = {
 ownerId: string;
 resourceKey: string;
 lastSyncedAt: number;
};

export interface LocalReplicaSchema extends DBSchema {
 boards: {
  key: [string, string];
  value: CachedBoardRecord;
  indexes: {
   "by-owner": string;
  };
 };

 tasks: {
  key: [string, string];
  value: CachedTaskRecord;
  indexes: {
   "by-owner": string;
   "by-owner-board": [string, string];
  };
 };

 syncMetadata: {
  key: [string, string];
  value: SyncMetadataRecord;
  indexes: {
   "by-owner": string;
  };
 };
}
