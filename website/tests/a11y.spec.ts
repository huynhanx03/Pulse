import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Theme-switch colour transitions should settle before measuring contrast.
test.use({ contextOptions: { reducedMotion: 'reduce' } })

const settleFiniteAnimations = async (page: Page) => {
  await page.evaluate(async () => {
    const finite = document
      .getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
    await Promise.race([
      Promise.all(finite.map((animation) => animation.finished.catch(() => undefined))),
      new Promise<void>((resolve) => window.setTimeout(resolve, 750)),
    ])
  })
}

const routes = [
  '/w/ws-core/request/req-login',
  '/w/ws-core/grpc/req-grpc-profile',
  '/w/ws-core/variables',
  '/w/ws-core/datasets',
  '/w/ws-core/automations',
  '/w/ws-core/runner',
  '/w/ws-core/runs',
]

for (const locale of ['vi', 'en'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    for (const route of routes) {
      test(`${locale} ${theme}: ${route}`, async ({ page }) => {
        await page.goto(route)
        await expect(page.getByRole('main')).toBeVisible()
        await page
          .getByRole('banner')
          .getByRole('button', { name: 'Theo hệ thống', exact: true })
          .click()
        if (theme === 'dark')
          await page.getByRole('banner').getByRole('button', { name: 'Sáng', exact: true }).click()
        if (locale === 'en')
          await page.getByRole('button', { name: 'Ngôn ngữ', exact: true }).click()
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        await settleFiniteAnimations(page)
        const results = await new AxeBuilder({ page }).include('#root').analyze()
        if (results.violations.length > 0) {
          console.log(
            JSON.stringify(
              {
                route,
                theme,
                violations: results.violations.map((violation) => ({
                  id: violation.id,
                  impact: violation.impact,
                  count: violation.nodes.length,
                  nodes: violation.nodes
                    .slice(0, 6)
                    .map((node) => ({ target: node.target, summary: node.failureSummary })),
                })),
              },
              null,
              2,
            ),
          )
        }
        expect(
          results.violations.map((violation) => ({
            id: violation.id,
            nodes: violation.nodes.map((node) => node.target),
          })),
        ).toEqual([])
      })
    }
  }
}

for (const theme of ['light', 'dark'] as const) {
  test(`interactive HTTP response, actions and dialog: ${theme}`, async ({ page }) => {
    await page.goto('/w/ws-core/request/req-login')
    await page.getByRole('button', { name: 'Ngôn ngữ', exact: true }).click()
    await page.getByRole('banner').getByRole('button', { name: 'System', exact: true }).click()
    if (theme === 'dark')
      await page.getByRole('banner').getByRole('button', { name: 'Light', exact: true }).click()
    await page.getByRole('button', { name: 'Send request' }).click()
    await expect(page.getByText('200 OK', { exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Headers', exact: true }).click()
    await settleFiniteAnimations(page)
    expect(
      (await new AxeBuilder({ page }).include('#root').analyze()).violations.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => node.target),
      })),
    ).toEqual([])
    await page
      .getByRole('region', { name: 'Login', exact: true })
      .getByRole('button', { name: 'More actions', exact: true })
      .click()
    await page.getByRole('menuitem', { name: 'Generate code' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(
      (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations.map(
        (item) => ({ id: item.id, nodes: item.nodes.map((node) => node.target) }),
      ),
    ).toEqual([])
  })

  test(`interactive gRPC stream: ${theme}`, async ({ page }) => {
    await page.goto('/w/ws-core/grpc/req-grpc-profile')
    await page.getByRole('button', { name: 'Ngôn ngữ', exact: true }).click()
    await page.getByRole('banner').getByRole('button', { name: 'System', exact: true }).click()
    if (theme === 'dark')
      await page.getByRole('banner').getByRole('button', { name: 'Light', exact: true }).click()
    await page.getByRole('button', { name: 'Invoke RPC' }).click()
    await expect(page.getByText('OK', { exact: true })).toBeVisible()
    await settleFiniteAnimations(page)
    expect(
      (await new AxeBuilder({ page }).include('#root').analyze()).violations.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => node.target),
      })),
    ).toEqual([])
  })
}
