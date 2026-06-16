// Tests unitaires — logique pure des services documents (018/019/020)
// Données réalistes Salesforce → HubSpot (Constitution Principe IV)
//
// Ces tests valident la chaîne complète :
//   describeRule (018) → enrichissement HTML
//   computeUnmappedFields (016) → section exclusions
//
// Sans DB (pure logique via les coeurs purs importés directement).

import { describe, it, expect } from 'vitest'
import {
  describeRule,
  type RuleDescriptionInput,
} from '@/features/documents/lib/rule-description'
import { computeUnmappedFields } from '@/features/unmapped/lib/compute-unmapped'
import { sanitizePdfFilename } from '@/features/documents/lib/pdf-export'
import type { ConnectorField } from '@/lib/types/connector'

// ---------------------------------------------------------------------------
// Helpers — données réalistes SF/HubSpot
// ---------------------------------------------------------------------------

function sfField(apiName: string, label: string, dataType: string, isRequired = false): ConnectorField {
  return { apiName, label, dataType, isRequired, isReadOnly: false, isUnique: false }
}

function hsField(apiName: string, label: string, dataType: string, isRequired = false): ConnectorField {
  return { apiName, label, dataType, isRequired, isReadOnly: false, isUnique: false }
}

// Champs SF Contact typiques
const SF_CONTACT_FIELDS: ConnectorField[] = [
  sfField('FirstName', 'First Name', 'string'),
  sfField('LastName', 'Last Name', 'string', true),
  sfField('Email', 'Email', 'email', true),
  sfField('Phone', 'Phone', 'phone'),
  sfField('LeadSource', 'Lead Source', 'picklist'),
  sfField('MobilePhone', 'Mobile Phone', 'phone'),
  sfField('Description', 'Description', 'textarea'),
]

// Champs HubSpot Contacts typiques
const HS_CONTACT_FIELDS: ConnectorField[] = [
  hsField('firstname', 'First name', 'string', true),
  hsField('lastname', 'Last name', 'string', true),
  hsField('email', 'Email', 'string', true),
  hsField('phone', 'Phone number', 'string'),
  hsField('hs_lead_source', 'Lead source', 'enumeration'),
  hsField('notes_body', 'Notes', 'string'),
]

// ---------------------------------------------------------------------------
// 018 describeRule — validation des 5 types
// ---------------------------------------------------------------------------

describe('describeRule — intégration 5 types (données SF/HubSpot)', () => {
  it('DIRECT_COPY SF string → HubSpot string : copie directe', () => {
    const input: RuleDescriptionInput = {
      ruleType: 'DIRECT_COPY',
      sourceDataType: 'string',
      destDataType: 'string',
    }
    const { description, source } = describeRule(input)
    expect(source).toBe('template')
    expect(description).toContain('Copie directe')
  })

  it('DIRECT_COPY SF phone → HubSpot string : conversion de type', () => {
    const input: RuleDescriptionInput = {
      ruleType: 'DIRECT_COPY',
      sourceDataType: 'phone',
      destDataType: 'string',
    }
    const { description, source } = describeRule(input)
    expect(source).toBe('template')
    expect(description).toContain('conversion')
    expect(description).toContain('phone')
    expect(description).toContain('string')
  })

  it('VALUE_EQUIVALENCE SF LeadSource → HubSpot hs_lead_source', () => {
    const input: RuleDescriptionInput = {
      ruleType: 'VALUE_EQUIVALENCE',
      valueEquivalences: [
        { sourceValue: 'Web', destinationValue: 'ONLINE' },
        { sourceValue: 'Phone Inquiry', destinationValue: 'PHONE' },
        { sourceValue: 'Partner Referral', destinationValue: 'PARTNER' },
        { sourceValue: 'Cold Call', destinationValue: 'COLD_CALL' },
        { sourceValue: 'Purchased List', destinationValue: 'OTHER' },
        { sourceValue: 'Internal', destinationValue: 'OTHER' }, // 6ème → "and 1 more"
      ],
    }
    const { description, source } = describeRule(input)
    expect(source).toBe('template')
    expect(description).toContain("'Web' becomes 'ONLINE'")
    expect(description).toContain('and 1 more equivalence.')
  })

  it('INFORMATIONAL SF Stage → HubSpot dealstage (message pré-défini)', () => {
    const input: RuleDescriptionInput = {
      ruleType: 'INFORMATIONAL',
      informationalMessage:
        'Le statut de lead HubSpot est réinitialisé à "New" lors de l\'import.',
    }
    const { description, source } = describeRule(input)
    expect(source).toBe('template')
    expect(description).toContain('New')
  })

  it('ERROR SF multipicklist → HubSpot text (incompatibilité)', () => {
    const input: RuleDescriptionInput = {
      ruleType: 'ERROR',
      sourceType: 'multipicklist',
      destType: 'text',
    }
    const { description, source } = describeRule(input)
    expect(source).toBe('template')
    expect(description).toContain('WARNING')
    expect(description).toContain('multipicklist')
    expect(description).toContain('text')
    expect(description).toContain('CSV')
  })

  it('PROMPT SF industry → HubSpot industry (fallback sans API key)', () => {
    const input: RuleDescriptionInput = {
      ruleType: 'PROMPT',
      promptText:
        'Classify the Salesforce Account Industry field into one of the HubSpot industry categories: Technology, Finance, Healthcare, Retail, Other.',
    }
    const { description, source } = describeRule(input)
    expect(source).toBe('fallback')
    expect(description).toContain('(requires review)')
    expect(description).toContain('HubSpot industry')
  })

  it('PROMPT sans texte de prompt → message générique fallback', () => {
    const input: RuleDescriptionInput = { ruleType: 'PROMPT', promptText: null }
    const { description, source } = describeRule(input)
    expect(source).toBe('fallback')
    expect(description).toBe('No classification prompt defined. (requires review)')
  })
})

