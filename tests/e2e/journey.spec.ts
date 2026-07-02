import { expect, test, type Page } from "@playwright/test";

// Test de PARCOURS — le garde-fou qui manquait en v3/v4 (04-lessons, mode
// d'échec n°2 : 785 tests unitaires verts pendant que le parcours était
// gelé). Il traverse le parcours guidé complet sur le connecteur démo
// jusqu'à plan READY, puis vérifie la navigation arrière sans reverrouillage
// et le gate de validation de la frontière DOCUMENTS.
//
// Scénario normatif : docs/foundation/01-journeys.md §1 et §3.

const createdPlanIds: string[] = [];

async function createPlan(page: Page, name: string): Promise<string> {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Plans de migration" })).toBeVisible();
  await page.getByRole("link", { name: "Nouveau plan" }).click();
  await page.getByLabel("Nom du plan").fill(name);
  await page.getByRole("button", { name: "Créer le plan" }).click();
  await page.waitForURL(/\/plans\/[0-9a-f-]+$/);
  const planId = page.url().split("/plans/")[1];
  createdPlanIds.push(planId);
  return planId;
}

test.afterAll(async ({ request }) => {
  for (const planId of createdPlanIds) {
    await request.delete(`/api/plans/${planId}`).catch(() => {});
  }
});

