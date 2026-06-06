import { afterEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'
import { getNameFromEmail, isValidEmail, mapAuthUser } from './authUtils'

const createUser = (overrides: Partial<User>): User =>
  ({
    id: 'user-1',
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-06-04T00:00:00.000Z',
    ...overrides,
  }) as User

describe('authUtils', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('validates email format', () => {
    expect(isValidEmail('you@example.com')).toBe(true)
    expect(isValidEmail('you@example')).toBe(false)
    expect(isValidEmail('you example.com')).toBe(false)
  })

  it('gets a display name from the email prefix', () => {
    expect(getNameFromEmail('you@example.com')).toBe('you')
  })

  it('falls back to the email value when the prefix is empty', () => {
    expect(getNameFromEmail('@example.com')).toBe('@example.com')
  })

  it('maps a user and prefers metadata name', () => {
    expect(
      mapAuthUser(
        createUser({
          email: 'you@example.com',
          user_metadata: { name: 'You' },
          last_sign_in_at: '2026-06-05T00:00:00.000Z',
        }),
      ),
    ).toEqual({
      id: 'user-1',
      email: 'you@example.com',
      name: 'You',
      loggedInAt: '2026-06-05T00:00:00.000Z',
    })
  })

  it('uses the email prefix when metadata name is missing', () => {
    expect(
      mapAuthUser(
        createUser({
          email: 'you@example.com',
          user_metadata: {},
          last_sign_in_at: '2026-06-05T00:00:00.000Z',
        }),
      ).name,
    ).toBe('you')
  })

  it('uses the current time when last sign in time is missing', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-05T12:00:00.000Z'))

    expect(
      mapAuthUser(
        createUser({
          email: 'you@example.com',
          user_metadata: {},
          last_sign_in_at: undefined,
        }),
      ).loggedInAt,
    ).toBe('2026-06-05T12:00:00.000Z')
  })
})
