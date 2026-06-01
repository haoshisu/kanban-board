import type { AuthUser } from './types'
import { captureAppError } from '../lib/errorReporting'

const AUTH_STORAGE_KEY = 'kanban-board:auth-user'

const isAuthUser = (value: unknown): value is AuthUser => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const user = value as Partial<AuthUser>

  return (
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    typeof user.name === 'string' &&
    typeof user.loggedInAt === 'string'
  )
}

export const loadAuthUser = (): AuthUser | null => {
  try {
    const value = localStorage.getItem(AUTH_STORAGE_KEY)

    if (!value) {
      return null
    }

    const parsed: unknown = JSON.parse(value)

    return isAuthUser(parsed) ? parsed : null
  } catch (error) {
    captureAppError(error, {
      area: 'storage',
      action: 'loadAuthUser',
    })
    return null
  }
}

export const saveAuthUser = (user: AuthUser) => {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
  } catch (error) {
    captureAppError(error, {
      area: 'storage',
      action: 'saveAuthUser',
      hasUser: Boolean(user.id),
    })
  }
}

export const clearAuthUser = () => {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch (error) {
    captureAppError(error, {
      area: 'storage',
      action: 'clearAuthUser',
    })
  }
}