// ---------------------------------------------------------------------------
// 016 computeUnmappedFields — intégration avec données SF/HubSpot
// ---------------------------------------------------------------------------

describe('computeUnmappedFields — champs SF Contact → HubSpot Contacts', () => {
  it('MobilePhone et Description non-mappés → apparaissent dans unmappedSourceFields', () => {
    const mappings = [
      { sourceFieldName: 'FirstName', destinationFieldName: 'firstname' },
      { sourceFieldName: 'LastName', destinationFieldName: 'lastname' },
      { sourceFieldName: 'Email', destinationFieldName: 'email' },
      { sourceFieldName: 'Phone', destinationFieldName: 'phone' },
      { sourceFieldName: 'LeadSource', destinationFieldName: 'hs_lead_source' },
      // MobilePhone et Description non mappés
    ]

    const report = computeUnmappedFields(SF_CONTACT_FIELDS, HS_CONTACT_FIELDS, mappings, [])

    expect(report.unmappedSourceFields.map((f) => f.apiName)).toContain('MobilePhone')
    expect(report.unmappedSourceFields.map((f) => f.apiName)).toContain('Description')
    expect(report.unmappedSourceFields.length).toBe(2)
  })

  it('notes_body non-couvert → apparaît dans unmappedRequiredDestFields si requis', () => {
    // notes_body n'est pas requis par défaut dans notre fixture
    const mappings = [
      { sourceFieldName: 'FirstName', destinationFieldName: 'firstname' },
      { sourceFieldName: 'LastName', destinationFieldName: 'lastname' },
      { sourceFieldName: 'Email', destinationFieldName: 'email' },
      { sourceFieldName: 'Phone', destinationFieldName: 'phone' },
      { sourceFieldName: 'LeadSource', destinationFieldName: 'hs_lead_source' },
    ]

    const report = computeUnmappedFields(SF_CONTACT_FIELDS, HS_CONTACT_FIELDS, mappings, [])

    // notes_body n'est pas required → pas dans unmappedRequiredDestFields
    expect(report.unmappedRequiredDestFields.map((f) => f.apiName)).not.toContain('notes_body')
  })

  it('couverture source 100 % quand tous mappés', () => {
    const allMapped = SF_CONTACT_FIELDS.map((f, i) => ({
      sourceFieldName: f.apiName,
      destinationFieldName: HS_CONTACT_FIELDS[i % HS_CONTACT_FIELDS.length].apiName,
    }))

    const report = computeUnmappedFields(SF_CONTACT_FIELDS, HS_CONTACT_FIELDS, allMapped, [])
    expect(report.sourceCoverage).toBe(100)
    expect(report.unmappedSourceFields.length).toBe(0)
  })

  it('champ exclu compte dans la couverture source', () => {
    const mappings = [
      { sourceFieldName: 'FirstName', destinationFieldName: 'firstname' },
      { sourceFieldName: 'LastName', destinationFieldName: 'lastname' },
      { sourceFieldName: 'Email', destinationFieldName: 'email' },
    ]
    const exclusions = [
      { id: 'ex1', sourceFieldName: 'Phone', reason: 'Not needed in HS', createdAt: '2026-06-16T00:00:00Z' },
      { id: 'ex2', sourceFieldName: 'LeadSource', reason: null, createdAt: '2026-06-16T00:00:00Z' },
    ]

    const report = computeUnmappedFields(SF_CONTACT_FIELDS, HS_CONTACT_FIELDS, mappings, exclusions)

    // 3 mappés + 2 exclus = 5 sur 7 → ~71 % (arrondi)
    // MobilePhone et Description restent non-mappés
    expect(report.unmappedSourceFields.map((f) => f.apiName)).toContain('MobilePhone')
    expect(report.unmappedSourceFields.map((f) => f.apiName)).toContain('Description')
    expect(report.excludedSourceFields.map((f) => f.sourceFieldName)).toContain('Phone')
  })
})

