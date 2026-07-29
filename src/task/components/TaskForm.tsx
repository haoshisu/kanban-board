import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import type { BoardStatus } from '../../board'
import {
  formCardClassName,
  formErrorClassName,
  formFieldLabelClassName,
  formInputClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from '../../shared/formStyles'
import type { Task, TaskInput } from '../types'

type TaskFormProps = {
  statuses: BoardStatus[]
  task?: Task
  disabled?: boolean
  defaultStatusKey?: TaskInput['statusKey']
  submitLabel: string
  onSubmit: (input: TaskInput) => Promise<unknown> | unknown
  onCancel?: () => void
}

export function TaskForm({
  statuses,
  task,
  disabled = false,
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

    if (disabled) return

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
    <form className={formCardClassName} onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div>
          <label className={formFieldLabelClassName} htmlFor={titleId}>
            Task 標題
          </label>
          <input
            className={formInputClassName}
            disabled={disabled || isSubmitting}
            id={titleId}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：設計登入流程"
            type="text"
            value={title}
          />
        </div>

        <div>
          <label className={formFieldLabelClassName} htmlFor={descriptionId}>
            描述
          </label>
          <textarea
            className={`min-h-20 resize-none ${formInputClassName}`}
            disabled={disabled || isSubmitting}
            id={descriptionId}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="補充 task 的內容或驗收重點"
            value={description}
          />
        </div>

        <div>
          <label className={formFieldLabelClassName} htmlFor={statusId}>
            狀態
          </label>
          <select
            className={formInputClassName}
            disabled={disabled || isSubmitting}
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

        {error ? <p className={formErrorClassName}>{error}</p> : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button className={primaryButtonClassName} disabled={disabled || isSubmitting} type="submit">
            {isSubmitting ? '處理中...' : submitLabel}
          </button>
          {onCancel ? (
            <button
              className={secondaryButtonClassName}
              disabled={disabled || isSubmitting}
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
