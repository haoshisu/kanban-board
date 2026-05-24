import type { AuthUser } from './types'

const AUTH_STORAGE_KEY = 'kanban-board:auth-user'

const isAuthUser = (value: unknown): value is AuthUser => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const user = value as Partial<AuthUser>

  return (
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
  } catch {
    return null
  }
}

export const saveAuthUser = (user: AuthUser) => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
}

export const clearAuthUser = () => {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}
