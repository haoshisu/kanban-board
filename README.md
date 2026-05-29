# Kanban Board

A Kanban-style task management app built with React, TypeScript, Vite, TailwindCSS, dnd-kit, React Router, and Supabase.

The project focuses on a practical board workflow: authenticated users can create boards, manage tasks, and move tasks across statuses with drag-and-drop interactions. It also includes a local data mode for end-to-end testing.

## Features

- Email/password login with Supabase Auth
- Protected board route with React Router
- Board CRUD: create, edit, delete, and select boards
- Task CRUD: create, edit, delete, and move tasks between statuses
- Drag-and-drop task status updates with dnd-kit
- Optimistic UI updates for faster perceived interactions
- Supabase persistence for boards and tasks
- LocalStorage-backed e2e mode for stable Playwright tests
- Responsive UI built with TailwindCSS
- Playwright coverage for login, board CRUD, task CRUD, and drag-and-drop flows

## Tech Stack

- React
- TypeScript
- Vite
- TailwindCSS
- dnd-kit
- React Router v7
- Supabase
- Playwright
- ESLint

## Project Structure

```txt
src/
  404/          Not found route
  board/        Board page, board hooks, board components, board storage
  lib/          Supabase client, generated database types, local data mode
  login/        Auth hooks, login page, local auth storage
  task/         Task hooks, task components, task storage
  utils/        Web vitals reporting
e2e/            Playwright end-to-end tests
public/         Static assets
```

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

### Lint

```bash
npm run lint
```

### End-to-end tests

```bash
npm run test:e2e
```

The Playwright tests enable local data mode by setting `kanban-board:e2e` in `localStorage`, so the test flow does not depend on a live Supabase session.

---

# Kanban Board 中文說明

這是一個使用 React、TypeScript、Vite、TailwindCSS、dnd-kit、React Router 和 Supabase 建立的 Kanban 任務管理專案。

專案重點是實作實用的看板工作流程：使用者登入後可以建立 board、管理 task，並透過拖拉操作更新 task 狀態。專案也提供 LocalStorage 模式，讓 Playwright e2e 測試可以穩定執行，不依賴真實 Supabase session。

## 功能

- 使用 Supabase Auth 實作 Email/password 登入
- 使用 React Router 實作受保護的 board 頁面
- Board CRUD：建立、編輯、刪除、切換 board
- Task CRUD：建立、編輯、刪除、移動 task 狀態
- 使用 dnd-kit 實作拖拉更新 task 狀態
- 使用 optimistic UI update 提升操作回饋速度
- 使用 Supabase 儲存 boards 與 tasks
- 提供 LocalStorage-backed e2e mode，讓測試流程更穩定
- 使用 TailwindCSS 建立響應式介面
- 使用 Playwright 測試登入、board CRUD、task CRUD、拖拉流程

## 技術棧

- React
- TypeScript
- Vite
- TailwindCSS
- dnd-kit
- React Router v7
- Supabase
- Playwright
- ESLint

## 專案結構

```txt
src/
  404/          404 頁面
  board/        Board 頁面、hooks、components、storage
  lib/          Supabase client、資料庫型別、local data mode
  login/        Auth hooks、登入頁、local auth storage
  task/         Task hooks、components、storage
  utils/        Web vitals 回報
e2e/            Playwright end-to-end tests
public/         靜態資源
```

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

### Lint

```bash
npm run lint
```

### End-to-end 測試

```bash
npm run test:e2e
```

Playwright 測試會在 `localStorage` 設定 `kanban-board:e2e`，讓測試改用本機資料模式，因此不需要依賴實際 Supabase 登入 session。
