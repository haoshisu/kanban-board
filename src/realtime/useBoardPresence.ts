import { useEffect, useState } from "react"
import { captureAppError } from "../lib/errorReporting"
import { getSupabase } from "../lib/supabase"

export type PresenceMember = {
 userId: string
 name: string
}

type UseBoardPresenceOptions = {
 boardId: string | null
 userId: string | undefined
 userName: string | undefined
 enabled: boolean
}

export function useBoardPresence({ boardId, userId, userName, enabled }: UseBoardPresenceOptions) {
 const [members, setMembers] = useState<PresenceMember[]>([])
 useEffect(() => {
  if (!boardId || !userId || !enabled) {
   // 條件不成立時清空在場名單，不會啟動訂閱，不會有 cascading render 的疑慮。
   // eslint-disable-next-line react-hooks/set-state-in-effect
   setMembers([])
   return
  }
  let disposed = false
  let removeChannel: (() => Promise<unknown>) | undefined

  const subscribe = async () => {
   const supabase = await getSupabase()
   if (disposed) return

   // config: { presence: { key: userId } }：用 userId 當這個人在頻道裡的唯一 key，
   // 這樣同一人開兩個分頁會被視為同一個 presence entry（用 userId 去重），不會出現「自己看到自己兩個頭像」。
   const channel = supabase.channel(`presence:board:${boardId}`, { config: { presence: { key: userId } } })

   channel.on("presence", { event: "sync" }, () => {
    // channel.presenceState<PresenceMember>() 回傳的結構是 { [key]: PresenceMember[] }（同一個 key 底下可能有多筆，例如同一人多分頁）
    // 所以用 Object.values(...).flat() 攤平成一維陣列。
    const state = channel.presenceState<PresenceMember>()
    const list = Object.values(state)
     .flat()
     .map((entry) => ({ userId: entry.userId, name: entry.name }))
    setMembers(list)
   })

   channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
     void channel.track({ userId, name: userName ?? userId })
    }
   })

   removeChannel = () => supabase.removeChannel(channel)
  }
  void subscribe().catch((error: unknown) => {
   if (disposed) return
   captureAppError(error, { area: "realtime", action: "presence-subscribe", boardId })
  })

  // cleanup 時把 members 清空、removeChannel()——分頁切換 board 或離開頁面時，不會留著舊 board 的在場清單殘影。
  // 完全比照 useRealtimeTableRefresh.ts 的 disposed guard 寫法，避免非同步的 subscribe() 在元件已經卸載後才 resolve、
  // 造成 memory leak 或對已卸載元件 setState。

  return () => {
   disposed = true
   setMembers([])
   if (removeChannel) void removeChannel()
  }
 }, [boardId, enabled, userId, userName])
 return members
}
