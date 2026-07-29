import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOnlineStatus } from "./useOnlineStatus";

describe("useOnlineStatus", () => {
 afterEach(() => {
  vi.unstubAllGlobals();
 });

 it("tracks browser online and offline events", () => {
  let isOnline = true;

  vi.stubGlobal("navigator", {
   get onLine() {
    return isOnline;
   },
  });

  const { result } = renderHook(() => useOnlineStatus());

  expect(result.current).toBe(true);

  act(() => {
   isOnline = false;
   window.dispatchEvent(new Event("offline"));
  });

  expect(result.current).toBe(false);

  act(() => {
   isOnline = true;
   window.dispatchEvent(new Event("online"));
  });

  expect(result.current).toBe(true);
 });
});
