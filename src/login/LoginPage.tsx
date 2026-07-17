import { useState } from "react";
import type { ComponentProps } from "react";
import type { LoginInput, LoginResult } from "./types";

type LoginPageProps = {
 onLogin: (input: LoginInput) => Promise<LoginResult>;
};

const inputBaseClassName =
 "mt-2 w-full rounded-[5px] border bg-card px-3 py-2.5 text-sm text-ink outline-none transition duration-200 placeholder:text-ink-muted focus:-translate-y-px disabled:cursor-not-allowed disabled:bg-ink-muted/10 disabled:text-ink-muted disabled:focus:translate-y-0";

const featureCardClassName =
 "rounded-lg border border-ink-muted/30 bg-card/70 p-4 transition duration-200 motion-safe:hover:-translate-y-0.5 hover:border-ink-muted/50 hover:bg-card";

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
  <main className="min-h-screen bg-paper px-4 py-8 text-ink sm:px-6 lg:px-8">
   <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1fr_440px] lg:gap-14">
    <div className="space-y-8">
     <div>
      <p className="font-display text-sm font-semibold uppercase tracking-widest text-ink-muted">
       Kanban Board
      </p>
      <p className="mt-4 max-w-xl font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
       讓工作狀態保持清楚、安靜、可掌握。
      </p>
      <p className="mt-4 max-w-lg text-base leading-7 text-ink-muted">
       登入後即可管理 board、整理 task，並用拖拉方式更新每件事的進度。
      </p>
     </div>

     <div className="grid max-w-xl gap-3 sm:grid-cols-3">
      <div className={featureCardClassName}>
       <p className="font-display text-sm font-semibold uppercase tracking-wide text-ink">Boards</p>
       <p className="mt-2 text-sm leading-6 text-ink-muted">集中管理不同工作流程。</p>
      </div>
      <div className={featureCardClassName}>
       <p className="font-display text-sm font-semibold uppercase tracking-wide text-ink">Tasks</p>
       <p className="mt-2 text-sm leading-6 text-ink-muted">快速記錄與追蹤待辦。</p>
      </div>
      <div className={featureCardClassName}>
       <p className="font-display text-sm font-semibold uppercase tracking-wide text-ink">Flow</p>
       <p className="mt-2 text-sm leading-6 text-ink-muted">拖拉任務更新狀態。</p>
      </div>
     </div>
    </div>

    <form
     className="w-full rounded-lg border border-ink-muted/40 bg-card p-5 transition duration-300 sm:p-6"
     onSubmit={handleSubmit}
    >
     <div className="mb-6">
      <p className="text-sm font-medium text-ink-muted">歡迎回來</p>
      <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide text-ink">登入</h1>
      <p className="mt-2 text-sm leading-6 text-ink-muted">使用你的 email 與密碼進入工作看板。</p>
     </div>

     <div className="space-y-5">
      <div>
       <label className="text-sm font-medium text-ink" htmlFor="login-email">
        Email
       </label>
       <input
        aria-describedby={error?.type === "email" ? "login-error" : undefined}
        aria-invalid={error?.type === "email"}
        autoComplete="email"
        className={`${inputBaseClassName} ${
         error?.type === "email"
          ? "border-error ring-2 ring-error/20 focus:border-error focus:ring-error/20"
          : "border-ink-muted/50 focus:border-stamp-todo focus:ring-2 focus:ring-stamp-todo/30"
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
       <label className="text-sm font-medium text-ink" htmlFor="login-password">
        密碼
       </label>
       <input
        aria-describedby={error?.type === "password" ? "login-error" : undefined}
        aria-invalid={error?.type === "password"}
        autoComplete="current-password"
        className={`${inputBaseClassName} ${
         error?.type === "password"
          ? "border-error ring-2 ring-error/20 focus:border-error focus:ring-error/20"
          : "border-ink-muted/50 focus:border-stamp-todo focus:ring-2 focus:ring-stamp-todo/30"
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
        className="rounded-[5px] border border-error bg-error/10 px-3 py-2 text-sm font-medium text-error"
        id="login-error"
        role="alert"
       >
        {error.message}
       </p>
      ) : null}

      <button
       className="flex w-full items-center justify-center gap-2 rounded-[5px] bg-stamp-todo px-4 py-2.5 font-display text-sm font-semibold uppercase tracking-wide text-card transition duration-200 hover:cursor-pointer hover:bg-stamp-todo/90 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp-todo disabled:cursor-not-allowed disabled:bg-ink-muted/50 disabled:active:translate-y-0"
       disabled={isSubmitting}
       type="submit"
      >
       {isSubmitting ? (
        <span
         aria-hidden="true"
         className="h-4 w-4 animate-spin rounded-full border-2 border-card/40 border-t-card"
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
