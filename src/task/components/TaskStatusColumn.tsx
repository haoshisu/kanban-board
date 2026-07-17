import { useDroppable } from "@dnd-kit/react";
import { memo } from "react";
import type { BoardStatus } from "../../board";
import { statusStyles } from "../../shared/statusStyles";
import { TaskCard } from "./TaskCard";
import type { Task } from "../types";

type TaskStatusColumnProps = {
 status: BoardStatus;
 tasks: Task[];
 onCreate: (status: BoardStatus) => void;
 onEdit: (task: Task) => void;
 onDelete: (task: Task) => void;
};

function TaskStatusColumnComponent({
 status,
 tasks,
 onCreate,
 onEdit,
 onDelete,
}: TaskStatusColumnProps) {
 const { isDropTarget, ref } = useDroppable({
  id: `status-${status.key}`,
  accept: "task",
  data: {
   statusKey: status.key,
  },
 });

 return (
  <section
   aria-label={`${status.title} 欄位`}
   className={`min-h-52 rounded-lg border p-4 transition ${
    isDropTarget
     ? "border-stamp-todo bg-card ring-2 ring-stamp-todo/30"
     : "border-ink-muted/30 bg-card/50"
   }`}
   ref={ref}
  >
   <div
    className={`-mx-4 -mt-4 flex items-center justify-between gap-3 rounded-t-lg px-4 py-2 ${statusStyles[status.key].headerTint}`}
   >
    <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-ink">
     {status.title}
    </h3>
    <span className="rounded-full bg-card px-2 py-1 text-xs font-medium text-ink-muted">
     {tasks.length}
    </span>
   </div>

   <button
    className="mt-4 w-full rounded-[5px] border border-dashed border-ink-muted/40 bg-card/60 px-3 py-2 font-display text-xs font-medium uppercase tracking-wide text-ink-muted transition hover:cursor-pointer hover:border-ink-muted/70 hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp-todo"
    onClick={() => onCreate(status)}
    type="button"
   >
    新增 task
   </button>

   <div className="mt-4 space-y-3">
    {tasks.length ? (
     tasks.map((task) => <TaskCard key={task.id} task={task} onDelete={onDelete} onEdit={onEdit} />)
    ) : (
     <div className="rounded-md border border-dashed border-ink-muted/40 bg-card/40 p-4 text-center text-sm text-ink-muted">
      尚無 task
     </div>
    )}
   </div>
  </section>
 );
}

export const TaskStatusColumn = memo(TaskStatusColumnComponent);
