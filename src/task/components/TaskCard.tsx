import { useDraggable } from "@dnd-kit/react";
import { memo } from "react";
import { StatusStamp } from "../../shared/components/StatusStamp";
import { statusLabels, statusStyles } from "../../shared/statusStyles";
import type { Task } from "../types";

type TaskCardProps = {
 task: Task;
 onEdit: (task: Task) => void;
 onDelete: (task: Task) => void;
};

const dateFormatter = new Intl.DateTimeFormat("zh-TW", {
 month: "short",
 day: "numeric",
});

function TaskCardComponent({ task, onEdit, onDelete }: TaskCardProps) {
 const { isDragging, ref } = useDraggable({
  id: task.id,
  type: "task",
  data: {
   taskId: task.id,
   statusKey: task.statusKey,
  },
 });

 return (
  <article
   aria-label={`Task ${task.title}`}
   className={`relative cursor-grab overflow-hidden rounded-md border border-ink-muted/30 bg-card p-3 pt-4 transition active:cursor-grabbing ${
    isDragging ? "opacity-50 ring-2 ring-stamp-todo/40 motion-safe:shadow-lg" : ""
   }`}
   ref={ref}
  >
   <div
    aria-hidden="true"
    className={`absolute inset-x-0 top-0 h-[3px] ${statusStyles[task.statusKey].bar}`}
   />
   <StatusStamp
    className="absolute right-2 top-2.5"
    label={statusLabels[task.statusKey]}
    statusKey={task.statusKey}
   />

   <div className="pr-14">
    <h4 className="font-display text-sm font-semibold leading-6 text-ink">{task.title}</h4>
    {task.description ? (
     <p className="mt-1 text-sm leading-6 text-ink-muted">{task.description}</p>
    ) : null}
    <p className="mt-3 text-xs text-ink-muted">
     更新於 {dateFormatter.format(new Date(task.updatedAt))}
    </p>
   </div>

   <div className="mt-3 flex gap-2">
    <button
     className="rounded-[5px] border border-ink-muted/40 px-2.5 py-1 text-xs font-medium text-ink transition hover:cursor-pointer hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp-todo"
     onClick={() => onEdit(task)}
     type="button"
    >
     修改
    </button>
    <button
     className="rounded-[5px] border border-error px-2.5 py-1 text-xs font-medium text-error transition hover:cursor-pointer hover:bg-error/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
     onClick={() => onDelete(task)}
     type="button"
    >
     刪除
    </button>
   </div>
  </article>
 );
}

export const TaskCard = memo(TaskCardComponent);
