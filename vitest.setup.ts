// Load test-only env (Neon test branch) for integration tests when present.
// Uses Node's built-in env-file loader (Node >= 20.12). No-op if the file is absent
// (e.g. CI without a provisioned test DB), so unit tests still run.
import { existsSync } from 'node:fs'

if (existsSync('.env.test')) {
  process.loadEnvFile('.env.test')
}
