import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isLocalDataMode } from './localDataMode'

const storageKey = 'kanban-board:e2e'

describe('isLocalDataMode', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true only when the local data mode key is true', () => {
    expect(isLocalDataMode()).toBe(false)

    localStorage.setItem(storageKey, 'false')
    expect(isLocalDataMode()).toBe(false)

    localStorage.setItem(storageKey, 'true')
    expect(isLocalDataMode()).toBe(true)
  })

  it('returns false when localStorage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage blocked')
    })

    expect(isLocalDataMode()).toBe(false)
  })
})
