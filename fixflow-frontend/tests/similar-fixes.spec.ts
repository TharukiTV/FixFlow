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


test('Gemini explanations and explicit text fallback', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ json: { email: 'tech@example.test', name: 'Tech', role: 'TECHNICIAN' } }))
  await page.route('**/api/auth/csrf', route => route.fulfill({ json: { headerName: 'X-CSRF-TOKEN', token: 'test' } }))
  let attempt = 0
  await page.route('**/api/incidents**', route => {
    if (route.request().method() === 'POST') {
      attempt++
      return route.fulfill({ json: { mode: attempt === 1 ? 'GEMINI' : 'TEXT', notice: attempt === 1 ? 'Gemini relevance suggestions.' : 'Gemini unavailable. Showing text matches.', matches: [{ fix: { id: 2, description: 'Wi-Fi disconnects', cause: 'Unknown', resolution: 'Restarted and tested' }, explanation: attempt === 1 ? 'Both report lost connectivity.' : null }] } })
    }
    return route.fulfill({ json: [{ id: 1, description: 'Internet drops', location: 'Lab', status: 'OPEN', createdAt: '2026-09-12T00:00:00Z', assignedTechnician: 'tech@example.test' }] })
  })
  await page.goto('/')
  const region = page.getByRole('region', { name: 'Similar past fixes' })
  await region.getByRole('button', { name: 'Compare with Gemini' }).click()
  await region.locator('summary').click()
  await expect(region).toContainText('Both report lost connectivity.')
  await region.getByRole('button', { name: 'Compare with Gemini' }).click()
  await expect(region).toContainText('Gemini unavailable. Showing text matches.')
  await expect(region.getByText('Both report lost connectivity.')).toHaveCount(0)
})
