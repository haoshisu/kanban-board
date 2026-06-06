import { useDroppable } from "@dnd-kit/react";
import { memo } from "react";
import type { BoardStatus } from "../../board";
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
     ? "border-slate-500 bg-slate-100 ring-2 ring-slate-300"
     : "border-slate-200 bg-slate-50"
   }`}
   ref={ref}
  >
   <div className="flex items-center justify-between gap-3">
    <h3 className="text-sm font-semibold text-slate-900">{status.title}</h3>
    <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-500">
     {tasks.length}
    </span>
   </div>

   <button
    className="mt-4 w-full rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:cursor-pointer hover:border-slate-400 hover:bg-slate-100"
    onClick={() => onCreate(status)}
    type="button"
   >
    新增 task
   </button>

   <div className="mt-4 space-y-3">
    {tasks.length ? (
     tasks.map((task) => <TaskCard key={task.id} task={task} onDelete={onDelete} onEdit={onEdit} />)
    ) : (
     <div className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
      尚無 task
     </div>
    )}
   </div>
  </section>
 );
}

export const TaskStatusColumn = memo(TaskStatusColumnComponent);
