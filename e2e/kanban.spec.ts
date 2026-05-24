import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

const login = async (page: Page) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('tester@example.com')
  await page.getByLabel('密碼').fill('password')
  await page.getByRole('button', { name: '登入' }).click()
  await expect(page).toHaveURL(/\/board$/)
}

const createBoard = async (page: Page, name: string) => {
  await page.getByLabel('Board 名稱').fill(name)
  await page
    .getByLabel('描述')
    .first()
    .fill(`${name} description`)
  await page.getByRole('button', { name: '建立 board' }).click()
  await expect(page.getByRole('heading', { level: 2, name })).toBeVisible()
}

const createTask = async (page: Page, statusName: string, title: string) => {
  const statusColumn = page.getByLabel(`${statusName} 欄位`)

  await statusColumn.getByRole('button', { name: '新增 task' }).click()
  await page.getByLabel('Task 標題').fill(title)
  await page.getByLabel('描述').last().fill(`${title} description`)
  await page.getByRole('button', { name: '建立 task' }).click()
  await expect(
    statusColumn.getByRole('button', { name: `Task ${title}` }),
  ).toBeVisible()
}

const dragTo = async (page: Page, source: Locator, target: Locator) => {
  const sourceBox = await source.boundingBox()
  const targetBox = await target.boundingBox()

  if (!sourceBox || !targetBox) {
    throw new Error('Unable to calculate drag target boxes')
  }

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 10 },
  )
  await page.mouse.up()
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear()
  })
})

test('redirects protected board route to login and supports login/logout', async ({
  page,
}) => {
  await page.goto('/board')
  await expect(page).toHaveURL(/\/login$/)

  await page.getByLabel('Email').fill('tester@example.com')
  await page.getByLabel('密碼').fill('password')
  await page.getByRole('button', { name: '登入' }).click()

  await expect(page).toHaveURL(/\/board$/)
  await expect(page.getByRole('heading', { name: 'Board 管理' })).toBeVisible()
  await expect(page.getByText('tester@example.com')).toBeVisible()

  await page.getByRole('button', { name: '登出' }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('creates, updates, and deletes a board from the current UI', async ({
  page,
}) => {
  await login(page)
  await createBoard(page, '產品開發')

  const boardCard = page.getByRole('article', { name: 'Board 產品開發' })
  await boardCard.getByRole('button', { name: '修改' }).click()

  const editBoardForm = page.locator('form').filter({
    hasText: '儲存修改',
  })
  await editBoardForm.getByLabel('Board 名稱').fill('產品開發 v2')
  await editBoardForm.getByLabel('描述').fill('更新後的 board 描述')
  await editBoardForm.getByRole('button', { name: '儲存修改' }).click()

  await expect(
    page.getByRole('heading', { level: 2, name: '產品開發 v2' }),
  ).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await page
    .getByRole('article', { name: 'Board 產品開發 v2' })
    .getByRole('button', { name: '刪除' })
    .click()

  await expect(page.getByText('尚未建立 board')).toBeVisible()
})

test('creates, edits, and deletes tasks from the current UI', async ({
  page,
}) => {
  await login(page)
  await createBoard(page, 'Task Flow')
  await createTask(page, '尚未開始', '設計登入流程')

  const todoColumn = page.getByLabel('尚未開始 欄位')
  const inProgressColumn = page.getByLabel('進行中 欄位')
  const originalTaskButton = todoColumn.getByRole('button', {
    name: 'Task 設計登入流程',
  })

  await originalTaskButton.getByRole('button', { name: '修改' }).click()
  await page.getByLabel('Task 標題').fill('設計登入流程 v2')
  await page.getByLabel('狀態').selectOption('inProgress')
  await page.getByRole('button', { name: '儲存修改' }).click()

  const editedTask = inProgressColumn.getByRole('button', {
    name: 'Task 設計登入流程 v2',
  })
  await expect(editedTask).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await editedTask.getByRole('button', { name: '刪除' }).click()

  await expect(inProgressColumn.getByText('尚無 task')).toBeVisible()
})

test('drags a task between board statuses', async ({ browserName, page }) => {
  test.skip(
    browserName === 'webkit',
    'WebKit headless does not reliably dispatch this pointer-based dnd-kit drag flow.',
  )

  await login(page)
  await createBoard(page, 'Drag Flow')
  await createTask(page, '尚未開始', '拖曳測試 task')

  const todoColumn = page.getByLabel('尚未開始 欄位')
  const doneColumn = page.getByLabel('已完成 欄位')
  const task = todoColumn.getByRole('button', {
    name: 'Task 拖曳測試 task',
  })

  await dragTo(page, task, doneColumn)

  await expect(
    doneColumn.getByRole('button', { name: 'Task 拖曳測試 task' }),
  ).toBeVisible()
})
