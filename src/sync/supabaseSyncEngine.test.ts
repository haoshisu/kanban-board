import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Board } from "../board/types";
import type { Task } from "../task/types";
import type { PendingMutation } from "./localReplicaTypes";

const {
 getSupabaseMock,
 acknowledgeMutationMock,
 readPendingMutationsMock,
 recordMutationFailureMock,
} = vi.hoisted(() => ({
 getSupabaseMock: vi.fn(),
 acknowledgeMutationMock: vi.fn(),
 readPendingMutationsMock: vi.fn(),
 recordMutationFailureMock: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({ getSupabase: getSupabaseMock }));
vi.mock("./pendingMutationRepository", () => ({
 acknowledgeMutation: acknowledgeMutationMock,
 readPendingMutations: readPendingMutationsMock,
 recordMutationFailure: recordMutationFailureMock,
}));

import { flushPendingMutations } from "./supabaseSyncEngine";

const board: Board = {
 id: "board-1",
 name: "Board",
 description: "",
 statuses: [],
 version: 0,
 createdAt: "2026-01-01T00:00:00.000Z",
 updatedAt: "2026-01-01T00:00:00.000Z",
};

const task: Task = {
 id: "task-1",
 boardId: board.id,
 title: "Task",
 description: "",
 statusKey: "todo",
 position: 0,
 version: 0,
 createdAt: board.createdAt,
 updatedAt: board.updatedAt,
};

const mutation = (
 entityType: "board" | "task",
 payload: Board | Task,
 createdAt: number,
): PendingMutation => ({
 ownerId: "owner-1",
 entityType,
 entityId: payload.id,
 boardId: entityType === "task" ? (payload as Task).boardId : undefined,
 operation: "upsert",
 mutationId: `${entityType}-mutation`,
 baseVersion: 0,
 payload,
 createdAt,
 updatedAt: createdAt,
 attempts: 0,
});

beforeEach(() => {
 vi.clearAllMocks();
 acknowledgeMutationMock.mockResolvedValue(undefined);
 recordMutationFailureMock.mockResolvedValue(undefined);
});

describe("flushPendingMutations", () => {
 it("creates a pending board before its task even when the task was queued first", async () => {
  const inserts: string[] = [];
  const boardMutation = mutation("board", board, 2);
  const taskMutation = mutation("task", task, 1);
  readPendingMutationsMock
   .mockResolvedValueOnce([taskMutation, boardMutation])
   .mockResolvedValueOnce([]);

  getSupabaseMock.mockResolvedValue({
   from: (table: "boards" | "tasks") => ({
    select: () => ({
     eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
    }),
    insert: () => {
     inserts.push(table);
     return {
      select: () => ({
       single: async () => ({
        data:
         table === "boards"
          ? {
             id: board.id,
             owner_id: "owner-1",
             name: board.name,
             description: board.description,
             version: 1,
             created_at: board.createdAt,
             updated_at: board.updatedAt,
            }
          : {
             id: task.id,
             board_id: task.boardId,
             title: task.title,
             description: task.description,
             status: "todo",
             position: task.position,
             version: 1,
             created_at: task.createdAt,
             updated_at: task.updatedAt,
            },
        error: null,
       }),
      }),
     };
    },
   }),
  });

  await flushPendingMutations("owner-1");

  expect(inserts).toEqual(["boards", "tasks"]);
  expect(acknowledgeMutationMock).toHaveBeenCalledTimes(2);
 });

 it("retains and records a mutation when the network write fails", async () => {
  const boardMutation = mutation("board", board, 1);
  readPendingMutationsMock.mockResolvedValue([boardMutation]);
  getSupabaseMock.mockRejectedValue(new Error("network down"));

  await expect(flushPendingMutations("owner-1")).rejects.toThrow("network down");
  expect(recordMutationFailureMock).toHaveBeenCalledWith(boardMutation, "network down");
  expect(acknowledgeMutationMock).not.toHaveBeenCalled();
 });
});
