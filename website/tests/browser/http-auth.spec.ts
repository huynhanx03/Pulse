import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/w/ws-core/request/req-login')
  await expect(page.getByRole('main')).toBeVisible()
})

test('captures Login tokens while keeping secret values redacted', async ({ page }) => {
  await page.getByRole('button', { name: 'Gửi yêu cầu' }).click()
  await expect(page.getByText('200 OK', { exact: false })).toBeVisible()
  await expect(page.getByText('[redacted]', { exact: false })).toBeVisible()
  await expect(page.getByText('demo-access', { exact: false })).toHaveCount(0)

  await page.getByRole('link', { name: 'Biến' }).click()
  await expect(page.getByRole('heading', { name: 'Variables & Environments' })).toBeVisible()
  await expect(page.locator('input[value="access_token"]')).toBeVisible()
})

test('switches language and theme without reloading', async ({ page }) => {
  await page.getByRole('button', { name: 'Ngôn ngữ' }).click()
  await expect(page.getByRole('button', { name: 'Send request' })).toBeVisible()

  const root = page.locator('html')
  await page.getByRole('button', { name: 'System' }).click()
  await expect(page.getByRole('button', { name: 'Light' })).toBeVisible()
  await page.getByRole('button', { name: 'Light' }).click()
  await expect(root).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Send request' })).toBeVisible()
  await expect(root).toHaveAttribute('data-theme', 'dark')
})
