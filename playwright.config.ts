import { defineConfig } from "@playwright/test";

// Port 3005 : ne PAS toucher au 3001 (réservé aux callbacks OAuth du dev
// manuel de l'utilisateur — leçon v4).
const PORT = 3005;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 180_000,
  // DB Neon distante : chaque écriture prend des centaines de ms et la latence
  // grimpe sous charge (suite complète) — les attentes de visibilité doivent
  // absorber connexion + création de schéma + rotations transactionnelles.
  expect: { timeout: 30_000 },
  // DB de dev partagée (Neon distant) : un seul worker, pas de parallélisme.
  workers: 1,
  fullyParallel: false,
  // Neon distant : un hoquet réseau ponctuel ne doit pas faire mentir la
  // suite — un vrai bug, lui, échoue deux fois.
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
