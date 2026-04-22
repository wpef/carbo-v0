// Live Salesforce tests — hit the real Salesforce API via a pre-seeded
// connection. Skipped if .env.test does not contain SF_TEST_ACCESS_TOKEN.
//
// How to populate the credentials:
//   1. `npm run dev -- -p 3001`
//   2. Create a plan in the UI, click "Connect with OAuth" on the source step,
//      complete the Salesforce login in your browser.
//   3. Run `npm run dump:test-conn -- <planId>`
//   4. Copy the printed SF_TEST_* lines into .env.test.

import { test, expect } from '@playwright/test'
import { loadTestEnv } from './helpers/env'
import { createPlan, deletePlan, seedSalesforceSource } from './helpers/db'

const { hasSfCredentials } = loadTestEnv()

test.describe('Salesforce (live)', () => {
  test.skip(!hasSfCredentials, 'Set SF_TEST_ACCESS_TOKEN in .env.test to run.')

  let planId: string

  test.beforeEach(async () => {
    planId = await createPlan('E2E SF live ' + Date.now())
    await seedSalesforceSource(planId)
  })

  test.afterEach(async () => {
    await deletePlan(planId)
  })

  test('retrieves schema from real Salesforce org', async ({ request }) => {
    const res = await request.post(`/api/plans/${planId}/source/schema`)
    expect(res.status(), await res.text()).toBe(201)

    const body = (await res.json()) as {
      snapshot: { objectCount: number }
      objects: Array<{ apiName: string; label: string }>
    }
    expect(body.snapshot.objectCount).toBeGreaterThan(0)
    // Every Salesforce org has Contact and Account.
    expect(body.objects.some((o) => o.apiName === 'Contact')).toBeTruthy()
    expect(body.objects.some((o) => o.apiName === 'Account')).toBeTruthy()
  })
})
