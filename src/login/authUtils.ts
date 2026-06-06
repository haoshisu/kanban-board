import type { User } from '@supabase/supabase-js'
import type { AuthUser } from './types'

export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const isValidEmail = (email: string) => emailPattern.test(email)

export const getNameFromEmail = (email: string) => {
  const [name] = email.split('@')

  return name || email
}

export const mapAuthUser = (user: User): AuthUser => {
  const email = user.email ?? ''

  return {
    id: user.id,
    email,
    name:
      typeof user.user_metadata.name === 'string'
        ? user.user_metadata.name
        : getNameFromEmail(email),
    loggedInAt: user.last_sign_in_at ?? new Date().toISOString(),
  }
}
