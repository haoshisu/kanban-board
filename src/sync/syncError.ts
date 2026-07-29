import type { Board } from "../board"
import type { Task } from "../task"

type SyncEntity = Board | Task

export type SyncConflictDetails = {
 entityId: string
 baseVersion: number
 remoteVersion?: number
 localPayload: SyncEntity | null
 remotePayload: SyncEntity | null
}

export class SyncConflictError extends Error {
 readonly kind = "conflict" as const
 readonly details: SyncConflictDetails

 constructor(message: string, details: SyncConflictDetails) {
  super(message)

  this.name = "SyncConflictError"
  this.details = details
 }
}

export class SyncPermanentError extends Error {
 readonly kind = "permanent" as const

 constructor(message: string) {
  super(message)
  this.name = "SyncPermanentError"
 }
}

const getErrorMessage = (error: unknown) => {
 if (error instanceof Error) return error.message
 if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
  return error.message
 }
 return "同步失敗"
}

export const classifySyncError = (error: unknown) => {
 if (error instanceof SyncConflictError) {
  return {
   kind: "conflict" as const,
   message: error.message,
   conflict: error.details,
  }
 }

 if (error instanceof SyncPermanentError) {
  return {
   kind: "permanent" as const,
   message: error.message,
  }
 }

 const code =
  typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
   ? error.code
   : undefined

 if (code && ["22P02", "23503", "23514", "42501"].includes(code)) {
  return {
   kind: "permanent" as const,
   message: getErrorMessage(error),
  }
 }

 return {
  kind: "transient" as const,
  message: getErrorMessage(error),
 }
}
