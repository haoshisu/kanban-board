import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

vi.hoisted(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    disconnect() {}
    observe() {}
    unobserve() {}
  }
})

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
  setUser: vi.fn(),
  withScope: vi.fn((callback: (scope: unknown) => void) => {
    callback({
      setContext: vi.fn(),
      setTag: vi.fn(),
    })
  }),
}))

const localDataModeKey = 'kanban-board:e2e'
const authStorageKey = 'kanban-board:auth-user'

const authUser = {
  id: 'local-you@example.com',
  email: 'you@example.com',
  name: 'you',
  loggedInAt: '2026-06-05T12:00:00.000Z',
}

const renderAppAt = (path: string) => {
  window.history.pushState({}, '', path)

  return render(<App />)
}

describe('App integration', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(localDataModeKey, 'true')
    window.history.pushState({}, '', '/')
  })

  afterEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('redirects unauthenticated users from the board route to login', async () => {
    renderAppAt('/board')

    expect(await screen.findByRole('heading', { name: '登入' })).toBeVisible()

    await waitFor(() => {
      expect(window.location.pathname).toBe('/login')
    })
  })

  it('logs in from the login page and logs out from the board page', async () => {
    const user = userEvent.setup()

    renderAppAt('/login')

    await user.type(await screen.findByLabelText('Email'), 'you@example.com')
    await user.type(screen.getByLabelText('密碼'), '123')
    await user.click(screen.getByRole('button', { name: '登入' }))

    expect(await screen.findByRole('heading', { name: 'Board 管理' })).toBeVisible()
    expect(screen.getByText('you@example.com')).toBeVisible()

    await waitFor(() => {
      expect(window.location.pathname).toBe('/board')
    })

    await user.click(screen.getByRole('button', { name: '登出' }))

    expect(await screen.findByRole('heading', { name: '登入' })).toBeVisible()

    await waitFor(() => {
      expect(window.location.pathname).toBe('/login')
    })
  })

  it('redirects authenticated users away from the login route to the board', async () => {
    localStorage.setItem(authStorageKey, JSON.stringify(authUser))

    renderAppAt('/login')

    expect(await screen.findByRole('heading', { name: 'Board 管理' })).toBeVisible()
    expect(screen.getByText('you@example.com')).toBeVisible()

    await waitFor(() => {
      expect(window.location.pathname).toBe('/board')
    })
  })

  it('sends unauthenticated users from the 404 page back to login', async () => {
    const user = userEvent.setup()

    renderAppAt('/missing-page')

    expect(await screen.findByRole('heading', { name: '找不到這個頁面' })).toBeVisible()

    await user.click(screen.getByRole('link', { name: '回到首頁' }))

    expect(await screen.findByRole('heading', { name: '登入' })).toBeVisible()

    await waitFor(() => {
      expect(window.location.pathname).toBe('/login')
    })
  })

  it('sends authenticated users from the 404 page back to the board', async () => {
    const user = userEvent.setup()

    localStorage.setItem(authStorageKey, JSON.stringify(authUser))

    renderAppAt('/missing-page')

    expect(await screen.findByRole('heading', { name: '找不到這個頁面' })).toBeVisible()

    await user.click(screen.getByRole('link', { name: '回到首頁' }))

    expect(await screen.findByRole('heading', { name: 'Board 管理' })).toBeVisible()

    await waitFor(() => {
      expect(window.location.pathname).toBe('/board')
    })
  })
})
