// 019-text-document — Template builder: renders TextDocumentData into a self-contained HTML string

import type { TextDocumentData, ObjectSectionData } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function compatBadge(compat: string): string {
  const styles: Record<string, string> = {
    COMPATIBLE: 'background:#d1fae5;color:#065f46;',
    WARNING: 'background:#fef3c7;color:#92400e;',
    INCOMPATIBLE: 'background:#fee2e2;color:#991b1b;',
  }
  const style = styles[compat] ?? 'background:#f3f4f6;color:#374151;'
  const label = compat === 'COMPATIBLE' ? 'OK' : compat === 'WARNING' ? 'WARN' : compat === 'INCOMPATIBLE' ? 'ERR' : esc(compat)
  return `<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:600;${style}">${label}</span>`
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

export function buildSummarySection(data: TextDocumentData): string {
  const { planName, planDescription, generatedAt, objectSections, stats } = data
  const dateStr = new Date(generatedAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })
  const descPara = planDescription
    ? `<p style="margin:0 0 12px;">${esc(planDescription)}</p>`
    : ''

  return `
  <section id="summary" style="margin-bottom:40px;">
    <h2 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 16px;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">
      Executive Summary
    </h2>
    ${descPara}
    <p style="margin:0 0 12px;color:#374151;line-height:1.7;">
      This document describes the migration plan <strong>${esc(planName)}</strong> and covers
      <strong>${objectSections.length}</strong> object mapping${objectSections.length !== 1 ? 's' : ''},
      <strong>${stats.fieldCount}</strong> field mapping${stats.fieldCount !== 1 ? 's' : ''},
      and <strong>${stats.ruleCount}</strong> migration rule${stats.ruleCount !== 1 ? 's' : ''}.
      ${stats.unmappedCount > 0 ? `<br/><span style="color:#b45309;font-weight:500;">&#9888;&nbsp;${stats.unmappedCount} field${stats.unmappedCount !== 1 ? 's' : ''} are not mapped and require attention.</span>` : ''}
    </p>
    <p style="margin:0;color:#6b7280;font-size:13px;">Generated on ${dateStr}.</p>
  </section>`
}

export function buildObjectSection(om: ObjectSectionData, index: number): string {
  const anchor = `object-${index}`

  // Field mapping table
  let fieldTable: string
  if (om.fields.length === 0) {
    fieldTable = `<p style="color:#6b7280;font-style:italic;margin:0 0 16px;">No field mappings defined for this object.</p>`
  } else {
    const rows = om.fields
      .map(
        (f) => `
      <tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:8px 12px;font-family:monospace;font-size:13px;color:#1f2937;">${esc(f.sourceField)}</td>
        <td style="padding:8px 12px;font-family:monospace;font-size:13px;color:#1f2937;">${esc(f.destField)}</td>
        <td style="padding:8px 12px;text-align:center;">${compatBadge(f.typeCompatibility)}</td>
        <td style="padding:8px 12px;font-size:13px;color:#374151;line-height:1.5;">${esc(f.migrationDescription)}</td>
      </tr>`,
      )
      .join('')

    fieldTable = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:14px;">
      <thead>
        <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb;">
          <th style="padding:8px 12px;text-align:left;font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Source Field</th>
          <th style="padding:8px 12px;text-align:left;font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Destination Field</th>
          <th style="padding:8px 12px;text-align:center;font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Compat.</th>
          <th style="padding:8px 12px;text-align:left;font-weight:600;color:#374151;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Migration Logic</th>
        </tr>
      </thead>
      <tbody>${rows}
      </tbody>
    </table>`
  }

  // Filters
  const filterBlock =
    om.filterSummary && om.filterSummary !== 'No filters applied — all records are included.'
      ? `
    <div style="margin-bottom:16px;padding:12px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;">
      <strong style="font-size:13px;color:#1e40af;">Active Filters:</strong>
      <p style="margin:4px 0 0;font-size:13px;color:#1e40af;">${esc(om.filterSummary)}</p>
    </div>`
      : `<p style="color:#6b7280;font-size:13px;margin-bottom:16px;">No filters applied &mdash; all records will be included.</p>`

  // Unmapped source fields
  let unmappedSrcBlock = ''
  if (om.unmappedSourceFields.length > 0) {
    const items = om.unmappedSourceFields
      .map((f) => {
        const reqBadge = f.isRequired
          ? ` <span style="font-size:11px;background:#fee2e2;color:#991b1b;padding:1px 5px;border-radius:3px;font-weight:600;">REQUIRED</span>`
          : ''
        return `<li style="padding:3px 0;font-family:monospace;font-size:13px;color:#374151;">${esc(f.apiName)} <span style="font-family:sans-serif;color:#6b7280;">(${esc(f.label)} &mdash; ${esc(f.dataType)})</span>${reqBadge}</li>`
      })
      .join('')
    unmappedSrcBlock = `
    <div style="margin-bottom:16px;padding:12px 16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;">
      <strong style="font-size:13px;color:#c2410c;">&#9888;&nbsp;${om.unmappedSourceFields.length} Unmapped Source Field${om.unmappedSourceFields.length !== 1 ? 's' : ''}:</strong>
      <ul style="margin:6px 0 0;padding-left:18px;">${items}</ul>
    </div>`
  }

  // Unmapped destination fields (required only)
  let unmappedDstBlock = ''
  if (om.unmappedDestFields.length > 0) {
    const items = om.unmappedDestFields
      .map(
        (f) =>
          `<li style="padding:3px 0;font-family:monospace;font-size:13px;color:#374151;">${esc(f.apiName)} <span style="font-family:sans-serif;color:#6b7280;">(${esc(f.label)} &mdash; ${esc(f.dataType)})</span></li>`,
      )
      .join('')
    unmappedDstBlock = `
    <div style="margin-bottom:16px;padding:12px 16px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;">
      <strong style="font-size:13px;color:#dc2626;">&#9888;&nbsp;${om.unmappedDestFields.length} Required Destination Field${om.unmappedDestFields.length !== 1 ? 's' : ''} Not Mapped:</strong>
      <ul style="margin:6px 0 0;padding-left:18px;">${items}</ul>
    </div>`
  }

  return `
  <section id="${anchor}" style="margin-bottom:48px;">
    <h2 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 4px;padding-bottom:8px;border-bottom:2px solid #e5e7eb;">
      ${esc(om.sourceObject)} &rarr; ${esc(om.destObject)}
    </h2>
    <p style="margin:0 0 20px;font-size:13px;color:#6b7280;">${om.fields.length} field mapping${om.fields.length !== 1 ? 's' : ''}</p>
    ${fieldTable}
    ${filterBlock}
    ${unmappedSrcBlock}
    ${unmappedDstBlock}
  </section>`
}

