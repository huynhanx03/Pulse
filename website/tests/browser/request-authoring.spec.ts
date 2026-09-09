import { expect, test } from '@playwright/test'

test('keeps authoring focused and sends from the JSON editor with a shortcut', async ({ page }) => {
  await page.goto('/w/ws-core/request/req-login')

  await page.getByRole('textbox', { name: 'Body', exact: true }).press('ControlOrMeta+Enter')
  await expect(page.getByRole('region', { name: 'Response', exact: true })).toContainText('200 OK')
})
