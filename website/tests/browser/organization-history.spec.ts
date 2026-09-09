import { expect, test, type Locator, type Page } from '@playwright/test'

const chooseOption = async (page: Page, select: Locator, name: string) => {
  await select.click()
  await page.getByRole('option', { name, exact: true }).click()
}

const openEnglishWorkbench = async (page: Page) => {
  await page.goto('/w/ws-core/request/req-login')
  await page.getByRole('button', { name: 'Ngôn ngữ', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Send request', exact: true })).toBeVisible()
}

test('creates collection structure and moves a request into the chosen folder', async ({
  page,
}) => {
  await openEnglishWorkbench(page)
  const explorer = page.getByRole('complementary', { name: 'Explorer', exact: true })

  await explorer.getByRole('button', { name: 'New request', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Create collection', exact: true }).click()
  const collectionDialog = page.getByRole('dialog', { name: 'Create collection', exact: true })
  await collectionDialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Payments')
  await collectionDialog.getByRole('button', { name: 'Create', exact: true }).click()
  const collectionButton = explorer.getByRole('button', { name: 'Payments', exact: true })
  await expect(collectionButton).toBeVisible()

  await explorer.getByRole('button', { name: 'New request', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Create folder', exact: true }).click()
  const folderDialog = page.getByRole('dialog', { name: 'Create folder', exact: true })
  await chooseOption(
    page,
    folderDialog.getByRole('combobox', { name: 'Collection', exact: true }),
    'Payments',
  )
  await folderDialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Refunds')
  await folderDialog.getByRole('button', { name: 'Create', exact: true }).click()

  const requestRegion = page.getByRole('region', { name: 'Login', exact: true })
  await requestRegion.getByRole('button', { name: 'More actions', exact: true }).click()
  await page.getByRole('menuitem', { name: /^Move to/ }).hover()
  const refundsDestination = page.getByRole('menuitem', { name: 'Refunds', exact: true })
  await expect(refundsDestination).toBeVisible()
  await refundsDestination.click({ force: true })

  await expect(explorer.getByRole('button', { name: 'Refunds', exact: true })).toBeVisible()
  await expect(explorer.getByRole('button', { name: /^POST\s+Login/ })).toBeVisible()

  await page.reload()
  await expect(explorer.getByRole('button', { name: 'Payments', exact: true })).toBeVisible()
  await expect(explorer.getByRole('button', { name: 'Refunds', exact: true })).toBeVisible()
  await expect(explorer.getByRole('button', { name: /^POST\s+Login/ })).toBeVisible()
})
