import { clearCachedBoards } from "./boardCacheRepository";
import { getLocalReplicaDb } from "./localReplicaDb";
import { flushLocalReplicaWrites } from "./localReplicaWriteQueue";
import { clearCachedTasks } from "./taskCacheRepository";

const clearCachedMetadata = async (ownerId: string) => {
 const database = await getLocalReplicaDb();
 const transaction = database.transaction("syncMetadata", "readwrite");
 const ownerIndex = transaction.store.index("by-owner");
 const keys = await ownerIndex.getAllKeys(ownerId);

 await Promise.all(keys.map((key) => transaction.store.delete(key)));
 await transaction.done;
};

export const clearLocalReplicaForOwner = async (ownerId: string) => {
 await flushLocalReplicaWrites();
 await Promise.all([
  clearCachedBoards(ownerId),
  clearCachedTasks(ownerId),
  clearCachedMetadata(ownerId),
 ]);
};
