import { useState } from "react";
import type { ComponentProps } from "react";
import type { LoginInput, LoginResult } from "./types";

type LoginPageProps = {
 onLogin: (input: LoginInput) => Promise<LoginResult>;
};

const inputBaseClassName =
 "mt-2 w-full rounded-md border bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition duration-200 placeholder:text-slate-400 focus:-translate-y-px disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 disabled:focus:translate-y-0";

const featureCardClassName =
 "rounded-lg border border-slate-200 bg-white/70 p-4 transition duration-200 motion-safe:hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-sm";

export default function LoginPage({ onLogin }: LoginPageProps) {
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [error, setError] = useState<{ message: string; type: string } | null>(null);
 const [isSubmitting, setIsSubmitting] = useState(false);

 const handleSubmit: ComponentProps<"form">["onSubmit"] = async (event) => {
  event.preventDefault();
  setIsSubmitting(true);

  const result = await onLogin({ email, password });

  if (!result.success) {
   setError({ message: result.message, type: result.type });
   setIsSubmitting(false);
   return;
  }

  setError(null);
  setIsSubmitting(false);
 };

 return (
  <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
   <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1fr_440px] lg:gap-14">
    <div className="space-y-8">
     <div>
      <p className="text-sm font-semibold uppercase tracking-normal text-slate-500">Kanban Board</p>
      <p className="mt-4 max-w-xl text-4xl font-bold tracking-normal text-slate-950 sm:text-5xl">
       讓工作狀態保持清楚、安靜、可掌握。
      </p>
      <p className="mt-4 max-w-lg text-base leading-7 text-slate-600">
       登入後即可管理 board、整理 task，並用拖拉方式更新每件事的進度。
      </p>
     </div>

     <div className="grid max-w-xl gap-3 sm:grid-cols-3">
      <div className={featureCardClassName}>
       <p className="text-sm font-semibold text-slate-900">Boards</p>
       <p className="mt-2 text-sm leading-6 text-slate-600">集中管理不同工作流程。</p>
      </div>
      <div className={featureCardClassName}>
       <p className="text-sm font-semibold text-slate-900">Tasks</p>
       <p className="mt-2 text-sm leading-6 text-slate-600">快速記錄與追蹤待辦。</p>
      </div>
      <div className={featureCardClassName}>
       <p className="text-sm font-semibold text-slate-900">Flow</p>
       <p className="mt-2 text-sm leading-6 text-slate-600">拖拉任務更新狀態。</p>
      </div>
     </div>
    </div>

    <form
     className="w-full rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:shadow-md sm:p-6"
     onSubmit={handleSubmit}
    >
     <div className="mb-6">
      <p className="text-sm font-medium text-slate-500">歡迎回來</p>
      <h1 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">登入</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">使用你的 email 與密碼進入工作看板。</p>
     </div>

     <div className="space-y-5">
      <div>
       <label className="text-sm font-medium text-slate-700" htmlFor="login-email">
        Email
       </label>
       <input
        aria-describedby={error?.type === "email" ? "login-error" : undefined}
        aria-invalid={error?.type === "email"}
        autoComplete="email"
        className={`${inputBaseClassName} ${
         error?.type === "email"
          ? "border-red-300 ring-2 ring-red-100 focus:border-red-500 focus:ring-red-100"
          : "border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
        }`}
        disabled={isSubmitting}
        id="login-email"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        type="email"
        value={email}
       />
      </div>

      <div>
       <label className="text-sm font-medium text-slate-700" htmlFor="login-password">
        密碼
       </label>
       <input
        aria-describedby={error?.type === "password" ? "login-error" : undefined}
        aria-invalid={error?.type === "password"}
        autoComplete="current-password"
        className={`${inputBaseClassName} ${
         error?.type === "password"
          ? "border-red-300 ring-2 ring-red-100 focus:border-red-500 focus:ring-red-100"
          : "border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
        }`}
        disabled={isSubmitting}
        id="login-password"
        onChange={(event) => setPassword(event.target.value)}
        placeholder="請輸入密碼"
        type="password"
        value={password}
       />
      </div>

      {error ? (
       <p
        className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
        id="login-error"
        role="alert"
       >
        {error.message}
       </p>
      ) : null}

      <button
       className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition duration-200 hover:cursor-pointer hover:bg-slate-700 active:translate-y-px focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:active:translate-y-0"
       disabled={isSubmitting}
       type="submit"
      >
       {isSubmitting ? (
        <span
         aria-hidden="true"
         className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
        />
       ) : null}
       {isSubmitting ? "登入中..." : "登入"}
      </button>
     </div>
    </form>
   </section>
  </main>
 );
}
