import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'
import type { AuthUser, LoginResult } from './types'
import { useAuth } from './useAuth'

const {
  captureAppErrorMock,
  clearAuthUserMock,
  getSupabaseMock,
  isLocalDataModeMock,
  loadAuthUserMock,
  saveAuthUserMock,
  setErrorReportingUserMock,
} = vi.hoisted(() => ({
  captureAppErrorMock: vi.fn(),
  clearAuthUserMock: vi.fn(),
  getSupabaseMock: vi.fn(),
  isLocalDataModeMock: vi.fn(),
  loadAuthUserMock: vi.fn(),
  saveAuthUserMock: vi.fn(),
  setErrorReportingUserMock: vi.fn(),
}))

vi.mock('../lib/errorReporting', () => ({
  captureAppError: captureAppErrorMock,
  setErrorReportingUser: setErrorReportingUserMock,
}))

vi.mock('../lib/localDataMode', () => ({
  isLocalDataMode: isLocalDataModeMock,
}))

vi.mock('../lib/supabase', () => ({
  getSupabase: getSupabaseMock,
}))

vi.mock('./authStorage', () => ({
  clearAuthUser: clearAuthUserMock,
  loadAuthUser: loadAuthUserMock,
  saveAuthUser: saveAuthUserMock,
}))

const fixedNow = '2026-06-05T12:00:00.000Z'

const authUser: AuthUser = {
  id: 'local-you@example.com',
  email: 'you@example.com',
  name: 'you',
  loggedInAt: '2026-06-04T00:00:00.000Z',
}

const createSupabaseUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    email: 'you@example.com',
    created_at: '2026-06-04T00:00:00.000Z',
    last_sign_in_at: '2026-06-05T00:00:00.000Z',
    ...overrides,
  }) as User

const flushLocalEffect = async () => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

type AuthStateCallback = (
  event: string,
  session: { user: User } | null,
) => void

const createAuthSupabaseMock = ({
  sessionUser = null,
  getSessionError = null,
  signInUser = null,
  signInError = null,
  signInThrows = null,
  signOutError = null,
  signOutThrows = null,
  profileError = null,
}: {
  sessionUser?: User | null
  getSessionError?: Error | null
  signInUser?: User | null
  signInError?: { message?: string } | null
  signInThrows?: Error | null
  signOutError?: { message?: string } | null
  signOutThrows?: Error | null
  profileError?: { message?: string } | null
} = {}) => {
  let authStateCallback: AuthStateCallback | null = null

  const getSessionMock = getSessionError
    ? vi.fn().mockRejectedValue(getSessionError)
    : vi.fn().mockResolvedValue({
        data: { session: sessionUser ? { user: sessionUser } : null },
      })

  const signInWithPasswordMock = signInThrows
    ? vi.fn().mockRejectedValue(signInThrows)
    : vi.fn().mockResolvedValue({
        data: { user: signInUser },
        error: signInError,
      })

  const signOutMock = signOutThrows
    ? vi.fn().mockRejectedValue(signOutThrows)
    : vi.fn().mockResolvedValue({ error: signOutError })

  const unsubscribeMock = vi.fn()
  const onAuthStateChangeMock = vi.fn((callback: AuthStateCallback) => {
    authStateCallback = callback

    return {
      data: {
        subscription: {
          unsubscribe: unsubscribeMock,
        },
      },
    }
  })

  const upsertMock = vi.fn().mockResolvedValue({ error: profileError })
  const fromMock = vi.fn(() => ({ upsert: upsertMock }))

  const supabase = {
    auth: {
      getSession: getSessionMock,
      onAuthStateChange: onAuthStateChangeMock,
      signInWithPassword: signInWithPasswordMock,
      signOut: signOutMock,
    },
    from: fromMock,
  }

  getSupabaseMock.mockResolvedValue(supabase)

  return {
    emitAuthStateChange: (session: { user: User } | null) => {
      authStateCallback?.('SIGNED_IN', session)
    },
    fromMock,
    getSessionMock,
    onAuthStateChangeMock,
    signInWithPasswordMock,
    signOutMock,
    unsubscribeMock,
    upsertMock,
  }
}

