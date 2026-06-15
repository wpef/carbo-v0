// Tests unitaires — 020-contractual-document FR-013 : numéro de référence
// Données réalistes : dates réelles de génération de documents contractuels

import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateReferenceNumber,
  generateReferenceNumberForDate,
  isValidReferenceNumber,
  parseReferenceNumber,
  _resetCounterForTests,
} from '@/features/documents/lib/reference-number'

beforeEach(() => {
  _resetCounterForTests()
})

// ---------------------------------------------------------------------------
// generateReferenceNumberForDate — déterministe
// ---------------------------------------------------------------------------

describe('generateReferenceNumberForDate', () => {
  it('produit CARBO-YYYYMMDD-XXXX pour une date et séquence données', () => {
    const date = new Date(2026, 5, 16, 9, 0, 0) // 16 juin 2026 locale
    expect(generateReferenceNumberForDate(date, 1)).toBe('CARBO-20260616-0001')
  })

  it('séquence 42 → -0042', () => {
    const date = new Date(2026, 5, 16, 10, 0, 0) // 16 juin 2026 locale
    expect(generateReferenceNumberForDate(date, 42)).toBe('CARBO-20260616-0042')
  })

  it('séquence 1000 → -1000 (4 chiffres exacts)', () => {
    const date = new Date(2026, 5, 16, 10, 0, 0) // 16 juin 2026 locale
    expect(generateReferenceNumberForDate(date, 1000)).toBe('CARBO-20260616-1000')
  })

  it('date de démo — 3 avril 2026', () => {
    const date = new Date(2026, 3, 3, 14, 30, 0) // 3 avril 2026 locale
    expect(generateReferenceNumberForDate(date, 3)).toBe('CARBO-20260403-0003')
  })

  it('n affecte pas le compteur interne', () => {
    const date = new Date(2026, 5, 16, 10, 0, 0) // 16 juin 2026 locale
    generateReferenceNumberForDate(date, 99)
    // Le compteur interne est encore à 0 → le prochain generateReferenceNumber commence à 0001
    const next = generateReferenceNumber(date)
    expect(next).toBe('CARBO-20260616-0001')
  })
})

// ---------------------------------------------------------------------------
// generateReferenceNumber — compteur en mémoire
// ---------------------------------------------------------------------------

describe('generateReferenceNumber', () => {
  it('premier appel → -0001', () => {
    const date = new Date(2026, 5, 16, 10, 0, 0) // 16 juin 2026 locale
    expect(generateReferenceNumber(date)).toBe('CARBO-20260616-0001')
  })

  it('incrémente séquentiellement dans la même journée', () => {
    const date = new Date(2026, 5, 16, 10, 0, 0) // 16 juin 2026 locale
    const r1 = generateReferenceNumber(date)
    const r2 = generateReferenceNumber(date)
    const r3 = generateReferenceNumber(date)
    expect(r1).toBe('CARBO-20260616-0001')
    expect(r2).toBe('CARBO-20260616-0002')
    expect(r3).toBe('CARBO-20260616-0003')
  })

  it('reset automatique au changement de date', () => {
    // Utiliser des dates locales explicites pour éviter les décalages UTC
    // new Date(year, month-1, day) crée une date locale sans conversion TZ
    const day1 = new Date(2026, 5, 16, 10, 0, 0) // 16 juin 2026 10h locale
    const day2 = new Date(2026, 5, 17, 10, 0, 0) // 17 juin 2026 10h locale
    generateReferenceNumber(day1) // 0001 le 16
    generateReferenceNumber(day1) // 0002 le 16
    const next = generateReferenceNumber(day2) // 0001 le 17
    expect(next).toBe('CARBO-20260617-0001')
  })

  it('deux numéros consécutifs sont toujours distincts', () => {
    const date = new Date(2026, 5, 16, 10, 0, 0)
    const r1 = generateReferenceNumber(date)
    const r2 = generateReferenceNumber(date)
    expect(r1).not.toBe(r2)
  })

  it('format exact : CARBO-YYYYMMDD-XXXX (mois et jour padded)', () => {
    const date = new Date(2026, 0, 5, 10, 0, 0) // 5 janvier 2026 locale
    const ref = generateReferenceNumber(date)
    expect(ref).toMatch(/^CARBO-\d{8}-\d{4}$/)
    expect(ref).toBe('CARBO-20260105-0001')
  })
})

// ---------------------------------------------------------------------------
// isValidReferenceNumber
// ---------------------------------------------------------------------------

describe('isValidReferenceNumber', () => {
  it('numéro valide → true', () => {
    expect(isValidReferenceNumber('CARBO-20260616-0001')).toBe(true)
  })

  it('numéro valide — séquence haute', () => {
    expect(isValidReferenceNumber('CARBO-20260403-9999')).toBe(true)
  })

  it('préfixe incorrect → false', () => {
    expect(isValidReferenceNumber('DOC-20260616-0001')).toBe(false)
  })

  it('date avec tirets → false', () => {
    expect(isValidReferenceNumber('CARBO-2026-06-16-0001')).toBe(false)
  })

  it('séquence à 3 chiffres → false', () => {
    expect(isValidReferenceNumber('CARBO-20260616-001')).toBe(false)
  })

  it('séquence à 5 chiffres → false', () => {
    expect(isValidReferenceNumber('CARBO-20260616-00001')).toBe(false)
  })

  it('date à 7 chiffres → false', () => {
    expect(isValidReferenceNumber('CARBO-2026061-0001')).toBe(false)
  })

  it('chaîne vide → false', () => {
    expect(isValidReferenceNumber('')).toBe(false)
  })

  it('casse incorrecte → false', () => {
    expect(isValidReferenceNumber('carbo-20260616-0001')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// parseReferenceNumber
// ---------------------------------------------------------------------------

describe('parseReferenceNumber', () => {
  it('parse un numéro valide', () => {
    const parsed = parseReferenceNumber('CARBO-20260616-0042')
    expect(parsed).toEqual({ dateStr: '20260616', sequence: 42 })
  })

  it('sequence 0001 → 1 (nombre entier)', () => {
    const parsed = parseReferenceNumber('CARBO-20260403-0001')
    expect(parsed?.sequence).toBe(1)
  })

  it('retourne null pour un numéro invalide', () => {
    expect(parseReferenceNumber('INVALID')).toBeNull()
  })

  it('retourne null pour une chaîne vide', () => {
    expect(parseReferenceNumber('')).toBeNull()
  })

  it('aller-retour : générer puis parser', () => {
    const date = new Date(2026, 5, 16, 10, 0, 0) // 16 juin 2026 locale
    const ref = generateReferenceNumberForDate(date, 7)
    const parsed = parseReferenceNumber(ref)
    expect(parsed).toEqual({ dateStr: '20260616', sequence: 7 })
  })
})
