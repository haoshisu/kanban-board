import type { Board } from '../types'

type BoardCardProps = {
  board: Board
  isSelected: boolean
  onSelect: (id: string) => void
  onEdit: (board: Board) => void
  onDelete: (board: Board) => void
}

const dateFormatter = new Intl.DateTimeFormat('zh-TW', {
  month: 'short',
  day: 'numeric',
})

export function BoardCard({
  board,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: BoardCardProps) {
  return (
    <article
      aria-label={`Board ${board.name}`}
      className={`rounded-lg border bg-white p-4 shadow-sm transition ${
        isSelected ? 'border-slate-900 ring-2 ring-slate-200' : 'border-slate-200'
      }`}
    >
      <button
        className="block w-full text-left"
        onClick={() => onSelect(board.id)}
        type="button"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-950">{board.name}</h3>
            <p className="mt-1 text-xs text-slate-500">
              更新於 {dateFormatter.format(new Date(board.updatedAt))}
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            {board.statuses.length} 狀態
          </span>
        </div>
        <p className="mt-3 line-clamp-2 text-sm text-slate-600">
          {board.description || '沒有描述'}
        </p>
      </button>

      <div className="mt-4 flex gap-2">
        <button
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          onClick={() => onEdit(board)}
          type="button"
        >
          修改
        </button>
        <button
          className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
          onClick={() => onDelete(board)}
          type="button"
        >
          刪除
        </button>
      </div>
    </article>
  )
}
