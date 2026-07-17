import { Link } from 'react-router'

type NotFoundPageProps = {
  homePath: string
}

export default function NotFoundPage({ homePath }: NotFoundPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-10 text-ink">
      <section className="w-full max-w-lg rounded-lg border border-ink-muted/40 bg-card p-6">
        <p className="font-display text-sm font-semibold uppercase tracking-widest text-ink-muted">404</p>
        <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide text-ink">
          找不到這個頁面
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          這個連結可能已經不存在，或網址輸入有誤。
        </p>
        <Link
          className="mt-6 inline-flex rounded-[5px] bg-stamp-todo px-4 py-2 font-display text-sm font-semibold uppercase tracking-wide text-card transition hover:bg-stamp-todo/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp-todo"
          to={homePath}
        >
          回到首頁
        </Link>
      </section>
    </main>
  )
}
