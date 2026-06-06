import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { BoardStatus } from '../../board'
import type { Task } from '../types'
import { TaskForm } from './TaskForm'

const statuses: BoardStatus[] = [
  { key: 'todo', title: '尚未開始' },
  { key: 'inProgress', title: '進行中' },
  { key: 'done', title: '已完成' },
]

const task: Task = {
  id: 'task-1',
  boardId: 'board-1',
  title: '設計登入流程',
  description: 'Login UX',
  statusKey: 'inProgress',
  position: 1,
  createdAt: '2026-06-04T00:00:00.000Z',
  updatedAt: '2026-06-04T00:00:00.000Z',
}

describe('TaskForm', () => {
  it('shows an error when the task title is empty', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <TaskForm
        statuses={statuses}
        submitLabel="建立 task"
        onSubmit={onSubmit}
      />,
    )

    await user.click(screen.getByRole('button', { name: '建立 task' }))

    expect(screen.getByText('請輸入 task 標題')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits task input and clears text fields in create mode', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <TaskForm
        defaultStatusKey="done"
        statuses={statuses}
        submitLabel="建立 task"
        onSubmit={onSubmit}
      />,
    )

    await user.type(screen.getByLabelText('Task 標題'), '  新 Task  ')
    await user.type(screen.getByLabelText('描述'), '  新描述  ')
    await user.click(screen.getByRole('button', { name: '建立 task' }))

    expect(onSubmit).toHaveBeenCalledWith({
      title: '  新 Task  ',
      description: '  新描述  ',
      statusKey: 'done',
    })
    expect(screen.getByLabelText('Task 標題')).toHaveValue('')
    expect(screen.getByLabelText('描述')).toHaveValue('')
    expect(screen.getByLabelText('狀態')).toHaveValue('done')
  })

  it('uses task values in edit mode and keeps them after submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <TaskForm
        statuses={statuses}
        submitLabel="儲存修改"
        task={task}
        onSubmit={onSubmit}
      />,
    )

    await user.click(screen.getByRole('button', { name: '儲存修改' }))

    expect(onSubmit).toHaveBeenCalledWith({
      title: task.title,
      description: task.description,
      statusKey: task.statusKey,
    })
    expect(screen.getByLabelText('Task 標題')).toHaveValue(task.title)
    expect(screen.getByLabelText('描述')).toHaveValue(task.description)
    expect(screen.getByLabelText('狀態')).toHaveValue(task.statusKey)
  })

  it('calls onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(
      <TaskForm
        statuses={statuses}
        submitLabel="儲存修改"
        task={task}
        onCancel={onCancel}
        onSubmit={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: '取消' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