test("parcours guidé complet : création → source → destination → mappings → documents → READY", async ({
  page,
}) => {
  const planName = `E2E parcours ${Date.now()}`;
  const planId = await createPlan(page, planName);

  // ── Hub (§1.3) : pas de redirect, badge Brouillon, CTA étape courante.
  await expect(page.getByTestId("plan-status")).toHaveText("Brouillon");
  await page.getByRole("link", { name: /Reprendre : Source/ }).click();
  await page.waitForURL(`**/plans/${planId}/source`);

  // ── Source (§1.4) : connexion démo → schéma auto → continuer.
  await page.getByRole("button", { name: "Connecter le CRM démo" }).click();
  await expect(page.getByText("8 objets découverts")).toBeVisible();
  await page.getByRole("link", { name: /Continuer vers la sélection d'objets/ }).click();
  await page.waitForURL(`**/plans/${planId}/source/objects`);

  // ── Sélection (§1.5) : pré-sélection par défaut = 4 standard courants +
  // 1 personnalisé ; 3 objets système NON sélectionnés et masqués par défaut.
  await expect(page.getByText("5 objets sélectionnés sur 8 · 3 objets système masqués")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /(AccountHistory)/ })).toHaveCount(0);

  // Toggle système : les 3 objets système apparaissent.
  await page.getByRole("button", { name: /Afficher les objets système \(3\)/ }).click();
  await expect(page.getByRole("checkbox", { name: /(AccountHistory)/ })).toBeVisible();
  await page.getByRole("button", { name: /Masquer les objets système/ }).click();

  // Recherche temps réel.
  await page.getByPlaceholder("Rechercher un objet…").fill("Invoice");
  await expect(page.getByRole("checkbox", { name: /(Invoice__c)/ })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /(Account)\)/ })).toHaveCount(0);
  await page.getByPlaceholder("Rechercher un objet…").clear();

  // Désélection unitaire : Case sort du périmètre.
  await page.getByRole("checkbox", { name: /(Case)\)/ }).click();
  await expect(page.getByText(/4 objets sélectionnés sur 8/)).toBeVisible();

  // Filtre segmenté « Sélectionnés ».
  await page.getByRole("button", { name: "Sélectionnés", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /(Case)\)/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Tous", exact: true }).click();

  await page.getByRole("link", { name: /Continuer vers les champs/ }).click();
  await page.waitForURL(`**/plans/${planId}/source/fields`);

  // ── Champs source (§1.6) : scope = objets sélectionnés uniquement.
  await expect(page.getByText(/4 objets · \d+ champs/)).toBeVisible();

  // ── FRONTIÈRE 1 → destination.
  await page.getByRole("button", { name: /Connecter la destination/ }).click();
  await page.waitForURL(`**/plans/${planId}/destination`);

  // ── Destination (§1.7) : connexion démo.
  await page.getByRole("button", { name: "Connecter le CRM démo" }).click();
  await expect(page.getByText("4 objets de destination découverts")).toBeVisible();
  await page.getByRole("link", { name: /Continuer vers les champs/ }).click();
  await page.waitForURL(`**/plans/${planId}/destination/fields`);

  // ── Champs destination (§1.8) : tous les objets.
  await expect(page.getByText(/Schéma destination prêt : 4 objets/)).toBeVisible();

  // ── FRONTIÈRE 2 → object mapping.
  await page.getByRole("button", { name: /Créer le mapping/ }).click();
  await page.waitForURL(`**/plans/${planId}/object-mapping`);

  // ── Object mapping (§1.9) : auto-link registre (Case désélectionné → 3
  // paires : Account→companies, Contact→contacts, Opportunity→deals).
  await expect(page.getByText("Paires mappées (3)")).toBeVisible();
  await expect(page.getByText(/3 paire\(s\) créée\(s\) automatiquement/)).toBeVisible();

  // Création manuelle d'une paire : Invoice__c → tickets.
  await page.getByRole("button", { name: /Facture \(Invoice__c\)/ }).click();
  await page.getByRole("button", { name: /Tickets \(tickets\)/ }).click();
  await expect(page.getByText("Paires mappées (4)")).toBeVisible();

  // ── FRONTIÈRE 3 via le bouton de ligne : ?object= doit ouvrir la bonne
  // paire (dette v4 corrigée).
  const invoiceRow = page.getByRole("listitem").filter({ hasText: "Invoice__c" }).filter({ hasText: "tickets" });
  await invoiceRow.getByRole("button", { name: /Mapper les champs/ }).click();
  await page.waitForURL(`**/plans/${planId}/field-mapping?object=Invoice__c`);
  await expect(page.getByRole("tab", { name: /Facture → Tickets/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // ── Field mapping (§1.10) : auto-match sur la paire Compte (name-based +
  // registre) — on change d'onglet et on vérifie (compteur d'onglet à jour).
  await page.getByRole("tab", { name: /Compte → Companies/ }).click();
  await expect(page.getByText(/champ\(s\) mappé\(s\) automatiquement/)).toBeVisible();
  await expect(page.getByRole("tab", { name: /Compte → Companies/ })).toContainText("4 champs");

  // Mapping manuel dans la paire Facture → Tickets (vide, pas de registre).
  await page.getByRole("tab", { name: /Facture → Tickets/ }).click();
  await page.getByRole("button", { name: /Numéro \(Name\)/ }).click();
  await page.getByRole("button", { name: /Subject \(subject\)/ }).click();
  await expect(page.getByText("Champs mappés (1)")).toBeVisible();

  // ── FRONTIÈRE 4 (validée) → documents ; le plan devient READY.
  await page.getByRole("button", { name: /Continuer vers les documents/ }).click();
  await page.waitForURL(`**/plans/${planId}/documents`);
  await expect(page.getByTestId("plan-status")).toHaveText("Prêt");

  // ── Documents (§1.11) : génération de la description, aperçu rendu.
  await page.getByRole("button", { name: "Générer la description" }).click();
  await expect(page.getByText("Version 1")).toBeVisible();
  await expect(page.getByTestId("document-preview")).toContainText("Account");

  // ── Navigation arrière sans reverrouillage (§3.3) : retour à Source par
  // la sidebar, puis Documents reste cliquable.
  await page.getByRole("navigation", { name: "Étapes du plan" }).getByRole("link", { name: "Source" }).click();
  await page.waitForURL(`**/plans/${planId}/source`);
  const documentsLink = page
    .getByRole("navigation", { name: "Étapes du plan" })
    .getByRole("link", { name: "Documents" });
  await expect(documentsLink).toBeVisible();
  await documentsLink.click();
  await page.waitForURL(`**/plans/${planId}/documents`);
  await expect(page.getByTestId("plan-status")).toHaveText("Prêt");
});

test("gates de frontière : les URL profondes ne corrompent ni le statut ni l'avancement", async ({
  page,
}) => {
  const planId = await createPlan(page, `E2E gate ${Date.now()}`);

  // URL profonde directe vers /documents (dette v4 : auto-READY par
  // navigation — corrigée en v5). Le bouton de génération est désactivé.
  await page.goto(`/plans/${planId}/documents`);
  await expect(page.getByText(/Le plan n'est pas encore prêt/)).toBeVisible();
  await expect(page.getByTestId("plan-status")).toHaveText("Brouillon");
  await expect(page.getByRole("button", { name: "Générer la description" })).toBeDisabled();

  // URL profonde vers /field-mapping sans connexions : pas de cul-de-sac,
  // le message oriente vers l'action qui débloque.
  await page.goto(`/plans/${planId}/field-mapping`);
  await expect(page.getByText(/Les deux connexions sont requises/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Connecter la source/ })).toBeVisible();

  // Les gates serveur (v5) ont refusé les PATCH du high-water-mark : le
  // hub propose toujours de reprendre à Source — l'avancement n'a pas menti.
  await page.goto(`/plans/${planId}`);
  await expect(page.getByRole("link", { name: /Reprendre : Source/ })).toBeVisible();
  await expect(page.getByTestId("plan-status")).toHaveText("Brouillon");
});
