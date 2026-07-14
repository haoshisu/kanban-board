import { getSupabase } from "../../../lib/supabase";
import type { Board } from "../../../board";
import type { Task } from "../../../task";

// supabase edge function 呼叫 gemini api
// supabse edge function 建立在supabse 雲端
export async function generateBoardSummary(board: Board, tasks: Task[]) {
 if (!tasks.length) {
  return {
   ok: false,
   reason: "no_tasks",
   message: "這個 board 還沒有任何 task，無法產生摘要",
  };
 }

 const supabase = await getSupabase();

 const { data, error } = await supabase.functions.invoke("summarize-board", {
  body: {
   board: {
    name: board.name,
    description: board.description,
    statuses: board.statuses,
   },
   tasks: tasks.map((task) => ({
    title: task.title,
    description: task.description,
    statusKey: task.statusKey,
    updatedAt: task.updatedAt,
   })),
  },
 });

 if (error) {
  return {
   ok: false,
   reason: "invalid_response",
   message: "AI 摘要失敗，請稍後再試",
  };
 }

 return data;
}
