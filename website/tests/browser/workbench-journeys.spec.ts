import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/w/ws-core/request/req-login')
  await page.getByRole('button', { name: 'Ngôn ngữ' }).click()
})

test('saves and closes a dirty tab without reopening it or losing its edits', async ({ page }) => {
  await page
    .getByRole('complementary', { name: 'Explorer', exact: true })
    .getByText('Get profile')
    .click()
  await expect(page).toHaveURL(/\/request\/req-profile$/)
  const endpoint = page.getByRole('textbox', { name: 'Endpoint', exact: true })
  await expect(endpoint).toHaveValue(/users\/me/)
  await endpoint.fill('https://demo.internal/updated')
  await expect(page.getByRole('button', { name: 'Save request' })).toBeEnabled()
  await page.getByRole('button', { name: 'Close tab: Get profile' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.getByRole('button', { name: 'Save & close', exact: true }).click()
  await expect(page).toHaveURL(/\/request\/req-login$/)
  await expect(
    page.getByRole('navigation', { name: 'requests', exact: true }).getByText('Get profile'),
  ).toHaveCount(0)
  await page
    .getByRole('complementary', { name: 'Explorer', exact: true })
    .getByText('Get profile')
    .click()
  await expect(page.getByRole('textbox', { name: 'Endpoint', exact: true })).toHaveValue(
    'https://demo.internal/updated',
  )
})

test('supports keyboard tab navigation and exposes validation errors', async ({ page }) => {
  await page.locator('[data-request-tab]', { hasText: 'Login' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(/\/request\/req-profile$/)
  const endpoint = page.getByRole('textbox', { name: 'Endpoint', exact: true })
  await expect(endpoint).toHaveValue(/users\/me/)
  await endpoint.fill('not-a-url')
  await page.getByRole('button', { name: 'Send request', exact: true }).click()
  await expect(
    page
      .getByRole('region', { name: 'Response', exact: true })
      .getByText('Enter a valid HTTP(S) URL or gRPC endpoint'),
  ).toBeVisible()
})
