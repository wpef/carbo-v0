// 020-contractual-document — Template builder: produces formal HTML from structured data

import type { Article, CorrespondenceRow, ScopeData, SignatureBlockData } from './types'
import type { PlanDescription, ObjectMappingDescription } from '@/lib/types/rule-description'
import type { UnmappedFieldsReport, ObjectMappingUnmappedReport } from '@/lib/types/unmapped-fields'

// ---------------------------------------------------------------------------
// CSS styles for the formal document
// ---------------------------------------------------------------------------

const DOCUMENT_CSS = `
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a1a;
    margin: 0;
    padding: 0;
    background: #fff;
  }
  .document-wrapper {
    max-width: 820px;
    margin: 0 auto;
    padding: 40px 60px;
  }
  h1.doc-title {
    font-size: 18pt;
    font-weight: bold;
    text-align: center;
    border-bottom: 2px solid #1a1a1a;
    padding-bottom: 12px;
    margin-bottom: 8px;
    letter-spacing: 0.5px;
  }
  .doc-reference {
    text-align: center;
    font-size: 10pt;
    color: #444;
    margin-bottom: 24px;
  }
  .doc-meta {
    border: 1px solid #ccc;
    border-radius: 2px;
    padding: 16px 20px;
    margin-bottom: 32px;
    background: #fafafa;
    font-size: 10pt;
  }
  .doc-meta table {
    width: 100%;
    border-collapse: collapse;
  }
  .doc-meta td {
    padding: 3px 0;
    vertical-align: top;
  }
  .doc-meta td:first-child {
    font-weight: bold;
    width: 200px;
    color: #333;
  }
  .toc {
    margin-bottom: 32px;
    padding: 16px 20px;
    border: 1px solid #ccc;
    background: #fafafa;
  }
  .toc h2 {
    font-size: 12pt;
    margin: 0 0 10px 0;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .toc ol {
    margin: 0;
    padding-left: 20px;
  }
  .toc li {
    padding: 2px 0;
    font-size: 10pt;
  }
  .article {
    margin-bottom: 36px;
  }
  .article h2 {
    font-size: 13pt;
    font-weight: bold;
    border-bottom: 1px solid #aaa;
    padding-bottom: 6px;
    margin-bottom: 14px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .article p {
    margin: 0 0 10px 0;
  }
  .subsection {
    margin-bottom: 20px;
  }
  .subsection h3 {
    font-size: 11pt;
    font-weight: bold;
    margin: 0 0 8px 0;
    color: #222;
  }
  table.formal-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
    font-size: 9.5pt;
  }
  table.formal-table th {
    background: #e8e8e8;
    border: 1px solid #999;
    padding: 6px 8px;
    text-align: left;
    font-weight: bold;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  table.formal-table td {
    border: 1px solid #bbb;
    padding: 5px 8px;
    vertical-align: top;
  }
  table.formal-table tr:nth-child(even) td {
    background: #f7f7f7;
  }
  .empty-note {
    font-style: italic;
    color: #666;
    font-size: 10pt;
    padding: 8px 0;
  }
  .warning-flag {
    color: #b45309;
    font-size: 9pt;
    font-weight: bold;
  }
  .signature-section {
    margin-top: 40px;
    padding-top: 20px;
    border-top: 2px solid #1a1a1a;
  }
  .signature-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    margin-top: 20px;
  }
  .signature-block {
    border: 1px solid #bbb;
    padding: 20px;
  }
  .signature-block h3 {
    font-size: 11pt;
    font-weight: bold;
    margin: 0 0 16px 0;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid #ccc;
    padding-bottom: 8px;
  }
  .signature-field {
    margin-bottom: 20px;
  }
  .signature-field label {
    display: block;
    font-size: 9pt;
    font-weight: bold;
    color: #444;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .signature-field .field-line {
    border-bottom: 1px solid #666;
    height: 28px;
    width: 100%;
    margin-top: 4px;
  }
  .footer {
    margin-top: 48px;
    padding-top: 12px;
    border-top: 1px solid #ccc;
    font-size: 9pt;
    color: #888;
    text-align: center;
  }
  .preamble {
    font-style: italic;
    border-left: 3px solid #ccc;
    padding-left: 16px;
    margin-bottom: 16px;
    color: #333;
  }
`

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

/**
 * Build the document header HTML (above the articles).
 */
