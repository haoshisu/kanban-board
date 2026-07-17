import type { BoardStatusKey } from "../board";

export const statusStyles: Record<
 BoardStatusKey,
 { bar: string; border: string; headerTint: string }
> = {
 todo: {
  bar: "bg-stamp-todo",
  border: "border-stamp-todo",
  headerTint: "bg-stamp-todo/10",
 },
 inProgress: {
  bar: "bg-stamp-doing",
  border: "border-stamp-doing",
  headerTint: "bg-stamp-doing/10",
 },
 done: {
  bar: "bg-stamp-done",
  border: "border-stamp-done",
  headerTint: "bg-stamp-done/10",
 },
};

export const statusLabels: Record<BoardStatusKey, string> = {
 todo: "待辦",
 inProgress: "進行中",
 done: "已完成",
};
