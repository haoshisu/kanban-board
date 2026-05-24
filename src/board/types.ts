export type BoardStatusKey = 'todo' | 'inProgress' | 'done'

export type BoardStatus = {
  key: BoardStatusKey
  title: string
}

export type Board = {
  id: string
  name: string
  description: string
  statuses: BoardStatus[]
  createdAt: string
  updatedAt: string
}

export type BoardInput = {
  name: string
  description: string
}