export function buildHeader(planName: string, referenceNumber: string, generatedAt: string): string {
  const dateStr = formatDate(generatedAt)
  return `
    <h1 class="doc-title">Migration Specification</h1>
    <div class="doc-reference">Reference: ${escapeHtml(referenceNumber)}</div>
    <div class="doc-meta">
      <table>
        <tr><td>Document Title</td><td>${escapeHtml(planName)}</td></tr>
        <tr><td>Reference Number</td><td>${escapeHtml(referenceNumber)}</td></tr>
        <tr><td>Generation Date</td><td>${escapeHtml(dateStr)}</td></tr>
        <tr><td>Document Type</td><td>Contractual Migration Specification</td></tr>
        <tr><td>Version</td><td>1.0 (Immutable)</td></tr>
      </table>
    </div>
  `.trim()
}

/**
 * Build the table of contents HTML (only when 3+ object mappings).
 */
export function buildTableOfContents(articles: { number: number; title: string }[]): string {
  const items = articles
    .map((a) => `<li>Article ${a.number} — ${escapeHtml(a.title)}</li>`)
    .join('\n')

  return `
    <div class="toc">
      <h2>Table of Contents</h2>
      <ol>${items}</ol>
    </div>
  `.trim()
}

/**
 * Build the Preamble (before Article 1).
 */
export function buildPreamble(planName: string, generatedAt: string): string {
  const dateStr = formatDate(generatedAt)
  return `
    <div class="preamble">
      <p>This document constitutes the formal migration specification for the project
      entitled <strong>${escapeHtml(planName)}</strong>, established on ${escapeHtml(dateStr)}.
      It describes in precise terms the scope, field correspondences, transformation rules,
      validation rules, data exclusions, and migration filters applicable to the planned
      data migration. The client is requested to review this document in its entirety,
      request any necessary amendments, and provide formal written approval (signature)
      before any migration execution may begin.</p>
    </div>
  `.trim()
}

/**
 * Build Article 1: Scope.
 */
export function buildScopeSection(scope: ScopeData): Article {
  const content = `
    <p>This migration specification covers the transfer of data from the source system
    (<strong>${escapeHtml(scope.sourceName)}</strong>) to the destination system
    (<strong>${escapeHtml(scope.destName)}</strong>).</p>
    <table class="formal-table">
      <thead>
        <tr>
          <th>Parameter</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Source System</td><td>${escapeHtml(scope.sourceName)}</td></tr>
        <tr><td>Destination System</td><td>${escapeHtml(scope.destName)}</td></tr>
        <tr><td>Number of Objects in Scope</td><td>${scope.objectCount}</td></tr>
        <tr><td>Number of Field Mappings</td><td>${scope.fieldCount}</td></tr>
        <tr><td>Number of Active Filters</td><td>${scope.filterCount}</td></tr>
      </tbody>
    </table>
    <p>Only fields explicitly listed in Article 3 are included in the migration scope.
    All other source fields are excluded and listed in Article 6.</p>
  `.trim()

  return { number: 1, title: 'Scope', content }
}

/**
 * Build Article 2: Object Mappings overview table.
 */
