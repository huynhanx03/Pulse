import { expect, test } from '@playwright/test'

test('drives client-stream messages through the real session lifecycle', async ({ page }) => {
  await page.goto('/w/ws-core/grpc/req-grpc-profile')
  await page.getByRole('button', { name: 'Phương thức RPC' }).click()
  await page.getByRole('option', { name: /ImportProfiles/ }).click()
  await page.getByRole('button', { name: 'Invoke RPC' }).click()
  await expect(page.getByText('STREAMING', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Gửi message' }).click()
  await expect(page.getByText('OUT', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Half-close client' }).click()
  await expect(page.getByText('OK', { exact: true })).toBeVisible()
  await expect(page.getByText('IN', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Xóa stream' })).toBeVisible()
})

test('runs a synchronized race and records collisions', async ({ page }) => {
  await page.goto('/w/ws-core/runner')
  await page.getByRole('button', { name: 'Bắt đầu chạy' }).click()
  await expect(page.getByRole('progressbar', { name: 'Tiến độ run' })).toHaveAttribute(
    'aria-valuenow',
    '100',
  )
  await expect(page.getByText('mock:Create order')).toBeVisible()

  await page.getByRole('link', { name: 'Lịch sử' }).click()
  await page.getByRole('tab', { name: /Lượt chạy kiểm thử/ }).click()
  await expect(page.getByText(/Create order · race/)).toBeVisible()
})
