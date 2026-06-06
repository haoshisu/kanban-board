import { beforeEach, describe, expect, it, vi } from 'vitest'

const sentry = vi.hoisted(() => ({
  captureException: vi.fn(),
  setContext: vi.fn(),
  setTag: vi.fn(),
  setUser: vi.fn(),
  withScope: vi.fn(),
}))

vi.mock('@sentry/react', () => ({
  captureException: sentry.captureException,
  setUser: sentry.setUser,
  withScope: sentry.withScope,
}))

import { captureAppError, setErrorReportingUser } from './errorReporting'

describe('errorReporting', () => {
  beforeEach(() => {
    sentry.captureException.mockClear()
    sentry.setContext.mockClear()
    sentry.setTag.mockClear()
    sentry.setUser.mockClear()
    sentry.withScope.mockImplementation((callback) => {
      callback({
        setContext: sentry.setContext,
        setTag: sentry.setTag,
      })
    })
  })

  it('captures errors with area, action, and app context', () => {
    const error = new Error('Boom')
    const context = {
      area: 'storage',
      action: 'loadBoards',
      boardCount: 2,
    }

    captureAppError(error, context)

    expect(sentry.setTag).toHaveBeenCalledWith('area', 'storage')
    expect(sentry.setTag).toHaveBeenCalledWith('action', 'loadBoards')
    expect(sentry.setContext).toHaveBeenCalledWith('app', context)
    expect(sentry.captureException).toHaveBeenCalledWith(error)
  })

  it('sets a non-local user id on Sentry', () => {
    setErrorReportingUser({ id: 'user-1' })

    expect(sentry.setUser).toHaveBeenCalledWith({ id: 'user-1' })
  })

  it('anonymizes local users on Sentry', () => {
    setErrorReportingUser({ id: 'local-you@example.com' })

    expect(sentry.setUser).toHaveBeenCalledWith({ id: 'local-user' })
  })

  it('clears the Sentry user', () => {
    setErrorReportingUser(null)

    expect(sentry.setUser).toHaveBeenCalledWith(null)
  })
})
