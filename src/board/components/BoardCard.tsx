import type { Board } from "../types";

type BoardCardProps = {
 board: Board;
 isSelected: boolean;
 isReadOnly?: boolean;
 onSelect: (id: string) => void;
 onEdit: (board: Board) => void;
 onDelete: (board: Board) => void;
};

const dateFormatter = new Intl.DateTimeFormat("zh-TW", {
 month: "short",
 day: "numeric",
});

export function BoardCard({
 board,
 isSelected,
 isReadOnly = false,
 onSelect,
 onEdit,
 onDelete,
}: BoardCardProps) {
 return (
  <article
   aria-label={`Board ${board.name}`}
   className={`rounded-lg border bg-card p-4 transition ${
    isSelected ? "border-stamp-todo ring-2 ring-stamp-todo/30" : "border-ink-muted/40"
   }`}
  >
   <button className="block w-full text-left" onClick={() => onSelect(board.id)} type="button">
    <div className="flex items-start justify-between gap-3">
     <div>
      <h3 className="font-display text-base font-semibold text-ink">{board.name}</h3>
      <p className="mt-1 text-xs text-ink-muted">
       更新於 {dateFormatter.format(new Date(board.updatedAt))}
      </p>
     </div>
     <span className="rounded-full bg-ink/5 px-2 py-1 text-xs font-medium text-ink-muted">
      {board.statuses.length} 狀態
     </span>
    </div>
    <p className="mt-3 line-clamp-2 text-sm text-ink-muted">{board.description || "沒有描述"}</p>
   </button>

   <div className="mt-4 flex gap-2">
    <button
     className="rounded-[5px] border border-ink-muted/40 px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-ink/5 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp-todo"
     disabled={isReadOnly}
     onClick={() => onEdit(board)}
     type="button"
    >
     修改
    </button>
    <button
     className="rounded-[5px] border border-error px-3 py-1.5 text-sm font-medium text-error transition hover:bg-error/10 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error"
     disabled={isReadOnly}
     onClick={() => onDelete(board)}
     type="button"
    >
     刪除
    </button>
   </div>
  </article>
 );
}
