import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { beforeEach, describe, expect, it } from "vitest";
import type { Board } from "../board/types";
import type { Task } from "../task/types";
import { closeLocalReplicaDb, LOCAL_REPLICA_DB_NAME } from "./localReplicaDb";
import {
 deleteCachedBoard,
 readCachedBoards,
 replaceCachedBoards,
 upsertCachedBoard,
} from "./boardCacheRepository";
import {
 deleteCachedTask,
 deleteCachedTasksByBoard,
 readCachedTasks,
 replaceCachedTasks,
 upsertCachedTask,
} from "./taskCacheRepository";

const createBoard = (overrides: Partial<Board> = {}): Board => ({
 id: "board-1",
 name: "Board",
 description: "",
 statuses: [
  { key: "todo", title: "Todo" },
  { key: "inProgress", title: "In progress" },
  { key: "done", title: "Done" },
 ],
 version: 1,
 createdAt: "2026-01-01T00:00:00.000Z",
 updatedAt: "2026-01-01T00:00:00.000Z",
 ...overrides,
});

const createTask = (overrides: Partial<Task> = {}): Task => ({
 id: "task-1",
 boardId: "board-1",
 title: "Task",
 description: "",
 statusKey: "todo",
 position: 0,
 version: 1,
 createdAt: "2026-01-01T00:00:00.000Z",
 updatedAt: "2026-01-01T00:00:00.000Z",
 ...overrides,
});

beforeEach(async () => {
 await closeLocalReplicaDb();
 await deleteDB(LOCAL_REPLICA_DB_NAME);
});

describe("board cache repository", () => {
 it("isolates boards by owner", async () => {
  await replaceCachedBoards("owner-1", [createBoard()]);

  expect(await readCachedBoards("owner-1")).toHaveLength(1);
  expect(await readCachedBoards("owner-2")).toEqual([]);
 });

 it("does not overwrite a newer board", async () => {
  await upsertCachedBoard("owner-1", createBoard({ name: "New", version: 2 }));

  await upsertCachedBoard("owner-1", createBoard({ name: "Old", version: 1 }));

 expect(await readCachedBoards("owner-1")).toEqual([createBoard({ name: "New", version: 2 })]);
 });

 it("replaces the owner snapshot and removes missing boards", async () => {
  await replaceCachedBoards("owner-1", [
   createBoard({ id: "board-1" }),
   createBoard({ id: "board-2" }),
  ]);

  await replaceCachedBoards("owner-1", [createBoard({ id: "board-2", version: 2 })]);

  expect(await readCachedBoards("owner-1")).toEqual([
   createBoard({ id: "board-2", version: 2 }),
  ]);
 });

 it("deletes a cached board without affecting another owner", async () => {
  await replaceCachedBoards("owner-1", [createBoard()]);
  await replaceCachedBoards("owner-2", [createBoard()]);

  await deleteCachedBoard("owner-1", "board-1");

  expect(await readCachedBoards("owner-1")).toEqual([]);
  expect(await readCachedBoards("owner-2")).toEqual([createBoard()]);
 });
});

describe("task cache repository", () => {
 it("isolates tasks by board", async () => {
  await replaceCachedTasks("owner-1", "board-1", [createTask()]);

  expect(await readCachedTasks("owner-1", "board-1")).toHaveLength(1);

  expect(await readCachedTasks("owner-1", "board-2")).toEqual([]);
 });

 it("does not overwrite a newer task", async () => {
  await upsertCachedTask("owner-1", createTask({ title: "New", version: 2 }));

  await upsertCachedTask("owner-1", createTask({ title: "Old", version: 1 }));

 expect(await readCachedTasks("owner-1", "board-1")).toEqual([createTask({ title: "New", version: 2 })]);
 });

 it("isolates tasks by owner", async () => {
  await replaceCachedTasks("owner-1", "board-1", [createTask()]);

  expect(await readCachedTasks("owner-1", "board-1")).toEqual([createTask()]);
  expect(await readCachedTasks("owner-2", "board-1")).toEqual([]);
 });

 it("replaces a board snapshot and removes missing tasks", async () => {
  await replaceCachedTasks("owner-1", "board-1", [
   createTask({ id: "task-1" }),
   createTask({ id: "task-2" }),
  ]);

  await replaceCachedTasks("owner-1", "board-1", [
   createTask({ id: "task-2", version: 2 }),
  ]);

  expect(await readCachedTasks("owner-1", "board-1")).toEqual([
   createTask({ id: "task-2", version: 2 }),
  ]);
 });

 it("deletes one task or all tasks for a board without affecting another board", async () => {
  await replaceCachedTasks("owner-1", "board-1", [
   createTask({ id: "task-1" }),
   createTask({ id: "task-2" }),
  ]);
  await replaceCachedTasks("owner-1", "board-2", [
   createTask({ id: "task-3", boardId: "board-2" }),
  ]);

  await deleteCachedTask("owner-1", "task-1");

  expect(await readCachedTasks("owner-1", "board-1")).toEqual([
   createTask({ id: "task-2" }),
  ]);

  await deleteCachedTasksByBoard("owner-1", "board-1");

  expect(await readCachedTasks("owner-1", "board-1")).toEqual([]);
  expect(await readCachedTasks("owner-1", "board-2")).toEqual([
   createTask({ id: "task-3", boardId: "board-2" }),
  ]);
 });
});
