// Export PDF = impression navigateur (05-acceptance §12), sans dépendance.
// Ouvre le fragment HTML du document dans une fenêtre imprimable, l'habille
// d'une feuille de style complète, puis déclenche window.print().
//
// ponytail: impression navigateur interactive. Si un PDF non-interactif
// (génération server-side) devient nécessaire, brancher puppeteer +
// @sparticuz/chromium dans une route — pas avant.

const PRINT_CSS = `
  body { font-family: system-ui, -apple-system, sans-serif; max-width: 960px; margin: 0 auto; padding: 2rem; color: #1a1a1a; line-height: 1.5; }
  h1 { border-bottom: 2px solid #333; padding-bottom: 0.5rem; font-size: 1.5rem; text-align: center; }
  h2, h2.plan-name { text-align: center; color: #444; font-weight: normal; font-size: 1.2rem; margin-top: 0.5rem; }
  h3, h3.article { margin-top: 2rem; border-bottom: 1px solid #ccc; padding-bottom: 0.3rem; font-size: 1.1rem; }
  h4 { margin-top: 1.2rem; color: #333; font-size: 1rem; }
  .doc-header { text-align: center; margin-bottom: 1.5rem; }
  .doc-ref { font-family: monospace; color: #555; }
  .doc-date { font-size: 0.9rem; color: #666; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.85rem; }
  th, td { border: 1px solid #bbb; padding: 0.45rem 0.65rem; text-align: left; vertical-align: top; }
  th { background: #e8e8e8; font-weight: bold; }
  tr:nth-child(even) { background: #f9f9f9; }
  tr.row-fallback { background: #fff8e1; }
  td.fallback-cell { font-family: monospace; font-size: 0.8rem; color: #7b5800; }
  code { background: #f0f0f0; padding: 1px 4px; border-radius: 2px; font-family: monospace; font-size: 0.82rem; }
  .rule-type { background: #e3f2fd; color: #0d47a1; padding: 1px 6px; border-radius: 3px; font-size: 0.78rem; }
  .badge-ok { background: #e8f5e9; color: #2e7d32; padding: 2px 6px; border-radius: 3px; font-size: 0.78rem; }
  .badge-warn { background: #fff3e0; color: #e65100; padding: 2px 6px; border-radius: 3px; font-size: 0.78rem; }
  .badge-error { background: #ffebee; color: #c62828; padding: 2px 6px; border-radius: 3px; font-size: 0.78rem; }
  .meta { color: #666; font-size: 0.85rem; }
  .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 0.6rem 1rem; margin: 0.8rem 0; border-radius: 3px; }
  .ok-notice { color: #2e7d32; font-size: 0.9rem; }
  .stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem; margin: 1rem 0; }
  .stat-card { background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 4px; padding: 0.6rem; text-align: center; }
  .stat-value { font-size: 1.4rem; font-weight: bold; color: #1565c0; }
  .stat-label { font-size: 0.72rem; color: #666; }
  .scope-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem 2rem; margin: 1rem 0; }
  .scope-grid dt { font-weight: bold; color: #555; }
  .scope-grid dd { margin: 0; }
  .toc { background: #f8f8f8; border: 1px solid #ddd; padding: 1rem 1.5rem; margin: 1.5rem 0; border-radius: 4px; }
  .toc a { color: #1565c0; text-decoration: none; }
  nav ol { margin: 0.3rem 0; }
  .signature-section { margin-top: 3rem; border-top: 2px solid #333; padding-top: 1.5rem; }
  .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; margin-top: 2rem; }
  .sig-label { font-size: 0.8rem; color: #666; margin-top: 1rem; }
  .sig-line { border-bottom: 1px solid #999; margin-top: 0.4rem; min-height: 2.2rem; }
  @media print {
    tr { break-inside: avoid; }
    h3, h4 { break-inside: avoid; break-after: avoid; }
    .signature-section { break-before: page; }
  }
`;

export function printDocument(title: string, htmlFragment: string): void {
  const win = window.open("", "_blank", "width=920,height=1000");
  if (!win) return;
  const esc = title.replace(/</g, "&lt;");
  win.document.write(
    `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${esc}</title><style>${PRINT_CSS}</style></head><body>${htmlFragment}</body></html>`,
  );
  win.document.close();
  win.focus();
  win.print();
}
