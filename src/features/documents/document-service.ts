// Document texte de migration (05-acceptance §12).
// Câble getSectionType + describeRule pour décrire chaque champ mappé, la
// section champs non-mappés + exclusions, et persiste les compteurs exacts
// (objets, champs, règles, non mappés, appels LLM). Versionne le TextDocument :
// l'ancien CURRENT passe OUTDATED, le nouveau est CURRENT.

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

export async function generatePlanDescription(planId: string) {
  const data = await buildPlanSections(planId);
  const htmlContent = renderTextDocumentHtml(data);

  // Versionnement : le document précédent passe OUTDATED.
  await db.textDocument.updateMany({
    where: { planId, status: "CURRENT" },
    data: { status: "OUTDATED" },
  });
  const previous = await db.textDocument.findFirst({
    where: { planId },
    orderBy: { version: "desc" },
  });

  const doc = await db.textDocument.create({
    data: {
      planId,
      version: (previous?.version ?? 0) + 1,
      htmlContent,
      objectCount: data.objectCount,
      fieldCount: data.fieldCount,
      ruleCount: data.ruleCount,
      unmappedCount: data.unmappedCount,
      llmCallCount: data.llmCallCount,
    },
  });

  await logAuditEvent({
    planId,
    action: "GENERATE_TEXT_DOCUMENT",
    entity: "TextDocument",
    entityId: doc.id,
    details: {
      version: doc.version,
      objectCount: data.objectCount,
      fieldCount: data.fieldCount,
      ruleCount: data.ruleCount,
      unmappedCount: data.unmappedCount,
      llmCallCount: data.llmCallCount,
    },
  });

  return doc;
}

export async function listDocuments(planId: string) {
  return db.textDocument.findMany({ where: { planId }, orderBy: { version: "desc" } });
}

// ─── Rendu HTML ─────────────────────────────────────────────────────────────────

function sectionBadge(sectionType: PlanObjectSection["fieldRows"][number]["sectionType"]): string {
  const cls =
    sectionType === "ERROR"
      ? "badge-error"
      : sectionType === "INFORMATIONAL"
        ? "badge-ok"
        : "badge-warn";
  return `<span class="${cls}">${escHtml(SECTION_LABEL[sectionType])}</span>`;
}

