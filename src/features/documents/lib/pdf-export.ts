// 021-pdf-export — Utilitaires PDF côté serveur (Netlify-compatible)
//
// generatePdfBinary() rend le HTML enrichi en PDF A4 binaire via puppeteer-core +
// @sparticuz/chromium (Chromium compatible Lambda/OpenNext — on n'embarque PAS le
// paquet 'puppeteer' complet, dont le Chromium bundlé casse sur Lambda).
//
// Stratégie executablePath :
//   1. PUPPETEER_EXECUTABLE_PATH (dev local : pointer vers un Chrome/Edge installé)
//   2. @sparticuz/chromium.executablePath() (runtime Netlify/Lambda)
// Si le lancement échoue, generatePdfBinary lève une erreur : la route retombe
// alors gracieusement sur le HTML d'impression (enrichHtmlForPrint).

import type { Browser, PDFOptions } from 'puppeteer-core'

const DEFAULT_MARGIN = {
  top: '25mm',
  right: '25mm',
  bottom: '20mm',
  left: '20mm',
}

export interface PdfBinaryOptions {
  /** Titre affiché dans l'entête de page (A4). */
  title?: string
  /** Date affichée dans l'entête de page. */
  date?: string
}

export interface PdfBinaryResult {
  buffer: Buffer
  fileSize: number
}

/**
 * Résout le chemin de l'exécutable Chromium.
 * - En dev/local : honore PUPPETEER_EXECUTABLE_PATH si défini.
 * - Sinon : utilise le Chromium de @sparticuz/chromium (runtime Netlify/Lambda,
 *   et dev local si la dépendance a téléchargé son binaire).
 */
async function resolveChromium(): Promise<{
  executablePath: string
  args: string[]
  headless: boolean | 'shell'
  defaultViewport: { width: number; height: number; deviceScaleFactor?: number } | null
}> {
  // Import dynamique : évite de charger le binaire au build et garde la route
  // fonctionnelle même si la dépendance n'est pas résolvable (fallback HTML).
  const chromium = (await import('@sparticuz/chromium')).default

  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH
  const executablePath = envPath && envPath.trim() !== '' ? envPath : await chromium.executablePath()

  return {
    executablePath,
    args: chromium.args,
    headless: chromium.headless,
    defaultViewport: chromium.defaultViewport,
  }
}

/**
 * Convertit une chaîne HTML auto-portée en PDF A4 binaire.
 *
 * Injecte du CSS anti-coupure (break-inside: avoid) sur les <tr> et titres,
 * puis rend via page.pdf() avec entête (titre + date) et pied de page (Page X / Y).
 *
 * Lève une erreur si Chromium ne peut pas démarrer — l'appelant doit alors
 * retomber sur le HTML d'impression (enrichHtmlForPrint).
 */
