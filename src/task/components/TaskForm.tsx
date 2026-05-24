import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { BoardStatus } from '../../board'
import type { Task, TaskInput } from '../types'

type TaskFormProps = {
  statuses: BoardStatus[]
  task?: Task
  defaultStatusKey?: TaskInput['statusKey']
  submitLabel: string
  onSubmit: (input: TaskInput) => Promise<unknown> | unknown
  onCancel?: () => void
}

export function TaskForm({
  statuses,
  task,
  defaultStatusKey,
  submitLabel,
  onSubmit,
  onCancel,
}: TaskFormProps) {
  const formId = useId()
  const titleId = `${formId}-task-title`
  const descriptionId = `${formId}-task-description`
  const statusId = `${formId}-task-status`
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [statusKey, setStatusKey] = useState(
    task?.statusKey ?? defaultStatusKey ?? statuses[0]?.key ?? 'todo',
  )
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!title.trim()) {
      setError('請輸入 task 標題')
      return
    }

    setIsSubmitting(true)

    try {
      await onSubmit({ title, description, statusKey })
    } finally {
      setIsSubmitting(false)
    }

    setError('')

    if (!task) {
      setTitle('')
      setDescription('')
    }
  }

  return (
    <form
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      onSubmit={handleSubmit}
    >
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor={titleId}>
            Task 標題
          </label>
          <input
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            disabled={isSubmitting}
            id={titleId}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：設計登入流程"
            type="text"
            value={title}
          />
        </div>

        <div>
          <label
            className="text-sm font-medium text-slate-700"
            htmlFor={descriptionId}
          >
            描述
          </label>
          <textarea
            className="mt-2 min-h-20 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            disabled={isSubmitting}
            id={descriptionId}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="補充 task 的內容或驗收重點"
            value={description}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700" htmlFor={statusId}>
            狀態
          </label>
          <select
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            disabled={isSubmitting}
            id={statusId}
            onChange={(event) => setStatusKey(event.target.value as TaskInput['statusKey'])}
            value={statusKey}
          >
            {statuses.map((status) => (
              <option key={status.key} value={status.key}>
                {status.title}
              </option>
            ))}
          </select>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? '處理中...' : submitLabel}
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
  )
}
