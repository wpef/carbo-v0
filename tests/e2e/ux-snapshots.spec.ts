import { test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// Outil de revue UX (pas un test de régression) : déroule le parcours et
// capture un snapshot ARIA de chaque page pour alimenter les agents de
// revue. Activé uniquement via UX_SNAPSHOTS=1 + UX_OUT=<dossier>.
const OUT = process.env.UX_OUT ?? "";
test.skip(!process.env.UX_SNAPSHOTS || !OUT, "outil de revue UX — activer via UX_SNAPSHOTS=1");

async function snap(page: Page, name: string) {
  const snapshot = await page.locator("body").ariaSnapshot();
  writeFileSync(path.join(OUT, `${name}.md`), `# ${name}\nURL: ${page.url()}\n\n\`\`\`yaml\n${snapshot}\n\`\`\`\n`);
}

test("dump des snapshots ARIA du parcours", async ({ page, request }) => {
  mkdirSync(OUT, { recursive: true });

  await page.goto("/");
  await snap(page, "01-home");

  await page.getByRole("link", { name: "Nouveau plan" }).click();
  await snap(page, "02-plan-new");

  await page.getByLabel("Nom du plan").fill(`UX review ${Date.now()}`);
  await page.getByRole("button", { name: "Créer le plan" }).click();
  await page.waitForURL(/\/plans\/[0-9a-f-]+$/);
  const planId = page.url().split("/plans/")[1];
  await snap(page, "03-plan-hub");

  await page.getByRole("link", { name: /Reprendre : Source/ }).click();
  await page.waitForURL(`**/plans/${planId}/source`);
  await snap(page, "04-source-avant-connexion");

  await page.getByRole("button", { name: "Connecter le CRM démo" }).click();
  await page.getByText("8 objets découverts").waitFor();
  await snap(page, "05-source-connectee");

  await page.getByRole("link", { name: /Continuer vers la sélection d'objets/ }).click();
  await page.waitForURL(`**/source/objects`);
  await page.getByText(/objets sélectionnés sur/).waitFor();
  await snap(page, "06-source-objects");

  await page.getByRole("link", { name: /Continuer vers les champs/ }).click();
  await page.waitForURL(`**/source/fields`);
  await page.getByText(/objets ·/).waitFor();
  await snap(page, "07-source-fields");

  await page.getByRole("button", { name: /Connecter la destination/ }).click();
  await page.waitForURL(`**/destination`);
  await snap(page, "08-destination-avant-connexion");

  await page.getByRole("button", { name: "Connecter le CRM démo" }).click();
  await page.getByText("4 objets de destination découverts").waitFor();
  await snap(page, "09-destination-connectee");

  await page.getByRole("link", { name: /Continuer vers les champs/ }).click();
  await page.waitForURL(`**/destination/fields`);
  await page.getByText(/Schéma destination prêt/).waitFor();
  await snap(page, "10-destination-fields");

  await page.getByRole("button", { name: /Créer le mapping/ }).click();
  await page.waitForURL(`**/object-mapping`);
  await page.getByText(/Paires mappées/).waitFor();
  await snap(page, "11-object-mapping");

  await page.getByRole("button", { name: /Mapper les champs/ }).first().click();
  await page.waitForURL(`**/field-mapping**`);
  await page.getByRole("tab").first().waitFor();
  // Attendre la fin de l'auto-match avant la frontière (sinon gate 422).
  await page.getByText(/Champs mappés \([1-9]\d*\)/).waitFor();
  await snap(page, "12-field-mapping");

  await page.getByRole("button", { name: /Continuer vers les documents/ }).click();
  await page.waitForURL(`**/documents`);
  await snap(page, "13-documents");

  await page.getByRole("button", { name: "Générer la description" }).click();
  await page.getByText("Version 1").waitFor();
  await snap(page, "14-documents-genere");

  await request.delete(`/api/plans/${planId}`).catch(() => {});
});
