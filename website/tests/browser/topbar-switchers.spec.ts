import { expect, test } from '@playwright/test'

test('switches mock workspaces and opens environment variable management from the top bar', async ({
  page,
}) => {
  await page.goto('/w/ws-core/request/req-login')

  await page.getByRole('button', { name: 'Chuyển workspace' }).click()
  await expect(page.getByRole('menuitem', { name: /Reliability Lab/ })).toBeVisible()
  await page.getByRole('menuitem', { name: /Reliability Lab/ }).click()
  await expect(page).toHaveURL(/\/w\/ws-reliability\/request\/req-login$/)

  await page.getByRole('button', { name: 'Environment đang dùng' }).click()
  await expect(page.getByText('10 biến')).toBeVisible()
  await page.getByRole('menuitem', { name: /Local/ }).click()
  await expect(page.getByRole('button', { name: 'Environment đang dùng' })).toContainText('Local')

  await page.getByRole('button', { name: 'Environment đang dùng' }).click()
  await page.getByRole('menuitem', { name: 'Quản lý environment & biến' }).click()
  await expect(page).toHaveURL(/\/w\/ws-reliability\/variables$/)
})
