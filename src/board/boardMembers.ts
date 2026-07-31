import { getSupabase } from "../lib/supabase"

export type BoardMember = {
 userId: string
 role: string
 displayName: string | null
}

// database.types.ts 還沒有 board_members 的表定義（等 migration 執行、重新產生型別後再補上），
// 這裡先用 as any 繞過型別檢查，補上型別後要記得拿掉。

export const listBoardMembers = async (boardId: string): Promise<BoardMember[]> => {
 const supabase = await getSupabase()
 // eslint-disable-next-line @typescript-eslint/no-explicit-any -- board_members 型別待補，見上方註解
 const { data, error } = await (supabase as any)
  .from("board_members")
  .select("user_id,role,profiles(display_name)")
  .eq("board_id", boardId)

 if (error) throw error
 // eslint-disable-next-line @typescript-eslint/no-explicit-any -- board_members 型別待補，見上方註解
 return (data ?? []).map((row: any) => ({
  userId: row.user_id,
  role: row.role,
  displayName: row.profiles?.display_name ?? null,
 }))
}

// inviteBoardMember 沒有 role 參數——因為這次的角色設計裡，邀請永遠是邀請別人當 editor（owner 身分只有建立 board 的人才有，
// 不能用邀請的方式轉讓），對應到 SQL 那邊 invite_board_member 函式的 p_role 預設值就是 'editor'，所以前端不用特別傳。
// 三個函式都不走離線同步佇列（不像 stageBoardUpsert 那樣），直接呼叫 Supabase——因為「邀請/移除協作者」
// 本質上是需要網路連線才有意義的操作，離線時排隊也沒用，之後 UI 上只要在離線時把「共享」按鈕 disable 掉即可。

export const inviteBoardMember = async (boardId: string, email: string): Promise<void> => {
 const supabase = await getSupabase()
 // eslint-disable-next-line @typescript-eslint/no-explicit-any -- board_members 型別待補，見上方註解
 const { error } = await (supabase as any).rpc("invite_board_member", { p_board_id: boardId, p_email: email })

 if (error) throw error
}

export const removeBoardMember = async (boardId: string, userId: string): Promise<void> => {
 const supabase = await getSupabase()
 // eslint-disable-next-line @typescript-eslint/no-explicit-any -- board_members 型別待補，見上方註解
 const { error } = await (supabase as any).from("board_members").delete().eq("board_id", boardId).eq("user_id", userId)

 if (error) throw error
}
