import { useId, useState } from "react";
import type { FormEvent } from "react";
import {
 formCardClassName,
 formErrorClassName,
 formFieldLabelClassName,
 formInputClassName,
 primaryButtonClassName,
 secondaryButtonClassName,
} from "../../shared/formStyles";
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
  <form className={formCardClassName} onSubmit={handleSubmit}>
   <div className="space-y-4">
    <div>
     <label className={formFieldLabelClassName} htmlFor={nameId}>
      Board 名稱
     </label>
     <input
      className={formInputClassName}
      disabled={isSubmitting}
      id={nameId}
      onChange={(event) => setName(event.target.value)}
      placeholder="例如：產品開發"
      type="text"
      value={name}
     />
    </div>

    <div>
     <label className={formFieldLabelClassName} htmlFor={descriptionId}>
      描述
     </label>
     <textarea
      className={`min-h-24 resize-none ${formInputClassName}`}
      disabled={isSubmitting}
      id={descriptionId}
      onChange={(event) => setDescription(event.target.value)}
      placeholder="補充這個 board 的協作目標"
      value={description}
     />
    </div>

    {error ? <p className={formErrorClassName}>{error}</p> : null}

    <div className="flex flex-col gap-2 sm:flex-row">
     <button className={primaryButtonClassName} disabled={isSubmitting} type="submit">
      {isSubmitting ? "處理中..." : submitLabel}
     </button>
     {onCancel ? (
      <button
       className={secondaryButtonClassName}
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
