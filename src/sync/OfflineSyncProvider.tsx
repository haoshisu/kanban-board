import {
 useCallback,
 useEffect,
 useMemo,
 useRef,
 useState,
 type ReactNode,
} from "react";
import { captureAppError } from "../lib/errorReporting";
import { isLocalDataMode } from "../lib/localDataMode";
import { useOnlineStatus } from "../realtime/useOnlineStatus";
import type { PendingMutation } from "./localReplicaTypes";
import { readPendingMutations } from "./pendingMutationRepository";
import { flushPendingMutations } from "./supabaseSyncEngine";
import {
 OfflineSyncContext,
 type SyncState,
} from "./offlineSyncContext";

const entityKey = (mutation: PendingMutation) =>
 `${mutation.entityType}:${mutation.entityId}`;

export function OfflineSyncProvider({
 ownerId,
 children,
}: {
 ownerId?: string;
 children: ReactNode;
}) {
 const isOnline = useOnlineStatus();
 const localMode = isLocalDataMode();
 const [mutations, setMutations] = useState<PendingMutation[]>([]);
 const [requestRevision, setRequestRevision] = useState(0);
 const [syncRevision, setSyncRevision] = useState(0);
 const [isRemoteReady, setIsRemoteReady] = useState(localMode);
 const [syncState, setSyncState] = useState<SyncState>({
  status: isOnline ? "synced" : "offline",
  pendingCount: 0,
 });
 const retryAttemptRef = useRef(0);
 const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

 const requestSync = useCallback(() => {
  setRequestRevision((revision) => revision + 1);
 }, []);

 const retrySync = useCallback(() => {
  retryAttemptRef.current = 0;
  requestSync();
 }, [requestSync]);

 useEffect(() => {
  if (!ownerId || localMode) {
   // Switching owner/data mode resets provider-owned external synchronization state.
   // eslint-disable-next-line react-hooks/set-state-in-effect
   setMutations([]);
   setIsRemoteReady(true);
   setSyncState({ status: "synced", pendingCount: 0 });
   return;
  }

  let cancelled = false;
  setIsRemoteReady(false);

  const synchronize = async () => {
   const pending = await readPendingMutations(ownerId);
   if (cancelled) return;

   setMutations(pending);

   if (!isOnline) {
    setSyncState({ status: "offline", pendingCount: pending.length });
    return;
   }

   if (pending.length > 0) {
    setSyncState({ status: "syncing", pendingCount: pending.length });
   }

   try {
    await flushPendingMutations(ownerId);
    const remaining = await readPendingMutations(ownerId);
    if (cancelled) return;

    retryAttemptRef.current = 0;
    setMutations(remaining);
    setSyncState(
     remaining.length === 0
      ? { status: "synced", pendingCount: 0 }
      : { status: "error", pendingCount: remaining.length, message: "仍有變更等待同步" },
    );
    setSyncRevision((revision) => revision + 1);
   } catch (error) {
    if (cancelled) return;
    const remaining = await readPendingMutations(ownerId);
    const message = error instanceof Error ? error.message : "同步失敗";

    setMutations(remaining);
    setSyncState({ status: "error", pendingCount: remaining.length, message });
    captureAppError(error, {
     area: "offline-sync",
     action: "flushPendingMutations",
     ownerId,
     pendingCount: remaining.length,
    });

    retryAttemptRef.current += 1;
    const delay = Math.min(30_000, 1_000 * 2 ** (retryAttemptRef.current - 1));
    retryTimerRef.current = setTimeout(requestSync, delay);
   } finally {
    if (!cancelled) setIsRemoteReady(true);
   }
  };

  void synchronize().catch((error: unknown) => {
   captureAppError(error, {
    area: "offline-sync",
    action: "readPendingMutations",
    ownerId,
   });
  });

  return () => {
   cancelled = true;
   if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
  };
 }, [isOnline, localMode, ownerId, requestRevision, requestSync]);

 useEffect(() => {
  if (localMode) return;

  const handleVisibilityChange = () => {
   if (document.visibilityState === "visible") requestSync();
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
 }, [localMode, requestSync]);

 const pendingEntityKeys = useMemo(
  () => new Set(mutations.map(entityKey)),
  [mutations],
 );
 const value = useMemo(
  () => ({
   isOnline,
   isRemoteReady,
   mutations,
   pendingEntityKeys,
   requestSync,
   retrySync,
   syncRevision,
   syncState,
  }),
  [
   isOnline,
   isRemoteReady,
   mutations,
   pendingEntityKeys,
   requestSync,
   retrySync,
   syncRevision,
   syncState,
  ],
 );

 return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>;
}