describe('useAuth local mode', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(fixedNow))

    isLocalDataModeMock.mockReturnValue(true)
    loadAuthUserMock.mockReturnValue(null)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('loads the stored local user and sets the error reporting user', async () => {
    loadAuthUserMock.mockReturnValue(authUser)

    const { result } = renderHook(() => useAuth())

    await flushLocalEffect()

    expect(result.current.isLoading).toBe(false)
    expect(result.current.currentUser).toEqual(authUser)
    expect(setErrorReportingUserMock).toHaveBeenCalledWith(authUser)
    expect(getSupabaseMock).not.toHaveBeenCalled()
  })

  it('rejects invalid email without saving a user', async () => {
    const { result } = renderHook(() => useAuth())

    await flushLocalEffect()
    expect(result.current.isLoading).toBe(false)

    let loginResult: LoginResult | null = null

    await act(async () => {
      loginResult = await result.current.login({
        email: 'invalid-email',
        password: 'password',
      })
    })

    expect(loginResult).toEqual({
      success: false,
      message: '請輸入有效的 email',
    })
    expect(saveAuthUserMock).not.toHaveBeenCalled()
    expect(result.current.currentUser).toBeNull()
  })

  it('rejects empty password without saving a user', async () => {
    const { result } = renderHook(() => useAuth())

    await flushLocalEffect()
    expect(result.current.isLoading).toBe(false)

    let loginResult: LoginResult | null = null

    await act(async () => {
      loginResult = await result.current.login({
        email: 'you@example.com',
        password: '   ',
      })
    })

    expect(loginResult).toEqual({
      success: false,
      message: '請輸入密碼',
    })
    expect(saveAuthUserMock).not.toHaveBeenCalled()
    expect(result.current.currentUser).toBeNull()
  })

  it('logs in with normalized email and stores the local user', async () => {
    const { result } = renderHook(() => useAuth())

    await flushLocalEffect()
    expect(result.current.isLoading).toBe(false)

    let loginResult: LoginResult | null = null

    await act(async () => {
      loginResult = await result.current.login({
        email: '  YOU@EXAMPLE.COM  ',
        password: '  password  ',
      })
    })

    const expectedUser = {
      id: 'local-you@example.com',
      email: 'you@example.com',
      name: 'you',
      loggedInAt: fixedNow,
    }

    expect(loginResult).toEqual({ success: true, message: '' })
    expect(saveAuthUserMock).toHaveBeenCalledWith(expectedUser)
    expect(setErrorReportingUserMock).toHaveBeenLastCalledWith(expectedUser)
    expect(result.current.currentUser).toEqual(expectedUser)
    expect(getSupabaseMock).not.toHaveBeenCalled()
  })

  it('logs out by clearing local auth state and error reporting user', async () => {
    loadAuthUserMock.mockReturnValue(authUser)

    const { result } = renderHook(() => useAuth())

    await flushLocalEffect()
    expect(result.current.currentUser).toEqual(authUser)

    await act(async () => {
      await result.current.logout()
    })

    expect(clearAuthUserMock).toHaveBeenCalled()
    expect(result.current.currentUser).toBeNull()
    expect(setErrorReportingUserMock).toHaveBeenLastCalledWith(null)
    expect(getSupabaseMock).not.toHaveBeenCalled()
  })
})

