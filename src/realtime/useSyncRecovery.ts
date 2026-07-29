import { useEffect, useRef } from "react";

export function useSyncRecovery(onRecover: () => void | Promise<void>, enabled = true) {
 const recoverRef = useRef(onRecover);

 useEffect(() => {
  recoverRef.current = onRecover;
 }, [onRecover]);

 useEffect(() => {
  if (!enabled) return;

  const recover = () => {
   void Promise.resolve(recoverRef.current());
  };

  const handleVisibilityChange = () => {
   if (document.visibilityState === "visible") {
    recover();
   }
  };

  window.addEventListener("online", recover);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
   window.removeEventListener("online", recover);
   document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
 }, [enabled]);
}
