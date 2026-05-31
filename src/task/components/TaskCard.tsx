import { useDraggable } from '@dnd-kit/react'
import { memo } from 'react'
import type { Task } from '../types'

type TaskCardProps = {
  task: Task
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

const dateFormatter = new Intl.DateTimeFormat('zh-TW', {
  month: 'short',
  day: 'numeric',
})

function TaskCardComponent({ task, onEdit, onDelete }: TaskCardProps) {
  const { isDragging, ref } = useDraggable({
    id: task.id,
    type: 'task',
    data: {
      taskId: task.id,
      statusKey: task.statusKey,
    },
  })

  return (
    <article
      aria-label={`Task ${task.title}`}
      className={`cursor-grab rounded-md border border-slate-200 bg-white p-3 shadow-sm transition active:cursor-grabbing ${
        isDragging ? 'opacity-50 ring-2 ring-slate-300' : ''
      }`}
      ref={ref}
    >
      <div>
        <h4 className="text-sm font-semibold leading-6 text-slate-950">
          {task.title}
        </h4>
        {task.description ? (
          <p className="mt-1 text-sm leading-6 text-slate-600">{task.description}</p>
        ) : null}
        <p className="mt-3 text-xs text-slate-500">
          更新於 {dateFormatter.format(new Date(task.updatedAt))}
        </p>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
          onClick={() => onEdit(task)}
          type="button"
        >
          修改
        </button>
        <button
          className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
          onClick={() => onDelete(task)}
          type="button"
        >
          刪除
        </button>
      </div>
    </article>
  )
}

export const TaskCard = memo(TaskCardComponent)
