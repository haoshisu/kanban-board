import { Link } from 'react-router'

type NotFoundPageProps = {
  homePath: string
}

export default function NotFoundPage({ homePath }: NotFoundPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10 text-slate-950">
      <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
          找不到這個頁面
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          這個連結可能已經不存在，或網址輸入有誤。
        </p>
        <Link
          className="mt-6 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          to={homePath}
        >
          回到首頁
        </Link>
      </section>
    </main>
  )
}
