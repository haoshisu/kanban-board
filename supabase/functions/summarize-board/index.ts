// Supabase Edge Function（Deno runtime）
// 用途：接收 board + tasks 的精簡資料，呼叫 Gemini API 產生中文摘要與「需要留意」清單。
//
// 部署方式（在有安裝 supabase CLI 的環境執行）：
//   supabase functions deploy summarize-board
//   supabase secrets set GEMINI_API_KEY=你的金鑰
//
// 本機測試：
//   supabase functions serve summarize-board --env-file ./supabase/.env.local

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT =
 `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const corsHeaders = {
 "Access-Control-Allow-Origin": "*",
 "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type BoardSummaryTaskInput = {
 title: string;
 description: string;
 statusKey: string;
 updatedAt: string;
};

type BoardSummaryRequestBody = {
 board: {
  name: string;
  description: string;
  statuses: { key: string; title: string }[];
 };
 tasks: BoardSummaryTaskInput[];
};

type BoardSummaryOkResult = {
 ok: true;
 summary: string;
 attentionItems: string[];
};

type BoardSummaryErrorResult = {
 ok: false;
 reason: "no_tasks" | "invalid_response";
 message: string;
};

function jsonResponse(body: BoardSummaryOkResult | BoardSummaryErrorResult, status = 200) {
 return new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
 });
}

function buildPrompt(body: BoardSummaryRequestBody): string {
 const statusTitleByKey = new Map(body.board.statuses.map((status) => [status.key, status.title]));
 const now = new Date().toISOString();

 const taskLines = body.tasks
  .map((task, index) => {
   const statusTitle = statusTitleByKey.get(task.statusKey) ?? task.statusKey;
   return `${index + 1}. [${statusTitle}] ${task.title} — ${task.description || "（無描述）"}（最後更新：${task.updatedAt}）`;
  })
  .join("\n");

 return `你是一個專案管理助理。請根據以下 board「${body.board.name}」的 tasks 清單，用「繁體中文」產生：
1. summary：2-4 句簡短摘要，描述整體進度（例如各狀態各有幾個 task、整體是否卡住）。
2. attentionItems：需要特別留意的 task 清單（例如超過 7 天沒更新、描述顯示有阻礙、或長時間卡在同一個狀態），每項用一句話描述，若沒有則回傳空陣列。

現在時間：${now}

Tasks：
${taskLines}

請只回傳符合 schema 的 JSON，不要加入其他文字。`;
}

Deno.serve(async (req: Request) => {
 if (req.method === "OPTIONS") {
  return new Response("ok", { headers: corsHeaders });
 }

 if (!GEMINI_API_KEY) {
  return jsonResponse(
   { ok: false, reason: "invalid_response", message: "AI 摘要失敗，請稍後再試" },
   500,
  );
 }

 let body: BoardSummaryRequestBody;

 try {
  body = await req.json();
 } catch {
  return jsonResponse(
   { ok: false, reason: "invalid_response", message: "AI 摘要失敗，請稍後再試" },
   400,
  );
 }

 if (!body.tasks?.length) {
  return jsonResponse({
   ok: false,
   reason: "no_tasks",
   message: "這個 board 還沒有任何 task，無法產生摘要",
  });
 }

 try {
  const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
   method: "POST",
   headers: { "Content-Type": "application/json" },
   body: JSON.stringify({
    contents: [{ parts: [{ text: buildPrompt(body) }] }],
    generationConfig: {
     responseMimeType: "application/json",
     responseSchema: {
      type: "OBJECT",
      properties: {
       summary: { type: "STRING" },
       attentionItems: { type: "ARRAY", items: { type: "STRING" } },
      },
      required: ["summary", "attentionItems"],
     },
    },
   }),
  });

  if (!response.ok) {
   return jsonResponse(
    { ok: false, reason: "invalid_response", message: "AI 摘要失敗，請稍後再試" },
    502,
   );
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = JSON.parse(text ?? "");

  if (typeof parsed.summary !== "string" || !Array.isArray(parsed.attentionItems)) {
   throw new Error("invalid shape");
  }

  return jsonResponse({
   ok: true,
   summary: parsed.summary,
   attentionItems: parsed.attentionItems.filter((item: unknown) => typeof item === "string"),
  });
 } catch {
  return jsonResponse(
   { ok: false, reason: "invalid_response", message: "AI 摘要失敗，請稍後再試" },
   502,
  );
 }
});