export function buildObjectMappingsSection(objectMappings: ObjectMappingDescription[]): Article {
  let content: string

  if (objectMappings.length === 0) {
    content = `<p class="empty-note">No object mappings have been defined for this plan.</p>`
  } else {
    const rows = objectMappings
      .map(
        (om, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td><code>${escapeHtml(om.sourceObject)}</code></td>
          <td><code>${escapeHtml(om.destObject)}</code></td>
          <td>${om.fieldDescriptions.length}</td>
          <td>${escapeHtml(om.filterSummary)}</td>
        </tr>
      `,
      )
      .join('')

    content = `
      <table class="formal-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Source Object</th>
            <th>Destination Object</th>
            <th>Field Mappings</th>
            <th>Filter Summary</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `.trim()
  }

  return { number: 2, title: 'Object Mappings', content }
}

/**
 * Build Article 3: Field Mappings (per-object correspondence tables).
 */
export function buildFieldMappingsSection(objectMappings: ObjectMappingDescription[]): Article {
  if (objectMappings.length === 0) {
    return {
      number: 3,
      title: 'Field Mappings',
      content: `<p class="empty-note">No field mappings have been defined for this plan.</p>`,
    }
  }

  const sections = objectMappings.map((om, omIdx) => {
    const heading = `
      <div class="subsection">
        <h3>${omIdx + 1}. ${escapeHtml(om.sourceObject)} → ${escapeHtml(om.destObject)}</h3>
    `

    let tableHtml: string
    if (om.fieldDescriptions.length === 0) {
      tableHtml = `<p class="empty-note">No field mappings defined for this object.</p>`
    } else {
      const rows = om.fieldDescriptions
        .map(
          (fd) => `
          <tr>
            <td><code>${escapeHtml(fd.sourceField)}</code></td>
            <td><code>${escapeHtml(fd.destField)}</code></td>
            <td>${escapeHtml(fd.typeCompatibility)}</td>
            <td>${escapeHtml(fd.migrationDescription)}</td>
          </tr>
        `,
        )
        .join('')

      tableHtml = `
        <table class="formal-table">
          <thead>
            <tr>
              <th>Source Field</th>
              <th>Destination Field</th>
              <th>Type Compatibility</th>
              <th>Migration Rule Description</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `.trim()
    }

    return `${heading}${tableHtml}</div>`
  })

  return {
    number: 3,
    title: 'Field Mappings',
    content: sections.join(''),
  }
}

/**
 * Build Article 4: Transformation Rules.
 */
export function buildTransformationRulesSection(objectMappings: ObjectMappingDescription[]): Article {
  const allRules = objectMappings.flatMap((om) =>
    om.fieldDescriptions
      .filter((fd) => fd.migrationDescription && fd.migrationDescription !== 'No migration logic defined.')
      .map((fd) => ({
        sourceObject: om.sourceObject,
        destObject: om.destObject,
        sourceField: fd.sourceField,
        destField: fd.destField,
        description: fd.migrationDescription,
        typeCompatibility: fd.typeCompatibility,
      })),
  )

  let content: string

  if (allRules.length === 0) {
    content = `<p class="empty-note">No transformation rules defined for this migration plan.</p>`
  } else {
    const rows = allRules
      .map(
        (r) => `
        <tr>
          <td><code>${escapeHtml(r.sourceObject)}</code></td>
          <td><code>${escapeHtml(r.sourceField)}</code> → <code>${escapeHtml(r.destField)}</code></td>
          <td>${escapeHtml(r.description)}</td>
        </tr>
      `,
      )
      .join('')

    content = `
      <table class="formal-table">
        <thead>
          <tr>
            <th>Object</th>
            <th>Field Mapping</th>
            <th>Transformation Description</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `.trim()
  }

  return { number: 4, title: 'Transformation Rules', content }
}

/**
 * Build Article 5: Filters.
 */
export function buildFilterSection(objectMappings: ObjectMappingDescription[]): Article {
  // Collect filter descriptions from all object mappings
  const filterEntries: { sourceObject: string; destObject: string; description: string }[] = []

  for (const om of objectMappings) {
    if (om.filterSummary && om.filterSummary !== 'No filters applied — all records are included.') {
      filterEntries.push({
        sourceObject: om.sourceObject,
        destObject: om.destObject,
        description: om.filterSummary,
      })
    }
  }

  let content: string

  if (filterEntries.length === 0) {
    content = `<p class="empty-note">No migration filters defined — all records from each source object are included.</p>`
  } else {
    const rows = filterEntries
      .map(
        (f) => `
        <tr>
          <td><code>${escapeHtml(f.sourceObject)}</code></td>
          <td><code>${escapeHtml(f.destObject)}</code></td>
          <td>${escapeHtml(f.description)}</td>
        </tr>
      `,
      )
      .join('')

    content = `
      <table class="formal-table">
        <thead>
          <tr>
            <th>Source Object</th>
            <th>Destination Object</th>
            <th>Filter Description</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `.trim()
  }

  return { number: 5, title: 'Migration Filters', content }
}

/**
 * Build Article 6: Exclusions (unmapped fields).
 */
export function buildExclusionsSection(unmappedReport: UnmappedFieldsReport): Article {
  const totalUnmapped = unmappedReport.summary.totalUnmappedSource + unmappedReport.summary.totalUnmappedDest

  if (totalUnmapped === 0) {
    return {
      number: 6,
      title: 'Exclusions — Fields Will NOT Be Migrated',
      content: `<p class="empty-note">All source fields are mapped — no exclusions.</p>`,
    }
  }

  const sections = unmappedReport.objectMappings
    .filter((om) => om.unmappedSourceFields.length > 0 || om.unmappedDestFields.length > 0)
    .map((om: ObjectMappingUnmappedReport) => {
      const parts: string[] = []

      if (om.unmappedSourceFields.length > 0) {
        const rows = om.unmappedSourceFields
          .map(
            (f) => `
            <tr>
              <td><code>${escapeHtml(f.apiName)}</code></td>
              <td>${escapeHtml(f.label)}</td>
              <td>${escapeHtml(f.dataType)}</td>
              <td>${f.isRequired ? '<span class="warning-flag">REQUIRED</span>' : 'Optional'}</td>
            </tr>
          `,
          )
          .join('')

        parts.push(`
          <p><strong>Source: ${escapeHtml(om.sourceObjectApiName)}</strong> — unmapped source fields:</p>
          <table class="formal-table">
            <thead>
              <tr>
                <th>API Name</th>
                <th>Label</th>
                <th>Data Type</th>
                <th>Required</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        `)
      }

      if (om.unmappedDestFields.length > 0) {
        const rows = om.unmappedDestFields
          .map(
            (f) => `
            <tr>
              <td><code>${escapeHtml(f.apiName)}</code></td>
              <td>${escapeHtml(f.label)}</td>
              <td>${escapeHtml(f.dataType)}</td>
              <td><span class="warning-flag">REQUIRED (unmet)</span></td>
            </tr>
          `,
          )
          .join('')

        parts.push(`
          <p><strong>Destination: ${escapeHtml(om.destObjectApiName)}</strong> — required destination fields with no source mapping:</p>
          <table class="formal-table">
            <thead>
              <tr>
                <th>API Name</th>
                <th>Label</th>
                <th>Data Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        `)
      }

      return `<div class="subsection">${parts.join('')}</div>`
    })
    .join('')

  const content = `
    <p>The following source fields will <strong>NOT</strong> be migrated. The client acknowledges
    that these fields are explicitly excluded from the migration scope (Data Fidelity — no silent omissions).</p>
    ${sections}
  `.trim()

  return { number: 6, title: 'Exclusions — Fields Will NOT Be Migrated', content }
}

/**
 * Build Article 7: Signatures.
 */
export function buildSignatureBlock(data: SignatureBlockData): Article {
  const content = `
    <p>By signing below, the parties acknowledge that they have read, understood, and agree
    to the migration scope, field correspondences, transformation rules, exclusions, and
    filters described in this document. No migration execution shall commence without
    written approval from the client signatory.</p>
    <div class="signature-grid">
      <div class="signature-block">
        <h3>Consultant</h3>
        <div class="signature-field">
          <label>Name</label>
          <div class="field-line">&nbsp;${data.consultantName ? escapeHtml(data.consultantName) : ''}</div>
        </div>
        <div class="signature-field">
          <label>Date</label>
          <div class="field-line">&nbsp;${escapeHtml(formatDate(data.generationDate))}</div>
        </div>
        <div class="signature-field">
          <label>Signature</label>
          <div class="field-line">&nbsp;</div>
        </div>
      </div>
      <div class="signature-block">
        <h3>Client</h3>
        <div class="signature-field">
          <label>Name</label>
          <div class="field-line">&nbsp;${data.clientName ? escapeHtml(data.clientName) : ''}</div>
        </div>
        <div class="signature-field">
          <label>Date</label>
          <div class="field-line">&nbsp;</div>
        </div>
        <div class="signature-field">
          <label>Signature</label>
          <div class="field-line">&nbsp;</div>
        </div>
        <div class="signature-field">
          <label>Approval</label>
          <div class="field-line">&nbsp;&#9744; I hereby approve this migration specification</div>
        </div>
      </div>
    </div>
  `.trim()

  return { number: 7, title: 'Signatures and Approval', content }
}

/**
 * Build the footer HTML.
 */
export function buildFooter(referenceNumber: string, generatedAt: string): string {
  const dateStr = formatDate(generatedAt)
  return `
    <div class="footer">
      <p>Document Reference: ${escapeHtml(referenceNumber)} &mdash; Generated: ${escapeHtml(dateStr)}</p>
      <p>This document is immutable. Any subsequent amendments require the generation of a new version with a new reference number.</p>
      <p>Generated by Carbo &mdash; Data Migration Specification Tool</p>
    </div>
  `.trim()
}

/**
 * Build the complete HTML document from articles, header, preamble, TOC, and footer.
 */
export function buildFullDocument(
  planName: string,
  referenceNumber: string,
  generatedAt: string,
  articles: Article[],
  includeTableOfContents: boolean,
): string {
  const headerHtml = buildHeader(planName, referenceNumber, generatedAt)
  const preambleHtml = buildPreamble(planName, generatedAt)
  const tocHtml = includeTableOfContents ? buildTableOfContents(articles) : ''
  const footerHtml = buildFooter(referenceNumber, generatedAt)

  const articleHtml = articles
    .map(
      (a) => `
      <div class="article" id="article-${a.number}">
        <h2>Article ${a.number} — ${escapeHtml(a.title)}</h2>
        ${a.content}
      </div>
    `,
    )
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Migration Specification — ${escapeHtml(planName)} — ${escapeHtml(referenceNumber)}</title>
  <style>${DOCUMENT_CSS}</style>
</head>
<body>
  <div class="document-wrapper">
    ${headerHtml}
    ${preambleHtml}
    ${tocHtml}
    ${articleHtml}
    ${footerHtml}
  </div>
</body>
</html>`
}
