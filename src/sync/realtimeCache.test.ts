import type {
 RealtimePostgresDeletePayload,
 RealtimePostgresUpdatePayload,
} from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardRow } from "../board/boardUtils";
import { defaultBoardStatuses } from "../board/boardStorage";
import type { TaskRow } from "../task/taskUtils";
import { persistBoardRealtimePayload } from "./boardRealtimeCache";
import { persistTaskRealtimePayload } from "./taskRealtimeCache";

const {
 deleteCachedBoardMock,
 deleteCachedTaskMock,
 deleteCachedTasksByBoardMock,
 upsertCachedBoardMock,
 upsertCachedTaskMock,
} = vi.hoisted(() => ({
 deleteCachedBoardMock: vi.fn(),
 deleteCachedTaskMock: vi.fn(),
 deleteCachedTasksByBoardMock: vi.fn(),
 upsertCachedBoardMock: vi.fn(),
 upsertCachedTaskMock: vi.fn(),
}));

vi.mock("./boardCacheRepository", () => ({
 deleteCachedBoard: deleteCachedBoardMock,
 upsertCachedBoard: upsertCachedBoardMock,
}));

vi.mock("./taskCacheRepository", () => ({
 deleteCachedTask: deleteCachedTaskMock,
 deleteCachedTasksByBoard: deleteCachedTasksByBoardMock,
 upsertCachedTask: upsertCachedTaskMock,
}));

const taskRow: TaskRow = {
 id: "task-1",
 board_id: "board-1",
 title: "Task",
 description: "",
 status: "todo",
 position: 0,
 version: 2,
 created_at: "2026-01-01T00:00:00.000Z",
 updated_at: "2026-01-02T00:00:00.000Z",
};

const boardRow: BoardRow = {
 id: "board-1",
 owner_id: "owner-1",
 name: "Board",
 description: "",
 version: 2,
 created_at: "2026-01-01T00:00:00.000Z",
 updated_at: "2026-01-02T00:00:00.000Z",
};

beforeEach(() => {
 vi.clearAllMocks();
});

describe("persistTaskRealtimePayload", () => {
 it("upserts an updated task for the active board", async () => {
  const payload: RealtimePostgresUpdatePayload<TaskRow> = {
   schema: "public",
   table: "tasks",
   commit_timestamp: "2026-01-02T00:00:00.000Z",
   errors: [],
   eventType: "UPDATE",
   new: taskRow,
   old: { id: taskRow.id, version: 1 },
  };

  await persistTaskRealtimePayload("owner-1", "board-1", payload);

  expect(upsertCachedTaskMock).toHaveBeenCalledWith("owner-1", {
   id: "task-1",
   boardId: "board-1",
   title: "Task",
   description: "",
   statusKey: "todo",
   position: 0,
   version: 2,
   createdAt: "2026-01-01T00:00:00.000Z",
   updatedAt: "2026-01-02T00:00:00.000Z",
  });
 });

 it("deletes a task by its old primary key", async () => {
  const payload: RealtimePostgresDeletePayload<TaskRow> = {
   schema: "public",
   table: "tasks",
   commit_timestamp: "2026-01-02T00:00:00.000Z",
   errors: [],
   eventType: "DELETE",
   new: {},
   old: { id: "task-1" },
  };

  await persistTaskRealtimePayload("owner-1", "board-1", payload);

  expect(deleteCachedTaskMock).toHaveBeenCalledWith("owner-1", "task-1");
 });
});

describe("persistBoardRealtimePayload", () => {
 it("upserts an updated board for its owner", async () => {
  const payload: RealtimePostgresUpdatePayload<BoardRow> = {
   schema: "public",
   table: "boards",
   commit_timestamp: "2026-01-02T00:00:00.000Z",
   errors: [],
   eventType: "UPDATE",
   new: boardRow,
   old: { id: boardRow.id, version: 1 },
  };

  await persistBoardRealtimePayload("owner-1", payload);

  expect(upsertCachedBoardMock).toHaveBeenCalledWith("owner-1", {
   id: "board-1",
   ownerId: "owner-1",
   name: "Board",
   description: "",
   statuses: defaultBoardStatuses,
   version: 2,
   createdAt: "2026-01-01T00:00:00.000Z",
   updatedAt: "2026-01-02T00:00:00.000Z",
  });
 });

 it("deletes a board by its old primary key", async () => {
  const payload: RealtimePostgresDeletePayload<BoardRow> = {
   schema: "public",
   table: "boards",
   commit_timestamp: "2026-01-02T00:00:00.000Z",
   errors: [],
   eventType: "DELETE",
   new: {},
   old: { id: "board-1" },
  };

  await persistBoardRealtimePayload("owner-1", payload);

 expect(deleteCachedBoardMock).toHaveBeenCalledWith("owner-1", "board-1");
  expect(deleteCachedTasksByBoardMock).not.toHaveBeenCalled();
 });

 it("upserts an updated board for a non-owner editor viewing a shared board", async () => {
  const payload: RealtimePostgresUpdatePayload<BoardRow> = {
   schema: "public",
   table: "boards",
   commit_timestamp: "2026-01-02T00:00:00.000Z",
   errors: [],
   eventType: "UPDATE",
   new: boardRow,
   old: { id: boardRow.id, version: 1 },
  };

  await persistBoardRealtimePayload("editor-1", payload);

  expect(upsertCachedBoardMock).toHaveBeenCalledWith("editor-1", {
   id: "board-1",
   ownerId: "owner-1",
   name: "Board",
   description: "",
   statuses: defaultBoardStatuses,
   version: 2,
   createdAt: "2026-01-01T00:00:00.000Z",
   updatedAt: "2026-01-02T00:00:00.000Z",
  });
 });
});
