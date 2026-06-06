import { useId, useState } from "react";
import type { FormEvent } from "react";
import type { Board, BoardInput } from "../types";

type BoardFormProps = {
 board?: Board;
 submitLabel: string;
 onSubmit: (input: BoardInput) => Promise<unknown> | unknown;
 onCancel?: () => void;
};

export function BoardForm({ board, submitLabel, onSubmit, onCancel }: BoardFormProps) {
 const formId = useId();
 const nameId = `${formId}-board-name`;
 const descriptionId = `${formId}-board-description`;
 const [name, setName] = useState(board?.name ?? "");
 const [description, setDescription] = useState(board?.description ?? "");
 const [error, setError] = useState("");
 const [isSubmitting, setIsSubmitting] = useState(false);

 const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();

  if (!name.trim()) {
   setError("請輸入 board 名稱");
   return;
  }

  setIsSubmitting(true);

  try {
   await onSubmit({ name, description });
  } finally {
   setIsSubmitting(false);
  }

  setError("");

  if (!board) {
   setName("");
   setDescription("");
  }
 };

 return (
  <form
   className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
   onSubmit={handleSubmit}
  >
   <div className="space-y-4">
    <div>
     <label className="text-sm font-medium text-slate-700" htmlFor={nameId}>
      Board 名稱
     </label>
     <input
      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
      disabled={isSubmitting}
      id={nameId}
      onChange={(event) => setName(event.target.value)}
      placeholder="例如：產品開發"
      type="text"
      value={name}
     />
    </div>

    <div>
     <label className="text-sm font-medium text-slate-700" htmlFor={descriptionId}>
      描述
     </label>
     <textarea
      className="mt-2 min-h-24 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
      disabled={isSubmitting}
      id={descriptionId}
      onChange={(event) => setDescription(event.target.value)}
      placeholder="補充這個 board 的協作目標"
      value={description}
     />
    </div>

    {error ? <p className="text-sm text-red-600">{error}</p> : null}

    <div className="flex flex-col gap-2 sm:flex-row">
     <button
      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 hover:cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-400"
      disabled={isSubmitting}
      type="submit"
     >
      {isSubmitting ? "處理中..." : submitLabel}
     </button>
     {onCancel ? (
      <button
       className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
       disabled={isSubmitting}
       onClick={onCancel}
       type="button"
      >
       取消
      </button>
     ) : null}
    </div>
   </div>
  </form>
 );
}
