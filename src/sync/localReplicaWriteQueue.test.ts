import { describe, expect, it, vi } from "vitest";
import {
 enqueueLocalReplicaWrite,
 flushLocalReplicaWrites,
} from "./localReplicaWriteQueue";

const createDeferred = () => {
 let resolve!: () => void;
 const promise = new Promise<void>((nextResolve) => {
  resolve = nextResolve;
 });

 return { promise, resolve };
};

describe("localReplicaWriteQueue", () => {
 it("serializes writes for the same resource", async () => {
  const firstWrite = createDeferred();
  const events: string[] = [];

  const firstPromise = enqueueLocalReplicaWrite("tasks:owner-1:board-1", async () => {
   events.push("first:start");
   await firstWrite.promise;
   events.push("first:end");
  });

  const secondPromise = enqueueLocalReplicaWrite("tasks:owner-1:board-1", async () => {
   events.push("second");
  });

  await vi.waitFor(() => {
   expect(events).toEqual(["first:start"]);
  });

  firstWrite.resolve();
  await Promise.all([firstPromise, secondPromise]);

  expect(events).toEqual(["first:start", "first:end", "second"]);
 });

 it("continues after an earlier write fails", async () => {
  const events: string[] = [];

  const failedWrite = enqueueLocalReplicaWrite("boards:owner-1", async () => {
   events.push("failed");
   throw new Error("IndexedDB failed");
  });

  const nextWrite = enqueueLocalReplicaWrite("boards:owner-1", async () => {
   events.push("next");
  });

  await expect(failedWrite).rejects.toThrow("IndexedDB failed");
  await nextWrite;
  await flushLocalReplicaWrites();

  expect(events).toEqual(["failed", "next"]);
 });
});
