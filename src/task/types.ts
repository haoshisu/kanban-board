import type { BoardStatusKey } from "../board";

export type Task = {
 id: string;
 boardId: string;
 title: string;
 description: string;
 statusKey: BoardStatusKey;
 position: number;
 createdAt: string;
 updatedAt: string;
};

export type TaskInput = {
 title: string;
 description: string;
 statusKey: BoardStatusKey;
};
