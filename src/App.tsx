import { Suspense, lazy } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { useAuth } from './login/useAuth'

type ProtectedRouteProps = {
  isAuthenticated: boolean
  children: ReactNode
}

const LoginPage = lazy(() => import('./login/LoginPage'))

const BoardPage = lazy(() => import('./board/BoardPage'))

const NotFoundPage = lazy(() => import('./404/NotFoundPage'))


function PageFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-700">
      <p className="text-sm font-medium">載入頁面...</p>
    </main>
  )
}

function ProtectedRoute({ isAuthenticated, children }: ProtectedRouteProps) {
  if (!isAuthenticated) {
    return <Navigate replace to="/login" />
  }

  return children
}

function App() {
  const { currentUser, isLoading, login, logout } = useAuth()
  const isAuthenticated = Boolean(currentUser)

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-700">
        <p className="text-sm font-medium">載入登入狀態...</p>
      </main>
    )
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Navigate replace to={isAuthenticated ? '/board' : '/login'} />}/>
          <Route path="/login" element={isAuthenticated ? (<Navigate replace to="/board" />) : (<LoginPage onLogin={login} />)}/>
          <Route path="/board" element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <BoardPage
                  userEmail={currentUser?.email}
                  userId={currentUser?.id}
                  onLogout={logout}
                />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage homePath={isAuthenticated ? '/board' : '/login'} />}/>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
