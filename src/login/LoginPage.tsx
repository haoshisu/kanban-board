import { useState } from "react";
import type { ComponentProps } from "react";
import type { LoginInput, LoginResult } from "./types";

type LoginPageProps = {
 onLogin: (input: LoginInput) => Promise<LoginResult>;
};

const inputBaseClassName =
 "mt-2 w-full rounded-lg border bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none transition duration-200 placeholder:text-white/30 focus:bg-white/[0.06] disabled:cursor-not-allowed disabled:bg-white/[0.02] disabled:text-white/40";

const featureCardClassName =
 "rounded-lg border border-white/10 bg-white/[0.03] p-4 transition duration-200 hover:border-white/20 hover:bg-white/[0.05]";

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
  <main className="relative min-h-screen overflow-hidden bg-[#08090a] px-4 py-8 text-white sm:px-6 lg:px-8">
   <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 opacity-40"
    style={{
     backgroundImage:
      "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(94,106,210,0.25), transparent)",
    }}
   />
   <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-size-[64px_64px] mask-[radial-gradient(ellipse_80%_60%_at_50%_0%,black,transparent)]"
   />

   <section className="relative mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1fr_440px] lg:gap-14">
    <div className="space-y-8">
     <div>
      <p className="flex items-center gap-2 text-sm font-medium text-white/50">
       <span className="h-1.5 w-1.5 rounded-full bg-[#5E6AD2]" aria-hidden="true" />
       Kanban Board
      </p>
      <p className="mt-4 max-w-xl text-4xl font-medium tracking-tight text-white sm:text-5xl">
       讓工作狀態保持清楚、安靜、可掌握。
      </p>
      <p className="mt-4 max-w-lg text-base leading-7 text-white/50">
       登入後即可管理 board、整理 task，並用拖拉方式更新每件事的進度。
      </p>
     </div>

     <div className="grid max-w-xl gap-3 sm:grid-cols-3">
      <div className={featureCardClassName}>
       <p className="text-sm font-medium text-white">Boards</p>
       <p className="mt-2 text-sm leading-6 text-white/45">集中管理不同工作流程。</p>
      </div>
      <div className={featureCardClassName}>
       <p className="text-sm font-medium text-white">Tasks</p>
       <p className="mt-2 text-sm leading-6 text-white/45">快速記錄與追蹤待辦。</p>
      </div>
      <div className={featureCardClassName}>
       <p className="text-sm font-medium text-white">Flow</p>
       <p className="mt-2 text-sm leading-6 text-white/45">拖拉任務更新狀態。</p>
      </div>
     </div>
    </div>

    <form
     className="w-full rounded-xl border border-white/10 bg-[#0d0e10]/90 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_60px_-15px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:p-6"
     onSubmit={handleSubmit}
    >
     <div className="mb-6">
      <p className="text-sm font-medium text-white/50">歡迎回來</p>
      <h1 className="mt-2 text-2xl font-medium tracking-tight text-white">登入</h1>
      <p className="mt-2 text-sm leading-6 text-white/45">使用你的 email 與密碼進入工作看板。</p>
     </div>

     <div className="space-y-5">
      <div>
       <label className="text-sm font-medium text-white/70" htmlFor="login-email">
        Email
       </label>
       <input
        aria-describedby={error?.type === "email" ? "login-error" : undefined}
        aria-invalid={error?.type === "email"}
        autoComplete="email"
        className={`${inputBaseClassName} ${
         error?.type === "email"
          ? "border-red-500/40 focus:border-red-500/60"
          : "border-white/10 focus:border-[#5E6AD2]/60"
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
       <label className="text-sm font-medium text-white/70" htmlFor="login-password">
        密碼
       </label>
       <input
        aria-describedby={error?.type === "password" ? "login-error" : undefined}
        aria-invalid={error?.type === "password"}
        autoComplete="current-password"
        className={`${inputBaseClassName} ${
         error?.type === "password"
          ? "border-red-500/40 focus:border-red-500/60"
          : "border-white/10 focus:border-[#5E6AD2]/60"
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
        className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300"
        id="login-error"
        role="alert"
       >
        {error.message}
       </p>
      ) : null}

      <button
       className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#5E6AD2] px-4 py-2.5 text-sm font-medium text-white transition duration-150 hover:cursor-pointer hover:bg-[#6a76e0] active:bg-[#4f5ac2] focus:outline-none focus:ring-2 focus:ring-[#5E6AD2]/40 focus:ring-offset-2 focus:ring-offset-[#0d0e10] disabled:cursor-not-allowed disabled:bg-[#5E6AD2]/40"
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
