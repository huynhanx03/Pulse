import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/w/ws-core/request/req-login')
  await page.getByRole('button', { name: 'Ngôn ngữ', exact: true }).click()
})

test('previews cURL imports, rejects bad syntax, and applies a valid request', async ({ page }) => {
  const requestRegion = page.getByRole('region', { name: 'Login', exact: true })
  const requestActions = requestRegion.getByRole('button', {
    name: 'More actions',
    exact: true,
  })
  await requestActions.click()
  await page.getByRole('menuitem', { name: 'Import cURL' }).click()
  const dialog = page.getByRole('dialog', { name: 'Import cURL' })
  const editor = dialog.getByRole('textbox', { name: 'cURL', exact: true })
  await editor.fill('curl --not-supported https://example.test')
  await expect(dialog.getByRole('button', { name: 'Import', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('status')).toContainText('Invalid cURL')
  await editor.fill(
    `curl -XPOST https://example.test/orders -H 'Content-Type: application/json' --data-raw '{"quantity":3}'`,
  )
  await expect(dialog.getByRole('status')).toContainText('ready to import')
  await dialog.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Endpoint', exact: true })).toHaveValue(
    'https://example.test/orders',
  )
  await expect(page.getByRole('textbox', { name: 'Body', exact: true })).toContainText(
    '"quantity":3',
  )
  await expect(requestActions).toBeFocused()
})

test('creates a data profile and preserves its generated sample', async ({ page }) => {
  await page.getByRole('link', { name: 'Data', exact: true }).click()
  await page.getByRole('button', { name: 'New profile', exact: true }).click()
  await page.getByRole('button', { name: 'Add field', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await page.getByRole('button', { name: 'Generate sample', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Generated sample', exact: true })).toBeVisible()
})

test('pauses and stops a run without reporting future work', async ({ page }) => {
  await page.getByRole('link', { name: 'Runner', exact: true }).click()
  await page.getByRole('button', { name: 'Start run', exact: true }).click()
  const progress = page.getByRole('progressbar')
  await expect(progress).not.toHaveAttribute('aria-valuenow', '0')
  await page.getByRole('button', { name: 'Pause run', exact: true }).click()
  const frozen = await progress.getAttribute('aria-valuenow')
  await expect(page.getByRole('button', { name: /Race condition/ })).toBeDisabled()
  // The simulated clock advances every 300 ms; pausing must span multiple ticks.
  await page.waitForTimeout(650)
  await expect(progress).toHaveAttribute('aria-valuenow', frozen!)
  await page.getByRole('button', { name: 'Stop run', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Start run', exact: true })).toBeVisible()
  expect(Number(await progress.getAttribute('aria-valuenow'))).toBeLessThan(100)
})

test('saves a scheduled operation without navigating away', async ({ page }) => {
  await page.getByRole('link', { name: 'Scheduled', exact: true }).click()
  await page.getByRole('button', { name: 'New schedule', exact: true }).click()
  await page.getByRole('button', { name: 'Rename schedule', exact: true }).click()
  const name = page.getByRole('textbox', { name: 'Schedule name', exact: true })
  await name.fill('Nightly profile check')
  await page.getByRole('button', { name: 'Save name', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Nightly profile check', exact: true }),
  ).toBeVisible()
})

test('honors a gRPC deadline and never presents the error as a successful stream', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'RPC Watch profiles', exact: true }).click()
  await expect(page).toHaveURL(/\/grpc\/req-grpc-profile$/)
  await expect(page.getByRole('button', { name: 'Invoke RPC', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Settings', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Deadline', exact: true }).fill('5')
  await page.getByRole('button', { name: 'Invoke RPC', exact: true }).click()
  await expect(page.getByText('DEADLINE_EXCEEDED', { exact: true })).toBeVisible()
  await expect(page.getByText('IN', { exact: true })).toHaveCount(0)
  await expect(page.getByText('grpc-status: 4 (DEADLINE_EXCEEDED)', { exact: true })).toBeVisible()
})
