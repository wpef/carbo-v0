// 021-pdf-export — Utilitaires PDF côté serveur
//
// TODO: Installer puppeteer et câbler generatePdfBinary() pour la génération
//       de PDF binaire réelle. La fonction est actuellement un stub qui retourne
//       le HTML enrichi de CSS @media print pour impression navigateur.
//
// Pour le PDF binaire :
//   import puppeteer from 'puppeteer'
//   const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
//   const page = await browser.newPage()
//   await page.setContent(html, { waitUntil: 'networkidle0' })
//   const buffer = await page.pdf({ format: 'A4', margin: { top: '25mm', bottom: '25mm', left: '20mm', right: '20mm' }, ... })
//   await browser.close()

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