export function buildTableOfContents(data: TextDocumentData): string {
  if (data.objectSections.length < 3) return ''

  const items = data.objectSections
    .map(
      (om, i) =>
        `<li style="padding:2px 0;"><a href="#object-${i}" style="color:#2563eb;text-decoration:none;font-size:14px;">${esc(om.sourceObject)} &rarr; ${esc(om.destObject)}</a></li>`,
    )
    .join('')

  return `
  <section id="toc" style="margin-bottom:40px;padding:20px 24px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
    <h2 style="font-size:16px;font-weight:700;color:#111827;margin:0 0 12px;">Table of Contents</h2>
    <ol style="margin:0;padding-left:20px;">${items}</ol>
  </section>`
}

export function buildStatisticsSection(data: TextDocumentData): string {
  const { stats } = data
  return `
  <section id="statistics" style="margin-top:48px;padding:20px 24px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
    <h2 style="font-size:16px;font-weight:700;color:#111827;margin:0 0 16px;">Summary Statistics</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tbody>
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:8px 0;color:#374151;font-weight:500;">Object Mappings</td>
          <td style="padding:8px 0;color:#111827;font-weight:700;text-align:right;">${data.objectSections.length}</td>
        </tr>
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:8px 0;color:#374151;font-weight:500;">Field Mappings</td>
          <td style="padding:8px 0;color:#111827;font-weight:700;text-align:right;">${stats.fieldCount}</td>
        </tr>
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:8px 0;color:#374151;font-weight:500;">Migration Rules</td>
          <td style="padding:8px 0;color:#111827;font-weight:700;text-align:right;">${stats.ruleCount}</td>
        </tr>
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:8px 0;color:#374151;${stats.unmappedCount > 0 ? 'color:#b45309;' : ''}font-weight:500;">Unmapped Fields</td>
          <td style="padding:8px 0;font-weight:700;text-align:right;${stats.unmappedCount > 0 ? 'color:#b45309;' : 'color:#111827;'}">${stats.unmappedCount}</td>
        </tr>
      </tbody>
    </table>
  </section>`
}

// ---------------------------------------------------------------------------
// Full document builder
// ---------------------------------------------------------------------------

const INLINE_STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 15px;
    line-height: 1.6;
    color: #1f2937;
    background: #ffffff;
    margin: 0;
    padding: 0;
  }
  .document-wrapper {
    max-width: 900px;
    margin: 0 auto;
    padding: 48px 40px;
  }
  h1, h2, h3 { line-height: 1.3; }
  a { color: #2563eb; }
  @media print {
    body { font-size: 12px; }
    .document-wrapper { padding: 24px; max-width: 100%; }
    a { color: inherit; text-decoration: none; }
  }
`

export function buildFullDocument(data: TextDocumentData): string {
  const { planName, generatedAt } = data
  const dateStr = new Date(generatedAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })

  const header = `
  <header style="margin-bottom:48px;padding-bottom:24px;border-bottom:3px solid #111827;">
    <h1 style="font-size:28px;font-weight:800;color:#111827;margin:0 0 6px;">Migration Plan: ${esc(planName)}</h1>
    <p style="margin:0;color:#6b7280;font-size:14px;">Generated on ${dateStr} &bull; Confidential &mdash; For client review only</p>
  </header>`

  const toc = buildTableOfContents(data)
  const summary = buildSummarySection(data)
  const objectSections = data.objectSections.map((om, i) => buildObjectSection(om, i)).join('\n')
  const statistics = buildStatisticsSection(data)

  const footer = `
  <footer style="margin-top:48px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">
    Carbo Migration Planner &bull; ${esc(planName)} &bull; Generated ${dateStr}
  </footer>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Migration Plan: ${esc(planName)}</title>
  <style>${INLINE_STYLES}</style>
</head>
<body>
  <div class="document-wrapper">
    ${header}
    ${toc}
    ${summary}
    ${objectSections}
    ${statistics}
    ${footer}
  </div>
</body>
</html>`
}