describe('useAuth Supabase mode', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(fixedNow))

    isLocalDataModeMock.mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('loads a Supabase session user and ensures the profile', async () => {
    const user = createSupabaseUser({
      user_metadata: { name: 'You' },
    })
    const { upsertMock } = createAuthSupabaseMock({ sessionUser: user })

    const { result } = renderHook(() => useAuth())

    await flushLocalEffect()

    const expectedUser = {
      id: 'user-1',
      email: 'you@example.com',
      name: 'You',
      loggedInAt: '2026-06-05T00:00:00.000Z',
    }

    expect(result.current.isLoading).toBe(false)
    expect(result.current.currentUser).toEqual(expectedUser)
    expect(setErrorReportingUserMock).toHaveBeenCalledWith(expectedUser)
    expect(upsertMock).toHaveBeenCalledWith(
      {
        id: 'user-1',
        display_name: 'You',
      },
      { onConflict: 'id' },
    )
  })

  it('loads an empty Supabase session and clears the error reporting user', async () => {
    createAuthSupabaseMock({ sessionUser: null })

    const { result } = renderHook(() => useAuth())

    await flushLocalEffect()

    expect(result.current.isLoading).toBe(false)
    expect(result.current.currentUser).toBeNull()
    expect(setErrorReportingUserMock).toHaveBeenCalledWith(null)
  })

  it('captures thrown session load errors', async () => {
    const error = new Error('session failed')
    createAuthSupabaseMock({ getSessionError: error })

    const { result } = renderHook(() => useAuth())

    await flushLocalEffect()

    expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
      area: 'auth',
      action: 'loadSupabaseSession',
    })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.currentUser).toBeNull()
    expect(setErrorReportingUserMock).toHaveBeenCalledWith(null)
  })

  it('updates the user from auth state changes and unsubscribes on unmount', async () => {
    const user = createSupabaseUser({ user_metadata: { name: 'Auth Event User' } })
    const { emitAuthStateChange, unsubscribeMock, upsertMock } =
      createAuthSupabaseMock()

    const { result, unmount } = renderHook(() => useAuth())
    await flushLocalEffect()

    act(() => {
      emitAuthStateChange({ user })
    })

    expect(result.current.currentUser).toEqual({
      id: 'user-1',
      email: 'you@example.com',
      name: 'Auth Event User',
      loggedInAt: '2026-06-05T00:00:00.000Z',
    })
    expect(upsertMock).toHaveBeenCalledWith(
      {
        id: 'user-1',
        display_name: 'Auth Event User',
      },
      { onConflict: 'id' },
    )

    act(() => {
      emitAuthStateChange(null)
    })

    expect(result.current.currentUser).toBeNull()
    expect(setErrorReportingUserMock).toHaveBeenLastCalledWith(null)

    unmount()
    expect(unsubscribeMock).toHaveBeenCalled()
  })

  it('captures subscribe errors', async () => {
    const error = new Error('subscribe failed')
    const supabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      },
      from: vi.fn(),
    }
    getSupabaseMock
      .mockResolvedValueOnce(supabase)
      .mockRejectedValueOnce(error)

    const { result } = renderHook(() => useAuth())

    await flushLocalEffect()

    expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
      area: 'auth',
      action: 'subscribeAuthState',
    })
    expect(result.current.isLoading).toBe(false)
  })

  it('logs in through Supabase and ensures the profile', async () => {
    const user = createSupabaseUser({ user_metadata: { name: 'Login User' } })
    const { signInWithPasswordMock, upsertMock } = createAuthSupabaseMock({
      signInUser: user,
    })

    const { result } = renderHook(() => useAuth())
    await flushLocalEffect()

    let loginResult: LoginResult | null = null

    await act(async () => {
      loginResult = await result.current.login({
        email: '  YOU@EXAMPLE.COM  ',
        password: '  password  ',
      })
    })

    const expectedUser = {
      id: 'user-1',
      email: 'you@example.com',
      name: 'Login User',
      loggedInAt: '2026-06-05T00:00:00.000Z',
    }

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: 'you@example.com',
      password: 'password',
    })
    expect(loginResult).toEqual({ success: true, message: '' })
    expect(result.current.currentUser).toEqual(expectedUser)
    expect(setErrorReportingUserMock).toHaveBeenLastCalledWith(expectedUser)
    expect(upsertMock).toHaveBeenCalledWith(
      {
        id: 'user-1',
        display_name: 'Login User',
      },
      { onConflict: 'id' },
    )
  })

  it('returns the Supabase login error message', async () => {
    createAuthSupabaseMock({
      signInError: { message: 'Invalid credentials' },
    })

    const { result } = renderHook(() => useAuth())
    await flushLocalEffect()

    let loginResult: LoginResult | null = null

    await act(async () => {
      loginResult = await result.current.login({
        email: 'you@example.com',
        password: 'password',
      })
    })

    expect(loginResult).toEqual({
      success: false,
      message: 'Invalid credentials',
    })
    expect(result.current.currentUser).toBeNull()
  })

  it('captures thrown login errors and returns a fallback message', async () => {
    const error = new Error('login exploded')
    createAuthSupabaseMock({ signInThrows: error })

    const { result } = renderHook(() => useAuth())
    await flushLocalEffect()

    let loginResult: LoginResult | null = null

    await act(async () => {
      loginResult = await result.current.login({
        email: 'you@example.com',
        password: 'password',
      })
    })

    expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
      area: 'auth',
      action: 'login',
    })
    expect(loginResult).toEqual({
      success: false,
      message: '登入時發生非預期錯誤，請稍後再試',
    })
  })

  it('logs out through Supabase and clears user state', async () => {
    const { signOutMock } = createAuthSupabaseMock()

    const { result } = renderHook(() => useAuth())
    await flushLocalEffect()

    await act(async () => {
      await result.current.logout()
    })

    expect(signOutMock).toHaveBeenCalled()
    expect(result.current.currentUser).toBeNull()
    expect(setErrorReportingUserMock).toHaveBeenLastCalledWith(null)
  })

  it('captures Supabase logout errors and still clears user state', async () => {
    const logoutError = { message: 'Logout failed' }
    createAuthSupabaseMock({ signOutError: logoutError })

    const { result } = renderHook(() => useAuth())
    await flushLocalEffect()

    await act(async () => {
      await result.current.logout()
    })

    expect(captureAppErrorMock).toHaveBeenCalledWith(logoutError, {
      area: 'auth',
      action: 'logout',
    })
    expect(result.current.currentUser).toBeNull()
    expect(setErrorReportingUserMock).toHaveBeenLastCalledWith(null)
  })

  it('captures thrown logout errors and still clears user state', async () => {
    const error = new Error('logout exploded')
    createAuthSupabaseMock({ signOutThrows: error })

    const { result } = renderHook(() => useAuth())
    await flushLocalEffect()

    await act(async () => {
      await result.current.logout()
    })

    expect(captureAppErrorMock).toHaveBeenCalledWith(error, {
      area: 'auth',
      action: 'logout',
    })
    expect(result.current.currentUser).toBeNull()
    expect(setErrorReportingUserMock).toHaveBeenLastCalledWith(null)
  })

  it('captures profile upsert errors', async () => {
    const profileError = { message: 'Profile failed' }
    createAuthSupabaseMock({
      sessionUser: createSupabaseUser({ user_metadata: { name: 'You' } }),
      profileError,
    })

    renderHook(() => useAuth())
    await flushLocalEffect()

    expect(captureAppErrorMock).toHaveBeenCalledWith(profileError, {
      area: 'auth',
      action: 'ensureProfile',
      userId: 'user-1',
    })
  })
})
