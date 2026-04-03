// 021-pdf-export — Core PDF generation service using Puppeteer

import puppeteer from 'puppeteer'
import type { PdfOptions, PdfResult } from './types'

const DEFAULT_MARGIN = {
  top: '25mm',
  right: '25mm',
  bottom: '20mm',
  left: '20mm',
}

/**
 * Convert a self-contained HTML string to an A4 PDF buffer.
 *
 * Injects `break-inside: avoid` on <tr> elements and headings to prevent
 * rows/headings from being split across pages.
 */
export async function generatePdf(htmlContent: string, options: PdfOptions = {}): Promise<PdfResult> {
  const {
    title = '',
    date = new Date().toLocaleDateString('fr-FR'),
    pageSize = 'A4',
    landscape = false,
    margin = DEFAULT_MARGIN,
  } = options

  // Inject page-break avoidance CSS into the HTML before rendering.
  const pageBreakCss = `
    <style>
      tr { break-inside: avoid; page-break-inside: avoid; }
      h1, h2, h3, h4, h5, h6 { break-inside: avoid; page-break-inside: avoid; break-after: avoid; page-break-after: avoid; }
    </style>
  `
  const htmlWithCss = htmlContent.includes('</head>')
    ? htmlContent.replace('</head>', `${pageBreakCss}</head>`)
    : `${pageBreakCss}${htmlContent}`

  console.log(`[PDF] Launching Puppeteer to generate PDF — title="${title}" format=${pageSize}`)

  let browser
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[PDF] Puppeteer launch failed:', message)
    throw new Error(`PDF generation failed: could not launch browser. ${message}`)
  }

  try {
    const page = await browser.newPage()
    await page.setContent(htmlWithCss, { waitUntil: 'networkidle0' })

    const headerTemplate = title
      ? `<div style="font-size:9px;color:#666;width:100%;padding:0 20mm;box-sizing:border-box;display:flex;justify-content:space-between;">
           <span>${escapeHtml(title)}</span>
           <span>${escapeHtml(date)}</span>
         </div>`
      : '<div></div>'

    const footerTemplate = `<div style="font-size:9px;color:#666;width:100%;padding:0 20mm;box-sizing:border-box;text-align:center;">
        Page <span class="pageNumber"></span> of <span class="totalPages"></span>
      </div>`

    const pdfBuffer = await page.pdf({
      format: pageSize,
      landscape,
      margin,
      headerTemplate,
      footerTemplate,
      displayHeaderFooter: true,
      printBackground: true,
    })

    const buffer = Buffer.from(pdfBuffer)
    console.log(`[PDF] Generated PDF: ${buffer.length} bytes`)

    return {
      buffer,
      fileSize: buffer.length,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[PDF] PDF generation error:', message)
    throw new Error(`PDF generation failed: ${message}`)
  } finally {
    await browser.close()
  }
}

/**
 * Produce a safe, lowercase filename from plan name, doc type and date.
 *
 * Pattern: `{plan-name}_{doc-type}_{date}.pdf`
 * e.g. `acme-crm-migration_text-document_2026-04-03.pdf`
 */
export function sanitizeFilename(planName: string, docType: string, date: string): string {
  const sanitize = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip accents
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // non-alphanum → hyphen
      .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens

  const safePlan = sanitize(planName)
  const safeType = sanitize(docType)
  const safeDate = sanitize(date)

  return `${safePlan}_${safeType}_${safeDate}.pdf`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
