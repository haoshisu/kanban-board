import { useState } from 'react'
import type { ComponentProps } from 'react'
import type { LoginInput, LoginResult } from './types'

type LoginPageProps = {
  onLogin: (input: LoginInput) => Promise<LoginResult>
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit: ComponentProps<'form'>['onSubmit'] = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)

    const result = await onLogin({ email, password })

    if (!result.success) {
      setError(result.message)
      setIsSubmitting(false)
      return
    }

    setError('')
    setIsSubmitting(false)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8 text-slate-950">
      <section className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
            登入
          </h1>
        </div>

        <form
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          onSubmit={handleSubmit}
        >
          <div className="space-y-4">
            <div>
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="login-email"
              >
                Email
              </label>
              <input
                autoComplete="email"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                disabled={isSubmitting}
                id="login-email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                type="email"
                value={email}
              />
            </div>

            <div>
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="login-password"
              >
                密碼
              </label>
              <input
                autoComplete="current-password"
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                disabled={isSubmitting}
                id="login-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="請輸入密碼"
                type="password"
                value={password}
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <button
              className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? '登入中...' : '登入'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
