import { openDB, type IDBPDatabase } from "idb";
import type { LocalReplicaSchema } from "./localReplicaTypes";

export const LOCAL_REPLICA_DB_NAME = "kanban-board-local-replica";
export const LOCAL_REPLICA_DB_VERSION = 1;

let databasePromise: Promise<IDBPDatabase<LocalReplicaSchema>> | undefined;

export const getLocalReplicaDb = () => {
 if (!databasePromise) {
  databasePromise = openDB<LocalReplicaSchema>(LOCAL_REPLICA_DB_NAME, LOCAL_REPLICA_DB_VERSION, {
   upgrade(database) {
    if (!database.objectStoreNames.contains("boards")) {
     const boardStore = database.createObjectStore("boards", {
      keyPath: ["ownerId", "boardId"],
     });

     boardStore.createIndex("by-owner", "ownerId");
    }

    if (!database.objectStoreNames.contains("tasks")) {
     const taskStore = database.createObjectStore("tasks", {
      keyPath: ["ownerId", "taskId"],
     });

     taskStore.createIndex("by-owner", "ownerId");
     taskStore.createIndex("by-owner-board", ["ownerId", "boardId"]);
    }

    if (!database.objectStoreNames.contains("syncMetadata")) {
     const metadataStore = database.createObjectStore("syncMetadata", {
      keyPath: ["ownerId", "resourceKey"],
     });

     metadataStore.createIndex("by-owner", "ownerId");
    }
   },
  });
 }

 return databasePromise;
};

export const closeLocalReplicaDb = async () => {
 if (!databasePromise) return;

 const database = await databasePromise;
 database.close();
 databasePromise = undefined;
};
