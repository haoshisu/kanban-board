import { DragDropProvider } from "@dnd-kit/react";
import type { DragEndEvent } from "@dnd-kit/react";
import { useCallback, useMemo, useState } from "react";
import { BoardCard } from "./components/BoardCard";
import { BoardForm } from "./components/BoardForm";
import { EmptyState } from "./components/EmptyState";
import { useBoards } from "./useBoards";
import { TaskForm, TaskStatusColumn, useTasks } from "../task";
import type { Board } from "./types";
import type { BoardStatus } from "./types";
import type { BoardStatusKey } from "./types";
import type { Task } from "../task";

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
    <div className="min-h-32 rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={item}>
     <div className="h-4 w-2/3 rounded bg-slate-200" />
     <div className="mt-3 h-3 w-1/3 rounded bg-slate-200" />
     <div className="mt-5 h-3 w-full rounded bg-slate-200" />
     <div className="mt-2 h-3 w-4/5 rounded bg-slate-200" />
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
     className="min-h-52 rounded-lg border border-slate-200 bg-slate-50 p-4"
     key={status.key}
    >
     <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-slate-900">{status.title}</h3>
      <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-500">0</span>
     </div>
     <div className="mt-4 h-9 rounded-md border border-dashed border-slate-300 bg-white" />
     <div className="mt-4 space-y-3">
      <div className="h-20 rounded-md border border-slate-200 bg-white p-3">
       <div className="h-3 w-2/3 rounded bg-slate-200" />
       <div className="mt-3 h-3 w-full rounded bg-slate-200" />
       <div className="mt-2 h-3 w-4/5 rounded bg-slate-200" />
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

 const tasksByStatus = useMemo(
  () =>
   tasks.reduce<Record<BoardStatusKey, Task[]>>(
    (groupedTasks, task) => {
     groupedTasks[task.statusKey].push(task);

     return groupedTasks;
    },
    { todo: [], inProgress: [], done: [] },
   ),
  [tasks],
 );

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

   const sourceData = event.operation.source?.data as { taskId?: unknown } | undefined;

   const targetData = event.operation.target?.data as { statusKey?: unknown } | undefined;

   const taskId = sourceData?.taskId;
   const statusKey = targetData?.statusKey;

   if (
    typeof taskId === "string" &&
    (statusKey === "todo" || statusKey === "inProgress" || statusKey === "done")
   ) {
    void moveTaskStatus(taskId, statusKey);
   }
  },
  [moveTaskStatus],
 );

 return (
  <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
   <div className="mx-auto max-w-7xl">
    <header className="mb-6">
     <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
       <h1 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">Board 管理</h1>
      </div>

      {userEmail && onLogout ? (
       <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600">{userEmail}</span>
        <button
         className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
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
        <h2 className="text-lg font-semibold text-slate-950">Boards</h2>
        <span className="text-sm text-slate-500">{boards.length} 個</span>
       </div>

       <div className="space-y-3">
        {boardError ? (
         <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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
         <h2 className="text-lg font-semibold text-slate-950">修改 board</h2>
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
       <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-6">
         <h2 className="text-2xl font-bold tracking-normal text-slate-950">{selectedBoard.name}</h2>
         <p className="mt-2 text-sm leading-6 text-slate-600">
          {selectedBoard.description || "沒有描述"}
         </p>
        </div>

        {creatingTaskStatus ? (
         <div className="mb-6">
          <div className="mb-3 flex items-center justify-between gap-3">
           <h3 className="text-lg font-semibold text-slate-950">新增 task</h3>
           <span className="text-sm text-slate-500">{creatingTaskStatus.title}</span>
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
           <h3 className="text-lg font-semibold text-slate-950">修改 task</h3>
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
         <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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
