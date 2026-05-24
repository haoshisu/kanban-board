import type { BoardStatus } from '../types'

type StatusColumnProps = {
  status: BoardStatus
}

export function StatusColumn({ status }: StatusColumnProps) {
  return (
    <section className="min-h-40 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{status.title}</h3>
        <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-500">
          0
        </span>
      </div>

      <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
        尚無 task
      </div>
    </section>
  )
}