function renderSection(s: PlanObjectSection, idx: number): string {
  const fieldRows =
    s.fieldRows.length > 0
      ? s.fieldRows
          .map(
            (d) => `
      <tr${d.isFallback ? ' class="row-fallback"' : ""}>
        <td><strong>${escHtml(d.sourceFieldLabel)}</strong><br><code>${escHtml(d.sourceFieldName)}</code></td>
        <td><strong>${escHtml(d.destinationFieldLabel)}</strong><br><code>${escHtml(d.destinationFieldName)}</code></td>
        <td>${escHtml(d.sourceType)}</td>
        <td>${escHtml(d.destType)}</td>
        <td>${sectionBadge(d.sectionType)}</td>
        <td${d.isFallback ? ' class="fallback-cell"' : ""}>${escHtml(d.description)}</td>
      </tr>`,
          )
          .join("")
      : `<tr><td colspan="6"><em>Aucun mapping de champ défini.</em></td></tr>`;

  const activeFilters = s.filters.filter((f) => f.isActive);
  const filterBlock =
    activeFilters.length > 0
      ? `<h4>Filtres de migration</h4><ul>${activeFilters
          .map(
            (f) =>
              `<li><strong>${escHtml(f.fieldApiName)}</strong> ${escHtml(
                FILTER_LABEL[f.operator] ?? f.operator,
              )} ${f.value ? escHtml(f.value) : ""}</li>`,
          )
          .join("")}</ul>`
      : `<h4>Filtres de migration</h4><p><em>Aucun filtre défini — tous les enregistrements seront migrés.</em></p>`;

  const unmappedBlock =
    s.unmappedSourceFields.length > 0 || s.unmappedRequiredDestFields.length > 0
      ? `<div class="warning">
          <h4>Champs source non-mappés (ne seront PAS migrés)</h4>
          ${
            s.unmappedSourceFields.length > 0
              ? `<ul>${s.unmappedSourceFields
                  .map(
                    (f) =>
                      `<li><code>${escHtml(f.apiName)}</code> <span class="meta">[${escHtml(f.dataType)}] ${escHtml(f.label)}</span></li>`,
                  )
                  .join("")}</ul>`
              : "<p><em>Tous les champs source sont mappés.</em></p>"
          }
          ${
            s.unmappedRequiredDestFields.length > 0
              ? `<h4>Champs destination requis non-couverts</h4><ul>${s.unmappedRequiredDestFields
                  .map(
                    (f) =>
                      `<li><code>${escHtml(f.apiName)}</code> <span class="meta">[${escHtml(f.dataType)}] ${escHtml(f.label)}</span></li>`,
                  )
                  .join("")}</ul>`
              : ""
          }
         </div>`
      : `<p class="ok-notice">Couverture complète — tous les champs source sont mappés.</p>`;

  const exclusionBlock =
    s.excludedSourceFields.length > 0
      ? `<h4>Exclusions volontaires (décision consultant)</h4><ul>${s.excludedSourceFields
          .map(
            (e) =>
              `<li><code>${escHtml(e.sourceFieldName)}</code>${e.reason ? ` — <span class="meta">${escHtml(e.reason)}</span>` : ""}</li>`,
          )
          .join("")}</ul>`
      : "";

  return `
      <section id="section-${idx}">
        <h3>${idx + 1}. ${escHtml(s.sourceObjectLabel)} → ${escHtml(s.destinationObjectLabel)}</h3>
        <table>
          <thead>
            <tr>
              <th>Champ source</th>
              <th>Champ destination</th>
              <th>Type source</th>
              <th>Type dest.</th>
              <th>Section</th>
              <th>Règle de migration</th>
            </tr>
          </thead>
          <tbody>${fieldRows}</tbody>
        </table>
        ${filterBlock}
        ${unmappedBlock}
        ${exclusionBlock}
      </section>`;
}

function renderTextDocumentHtml(data: PlanSections): string {
  const sections = data.sections.map(renderSection).join("");

  const toc =
    data.sections.length >= 3
      ? `<nav aria-label="Table des matières"><h3>Table des matières</h3><ol>${data.sections
          .map(
            (s, i) =>
              `<li><a href="#section-${i}">${escHtml(s.sourceObjectLabel)} → ${escHtml(s.destinationObjectLabel)}</a></li>`,
          )
          .join("")}</ol></nav>`
      : "";

  const noObjMsg =
    data.sections.length === 0
      ? `<div class="warning"><p>Aucun mapping d'objet défini pour ce plan de migration.</p></div>`
      : "";

  const generatedAt = new Date().toLocaleDateString("fr-FR", { dateStyle: "long" });

  return `<h1>Document Technique de Migration</h1>
  <h2>${escHtml(data.planName)}</h2>
  ${data.planDescription ? `<p>${escHtml(data.planDescription)}</p>` : ""}

  <div class="meta">
    <p><strong>Source :</strong> ${escHtml(data.sourceName)} &nbsp;|&nbsp; <strong>Destination :</strong> ${escHtml(data.destName)}</p>
    <p><strong>Généré le :</strong> ${generatedAt}</p>
  </div>

  <div class="stats-grid">
    <div class="stat-card"><div class="stat-value">${data.objectCount}</div><div class="stat-label">Objets mappés</div></div>
    <div class="stat-card"><div class="stat-value">${data.fieldCount}</div><div class="stat-label">Champs mappés</div></div>
    <div class="stat-card"><div class="stat-value">${data.ruleCount}</div><div class="stat-label">Règles de migration</div></div>
    <div class="stat-card"><div class="stat-value">${data.unmappedCount}</div><div class="stat-label">Champs non-mappés</div></div>
    <div class="stat-card"><div class="stat-value">${data.llmCallCount}</div><div class="stat-label">Appels LLM</div></div>
  </div>

  ${toc}
  ${noObjMsg}
  ${sections}`;
}
