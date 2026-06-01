export default function ErrorFallback() {
 const handleReload = () => {
  window.location.reload();
 };

 return (
  <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10 text-slate-950">
   <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
    <p className="text-sm font-semibold text-red-600">發生錯誤</p>
    <h1 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">頁面暫時無法顯示</h1>
    <p className="mt-3 text-sm leading-6 text-slate-600">
     系統遇到未預期的問題。你可以重新整理頁面，或回到首頁再試一次。
    </p>
    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
     <button
      className="inline-flex justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
      onClick={handleReload}
      type="button"
     >
      重新整理
     </button>
     <a
      className="inline-flex justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
      href="/"
     >
      回到首頁
     </a>
    </div>
   </section>
  </main>
 );
}
