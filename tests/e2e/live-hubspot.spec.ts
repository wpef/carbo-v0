// Live HubSpot tests — hit the real HubSpot API via a pre-seeded connection.
// Skipped if .env.test does not contain HS_TEST_ACCESS_TOKEN.

import { test, expect } from '@playwright/test'
import { loadTestEnv } from './helpers/env'
import { createPlan, deletePlan, seedHubSpotDestination } from './helpers/db'

const { hasHsCredentials } = loadTestEnv()

test.describe('HubSpot (live)', () => {
  test.skip(!hasHsCredentials, 'Set HS_TEST_ACCESS_TOKEN in .env.test to run.')

  let planId: string

  test.beforeEach(async () => {
    planId = await createPlan('E2E HS live ' + Date.now())
    await seedHubSpotDestination(planId)
  })

  test.afterEach(async () => {
    await deletePlan(planId)
  })

  test('retrieves schema from real HubSpot portal', async ({ request }) => {
    const res = await request.post(`/api/plans/${planId}/destination-schema`)
    expect(res.status(), await res.text()).toBe(201)

    const body = (await res.json()) as {
      snapshot: { objectCount: number }
      objects: Array<{ apiName: string; label: string }>
    }
    expect(body.snapshot.objectCount).toBeGreaterThan(0)
    // HubSpot standard objects.
    expect(body.objects.some((o) => o.apiName === 'contacts')).toBeTruthy()
    expect(body.objects.some((o) => o.apiName === 'companies')).toBeTruthy()
  })
})
