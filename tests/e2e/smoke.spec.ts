// Smoke tests — verify the app boots and the OAuth initiation routes behave
// correctly without actually completing the OAuth dance. These run without
// any external credentials.

import { test, expect } from '@playwright/test'

test('home page renders the plan list', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Migration Plans' })).toBeVisible()
})

test('SF auth route redirects to Salesforce login when creds configured', async ({ page, request }) => {
  // Need a planId for the auth route to accept the request.
  const create = await request.post('/api/plans', {
    data: { name: 'E2E smoke plan' },
  })
  expect(create.ok()).toBeTruthy()
  const { id: planId } = (await create.json()) as { id: string }

  // Hitting /auth should either 302 to login.salesforce.com OR return
  // MISSING_ENV if SF_CLIENT_ID is not set. Both are valid smoke outcomes.
  const res = await page.request.get(`/api/connectors/salesforce/auth?planId=${planId}`, {
    maxRedirects: 0,
  })
  if (res.status() === 302 || res.status() === 307) {
    const location = res.headers()['location'] ?? ''
    expect(location).toContain('salesforce.com/services/oauth2/authorize')
    expect(location).toContain('code_challenge=')
    expect(location).toContain('code_challenge_method=S256')
  } else {
    expect(res.status()).toBe(500)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('MISSING_ENV')
  }

  // Cleanup.
  await request.delete(`/api/plans/${planId}`).catch(() => undefined)
})

test('HS auth route redirects to HubSpot OAuth when creds configured', async ({ page, request }) => {
  const create = await request.post('/api/plans', {
    data: { name: 'E2E smoke plan HS' },
  })
  expect(create.ok()).toBeTruthy()
  const { id: planId } = (await create.json()) as { id: string }

  const res = await page.request.get(`/api/connectors/hubspot/auth?planId=${planId}`, {
    maxRedirects: 0,
  })
  if (res.status() === 302 || res.status() === 307) {
    const location = res.headers()['location'] ?? ''
    expect(location).toContain('app.hubspot.com/oauth/authorize')
  } else {
    expect(res.status()).toBe(500)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('MISSING_ENV')
  }

  await request.delete(`/api/plans/${planId}`).catch(() => undefined)
})
