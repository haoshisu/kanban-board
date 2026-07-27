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

export type PendingEntityType = "board" | "task";
export type PendingOperation = "upsert" | "delete";
export type PendingMutationStatus = "pending" | "blocked";
export type PendingFailureKind = "transient" | "conflict" | "permanent";

export type MutationConflict = {
 detectedAt: number;
 remoteVersion?: number;
 remotePayload: Board | Task | null;
};

export type PendingMutation = {
 ownerId: string;
 entityType: PendingEntityType;
 entityId: string;
 boardId?: string;
 operation: PendingOperation;
 mutationId: string;
 baseVersion: number;
 payload: Board | Task | null;
 createdAt: number;
 updatedAt: number;
 status: PendingMutationStatus;
 failureKind?: PendingFailureKind;
 attempts: number;
 nextAttemptAt: number;
 lastError?: string;
 conflict?: MutationConflict;
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

 pendingMutations: {
  key: [string, PendingEntityType, string];
  value: PendingMutation;
  indexes: {
   "by-owner": string;
   "by-owner-board": [string, string];
  };
 };
}
