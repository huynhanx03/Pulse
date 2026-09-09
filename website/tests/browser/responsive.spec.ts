import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })

test('keeps core HTTP actions and mobile navigation reachable', async ({ page }) => {
  await page.goto('/w/ws-core/request/req-login')
  await expect(page.getByRole('button', { name: 'Gửi yêu cầu' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible()
  await page.getByRole('button', { name: 'Mở trình khám phá' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: /Get profile/ }).click()
  await expect(page.getByRole('textbox', { name: 'Endpoint' })).toHaveValue(/users\/me/)
})

test('keeps data profile titles and actions readable on mobile', async ({ page }) => {
  await page.goto('/w/ws-core/datasets')
  await page.getByRole('button', { name: 'Ngôn ngữ', exact: true }).click()
  const heading = page.getByRole('heading', { name: 'Data Studio', exact: true })
  const action = page.getByRole('button', { name: 'New profile', exact: true })
  const geometry = await heading.evaluate((title) => {
    const header = title.closest('header')!
    const action = header.querySelector('button')!
    return {
      titleWidth: title.getBoundingClientRect().width,
      titleScrollWidth: title.scrollWidth,
      actionHeight: action.getBoundingClientRect().height,
    }
  })
  expect(geometry.titleWidth).toBeGreaterThanOrEqual(120)
  expect(geometry.titleScrollWidth).toBeLessThanOrEqual(geometry.titleWidth + 1)
  expect(geometry.actionHeight).toBeGreaterThanOrEqual(40)
  await expect(action).toBeVisible()
})