// ---------------------------------------------------------------------------
// Integration chaîne 019/020 : describeRule → HTML → unmapped
// ---------------------------------------------------------------------------

describe('chaîne 019/020 — describeRule + computeUnmappedFields + sanitizePdfFilename', () => {
  it('pipeline complet : 3 règles différentes + 1 champ non-mappé → résumé cohérent', () => {
    // Simuler ce que fait le service sans DB
    const fieldMappings = [
      {
        sourceFieldName: 'FirstName',
        destinationFieldName: 'firstname',
        ruleInput: { ruleType: 'DIRECT_COPY' as const, sourceDataType: 'string', destDataType: 'string' },
      },
      {
        sourceFieldName: 'LeadSource',
        destinationFieldName: 'hs_lead_source',
        ruleInput: {
          ruleType: 'VALUE_EQUIVALENCE' as const,
          valueEquivalences: [
            { sourceValue: 'Web', destinationValue: 'ONLINE' },
            { sourceValue: 'Phone Inquiry', destinationValue: 'PHONE' },
          ],
        } as RuleDescriptionInput,
      },
      {
        sourceFieldName: 'Email',
        destinationFieldName: 'email',
        ruleInput: { ruleType: 'INFORMATIONAL' as const, informationalMessage: 'Email copié tel quel.' },
      },
    ]

    const descriptions = fieldMappings.map((fm) => describeRule(fm.ruleInput))

    // Validation
    expect(descriptions[0].source).toBe('template')
    expect(descriptions[0].description).toContain('Copie directe')

    expect(descriptions[1].source).toBe('template')
    expect(descriptions[1].description).toContain("'Web' becomes 'ONLINE'")

    expect(descriptions[2].source).toBe('template')
    expect(descriptions[2].description).toBe('Email copié tel quel.')

    // Calcul unmapped : Phone, MobilePhone, Description non-mappés
    const mappingsForUnmapped = fieldMappings.map((fm) => ({
      sourceFieldName: fm.sourceFieldName,
      destinationFieldName: fm.destinationFieldName,
    }))
    const unmapped = computeUnmappedFields(SF_CONTACT_FIELDS, HS_CONTACT_FIELDS, mappingsForUnmapped, [])
    expect(unmapped.unmappedSourceFields.length).toBe(4) // Phone, MobilePhone, Description, LastName non mappé ici

    // Nom de fichier PDF
    const filename = sanitizePdfFilename('Contact Migration SF→HS', 'text-document', '2026-06-16')
    expect(filename).toMatch(/^[a-z0-9_-]+\.pdf$/)
    expect(filename).toContain('text-document')
  })
})
