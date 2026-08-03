import { getSupabase } from "../lib/supabase"

export type BoardMember = {
 userId: string
 role: string
 displayName: string | null
}

export const listBoardMembers = async (boardId: string): Promise<BoardMember[]> => {
 const supabase = await getSupabase()
 const { data, error } = await supabase
  .from("board_members")
  .select("user_id,role,profiles(display_name)")
  .eq("board_id", boardId)

 if (error) throw error
 return (data ?? []).map((row) => ({
  userId: row.user_id,
  role: row.role,
  displayName: row.profiles?.display_name ?? null,
 }))
}

// inviteBoardMember 沒有 role 參數——因為這次的角色設計裡，邀請永遠是邀請別人當 editor（owner 身分只有建立 board 的人才有，
// 不能用邀請的方式轉讓），對應到 SQL 那邊 invite_board_member 函式的 p_role 預設值就是 'editor'，所以前端不用特別傳。
// 三個函式都不走離線同步佇列（不像 stageBoardUpsert 那樣），直接呼叫 Supabase——因為「邀請/移除協作者」
// 本質上是需要網路連線才有意義的操作，離線時排隊也沒用，之後 UI 上只要在離線時把「共享」按鈕 disable 掉即可。

// invite_board_member 這個 SQL function 裡用 raise exception 丟出的訊息，會原封不動出現在 error.message，
// 這裡把它們對應成使用者看得懂的中文，其他沒對應到的訊息就用預設的通用錯誤。
const inviteErrorMessages: Record<string, string> = {
 "board not found": "找不到這個 board",
 "not authorized": "只有 board 建立者才能邀請協作者",
 "user not found": "找不到使用者，請確認對方 email 是否已註冊帳號",
 "cannot invite the board owner": "不能邀請自己",
}

export const getInviteErrorMessage = (error: unknown): string => {
 const message = error instanceof Error ? error.message : ""
 return inviteErrorMessages[message] ?? "邀請失敗，請稍後再試"
}

export const inviteBoardMember = async (boardId: string, email: string): Promise<void> => {
 const supabase = await getSupabase()
 const { error } = await supabase.rpc("invite_board_member", { p_board_id: boardId, p_email: email })

 if (error) throw error
}

export const removeBoardMember = async (boardId: string, userId: string): Promise<void> => {
 const supabase = await getSupabase()
 const { error } = await supabase.from("board_members").delete().eq("board_id", boardId).eq("user_id", userId)

 if (error) throw error
}
