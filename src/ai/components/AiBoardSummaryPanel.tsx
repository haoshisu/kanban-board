import { useState } from "react";
import type { Board } from "../../board";
import type { Task } from "../../task";

export type AiBoardSummaryResult =
 | {
    ok: true;
    summary: string;
    attentionItems: string[];
   }
 | {
    ok: false;
    reason: "no_tasks" | "invalid_response";
    message: string;
   };

type AiBoardSummaryPanelProps = {
 board: Board;
 tasks: Task[];
 disabled?: boolean;
 onGenerateSummary: (board: Board, tasks: Task[]) => Promise<AiBoardSummaryResult>;
};

function BoardSummarySkeleton() {
 return (
  <div className="mt-4 animate-pulse space-y-2" aria-live="polite">
   <div className="h-3 w-full rounded bg-slate-200" />
   <div className="h-3 w-4/5 rounded bg-slate-200" />
   <div className="h-3 w-3/5 rounded bg-slate-200" />
  </div>
 );
}

export function AiBoardSummaryPanel({
 board,
 tasks,
 disabled = false,
 onGenerateSummary,
}: AiBoardSummaryPanelProps) {
 const [result, setResult] = useState<AiBoardSummaryResult | null>(null);
 const [error, setError] = useState("");
 const [isGenerating, setIsGenerating] = useState(false);

 const handleGenerate = async () => {
  setIsGenerating(true);
  setError("");
  setResult(null);

  try {
   const nextResult = await onGenerateSummary(board, tasks);

   if (!nextResult.ok) {
    setError(nextResult.message);
    return;
   }

   setResult(nextResult);
  } catch {
   setError("AI 摘要失敗，請稍後再試");
  } finally {
   setIsGenerating(false);
  }
 };

 return (
  <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5">
   <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
     <h3 className="text-lg font-semibold text-slate-950">AI Board 摘要</h3>
     <p className="mt-1 text-sm leading-6 text-slate-600">
      快速了解這個 board 目前的進度與需要留意的 tasks。
     </p>
    </div>

    <button
     className="w-fit shrink-0 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:cursor-pointer hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
     disabled={disabled || isGenerating}
     onClick={handleGenerate}
     type="button"
    >
     {isGenerating ? "產生中..." : "產生摘要"}
    </button>
   </div>

   {error ? (
    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
     {error}
    </p>
   ) : null}

   {isGenerating ? <BoardSummarySkeleton /> : null}

   {!isGenerating && result?.ok ? (
    <div className="mt-4 border-t border-slate-200 pt-4">
     <p className="text-sm leading-6 text-slate-700">{result.summary}</p>

     {result.attentionItems.length ? (
      <div className="mt-4">
       <p className="text-sm font-semibold text-slate-950">需要留意</p>
       <ul className="mt-2 space-y-2">
        {result.attentionItems.map((item) => (
         <li
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800"
          key={item}
         >
          {item}
         </li>
        ))}
       </ul>
      </div>
     ) : null}
    </div>
   ) : null}
  </section>
 );
}
