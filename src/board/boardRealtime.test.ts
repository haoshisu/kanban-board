import type {
  RealtimePostgresDeletePayload,
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
} from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { defaultBoardStatuses } from './boardStorage'
import { applyBoardRealtimePayload, upsertBoardByVersion } from './boardRealtime'
import type { BoardRow } from './boardUtils'
import type { Board } from './types'

const createBoard = (overrides: Partial<Board> = {}): Board => ({
  id: 'board-1',
  name: 'Board',
  description: '',
  statuses: defaultBoardStatuses,
  version: 1,
  createdAt: '2026-06-04T00:00:00.000Z',
  updatedAt: '2026-06-04T00:00:00.000Z',
  ...overrides,
})

const createBoardRow = (overrides: Partial<BoardRow> = {}): BoardRow => ({
  id: 'board-1',
  owner_id: 'owner-1',
  name: 'Board',
  description: '',
  version: 1,
  created_at: '2026-06-04T00:00:00.000Z',
  updated_at: '2026-06-04T00:00:00.000Z',
  ...overrides,
})

const payloadBase = {
  schema: 'public',
  table: 'boards',
  commit_timestamp: '2026-06-05T00:00:00.000Z',
  errors: [],
}

describe('upsertBoardByVersion', () => {
  it('inserts an unknown board first', () => {
    const incomingBoard = createBoard({ id: 'board-2' })

    expect(upsertBoardByVersion([createBoard()], incomingBoard)).toEqual([
      incomingBoard,
      createBoard(),
    ])
  })

  it('replaces a board with a newer version', () => {
    const incomingBoard = createBoard({ name: 'Remote board', version: 2 })

    expect(upsertBoardByVersion([createBoard()], incomingBoard)).toEqual([
      incomingBoard,
    ])
  })

  it('ignores the same or an older version', () => {
    const currentBoards = [createBoard({ version: 2 })]

    expect(upsertBoardByVersion(currentBoards, createBoard({ version: 2 }))).toBe(
      currentBoards,
    )
    expect(upsertBoardByVersion(currentBoards, createBoard({ version: 1 }))).toBe(
      currentBoards,
    )
  })
})

describe('applyBoardRealtimePayload', () => {
  it('maps and applies an updated board from the current owner', () => {
    const payload: RealtimePostgresUpdatePayload<BoardRow> = {
      ...payloadBase,
      eventType: 'UPDATE',
      new: createBoardRow({ name: 'Remote board', version: 2 }),
      old: { id: 'board-1', version: 1 },
    }

    expect(applyBoardRealtimePayload([createBoard()], 'owner-1', payload)).toEqual([
      createBoard({ name: 'Remote board', version: 2 }),
    ])
  })

  it('ignores inserted boards from another owner', () => {
    const currentBoards = [createBoard()]
    const payload: RealtimePostgresInsertPayload<BoardRow> = {
      ...payloadBase,
      eventType: 'INSERT',
      new: createBoardRow({ id: 'board-2', owner_id: 'owner-2' }),
      old: {},
    }

    expect(applyBoardRealtimePayload(currentBoards, 'owner-1', payload)).toBe(
      currentBoards,
    )
  })

  it('removes a deleted board by id', () => {
    const remainingBoard = createBoard({ id: 'board-2' })
    const payload: RealtimePostgresDeletePayload<BoardRow> = {
      ...payloadBase,
      eventType: 'DELETE',
      new: {},
      old: { id: 'board-1' },
    }

    expect(
      applyBoardRealtimePayload(
        [createBoard(), remainingBoard],
        'owner-1',
        payload,
      ),
    ).toEqual([remainingBoard])
  })
})
