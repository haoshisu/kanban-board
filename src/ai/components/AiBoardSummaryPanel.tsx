import { useState } from "react";
import type { Board } from "../../board";
import type { BoardStatusKey } from "../../board";
import type { Task } from "../../task";

type AiBoardRecentUpdate = {
 title: string;
 status: BoardStatusKey;
 updateTime: string;
};

type AiBoardSummary = {
 boardName: string;
 keyFocus: string;
 progressOverview: string;
 recentUpdates: AiBoardRecentUpdate[];
 statusCounts: Record<BoardStatusKey, number>;
 totalTasks: number;
};

export type AiBoardSummaryResult =
 | {
    ok: true;
    summary: AiBoardSummary;
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
     <div>
      <p className="text-sm font-semibold text-slate-950">{result.summary.boardName}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{result.summary.progressOverview}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{result.summary.keyFocus}</p>
     </div>

     <div className="mt-4 grid grid-cols-3 gap-2">
      {board.statuses.map((status) => (
       <div className="rounded-md border border-slate-200 bg-white px-3 py-2" key={status.key}>
        <p className="text-xs font-medium text-slate-500">{status.title}</p>
        <p className="mt-1 text-lg font-semibold text-slate-950">
         {result.summary.statusCounts[status.key] ?? 0}
        </p>
       </div>
      ))}
     </div>

     {result.summary.recentUpdates.length ? (
      <div className="mt-4">
       <p className="text-sm font-semibold text-slate-950">最近更新</p>
       <ul className="mt-2 divide-y divide-slate-200 overflow-hidden rounded-md border border-slate-200 bg-white">
        {result.summary.recentUpdates.map((item) => {
         const statusTitle =
          board.statuses.find((status) => status.key === item.status)?.title ?? item.status;

         return (
          <li className="flex items-center justify-between gap-3 px-3 py-2" key={item.title}>
           <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
            <p className="mt-1 text-xs text-slate-500">{item.updateTime}</p>
           </div>
           <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            {statusTitle}
           </span>
          </li>
         );
        })}
       </ul>
      </div>
     ) : null}
    </div>
   ) : null}
  </section>
 );
}
