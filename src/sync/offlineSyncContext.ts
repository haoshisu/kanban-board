import { createContext, useContext } from "react";
import type { PendingMutation } from "./localReplicaTypes";

export type SyncState =
 | { status: "offline"; pendingCount: number }
 | { status: "syncing"; pendingCount: number }
 | { status: "synced"; pendingCount: 0 }
 | { status: "blocked"; pendingCount: number; message: string }
 | { status: "error"; pendingCount: number; message: string };

export type OfflineSyncContextValue = {
 isOnline: boolean;
 isRemoteReady: boolean;
 mutations: PendingMutation[];
 pendingEntityKeys: ReadonlySet<string>;
 requestSync: () => void;
 retrySync: () => void;
 syncRevision: number;
 syncState: SyncState;
};

export const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

const EMPTY_MUTATIONS: PendingMutation[] = [];
const EMPTY_ENTITY_KEYS = new Set<string>();
const NOOP = () => undefined;

export const useOfflineSync = () => {
 const context = useContext(OfflineSyncContext);
 if (context) return context;

 // Feature hooks can still be rendered in isolation by unit tests and Storybook.
 const online = typeof navigator === "undefined" ? true : navigator.onLine;
 return {
  isOnline: online,
  isRemoteReady: true,
  mutations: EMPTY_MUTATIONS,
  pendingEntityKeys: EMPTY_ENTITY_KEYS,
  requestSync: NOOP,
  retrySync: NOOP,
  syncRevision: 0,
  syncState: online
   ? ({ status: "synced", pendingCount: 0 } as const)
   : ({ status: "offline", pendingCount: 0 } as const),
 };
};
