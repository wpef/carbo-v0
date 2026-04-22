// Test helpers that talk directly to the Prisma DB used by the app.
// Used to seed plans and pre-authenticated connections so E2E tests can
// exercise real SF/HS API calls without running the OAuth dance every time.

import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient | undefined

export function db(): PrismaClient {
  if (!prisma) prisma = new PrismaClient()
  return prisma
}

export async function createPlan(name = `E2E test plan ${Date.now()}`): Promise<string> {
  const plan = await db().migrationPlan.create({
    data: { name, description: 'Created by Playwright E2E suite' },
  })
  return plan.id
}

export async function deletePlan(planId: string): Promise<void> {
  await db().migrationPlan.delete({ where: { id: planId } }).catch(() => undefined)
}

/**
 * Seed a Salesforce source connection with real tokens obtained from a prior
 * manual OAuth flow. The tokens live in .env.test as SF_TEST_ACCESS_TOKEN etc.
 * Returns the planId so the test can chain navigation.
 */
export async function seedSalesforceSource(planId: string): Promise<void> {
  const accessToken = process.env.SF_TEST_ACCESS_TOKEN
  const instanceUrl = process.env.SF_TEST_INSTANCE_URL
  const refreshToken = process.env.SF_TEST_REFRESH_TOKEN
  if (!accessToken || !instanceUrl) {
    throw new Error(
      'SF_TEST_ACCESS_TOKEN / SF_TEST_INSTANCE_URL missing — run the manual OAuth smoke-test first and copy the values into .env.test',
    )
  }
  const config = {
    instanceUrl,
    accessToken,
    refreshToken,
    // 30 min from now, matches what the real callback would write.
    tokenExpiresAt: new Date(Date.now() + 28 * 60 * 1000).toISOString(),
    orgName: process.env.SF_TEST_ORG_NAME ?? 'E2E Salesforce Org',
  }
  await db().sourceConnection.upsert({
    where: { planId },
    create: {
      planId,
      adapterType: 'salesforce',
      status: 'CONNECTED',
      config: JSON.stringify(config),
      connectedAt: new Date(),
    },
    update: {
      status: 'CONNECTED',
      config: JSON.stringify(config),
      connectedAt: new Date(),
    },
  })
}

export async function seedHubSpotDestination(planId: string): Promise<void> {
  const accessToken = process.env.HS_TEST_ACCESS_TOKEN
  const refreshToken = process.env.HS_TEST_REFRESH_TOKEN
  if (!accessToken) {
    throw new Error(
      'HS_TEST_ACCESS_TOKEN missing — run the manual OAuth smoke-test first and copy the value into .env.test',
    )
  }
  const config = {
    authMethod: 'oauth2',
    accessToken,
    refreshToken,
    tokenExpiresAt: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
    portalId: Number(process.env.HS_TEST_PORTAL_ID ?? 0),
    portalName: process.env.HS_TEST_PORTAL_NAME ?? 'E2E HubSpot Portal',
  }
  await db().destinationConnection.upsert({
    where: { planId },
    create: {
      planId,
      adapterType: 'hubspot',
      status: 'CONNECTED',
      config: JSON.stringify(config),
      connectedAt: new Date(),
    },
    update: {
      status: 'CONNECTED',
      config: JSON.stringify(config),
      connectedAt: new Date(),
    },
  })
}
