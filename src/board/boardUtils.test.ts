import { describe, expect, it } from 'vitest'
import { defaultBoardStatuses } from './boardStorage'
import { mapBoardRow, normalizeBoardInput } from './boardUtils'
import type { BoardRow } from './boardUtils'

const boardRow: BoardRow = {
  id: 'board-1',
  owner_id: 'owner-1',
  name: '產品開發',
  description: 'Roadmap',
  version: 1,
  created_at: '2026-06-04T00:00:00.000Z',
  updated_at: '2026-06-05T00:00:00.000Z',
}

describe('boardUtils', () => {
  it('trims board input fields', () => {
    expect(
      normalizeBoardInput({
        name: '  產品開發  ',
        description: '  Roadmap  ',
      }),
    ).toEqual({
      name: '產品開發',
      description: 'Roadmap',
    })
  })

  it('maps a board row into a board', () => {
    expect(mapBoardRow(boardRow)).toEqual({
      id: boardRow.id,
      ownerId: boardRow.owner_id,
      name: boardRow.name,
      description: boardRow.description,
      statuses: defaultBoardStatuses,
      version: boardRow.version,
      createdAt: boardRow.created_at,
      updatedAt: boardRow.updated_at,
    })
  })

  it('maps a null row description to an empty string', () => {
    expect(mapBoardRow({ ...boardRow, description: null }).description).toBe('')
  })

  it('uses the default board statuses when mapping rows', () => {
    expect(mapBoardRow(boardRow).statuses).toBe(defaultBoardStatuses)
  })
})
