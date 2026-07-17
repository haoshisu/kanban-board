import { DragDropProvider } from "@dnd-kit/react";
import type { DragEndEvent } from "@dnd-kit/react";
import { useCallback, useMemo, useState } from "react";
import { BoardCard } from "./components/BoardCard";
import { BoardForm } from "./components/BoardForm";
import { EmptyState } from "./components/EmptyState";
import { getValidDragMove, groupTasksByStatus } from "./boardPageUtils";
import { statusStyles } from "../shared/statusStyles";
import { useBoards } from "./useBoards";
import { AiTaskBreakdownPanel } from "../ai/components/AiTaskBreakdownPanel";
import { captureAppError } from "../lib/errorReporting";
import { TaskForm, TaskStatusColumn, useTasks } from "../task";
import type { Board } from "./types";
import type { BoardStatus } from "./types";
import type { AiTaskBreakdownResult } from "../ai/components/AiTaskBreakdownPanel";
import type { Task, TaskInput } from "../task";
import { generateTaskBreakdown } from "../ai/components/service/breakdown-task";

type BoardPageProps = {
 userEmail?: string;
 userId?: string;
 onLogout?: () => void;
};

const skeletonItems = [0, 1, 2];

function BoardListSkeleton() {
 return (
  <div aria-label="載入 boards" className="space-y-3">
   {skeletonItems.map((item) => (
    <div className="min-h-32 rounded-lg border border-ink-muted/30 bg-card p-4" key={item}>
     <div className="h-4 w-2/3 rounded bg-ink-muted/20" />
     <div className="mt-3 h-3 w-1/3 rounded bg-ink-muted/20" />
     <div className="mt-5 h-3 w-full rounded bg-ink-muted/20" />
     <div className="mt-2 h-3 w-4/5 rounded bg-ink-muted/20" />
    </div>
   ))}
  </div>
 );
}

function TaskColumnsSkeleton({ statuses }: { statuses: BoardStatus[] }) {
 return (
  <div aria-label="載入 tasks" className="grid gap-4 md:grid-cols-3">
   {statuses.map((status) => (
    <section
     className="min-h-52 rounded-lg border border-ink-muted/30 bg-card/50 p-4"
     key={status.key}
    >
     <div
      className={`-mx-4 -mt-4 flex items-center justify-between gap-3 rounded-t-lg px-4 py-2 ${statusStyles[status.key].headerTint}`}
     >
      <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-ink">
       {status.title}
      </h3>
      <span className="rounded-full bg-card px-2 py-1 text-xs font-medium text-ink-muted">0</span>
     </div>
     <div className="mt-4 h-9 rounded-[5px] border border-dashed border-ink-muted/40 bg-card/60" />
     <div className="mt-4 space-y-3">
      <div className="h-20 rounded-md border border-ink-muted/30 bg-card p-3">
       <div className="h-3 w-2/3 rounded bg-ink-muted/20" />
       <div className="mt-3 h-3 w-full rounded bg-ink-muted/20" />
       <div className="mt-2 h-3 w-4/5 rounded bg-ink-muted/20" />
      </div>
     </div>
    </section>
   ))}
  </div>
 );
}

