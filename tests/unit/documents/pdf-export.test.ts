// Tests unitaires — 021-pdf-export (utilitaires purs)
// Données réalistes Salesforce/HubSpot (Constitution Principe IV)

import { describe, it, expect } from 'vitest'
import {
  sanitizePdfFilename,
  enrichHtmlForPrint,
} from '@/features/documents/lib/pdf-export'

// ---------------------------------------------------------------------------
// sanitizePdfFilename
// ---------------------------------------------------------------------------

describe('sanitizePdfFilename', () => {
  it('produit le bon pattern {plan}_{type}_{date}.pdf', () => {
    expect(sanitizePdfFilename('Acme Migration', 'text-document', '2026-06-16')).toBe(
      'acme-migration_text-document_2026-06-16.pdf',
    )
  })

  it('plan SF→HubSpot avec caractères spéciaux', () => {
    const name = 'Salesforce → HubSpot (Q2 2026)'
    const result = sanitizePdfFilename(name, 'contractual-document', '2026-04-03')
    expect(result).toBe('salesforce-hubspot-q2-2026_contractual-document_2026-04-03.pdf')
  })

  it('plan avec accents et cédilles', () => {
    // Nom client français typique
    const result = sanitizePdfFilename('Données Équipe Crédit', 'text-document', '2026-06-16')
    expect(result).toMatch(/^[a-z0-9_-]+\.pdf$/)
    expect(result).not.toContain('é')
    expect(result).not.toContain('à')
  })

  it('type contractual-document préservé avec tirets', () => {
    const result = sanitizePdfFilename('Plan', 'contractual-document', '2026-06-01')
    expect(result).toBe('plan_contractual-document_2026-06-01.pdf')
  })

  it('plan avec tirets initiaux et finaux → suppressions', () => {
    const result = sanitizePdfFilename('  Migration CRM  ', 'text-document', '2026-06-16')
    expect(result).not.toMatch(/^-/)
    expect(result).not.toMatch(/-_/)
  })

  it('date ISO correctement préservée', () => {
    const result = sanitizePdfFilename('Plan', 'text-document', '2026-01-05')
    expect(result).toBe('plan_text-document_2026-01-05.pdf')
  })
})

// ---------------------------------------------------------------------------
// enrichHtmlForPrint
// ---------------------------------------------------------------------------

describe('enrichHtmlForPrint', () => {
  const minimalHtml = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Test</title></head>
<body><p>Contenu</p></body>
</html>`

  it('injecte le CSS @media print dans </head>', () => {
    const result = enrichHtmlForPrint(minimalHtml, 'Acme Migration', '2026-06-16')
    expect(result).toContain('@media print')
    expect(result).toContain('@page')
  })

  it('injecte le bouton impression dans <body>', () => {
    const result = enrichHtmlForPrint(minimalHtml, 'Plan', '2026-06-16')
    expect(result).toContain('print-btn')
    expect(result).toContain('window.print()')
  })

  it('préserve le contenu HTML original', () => {
    const result = enrichHtmlForPrint(minimalHtml, 'Plan', '2026-06-16')
    expect(result).toContain('<p>Contenu</p>')
  })

  it('inclut le titre dans le CSS print', () => {
    const result = enrichHtmlForPrint(minimalHtml, 'Acme CRM Migration', '2026-06-16')
    expect(result).toContain('Acme CRM Migration')
  })

  it('inclut la date dans le CSS print', () => {
    const result = enrichHtmlForPrint(minimalHtml, 'Plan', '2026-06-16')
    expect(result).toContain('2026-06-16')
  })

  it('fonctionne sans </head> (HTML partiel)', () => {
    const partialHtml = '<div><p>Contenu partiel</p></div>'
    const result = enrichHtmlForPrint(partialHtml, 'Plan', '2026-06-16')
    expect(result).toContain('@media print')
    expect(result).toContain('Contenu partiel')
  })

  it('ajoute break-inside: avoid sur les lignes de tableau', () => {
    const result = enrichHtmlForPrint(minimalHtml, 'Plan', '2026-06-16')
    expect(result).toContain('break-inside: avoid')
  })

  it('inclut CSS de sauts de page propres (spec 021 FR-008)', () => {
    const result = enrichHtmlForPrint(minimalHtml, 'Plan', '2026-06-16')
    expect(result).toContain('page-break-inside: avoid')
  })

  it('ne laisse pas de caractères dangereux dans le CSS (XSS)', () => {
    const maliciousTitle = 'Plan <script>alert(1)</script>'
    const result = enrichHtmlForPrint(minimalHtml, maliciousTitle, '2026-06-16')
    // Le titre est dans un attribut CSS content: "..." — les < et > doivent être échappés ou absents
    // La valeur brute ne doit pas créer de balise script
    const cssBlock = result.split('<style id="carbo-print">')[1]?.split('</style>')[0] ?? ''
    expect(cssBlock).not.toContain('<script>')
  })
})
