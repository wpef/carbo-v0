// Document contractuel de migration (05-acceptance §12) — structure 7 articles :
//   Article 1 — Périmètre
//   Article 2 — Correspondances de champs (une sous-section par objet)
//   Article 3 — Règles de migration (hors copie directe)
//   Article 4 — Exclusions (champs non migrés + raisons)
//   Article 5 — Filtres de migration
//   Article 6 — Conditions et réserves
//   Article 7 — Approbation et signature
//
// Numéro de référence unique CARBO-YYYYMMDD-XXXX (comptage DB pour l'unicité
// inter-session). Versionne le ContractualDocument comme le TextDocument.

import { db } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import {
  buildPlanSections,
  escHtml,
  FILTER_LABEL,
  SECTION_LABEL,
  type PlanSections,
  type PlanObjectSection,
} from "./plan-sections";

// ─── Numéro de référence — unicité réelle via comptage DB ───────────────────────

/**
 * CARBO-YYYYMMDD-XXXX en comptant les documents déjà créés aujourd'hui.
 * ponytail: comptage simple ; passer à une séquence/transaction si des
 * suppressions provoquaient des collisions (referenceNumber est @unique).
 */
async function generateReferenceNumberFromDb(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const prefix = `CARBO-${year}${month}${day}`;

  const todayStart = new Date(year, now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(year, now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const existingCount = await db.contractualDocument.count({
    where: {
      referenceNumber: { startsWith: prefix },
      generatedAt: { gte: todayStart, lte: todayEnd },
    },
  });

  return `${prefix}-${String(existingCount + 1).padStart(4, "0")}`;
}

// ─── generateContractualDocument ────────────────────────────────────────────────

export async function generateContractualDocument(planId: string) {
  const data = await buildPlanSections(planId);
  const referenceNumber = await generateReferenceNumberFromDb();
  const htmlContent = renderContractualHtml(data, referenceNumber);

  // Versionnement : l'ancien CURRENT passe OUTDATED.
  await db.contractualDocument.updateMany({
    where: { planId, status: "CURRENT" },
    data: { status: "OUTDATED" },
  });
  const previous = await db.contractualDocument.findFirst({
    where: { planId },
    orderBy: { version: "desc" },
  });

  const doc = await db.contractualDocument.create({
    data: {
      planId,
      referenceNumber,
      version: (previous?.version ?? 0) + 1,
      htmlContent,
      objectCount: data.objectCount,
      fieldCount: data.fieldCount,
      ruleCount: data.ruleCount,
      filterCount: data.filterCount,
      unmappedCount: data.unmappedCount,
      llmCallCount: data.llmCallCount,
    },
  });

  await logAuditEvent({
    planId,
    action: "GENERATE_CONTRACTUAL_DOCUMENT",
    entity: "ContractualDocument",
    entityId: doc.id,
    details: {
      referenceNumber,
      version: doc.version,
      objectCount: data.objectCount,
      fieldCount: data.fieldCount,
      ruleCount: data.ruleCount,
      filterCount: data.filterCount,
      unmappedCount: data.unmappedCount,
      llmCallCount: data.llmCallCount,
    },
  });

  return doc;
}

export async function listContractualDocuments(planId: string) {
  return db.contractualDocument.findMany({ where: { planId }, orderBy: { version: "desc" } });
}

// ─── Rendu HTML — 7 articles ────────────────────────────────────────────────────

function renderCorrespondence(s: PlanObjectSection, idx: number): string {
  const rows =
    s.fieldRows.length > 0
      ? s.fieldRows
          .map(
            (d) => `
        <tr${d.isFallback ? ' class="row-fallback"' : ""}>
          <td><strong>${escHtml(d.sourceFieldLabel)}</strong><br><code>${escHtml(d.sourceFieldName)}</code></td>
          <td><strong>${escHtml(d.destinationFieldLabel)}</strong><br><code>${escHtml(d.destinationFieldName)}</code></td>
          <td>${escHtml(d.sourceType)}</td>
          <td>${escHtml(d.destType)}</td>
          <td${d.isFallback ? ' class="fallback-cell"' : ""}>${escHtml(d.description)}</td>
        </tr>`,
          )
          .join("")
      : `<tr><td colspan="5"><em>Aucun mapping de champ défini pour cet objet.</em></td></tr>`;

  return `
      <h4 id="correspondence-${idx}">${idx + 1}. ${escHtml(s.sourceObjectLabel)} → ${escHtml(s.destinationObjectLabel)}</h4>
      <table>
        <thead>
          <tr>
            <th>Champ source</th>
            <th>Champ destination</th>
            <th>Type source</th>
            <th>Type dest.</th>
            <th>Règle de migration</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
}

function renderContractualHtml(data: PlanSections, referenceNumber: string): string {
  const hasToc = data.sections.length >= 3;

  // Article 2 — Correspondances
  const correspondenceSections = data.sections.map(renderCorrespondence).join("");

  // Article 3 — Règles non-triviales (section ≠ INFORMATIONAL)
  const allRules = data.sections.flatMap((s) =>
    s.fieldRows
      .filter((r) => r.sectionType !== "INFORMATIONAL")
      .map((r) => ({ object: s.sourceObjectLabel, ...r })),
  );
  const rulesSection =
    allRules.length > 0
      ? `<table>
        <thead><tr><th>Objet source</th><th>Champ source</th><th>Champ destination</th><th>Type de règle</th><th>Description</th></tr></thead>
        <tbody>${allRules
          .map(
            (r) => `
          <tr${r.isFallback ? ' class="row-fallback"' : ""}>
            <td>${escHtml(r.object)}</td>
            <td><code>${escHtml(r.sourceFieldName)}</code></td>
            <td><code>${escHtml(r.destinationFieldName)}</code></td>
            <td><span class="rule-type">${escHtml(SECTION_LABEL[r.sectionType])}</span></td>
            <td${r.isFallback ? ' class="fallback-cell"' : ""}>${escHtml(r.description)}</td>
          </tr>`,
          )
          .join("")}
        </tbody>
      </table>`
      : `<p><em>Aucune règle de migration spécifique définie — tous les champs sont copiés directement.</em></p>`;

  // Article 4 — Exclusions par section (non-mappés + exclusions volontaires)
  const exclusionSections = data.sections
    .map((s) => {
      const unmappedSrc = s.unmappedSourceFields;
      const unmappedDst = s.unmappedRequiredDestFields;
      const excluded = s.excludedSourceFields;

      if (unmappedSrc.length === 0 && unmappedDst.length === 0 && excluded.length === 0) {
        return `<p class="ok-notice"><strong>${escHtml(s.sourceObjectLabel)}</strong> : Tous les champs source sont mappés — aucune exclusion.</p>`;
      }

      return `
      <h4>${escHtml(s.sourceObjectLabel)} → ${escHtml(s.destinationObjectLabel)}</h4>
      ${
        unmappedSrc.length > 0
          ? `<p><strong>Champs source non migrés :</strong></p>
           <ul>${unmappedSrc.map((f) => `<li><code>${escHtml(f.apiName)}</code> — ${escHtml(f.label)} [${escHtml(f.dataType)}]</li>`).join("")}</ul>`
          : ""
      }
      ${
        excluded.length > 0
          ? `<p><strong>Exclusions volontaires (décision consultant) :</strong></p>
           <ul>${excluded.map((e) => `<li><code>${escHtml(e.sourceFieldName)}</code>${e.reason ? ` — ${escHtml(e.reason)}` : ""}</li>`).join("")}</ul>`
          : ""
      }
      ${
        unmappedDst.length > 0
          ? `<p><strong>Champs destination requis non couverts :</strong></p>
           <ul>${unmappedDst.map((f) => `<li><code>${escHtml(f.apiName)}</code> — ${escHtml(f.label)} [${escHtml(f.dataType)}]</li>`).join("")}</ul>`
          : ""
      }`;
    })
    .join("");

  // Article 5 — Filtres actifs
  const allFilters = data.sections.flatMap((s) =>
    s.filters.filter((f) => f.isActive).map((f) => ({ object: s.sourceObjectLabel, ...f })),
  );
  const filtersSection =
    allFilters.length > 0
      ? `<table>
        <thead><tr><th>Objet</th><th>Champ</th><th>Opérateur</th><th>Valeur</th><th>Effet</th></tr></thead>
        <tbody>${allFilters
          .map(
            (f) => `
          <tr>
            <td>${escHtml(f.object)}</td>
            <td><code>${escHtml(f.fieldApiName)}</code></td>
            <td>${escHtml(FILTER_LABEL[f.operator] ?? f.operator)}</td>
            <td>${f.value ? escHtml(f.value) : "—"}</td>
            <td>Seuls les enregistrements où <strong>${escHtml(f.fieldApiName)}</strong> ${escHtml(FILTER_LABEL[f.operator] ?? f.operator)} ${f.value ? `<em>${escHtml(f.value)}</em>` : ""} seront migrés.</td>
          </tr>`,
          )
          .join("")}
        </tbody>
      </table>`
      : `<p><em>Aucun filtre défini — tous les enregistrements seront migrés.</em></p>`;

  // Table des matières (≥ 3 objets)
  const toc = hasToc
    ? `<nav class="toc" aria-label="Table des matières">
        <h3>Table des matières</h3>
        <ol>
          <li><a href="#article-1">Article 1 — Périmètre de migration</a></li>
          <li><a href="#article-2">Article 2 — Correspondances de champs</a>
            <ol>${data.sections
              .map(
                (s, i) =>
                  `<li><a href="#correspondence-${i}">${escHtml(s.sourceObjectLabel)} → ${escHtml(s.destinationObjectLabel)}</a></li>`,
              )
              .join("")}</ol>
          </li>
          <li><a href="#article-3">Article 3 — Règles de migration</a></li>
          <li><a href="#article-4">Article 4 — Exclusions (champs non migrés)</a></li>
          <li><a href="#article-5">Article 5 — Filtres de migration</a></li>
          <li><a href="#article-6">Article 6 — Conditions et réserves</a></li>
          <li><a href="#article-7">Article 7 — Approbation et signature</a></li>
        </ol>
      </nav>`
    : "";

  const dateStr = new Date().toLocaleDateString("fr-FR", { dateStyle: "long" });

  return `<h1>Document Contractuel de Migration de Données</h1>
  <div class="doc-header">
    <h2 class="plan-name">${escHtml(data.planName)}</h2>
    <p class="doc-ref">Référence : <strong>${escHtml(referenceNumber)}</strong></p>
    <p class="doc-date">Généré le ${dateStr}</p>
  </div>

  ${toc}

  <h3 class="article" id="article-1">Article 1 — Périmètre de migration</h3>
  ${data.planDescription ? `<p>${escHtml(data.planDescription)}</p>` : ""}
  <dl class="scope-grid">
    <dt>Système source</dt><dd>${escHtml(data.sourceName)}</dd>
    <dt>Système destination</dt><dd>${escHtml(data.destName)}</dd>
    <dt>Objets migrés</dt><dd>${data.objectCount}</dd>
    <dt>Champs mappés</dt><dd>${data.fieldCount}</dd>
    <dt>Règles de transformation</dt><dd>${data.ruleCount}</dd>
    <dt>Filtres actifs</dt><dd>${data.filterCount}</dd>
    <dt>Champs non-migrés (exclusions)</dt><dd>${data.unmappedCount}</dd>
  </dl>

  <h3 class="article" id="article-2">Article 2 — Correspondances de champs</h3>
  <p>Les tableaux ci-dessous décrivent, pour chaque objet migré, les correspondances entre champs source et champs destination, ainsi que la règle de migration appliquée.</p>
  ${data.sections.length === 0 ? "<p><em>Aucun mapping d'objet défini pour ce plan.</em></p>" : correspondenceSections}

  <h3 class="article" id="article-3">Article 3 — Règles de migration</h3>
  <p>Récapitulatif de toutes les règles de transformation spécifiques (hors copie directe) applicables aux champs migrés.</p>
  ${rulesSection}

  <h3 class="article" id="article-4">Article 4 — Exclusions (champs ne seront PAS migrés)</h3>
  <p>Les champs source listés ci-dessous sont explicitement exclus du périmètre de migration. Ils ne seront pas transférés vers le système destination. Le client en prend acte par sa signature.</p>
  ${data.sections.length === 0 ? "<p><em>Aucun objet défini — voir Article 1.</em></p>" : exclusionSections}

  <h3 class="article" id="article-5">Article 5 — Filtres de migration</h3>
  <p>Les filtres ci-dessous restreignent le périmètre des enregistrements effectivement migrés. Seuls les enregistrements répondant aux critères seront traités.</p>
  ${filtersSection}

  <h3 class="article" id="article-6">Article 6 — Conditions et réserves</h3>
  <ol>
    <li>Le présent document décrit l'état du plan de migration à la date de génération indiquée en en-tête. Toute modification ultérieure du plan nécessite la génération d'un nouveau document avec un numéro de référence distinct.</li>
    <li>Les champs source non listés dans les tableaux de correspondance (Article 2) ne seront pas migrés. Le client confirme avoir pris connaissance de ces exclusions (Article 4).</li>
    <li>Les champs présentant une incompatibilité de types (signalés par "WARNING" dans la règle de migration) feront l'objet d'une exportation CSV pour traitement manuel.</li>
    <li>Les règles de classification par IA (type PROMPT) sont soumises à une revue préalable par le consultant avant exécution.</li>
    <li>Ce document est immutable une fois signé. En cas de modification du périmètre, un avenant devra être établi.</li>
  </ol>

  <h3 class="article" id="article-7">Article 7 — Approbation et signature</h3>
  <div class="signature-section">
    <p>En signant ce document, les parties certifient avoir pris connaissance du périmètre de migration défini aux articles 1 à 6 et approuvent son exécution conformément aux conditions décrites.</p>
    <div class="signature-grid">
      <div class="sig-block">
        <h4>Client</h4>
        <div class="sig-checkbox"><label>&#9744; J'approuve le périmètre de migration décrit dans ce document.</label></div>
        <div class="sig-label">Nom et prénom</div><div class="sig-line"></div>
        <div class="sig-label">Fonction</div><div class="sig-line"></div>
        <div class="sig-label">Date</div><div class="sig-line"></div>
        <div class="sig-label">Signature</div><div class="sig-line" style="min-height:4rem;"></div>
      </div>
      <div class="sig-block">
        <h4>Consultant (Carbo)</h4>
        <div class="sig-checkbox"><label>&#9744; Je certifie l'exactitude des informations contenues dans ce document.</label></div>
        <div class="sig-label">Nom et prénom</div><div class="sig-line"></div>
        <div class="sig-label">Fonction</div><div class="sig-line"></div>
        <div class="sig-label">Date</div><div class="sig-line"></div>
        <div class="sig-label">Signature</div><div class="sig-line" style="min-height:4rem;"></div>
      </div>
    </div>
    <p style="margin-top:2rem;font-size:0.8rem;color:#888;">
      Référence : ${escHtml(referenceNumber)} — Généré le ${dateStr} par Carbo.
    </p>
  </div>`;
}
