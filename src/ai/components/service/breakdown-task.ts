import { getSupabase } from "../../../lib/supabase";

// supabase edge function 呼叫 gemini api
// supabse edge function 建立在supabse 雲端
export async function generateTaskBreakdown(prompt: string) {
 const supabase = await getSupabase();
 if (!prompt.trim()) {
  return {
   ok: false,
   reason: "too_vague",
   message: "請輸入想拆解的需求",
  };
 }

 const { data, error } = await supabase.functions.invoke("breakdown-task", {
  body: {
   prompt: prompt,
  },
 });

 if (error) {
  return {
   ok: false,
   reason: "invalid_response",
   message: "AI 拆任務失敗，請稍後再試",
  };
 }

 return data;
}
