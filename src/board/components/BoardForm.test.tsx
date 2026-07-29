import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Board } from '../types'
import { BoardForm } from './BoardForm'

const board: Board = {
  id: 'board-1',
  name: '產品開發',
  description: 'Roadmap',
  statuses: [
    { key: 'todo', title: '尚未開始' },
    { key: 'inProgress', title: '進行中' },
    { key: 'done', title: '已完成' },
  ],
  version: 1,
  createdAt: '2026-06-04T00:00:00.000Z',
  updatedAt: '2026-06-04T00:00:00.000Z',
}

describe('BoardForm', () => {
  it('shows an error when the board name is empty', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<BoardForm submitLabel="建立 board" onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: '建立 board' }))

    expect(screen.getByText('請輸入 board 名稱')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits board input and clears fields in create mode', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<BoardForm submitLabel="建立 board" onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Board 名稱'), '  新 Board  ')
    await user.type(screen.getByLabelText('描述'), '  新描述  ')
    await user.click(screen.getByRole('button', { name: '建立 board' }))

    expect(onSubmit).toHaveBeenCalledWith({
      name: '  新 Board  ',
      description: '  新描述  ',
    })
    expect(screen.getByLabelText('Board 名稱')).toHaveValue('')
    expect(screen.getByLabelText('描述')).toHaveValue('')
  })

  it('keeps existing field values in edit mode after submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <BoardForm board={board} submitLabel="儲存修改" onSubmit={onSubmit} />,
    )

    await user.click(screen.getByRole('button', { name: '儲存修改' }))

    expect(onSubmit).toHaveBeenCalledWith({
      name: board.name,
      description: board.description,
    })
    expect(screen.getByLabelText('Board 名稱')).toHaveValue(board.name)
    expect(screen.getByLabelText('描述')).toHaveValue(board.description)
  })

  it('calls onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()

    render(
      <BoardForm
        board={board}
        submitLabel="儲存修改"
        onCancel={onCancel}
        onSubmit={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: '取消' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
