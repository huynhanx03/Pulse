import { expect, test } from '@playwright/test'

const routes = [
  'request/req-login',
  'grpc/req-grpc-profile',
  'variables',
  'datasets',
  'automations',
  'runner',
  'runs',
]

for (const width of [375, 768, 1024, 1440, 1920]) {
  test(`all main pages reflow at ${width}px without page-wide overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    for (const route of routes) {
      await page.goto(`/w/ws-core/${route}`)
      await expect(page.getByRole('main')).toBeVisible()
      const layout = await page.evaluate(() => ({
        width: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        overflowingPanels: Array.from(document.querySelectorAll('main section'))
          .filter((panel) => {
            const rect = panel.getBoundingClientRect()
            return rect.width > 0 && rect.right > window.innerWidth + 1
          })
          .map(
            (panel) => panel.querySelector('h2')?.textContent ?? panel.getAttribute('aria-label'),
          ),
      }))
      expect(layout.scrollWidth, route).toBeLessThanOrEqual(layout.width)
      expect(layout.overflowingPanels, route).toEqual([])
    }
    expect(errors).toEqual([])
  })

  for (const locale of ['vi', 'en']) {
    test(`Auth heading stays readable and actions do not overlap at ${width}px in ${locale}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/w/ws-core/automations')
      if (locale === 'en') await page.getByRole('button', { name: 'Ngôn ngữ', exact: true }).click()
      const heading = page.getByRole('main').getByRole('heading', { level: 1 })
      await expect(heading).toBeVisible()
      const layout = await heading.evaluate((title) => {
        const header = title.closest('header')
        const copy = title.parentElement
        const actions = header?.lastElementChild
        if (!header || !copy || !actions || actions === copy)
          throw new Error('Heading actions are missing')
        const headerRect = header.getBoundingClientRect()
        const copyRect = copy.getBoundingClientRect()
        const actionsRect = actions.getBoundingClientRect()
        const style = getComputedStyle(header)
        return {
          availableWidth:
            headerRect.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
          copyWidth: copyRect.width,
          titleHeight: title.getBoundingClientRect().height,
          titleLineHeight: parseFloat(getComputedStyle(title).lineHeight),
          copyRight: copyRect.right,
          copyBottom: copyRect.bottom,
          actionsLeft: actionsRect.left,
          actionsTop: actionsRect.top,
          contentBottom: Math.max(copyRect.bottom, actionsRect.bottom),
          headerBottom: headerRect.bottom,
        }
      })
      expect(
        layout.copyWidth,
        'Heading copy must not collapse to a skinny column',
      ).toBeGreaterThanOrEqual(Math.min(280, layout.availableWidth))
      expect(
        layout.titleHeight,
        'The page title should remain readable in at most two lines',
      ).toBeLessThanOrEqual(layout.titleLineHeight * 2)
      expect(
        layout.actionsLeft >= layout.copyRight || layout.actionsTop >= layout.copyBottom,
        'Actions must sit beside or below the heading copy',
      ).toBe(true)
      expect(
        layout.contentBottom,
        'Wrapped header content must not be compressed out of its header',
      ).toBeLessThanOrEqual(layout.headerBottom)
      if (width >= 1440) {
        expect(
          layout.actionsLeft,
          'Wide desktop headers should keep actions alongside the copy',
        ).toBeGreaterThanOrEqual(layout.copyRight)
      }
    })
  }
}
