import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 812, height: 375 } })

test('uses the compact mobile shell when a tablet viewport is too short for the desktop rail', async ({
  page,
}) => {
  await page.goto('/w/ws-core/request/req-login')
  await expect(page.getByRole('button', { name: 'Mở trình khám phá', exact: true })).toBeVisible()
  await expect(page.locator('.desktop-activity-rail')).toBeHidden()
  await expect(page.locator('.desktop-explorer')).toBeHidden()
  const mobileNavigation = page.locator('.mobile-activity-rail')
  await expect(mobileNavigation).toBeVisible()

  const geometry = await page.evaluate(() => {
    const main = document.querySelector('main')!.getBoundingClientRect()
    const navigation = document.querySelector('.mobile-activity-rail')!.getBoundingClientRect()
    return {
      viewportWidth: window.innerWidth,
      pageWidth: document.documentElement.scrollWidth,
      mainBottom: main.bottom,
      navigationTop: navigation.top,
    }
  })
  expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth)
  expect(geometry.mainBottom).toBeLessThanOrEqual(geometry.navigationTop + 1)

  await page.getByRole('button', { name: 'Mở trình khám phá', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Trình khám phá', exact: true })).toBeVisible()
})
