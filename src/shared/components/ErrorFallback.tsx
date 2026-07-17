export default function ErrorFallback() {
 const handleReload = () => {
  window.location.reload();
 };

 return (
  <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-10 text-ink">
   <section className="w-full max-w-lg rounded-lg border border-ink-muted/40 bg-card p-6">
    <p className="font-display text-sm font-semibold uppercase tracking-widest text-error">發生錯誤</p>
    <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide text-ink">頁面暫時無法顯示</h1>
    <p className="mt-3 text-sm leading-6 text-ink-muted">
     系統遇到未預期的問題。你可以重新整理頁面，或回到首頁再試一次。
    </p>
    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
     <button
      className="inline-flex justify-center rounded-[5px] bg-stamp-todo px-4 py-2 font-display text-sm font-semibold uppercase tracking-wide text-card transition hover:bg-stamp-todo/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp-todo"
      onClick={handleReload}
      type="button"
     >
      重新整理
     </button>
     <a
      className="inline-flex justify-center rounded-[5px] border border-ink-muted/40 px-4 py-2 font-display text-sm font-semibold uppercase tracking-wide text-ink transition hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp-todo"
      href="/"
     >
      回到首頁
     </a>
    </div>
   </section>
  </main>
 );
}
