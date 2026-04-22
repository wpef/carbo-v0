// Load .env.test credentials into process.env before tests run.
// Keeps real tokens out of .env (which is committed-friendly template) and
// lets devs opt-out of live tests by simply not creating .env.test.

import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const ENV_TEST_PATH = path.resolve(process.cwd(), '.env.test')

export function loadTestEnv(): { hasSfCredentials: boolean; hasHsCredentials: boolean } {
  if (existsSync(ENV_TEST_PATH)) {
    const raw = readFileSync(ENV_TEST_PATH, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = value
    }
  }
  return {
    hasSfCredentials: Boolean(process.env.SF_TEST_ACCESS_TOKEN && process.env.SF_TEST_INSTANCE_URL),
    hasHsCredentials: Boolean(process.env.HS_TEST_ACCESS_TOKEN),
  }
}
