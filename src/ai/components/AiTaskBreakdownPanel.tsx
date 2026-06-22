import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { BoardStatus } from "../../board";
import type { TaskInput } from "../../task";

export type AiGeneratedTask = {
 title: string;
 description: string;
 status: TaskInput["statusKey"];
};

export type AiTaskBreakdownResult =
 | {
    ok: true;
    tasks: AiGeneratedTask[];
   }
 | {
    ok: false;
    reason: "not_feature_request" | "too_vague" | "invalid_response";
    message: string;
   };

type DraftTask = {
 id: string;
 title: string;
 description: string;
 statusKey: TaskInput["statusKey"];
};

type AiTaskBreakdownPanelProps = {
 statuses: BoardStatus[];
 defaultStatusKey?: TaskInput["statusKey"];
 disabled?: boolean;
 onGenerateTasks: (prompt: string) => Promise<AiTaskBreakdownResult>;
 onCreateTasks: (tasks: TaskInput[]) => Promise<unknown> | unknown;
};

const createDraftId = () => {
 if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
  return crypto.randomUUID();
 }

 return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

function DraftTaskListSkeleton() {
 return (
  <div className="mt-5 border-t border-slate-200 pt-4" aria-live="polite">
   <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-sm font-semibold text-slate-950">AI 正在重新拆解 tasks</p>
    <p className="text-sm text-slate-500">請稍候</p>
   </div>

   <div className="divide-y divide-slate-200 overflow-hidden rounded-md border border-slate-200 bg-white">
    {[0, 1, 2].map((item) => (
     <div className="flex gap-3 p-3 sm:p-4" key={item}>
      <div className="mt-1 h-4 w-4 shrink-0 rounded border border-slate-200 bg-slate-100" />
      <div className="min-w-0 flex-1 animate-pulse">
       <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="h-4 w-2/3 rounded bg-slate-200" />
        <div className="h-5 w-14 rounded-full bg-slate-100" />
       </div>
       <div className="mt-3 h-3 w-full rounded bg-slate-200" />
       <div className="mt-2 h-3 w-4/5 rounded bg-slate-200" />
      </div>
     </div>
    ))}
   </div>
  </div>
 );
}

