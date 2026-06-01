# Kanban Board

A Kanban-style task management app built with React, TypeScript, Vite, TailwindCSS, dnd-kit, React Router, Supabase, Playwright, and Sentry.

The project focuses on a practical board workflow: authenticated users can create boards, manage tasks, and move tasks across statuses with drag-and-drop interactions. It also includes a LocalStorage-backed data mode for stable end-to-end testing and frontend error monitoring for production debugging.

## Features

- Email/password login with Supabase Auth
- Protected board route with React Router v7
- Board CRUD: create, edit, delete, and select boards
- Task CRUD: create, edit, delete, and move tasks between statuses
- Drag-and-drop task status updates with dnd-kit
- Optimistic UI updates for faster perceived interactions
- Supabase persistence for boards, tasks, and user profiles
- LocalStorage-backed e2e mode for stable Playwright tests
- Responsive UI built with TailwindCSS
- Playwright coverage for login, board CRUD, task CRUD, and drag-and-drop flows
- Sentry frontend error monitoring with a global React Error Boundary, contextual exception reporting, user scoping, and source map uploads
- GitHub Actions CI/CD for linting, building, and Vercel deployment

## Tech Stack

- React
- TypeScript
- Vite
- TailwindCSS
- dnd-kit
- React Router v7
- Supabase
- Sentry
- Playwright
- ESLint
- GitHub Actions
- Vercel

## Project Structure

```txt
src/
  404/          Not found route
  board/        Board page, board hooks, board components, board storage
  lib/          Supabase client, Sentry setup, error reporting, database types
  login/        Auth hooks, login page, local auth storage
  shared/       Shared UI components
  task/         Task hooks, task components, task storage
  utils/        Optional browser metric helpers
e2e/            Playwright end-to-end tests
.github/        GitHub Actions CI/CD workflow
public/         Static assets
```

## Observability

The current Sentry setup is focused on production error visibility:

- `Sentry.ErrorBoundary` wraps the React app and shows a fallback UI when an uncaught render-time error reaches the app boundary.
- `captureAppError` adds `area` and `action` tags plus contextual metadata before sending exceptions to Sentry.
- Auth, Supabase initialization, board operations, task operations, LocalStorage operations, and drag-and-drop task moves report unexpected exceptions.
- `Sentry.setUser` scopes events by user id only; local test users are anonymized as `local-user`.
- `sendDefaultPii` is disabled to avoid default PII collection.
- The Vite build generates source maps, and `@sentry/vite-plugin` uploads them for readable production stack traces.

## Getting Started

### Prerequisites

- Node.js
- npm
- A Supabase project

### Install dependencies

```bash
npm install
```

### Environment variables

