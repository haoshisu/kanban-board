import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from './types'

const captureAppError = vi.hoisted(() => vi.fn())

vi.mock('../lib/errorReporting', () => ({
  captureAppError,
}))

import { clearAuthUser, loadAuthUser, saveAuthUser } from './authStorage'

const storageKey = 'kanban-board:auth-user'

const authUser: AuthUser = {
  id: 'user-1',
  email: 'you@example.com',
  name: 'You',
  loggedInAt: '2026-06-04T00:00:00.000Z',
}

describe('authStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    captureAppError.mockClear()
  })

  it('returns null when no auth user is stored', () => {
    expect(loadAuthUser()).toBeNull()
  })

  it('saves and loads an auth user', () => {
    saveAuthUser(authUser)

    expect(loadAuthUser()).toEqual(authUser)
  })

  it('returns null for invalid auth user data', () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ id: 'user-1', email: 'you@example.com' }),
    )

    expect(loadAuthUser()).toBeNull()
  })

  it('reports parse errors and returns null', () => {
    localStorage.setItem(storageKey, '{bad-json')

    expect(loadAuthUser()).toBeNull()
    expect(captureAppError).toHaveBeenCalledWith(expect.any(SyntaxError), {
      area: 'storage',
      action: 'loadAuthUser',
    })
  })

  it('clears a stored auth user', () => {
    saveAuthUser(authUser)
    clearAuthUser()

    expect(localStorage.getItem(storageKey)).toBeNull()
  })
})
