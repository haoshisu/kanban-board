import { defaultBoardStatuses } from "./boardStorage";
import type { Board, BoardInput } from "./types";

export type BoardRow = {
 id: string;
 name: string;
 description: string | null;
 version: number;
 created_at: string;
 updated_at: string;
};

export const normalizeBoardInput = (input: BoardInput): BoardInput => ({
 name: input.name.trim(),
 description: input.description.trim(),
});

export const mapBoardRow = (row: BoardRow): Board => ({
 id: row.id,
 name: row.name,
 description: row.description ?? "",
 statuses: defaultBoardStatuses,
 version: row.version,
 createdAt: row.created_at,
 updatedAt: row.updated_at,
});