export async function generatePdfBinary(
  htmlContent: string,
  options: PdfBinaryOptions = {},
): Promise<PdfBinaryResult> {
  const { title = '', date = new Date().toLocaleDateString('fr-FR') } = options

  // CSS anti-coupure de page injecté avant rendu.
  const pageBreakCss = `
    <style>
      tr { break-inside: avoid; page-break-inside: avoid; }
      h1, h2, h3, h4, h5, h6 { break-inside: avoid; page-break-inside: avoid; break-after: avoid; page-break-after: avoid; }
    </style>
  `
  const htmlWithCss = htmlContent.includes('</head>')
    ? htmlContent.replace('</head>', `${pageBreakCss}</head>`)
    : `${pageBreakCss}${htmlContent}`

  // Import dynamique de puppeteer-core (idem : ne casse pas le build).
  const puppeteer = (await import('puppeteer-core')).default
  const { executablePath, args, headless, defaultViewport } = await resolveChromium()

  console.log(`[PDF] Lancement de Chromium — title="${title}" (${executablePath})`)

  let browser: Browser | undefined
  try {
    browser = await puppeteer.launch({
      executablePath,
      args,
      headless,
      defaultViewport,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[PDF] Échec du lancement de Chromium :', message)
    throw new Error(`Génération PDF impossible : Chromium n'a pas pu démarrer. ${message}`)
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
        Page <span class="pageNumber"></span> / <span class="totalPages"></span>
      </div>`

    const pdfOptions: PDFOptions = {
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      margin: DEFAULT_MARGIN,
    }

    const pdfBytes = await page.pdf(pdfOptions)
    const buffer = Buffer.from(pdfBytes)
    console.log(`[PDF] PDF généré : ${buffer.length} octets`)

    return { buffer, fileSize: buffer.length }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[PDF] Erreur de génération du PDF :', message)
    throw new Error(`Génération PDF échouée : ${message}`)
  } finally {
    await browser.close()
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Produit un nom de fichier PDF sécurisé.
 * Pattern : {plan-name}_{doc-type}_{date}.pdf
 * Exemple  : acme-migration_text-document_2026-06-16.pdf
 */
export function sanitizePdfFilename(planName: string, docType: string, date: string): string {
  const sanitize = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')   // supprimer les accents
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')       // caractères non-alphanum → tiret
      .replace(/^-+|-+$/g, '')           // supprimer tirets en tête/queue

  return `${sanitize(planName)}_${sanitize(docType)}_${sanitize(date)}.pdf`
}

/**
 * Enrichit le HTML du document avec du CSS d'impression A4 pour permettre
 * l'impression navigateur en attendant le PDF binaire Puppeteer.
 */
export function enrichHtmlForPrint(
  htmlContent: string,
  title: string,
  date: string,
): string {
  const printCss = `
<style id="carbo-print">
  /* ─── CSS d'impression A4 (021-pdf-export) ─── */
  @page {
    size: A4 portrait;
    margin: 25mm 20mm 25mm 20mm;
  }
  @media print {
    /* Entête de page */
    body::before {
      content: "${escCssStr(title)}   —   ${escCssStr(date)}";
      display: block;
      position: fixed;
      top: 0; left: 0; right: 0;
      font-size: 9pt;
      color: #666;
      text-align: right;
      padding: 0 5mm;
      border-bottom: 1px solid #ddd;
    }
    /* Pied de page */
    body::after {
      content: "Page " counter(page) " / " counter(pages);
      display: block;
      position: fixed;
      bottom: 0; left: 0; right: 0;
      font-size: 9pt;
      color: #666;
      text-align: center;
      padding: 0 5mm;
      border-top: 1px solid #eee;
    }
    /* Sauts de page propres */
    tr { break-inside: avoid; page-break-inside: avoid; }
    h1, h2, h3, h4, h5, h6 { break-inside: avoid; break-after: avoid; page-break-inside: avoid; page-break-after: avoid; }
    table { break-inside: auto; }
    .signature-section { break-before: page; }
    .toc { break-after: page; }
  }
  /* Bouton impression (ne s'imprime pas) */
  .print-btn {
    display: block;
    margin: 1rem auto 2rem;
    padding: 0.6rem 1.5rem;
    background: #1565c0;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    font-family: system-ui;
  }
  .print-btn:hover { background: #0d47a1; }
  @media print { .print-btn { display: none; } }
</style>
<script>
  // Ouvrir la boîte d'impression au clic sur le bouton
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.querySelector('.print-btn');
    if (btn) btn.addEventListener('click', function () { window.print(); });
  });
</script>
`

  const printButton = `<button class="print-btn" onclick="window.print()">Imprimer / Enregistrer en PDF</button>`

  // Injecter avant </head>
  let enriched = htmlContent.includes('</head>')
    ? htmlContent.replace('</head>', `${printCss}\n</head>`)
    : `${printCss}\n${htmlContent}`

  // Injecter bouton après <body>
  enriched = enriched.replace(/<body([^>]*)>/, `<body$1>\n${printButton}`)

  return enriched
}

/**
 * Échappe une chaîne pour usage dans un littéral CSS content: "..."
 * Supprime les balises HTML (< >) pour éviter toute injection dans le bloc CSS.
 */
function escCssStr(s: string): string {
  return s
    .replace(/</g, '')     // supprimer < (pas de balise dans un littéral CSS)
    .replace(/>/g, '')     // supprimer >
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
}