export default function BoardPage({ userEmail, userId, onLogout }: BoardPageProps) {
 const {
  boards,
  selectedBoard,
  isLoadingBoards,
  boardError,
  selectBoard,
  createBoard,
  updateBoard,
  deleteBoard,
 } = useBoards(userId);
 const {
  tasks,
  isLoadingTasks,
  taskError,
  createTask,
  updateTask,
  deleteTask,
  moveTaskStatus,
  deleteTasksByBoard,
 } = useTasks(selectedBoard?.id ?? null);
 const [editingBoard, setEditingBoard] = useState<Board | null>(null);
 const [creatingTaskStatus, setCreatingTaskStatus] = useState<BoardStatus | null>(null);
 const [editingTask, setEditingTask] = useState<Task | null>(null);

 const tasksByStatus = useMemo(() => groupTasksByStatus(tasks), [tasks]);

 const handleDeleteBoard = useCallback(
  async (board: Board) => {
   const confirmed = window.confirm(`確定要刪除「${board.name}」嗎？`);

   if (confirmed) {
    await deleteTasksByBoard(board.id);
    await deleteBoard(board.id);

    if (editingBoard?.id === board.id) {
     setEditingBoard(null);
    }
   }
  },
  [deleteBoard, deleteTasksByBoard, editingBoard?.id],
 );

 const handleSelectBoard = useCallback(
  (id: string) => {
   selectBoard(id);
   setEditingBoard(null);
   setCreatingTaskStatus(null);
   setEditingTask(null);
  },
  [selectBoard],
 );

 const handleCreateTask = useCallback((status: BoardStatus) => {
  setEditingTask(null);
  setCreatingTaskStatus(status);
 }, []);

 const handleGenerateAiTasks = useCallback(
  async (prompt: string): Promise<AiTaskBreakdownResult> => {
   return generateTaskBreakdown(prompt);
  },
  [],
 );

 const handleCreateAiTasks = useCallback(
  async (inputs: TaskInput[]) => {
   setCreatingTaskStatus(null);
   setEditingTask(null);

   for (const input of inputs) {
    await createTask(input);
   }
  },
  [createTask],
 );

 const handleEditTask = useCallback((task: Task) => {
  setCreatingTaskStatus(null);
  setEditingTask(task);
 }, []);

 const handleDeleteTask = useCallback(
  async (task: Task) => {
   const confirmed = window.confirm(`確定要刪除「${task.title}」嗎？`);

   if (confirmed) {
    await deleteTask(task.id);

    if (editingTask?.id === task.id) {
     setEditingTask(null);
    }
   }
  },
  [deleteTask, editingTask?.id],
 );

 const handleDragEnd = useCallback(
  (event: DragEndEvent) => {
   if (event.canceled) {
    return;
   }

   const dragMove = getValidDragMove(event);

   if (dragMove) {
    const { taskId, statusKey } = dragMove;

    void moveTaskStatus(taskId, statusKey).catch((error: unknown) => {
     captureAppError(error, {
      area: "dragAndDrop",
      action: "moveTaskStatus",
      taskId,
      statusKey,
     });
    });
   }
  },
  [moveTaskStatus],
 );

 return (
  <main className="min-h-screen bg-paper px-4 py-6 text-ink sm:px-6 lg:px-8">
   <div className="mx-auto max-w-7xl">
    <header className="mb-6">
     <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
       <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide text-ink">
        Board 管理
       </h1>
      </div>

      {userEmail && onLogout ? (
       <div className="flex items-center gap-3">
        <span className="text-sm text-ink-muted">{userEmail}</span>
        <button
         className="rounded-[5px] border border-ink-muted/40 bg-card px-3 py-2 font-display text-sm font-semibold uppercase tracking-wide text-ink transition hover:cursor-pointer hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp-todo"
         onClick={onLogout}
         type="button"
        >
         登出
        </button>
       </div>
      ) : null}
     </div>
    </header>

    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
     <aside className="space-y-6">
      <BoardForm submitLabel="建立 board" onSubmit={createBoard} />

      <section>
       <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-ink">
         Boards
        </h2>
        <span className="text-sm text-ink-muted">{boards.length} 個</span>
       </div>

       <div className="space-y-3">
        {boardError ? (
         <div className="rounded-lg border border-error bg-error/10 p-4 text-sm text-error">
          {boardError}
         </div>
        ) : null}

        {isLoadingBoards ? (
         <BoardListSkeleton />
        ) : boards.length ? (
         boards.map((board) => (
          <BoardCard
           board={board}
           isSelected={selectedBoard?.id === board.id}
           key={board.id}
           onDelete={handleDeleteBoard}
           onEdit={setEditingBoard}
           onSelect={handleSelectBoard}
          />
         ))
        ) : (
         <EmptyState
          description="建立第一個 board 後，就可以開始整理工作狀態。"
          title="尚未建立 board"
         />
        )}
       </div>
      </section>
     </aside>

     <section className="space-y-6">
      {editingBoard ? (
       <div>
        <div className="mb-3 flex items-center justify-between gap-3">
         <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-ink">
          修改 board
         </h2>
        </div>
        <BoardForm
         board={editingBoard}
         submitLabel="儲存修改"
         onCancel={() => setEditingBoard(null)}
         onSubmit={async (input) => {
          const updatedBoard = await updateBoard(editingBoard.id, input);

          if (updatedBoard) {
           setEditingBoard(null);
          }
         }}
        />
       </div>
      ) : null}

      {selectedBoard ? (
       <div className="rounded-lg border border-ink-muted/40 bg-card p-4 sm:p-6">
        <div className="mb-6">
         <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-ink">
          {selectedBoard.name}
         </h2>
         <p className="mt-2 text-sm leading-6 text-ink-muted">
          {selectedBoard.description || "沒有描述"}
         </p>
        </div>

        <div className="mb-6">
         <AiTaskBreakdownPanel
          defaultStatusKey="todo"
          statuses={selectedBoard.statuses}
          onCreateTasks={handleCreateAiTasks}
          onGenerateTasks={handleGenerateAiTasks}
         />
        </div>

        {creatingTaskStatus ? (
         <div className="mb-6">
          <div className="mb-3 flex items-center justify-between gap-3">
           <h3 className="font-display text-lg font-semibold uppercase tracking-wide text-ink hover:cursor-pointer">
            新增 task
           </h3>
           <span className="text-sm text-ink-muted">{creatingTaskStatus.title}</span>
          </div>
          <TaskForm
           defaultStatusKey={creatingTaskStatus.key}
           statuses={selectedBoard.statuses}
           submitLabel="建立 task"
           onCancel={() => setCreatingTaskStatus(null)}
           onSubmit={async (input) => {
            const task = await createTask(input);

            if (task) {
             setCreatingTaskStatus(null);
            }
           }}
          />
         </div>
        ) : null}

        {editingTask ? (
         <div className="mb-6">
          <div className="mb-3 flex items-center justify-between gap-3">
           <h3 className="font-display text-lg font-semibold uppercase tracking-wide text-ink">
            修改 task
           </h3>
          </div>
          <TaskForm
           statuses={selectedBoard.statuses}
           submitLabel="儲存修改"
           task={editingTask}
           onCancel={() => setEditingTask(null)}
           onSubmit={async (input) => {
            const task = await updateTask(editingTask.id, input);

            if (task) {
             setEditingTask(null);
            }
           }}
          />
         </div>
        ) : null}

        {taskError ? (
         <div className="mb-4 rounded-lg border border-error bg-error/10 p-4 text-sm text-error">
          {taskError}
         </div>
        ) : null}

        {isLoadingTasks ? (
         <TaskColumnsSkeleton statuses={selectedBoard.statuses} />
        ) : (
         <DragDropProvider onDragEnd={handleDragEnd}>
          <div className="grid gap-4 md:grid-cols-3">
           {selectedBoard.statuses.map((status) => (
            <TaskStatusColumn
             key={status.key}
             status={status}
             tasks={tasksByStatus[status.key]}
             onCreate={handleCreateTask}
             onDelete={handleDeleteTask}
             onEdit={handleEditTask}
            />
           ))}
          </div>
         </DragDropProvider>
        )}
       </div>
      ) : (
       <EmptyState
        description="建立或選取 board 後，這裡會顯示三個固定任務狀態欄。"
        title="尚未選取 board"
       />
      )}
     </section>
    </div>
   </div>
  </main>
 );
}
