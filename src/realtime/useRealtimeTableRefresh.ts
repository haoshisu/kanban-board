import { useEffect, useRef, useState } from "react";
import { captureAppError } from "../lib/errorReporting";
import { getSupabase } from "../lib/supabase";

type RealtimeTable = "boards" | "tasks";

export type RealtimeStatus = "disabled" | "connecting" | "connected" | "error";

type UseRealtimeTableRefreshOptions = {
 channelName: string;
 table: RealtimeTable;
 enabled: boolean;
 onRefresh: () => void | Promise<void>;
};

export function useRealtimeTableRefresh({ channelName, table, enabled, onRefresh }: UseRealtimeTableRefreshOptions) {
 const [status, setStatus] = useState<RealtimeStatus>(enabled ? "connecting" : "disabled");
 const refreshRef = useRef(onRefresh);

 useEffect(() => {
  refreshRef.current = onRefresh;
 }, [onRefresh]);

 useEffect(() => {
  if (!enabled) return;

  let disposed = false;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let removeChannel: (() => Promise<unknown>) | undefined;

  const scheduleRefresh = () => {
   clearTimeout(refreshTimer);

   refreshTimer = setTimeout(() => {
    if (disposed) return;

    Promise.resolve(refreshRef.current()).catch((error: unknown) => {
     captureAppError(error, {
      area: "realtime",
      action: "refresh",
      table,
     });
    });
   }, 100);
  };

  const subscribe = async () => {
   setStatus("connecting");

   const supabase = await getSupabase();

   if (disposed) return;

   const channel = supabase
    .channel(channelName)
    .on(
     "postgres_changes",
     {
      event: "*",
      schema: "public",
      table,
     },
     scheduleRefresh,
    )
    .subscribe((channelStatus, error) => {
     if (channelStatus === "SUBSCRIBED") {
      setStatus("connected");

      // 訂閱成功後重抓一次，修補初始查詢到訂閱完成間的空窗。
      scheduleRefresh();
      return;
     }

     if (channelStatus === "CHANNEL_ERROR" || channelStatus === "TIMED_OUT") {
      setStatus("error");

      captureAppError(error ?? new Error(`Realtime ${channelStatus}`), {
       area: "realtime",
       action: "subscribe",
       table,
       channelName,
      });
     }
    });

   removeChannel = () => supabase.removeChannel(channel);
  };

  void subscribe().catch((error: unknown) => {
   if (disposed) return;

   setStatus("error");

   captureAppError(error, {
    area: "realtime",
    action: "initialize",
    table,
    channelName,
   });
  });

  return () => {
   disposed = true;
   clearTimeout(refreshTimer);

   if (removeChannel) {
    void removeChannel();
   }
  };
 }, [channelName, enabled, table]);

 return status;
}