Create a `.env` file in the project root:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SENTRY_DSN=your_sentry_frontend_dsn
```

`VITE_SENTRY_DSN` is optional for local development. Without it, Sentry will not send events.

For production source map uploads, the build environment also needs:

```bash
SENTRY_AUTH_TOKEN=your_sentry_auth_token
SENTRY_ORG=your_sentry_org_slug
SENTRY_PROJECT=your_sentry_project_slug
```

The app expects these Supabase tables:

- `profiles`
- `boards`
- `tasks`

The generated type definitions are stored in `src/lib/database.types.ts`.

### Run locally

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

### End-to-end tests

```bash
npm run test:e2e
```

The Playwright tests enable local data mode by setting `kanban-board:e2e` in `localStorage`, so the test flow does not depend on a live Supabase session.

## CI/CD

The GitHub Actions workflow runs on pushes and pull requests targeting `main`.

- `checks`: installs dependencies, runs ESLint, and builds the app.
- `deploy`: runs on pushes to `main`, builds the Vercel production output, and deploys with the Vercel CLI.

---

# Kanban Board 中文說明

這是一個使用 React、TypeScript、Vite、TailwindCSS、dnd-kit、React Router、Supabase、Playwright 和 Sentry 建立的 Kanban 任務管理專案。

專案重點是實作實用的看板工作流程：使用者登入後可以建立 board、管理 task，並透過拖拉操作更新 task 狀態。專案也提供 LocalStorage-backed data mode，讓 Playwright e2e 測試可以穩定執行，並加入前端錯誤監控，方便 production debugging。

## 功能

- 使用 Supabase Auth 實作 email/password 登入
- 使用 React Router v7 實作受保護的 board 頁面
- Board CRUD：建立、編輯、刪除、切換 board
- Task CRUD：建立、編輯、刪除、移動 task 狀態
- 使用 dnd-kit 實作拖拉更新 task 狀態
- 使用 optimistic UI update 提升操作回饋速度
- 使用 Supabase 儲存 profiles、boards 與 tasks
- 提供 LocalStorage-backed e2e mode，讓測試流程更穩定
- 使用 TailwindCSS 建立響應式介面
- 使用 Playwright 測試登入、board CRUD、task CRUD、拖拉流程
- 使用 Sentry 做前端錯誤監控，包含全域 React Error Boundary、帶 context 的 exception reporting、user scoping 和 source map upload
- 使用 GitHub Actions 執行 lint、build 和 Vercel deployment

## 技術棧

- React
- TypeScript
- Vite
- TailwindCSS
- dnd-kit
- React Router v7
- Supabase
- Sentry
- Playwright
- ESLint
- GitHub Actions
- Vercel

## 專案結構

```txt
src/
  404/          404 頁面
  board/        Board 頁面、hooks、components、storage
  lib/          Supabase client、Sentry 設定、error reporting、資料庫型別
  login/        Auth hooks、登入頁、local auth storage
  shared/       共用 UI components
  task/         Task hooks、components、storage
  utils/        可選的瀏覽器效能指標 helper
e2e/            Playwright end-to-end tests
.github/        GitHub Actions CI/CD workflow
public/         靜態資源
```

## Observability

目前的 Sentry 設定重點是 production error visibility：

- 使用 `Sentry.ErrorBoundary` 包住 React app，當 render 階段的未處理錯誤抵達 app boundary 時，會顯示 fallback UI。
- 使用 `captureAppError` 在送出例外前加上 `area`、`action` tags 與額外 context。
- Auth、Supabase 初始化、board 操作、task 操作、LocalStorage 操作與拖拉移動 task 的非預期例外會上傳到 Sentry。
- 使用 `Sentry.setUser` 只設定 user id；local test user 會匿名成 `local-user`。
- 關閉 `sendDefaultPii`，避免 Sentry 收集預設 PII。
- Vite build 會產生 source maps，並透過 `@sentry/vite-plugin` 上傳，讓 production stack trace 可以還原到原始碼。

## 開始使用

### 前置需求

- Node.js
- npm
- Supabase project

### 安裝依賴

```bash
npm install
```

### 環境變數

在專案根目錄建立 `.env`：

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SENTRY_DSN=your_sentry_frontend_dsn
```

`VITE_SENTRY_DSN` 對本機開發是選填；沒有設定時，Sentry 不會送出事件。

若 production build 需要上傳 source maps，build 環境也需要：

```bash
SENTRY_AUTH_TOKEN=your_sentry_auth_token
SENTRY_ORG=your_sentry_org_slug
SENTRY_PROJECT=your_sentry_project_slug
```

目前專案預期 Supabase 內有以下 tables：

- `profiles`
- `boards`
- `tasks`

產生出的資料庫型別放在 `src/lib/database.types.ts`。

### 本機開發

```bash
npm run dev
```

### 建置

```bash
npm run build
```

### 預覽 production build

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

### End-to-end 測試

```bash
npm run test:e2e
```

Playwright 測試會在 `localStorage` 設定 `kanban-board:e2e`，讓測試改用本機資料模式，因此不需要依賴實際 Supabase 登入 session。

## CI/CD

GitHub Actions workflow 會在 push 和 pull request 目標為 `main` 時執行。

- `checks`：安裝依賴、執行 ESLint、建置 app。
- `deploy`：只在 push 到 `main` 時執行，使用 Vercel CLI 建置 production output 並部署。
