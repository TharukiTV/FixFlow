import { test, expect } from '@playwright/test'

test('technician can inspect past fixes, empty results, and retry errors', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ json: { email: 'tech@example.test', name: 'Tech', role: 'TECHNICIAN' } }))
  let attempt = 0
  await page.route('**/api/incidents**', route => {
    if (route.request().url().endsWith('/similar-fixes')) {
      attempt++
      if (attempt === 1) return route.fulfill({ status: 503, json: {} })
      return route.fulfill({ json: attempt === 2 ? [{ id: 2, description: 'Projector disconnected', cause: 'Loose cable', resolution: 'Reconnected and tested' }] : [] })
    }
    return route.fulfill({ json: [{ id: 1, description: 'Projector disconnecting', location: 'Lab', status: 'OPEN', createdAt: '2026-09-12T00:00:00Z', assignedTechnician: 'tech@example.test' }] })
  })
  await page.goto('/')
  const section = page.getByRole('region', { name: 'Similar past fixes' })
  const button = section.getByRole('button', { name: 'Find similar past fixes' })
  await button.click()
  await expect(section.getByRole('alert')).toBeVisible()
  await button.click()
  await section.locator('summary').click()
  await expect(section).toContainText('Reconnected and tested')
  await button.click()
  await expect(section).toContainText('No matching resolved tickets')
  await expect(section.locator('summary')).toHaveCount(0)
})
