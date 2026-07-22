import { useEffect, useEffectEvent, useState } from "react";
import { captureAppError } from "../lib/errorReporting";
import { getSupabase } from "../lib/supabase";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type RealtimeTable = "boards" | "tasks";

export type RealtimeStatus = "disabled" | "connecting" | "connected" | "error";

type UseRealtimeTableRefreshOptions<Row extends Record<string, unknown>> = {
 channelName: string;
 table: RealtimeTable;
 enabled: boolean;
 onChange: (payload: RealtimePostgresChangesPayload<Row>) => void;
 onRefresh: () => void | Promise<void>;
};

export function useRealtimeTableRefresh<Row extends Record<string, unknown>>({
 channelName,
 table,
 enabled,
 onChange,
 onRefresh,
}: UseRealtimeTableRefreshOptions<Row>) {
 const onChangeEvent = useEffectEvent(onChange);
 const onSubscribedEvent = useEffectEvent(onRefresh);
 const [status, setStatus] = useState<RealtimeStatus>(enabled ? "connecting" : "disabled");

 useEffect(() => {
  if (!enabled) return;

  let disposed = false;
  let removeChannel: (() => Promise<unknown>) | undefined;

  const subscribe = async () => {
   setStatus("connecting");

   const supabase = await getSupabase();

   if (disposed) return;

   const channel = supabase
    .channel(channelName)
    .on<Row>(
     "postgres_changes",
     {
      event: "*",
      schema: "public",
      table,
     },
     //  scheduleRefresh,
     (payload) => {
      if (!disposed) {
       onChangeEvent(payload);
      }
     },
    )
    .subscribe((channelStatus, error) => {
     if (channelStatus === "SUBSCRIBED") {
      setStatus("connected");

      // 訂閱成功後重抓一次，修補初始查詢到訂閱完成間的空窗。
      void Promise.resolve()
       .then(() => onSubscribedEvent())
       .catch((error: unknown) => {
        captureAppError(error, {
         area: "realtime",
         action: "refresh",
         table,
        });
       });

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

   if (removeChannel) {
    void removeChannel();
   }
  };
 }, [channelName, enabled, table]);

 return status;
}
