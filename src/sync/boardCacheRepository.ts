import type { Board } from "../board/types";
import { getLocalReplicaDb } from "./localReplicaDb";
import type { CachedBoardRecord } from "./localReplicaTypes";

export const readCachedBoards = async (ownerId: string): Promise<Board[]> => {
 const database = await getLocalReplicaDb();

 const records = await database.getAllFromIndex("boards", "by-owner", ownerId);

 return records
  .map((record) => record.board)
  .sort((firstBoard, secondBoard) => secondBoard.updatedAt.localeCompare(firstBoard.updatedAt));
};

export const replaceCachedBoards = async (ownerId: string, boards: Board[]) => {
 const database = await getLocalReplicaDb();
 const transaction = database.transaction("boards", "readwrite");
 const ownerIndex = transaction.store.index("by-owner");

 const existingKeys = await ownerIndex.getAllKeys(ownerId);

 await Promise.all(existingKeys.map((key) => transaction.store.delete(key)));

 const cachedAt = Date.now();

 await Promise.all(
  boards.map((board) => {
   const record: CachedBoardRecord = {
    ownerId,
    boardId: board.id,
    board,
    cachedAt,
   };

   return transaction.store.put(record);
  }),
 );

 await transaction.done;
};

export const upsertCachedBoard = async (ownerId: string, board: Board) => {
 const database = await getLocalReplicaDb();
 const transaction = database.transaction("boards", "readwrite");
 const key: [string, string] = [ownerId, board.id];

 const currentRecord = await transaction.store.get(key);

 if (currentRecord && currentRecord.board.version >= board.version) {
  await transaction.done;
  return;
 }

 await transaction.store.put({
  ownerId,
  boardId: board.id,
  board,
  cachedAt: Date.now(),
 });

 await transaction.done;
};

export const deleteCachedBoard = async (ownerId: string, boardId: string) => {
 const database = await getLocalReplicaDb();
 await database.delete("boards", [ownerId, boardId]);
};

export const clearCachedBoards = async (ownerId: string) => {
 const database = await getLocalReplicaDb();
 const transaction = database.transaction("boards", "readwrite");
 const ownerIndex = transaction.store.index("by-owner");

 const keys = await ownerIndex.getAllKeys(ownerId);

 await Promise.all(keys.map((key) => transaction.store.delete(key)));

 await transaction.done;
};