export function AiTaskBreakdownPanel({
 statuses,
 defaultStatusKey,
 disabled = false,
 onGenerateTasks,
 onCreateTasks,
}: AiTaskBreakdownPanelProps) {
 const fallbackStatusKey = defaultStatusKey ?? statuses[0]?.key ?? "todo";
 const statusTitleByKey = useMemo(
  () => new Map(statuses.map((status) => [status.key, status.title])),
  [statuses],
 );
 const [prompt, setPrompt] = useState("");
 const [draftTasks, setDraftTasks] = useState<DraftTask[]>([]);
 const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
 const [error, setError] = useState("");
 const [isGenerating, setIsGenerating] = useState(false);
 const [isCreating, setIsCreating] = useState(false);

 const selectedTasks = useMemo(
  () => draftTasks.filter((task) => selectedTaskIds.has(task.id)),
  [draftTasks, selectedTaskIds],
 );

 const generateDraftTasks = async (inputPrompt: string) => {
  setIsGenerating(true);
  setError("");
  setDraftTasks([]);
  setSelectedTaskIds(new Set());

  try {
   const result = await onGenerateTasks(inputPrompt);

   if (!result.ok) {
    setDraftTasks([]);
    setSelectedTaskIds(new Set());
    setError(result.message);
    return;
   }

   const nextDraftTasks = result.tasks
    .map((task) => ({
     id: createDraftId(),
     title: task.title.trim(),
     description: task.description.trim(),
     statusKey: statusTitleByKey.has(task.status ?? fallbackStatusKey)
      ? (task.status ?? fallbackStatusKey)
      : fallbackStatusKey,
    }))
    .filter((task) => task.title);

   if (!nextDraftTasks.length) {
    setDraftTasks([]);
    setSelectedTaskIds(new Set());
    setError("目前沒有產生可加入的 task，請換個描述再試一次");
    return;
   }

   setDraftTasks(nextDraftTasks);
   setSelectedTaskIds(new Set(nextDraftTasks.map((task) => task.id)));
  } catch {
   setError("AI 拆任務失敗，請稍後再試");
  } finally {
   setIsGenerating(false);
  }
 };

 const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();

  const trimmedPrompt = prompt.trim();

  if (!trimmedPrompt) {
   setError("請輸入想拆解的需求");
   return;
  }

  await generateDraftTasks(trimmedPrompt);
 };

 const handleRegenerate = async () => {
  const trimmedPrompt = prompt.trim();

  if (!trimmedPrompt) {
   setError("請輸入想拆解的需求");
   return;
  }

  await generateDraftTasks(trimmedPrompt);
 };

 const handleToggleTask = (taskId: string) => {
  setSelectedTaskIds((currentIds) => {
   const nextIds = new Set(currentIds);

   if (nextIds.has(taskId)) {
    nextIds.delete(taskId);
   } else {
    nextIds.add(taskId);
   }

   return nextIds;
  });
 };

 const handleCreateTasks = async () => {
  if (!selectedTasks.length) {
   setError("請至少選擇一個 task");
   return;
  }

  setIsCreating(true);
  setError("");

  try {
   await onCreateTasks(
    selectedTasks.map((task) => ({
     title: task.title,
     description: task.description,
     statusKey: task.statusKey,
    })),
   );
   setDraftTasks([]);
   setSelectedTaskIds(new Set());
   setPrompt("");
  } catch {
   setError("加入 task 失敗，請稍後再試");
  } finally {
   setIsCreating(false);
  }
 };

 return (
  <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5">
   <div className="mb-4">
    <div>
     <h3 className="text-lg font-semibold text-slate-950">AI 拆任務</h3>
     <p className="mt-1 text-sm leading-6 text-slate-600">把一段需求拆成可加入 board 的 tasks。</p>
    </div>
   </div>

   <form className="space-y-3" onSubmit={handleGenerate}>
    <textarea
     className="min-h-24 w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
     disabled={disabled || isGenerating || isCreating}
     onChange={(event) => setPrompt(event.target.value)}
     placeholder="例如：做一個登入與註冊功能，包含錯誤提示和測試"
     value={prompt}
    />

    <div className="flex flex-col gap-2 sm:flex-row">
     <button
      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:cursor-pointer hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      disabled={disabled || isGenerating || isCreating}
      type="submit"
     >
      {isGenerating ? "產生中..." : "產生 tasks"}
     </button>
    </div>
   </form>

   {error ? (
    <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
     {error}
    </p>
   ) : null}

   {isGenerating ? <DraftTaskListSkeleton /> : null}

   {!isGenerating && draftTasks.length ? (
    <div className="mt-5 border-t border-slate-200 pt-4">
     <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-slate-950">
       AI 建議新增 {draftTasks.length} 個 tasks
      </p>
      <p className="text-sm text-slate-500">{selectedTasks.length} 個已選</p>
     </div>

     <div className="divide-y divide-slate-200 overflow-hidden rounded-md border border-slate-200 bg-white">
      {draftTasks.map((task) => {
       const isSelected = selectedTaskIds.has(task.id);

       return (
        <label
         className={`flex gap-3 p-3 transition hover:cursor-pointer hover:bg-slate-50 sm:p-4 ${
          isSelected ? "bg-white" : "bg-slate-50/70"
         }`}
         key={task.id}
        >
         <input
          checked={isSelected}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
          disabled={disabled || isCreating}
          onChange={() => handleToggleTask(task.id)}
          type="checkbox"
         />
         <span className="min-w-0 flex-1">
          <span className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
           <span className="break-words text-sm font-semibold leading-6 text-slate-950">
            {task.title}
           </span>
           <span className="w-fit shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {statusTitleByKey.get(task.statusKey) ?? task.statusKey}
           </span>
          </span>
          {task.description ? (
           <span className="mt-1 block break-words text-sm leading-6 text-slate-600">
            {task.description}
           </span>
          ) : null}
         </span>
        </label>
       );
      })}
     </div>

     <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
      <button
       className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:cursor-pointer hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
       disabled={disabled || isGenerating || isCreating}
       onClick={handleRegenerate}
       type="button"
      >
       重新產生
      </button>
      <button
       className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:cursor-pointer hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
       disabled={disabled || isGenerating || isCreating || !selectedTasks.length}
       onClick={handleCreateTasks}
       type="button"
      >
       {isCreating ? "加入中..." : `加入 ${selectedTasks.length} 個 tasks`}
      </button>
     </div>
    </div>
   ) : null}
  </section>
 );
}
