// 006-destination-connection — Demo Destination Adapter (HubSpot-like pre-seeded data)

import {
  ConnectionStatus,
  type ConnectorAdapter,
  type ConnectorConnection,
  type ConnectorSchema,
  type ConnectorObject,
  type ConnectorField,
  type PaginatedRecords,
  type FieldStats,
} from '@/lib/connectors/types'

// ---------------------------------------------------------------------------
// Pre-seeded schema: 10 HubSpot-like objects (7 standard + 3 custom)
// ---------------------------------------------------------------------------

const DEMO_OBJECTS: ConnectorObject[] = [
  {
    apiName: 'contacts',
    label: 'Contacts',
    description: 'Individual people in your CRM',
    isCustom: false,
    isSelected: false,
  },
  {
    apiName: 'companies',
    label: 'Companies',
    description: 'Organizations and businesses',
    isCustom: false,
    isSelected: false,
  },
  {
    apiName: 'deals',
    label: 'Deals',
    description: 'Sales opportunities and pipeline stages',
    isCustom: false,
    isSelected: false,
  },
  {
    apiName: 'tickets',
    label: 'Tickets',
    description: 'Customer support requests and issues',
    isCustom: false,
    isSelected: false,
  },
  {
    apiName: 'products',
    label: 'Products',
    description: 'Product catalog items',
    isCustom: false,
    isSelected: false,
  },
  {
    apiName: 'line_items',
    label: 'Line Items',
    description: 'Individual products within a deal or quote',
    isCustom: false,
    isSelected: false,
  },
  {
    apiName: 'quotes',
    label: 'Quotes',
    description: 'Sales proposals sent to contacts',
    isCustom: false,
    isSelected: false,
  },
  {
    apiName: 'service_contracts',
    label: 'Service Contracts',
    description: 'Custom object for tracking ongoing service agreements',
    isCustom: true,
    isSelected: false,
  },
  {
    apiName: 'partner_referrals',
    label: 'Partner Referrals',
    description: 'Custom object for tracking referrals from partner network',
    isCustom: true,
    isSelected: false,
  },
  {
    apiName: 'onboarding_checklists',
    label: 'Onboarding Checklists',
    description: 'Custom object for new customer onboarding tracking',
    isCustom: true,
    isSelected: false,
  },
]

// ---------------------------------------------------------------------------
// Pre-seeded fields per object
// ---------------------------------------------------------------------------

const DEMO_FIELDS: Record<string, ConnectorField[]> = {
  contacts: [
    { apiName: 'id', label: 'Record ID', dataType: 'string', isRequired: true, isReadOnly: true, isUnique: true },
    { apiName: 'firstname', label: 'First Name', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'lastname', label: 'Last Name', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'email', label: 'Email', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: true },
    { apiName: 'phone', label: 'Phone Number', dataType: 'phone', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'mobilephone', label: 'Mobile Phone', dataType: 'phone', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'jobtitle', label: 'Job Title', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'company', label: 'Company Name', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'associatedcompanyid', label: 'Associated Company', dataType: 'reference', isRequired: false, isReadOnly: false, isUnique: false, referenceTo: 'companies', relationshipType: 'ManyToOne' },
    { apiName: 'lifecyclestage', label: 'Lifecycle Stage', dataType: 'enumeration', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'hs_lead_status', label: 'Lead Status', dataType: 'enumeration', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'hubspot_owner_id', label: 'Contact Owner', dataType: 'reference', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'createdate', label: 'Create Date', dataType: 'datetime', isRequired: false, isReadOnly: true, isUnique: false },
    { apiName: 'lastmodifieddate', label: 'Last Modified Date', dataType: 'datetime', isRequired: false, isReadOnly: true, isUnique: false },
    { apiName: 'hs_email_optout', label: 'Unsubscribed from all email', dataType: 'bool', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'date_of_birth', label: 'Date of Birth', dataType: 'date', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'hs_content_membership_notes', label: 'Membership Notes', dataType: 'number', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'country', label: 'Country/Region', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'city', label: 'City', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'zip', label: 'Postal Code', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'hs_calculated_merged_vids', label: 'Merged contact IDs', dataType: 'string', isRequired: false, isReadOnly: true, isUnique: false },
    { apiName: 'num_associated_deals', label: 'Number of Associated Deals', dataType: 'number', isRequired: false, isReadOnly: true, isUnique: false },
  ],

  companies: [
    { apiName: 'id', label: 'Record ID', dataType: 'string', isRequired: true, isReadOnly: true, isUnique: true },
    { apiName: 'name', label: 'Company name', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'domain', label: 'Company Domain Name', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'website', label: 'Website URL', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'phone', label: 'Phone Number', dataType: 'phone', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'industry', label: 'Industry', dataType: 'enumeration', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'numberofemployees', label: 'Number of Employees', dataType: 'number', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'annualrevenue', label: 'Annual Revenue', dataType: 'number', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'country', label: 'Country/Region', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'city', label: 'City', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'lifecyclestage', label: 'Lifecycle Stage', dataType: 'enumeration', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'hubspot_owner_id', label: 'Company Owner', dataType: 'reference', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'createdate', label: 'Create Date', dataType: 'datetime', isRequired: false, isReadOnly: true, isUnique: false },
    { apiName: 'hs_lastmodifieddate', label: 'Last Modified Date', dataType: 'datetime', isRequired: false, isReadOnly: true, isUnique: false },
    { apiName: 'type', label: 'Type', dataType: 'enumeration', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'description', label: 'Description', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'is_public', label: 'Is Public Company', dataType: 'bool', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'founded_year', label: 'Year Founded', dataType: 'date', isRequired: false, isReadOnly: false, isUnique: false },
  ],

  deals: [
    { apiName: 'id', label: 'Record ID', dataType: 'string', isRequired: true, isReadOnly: true, isUnique: true },
    { apiName: 'dealname', label: 'Deal Name', dataType: 'string', isRequired: true, isReadOnly: false, isUnique: false },
    { apiName: 'amount', label: 'Amount', dataType: 'number', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'dealstage', label: 'Deal Stage', dataType: 'enumeration', isRequired: true, isReadOnly: false, isUnique: false },
    { apiName: 'pipeline', label: 'Pipeline', dataType: 'enumeration', isRequired: true, isReadOnly: false, isUnique: false },
    { apiName: 'closedate', label: 'Close Date', dataType: 'date', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'hubspot_owner_id', label: 'Deal Owner', dataType: 'reference', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'createdate', label: 'Create Date', dataType: 'datetime', isRequired: false, isReadOnly: true, isUnique: false },
    { apiName: 'hs_lastmodifieddate', label: 'Last Modified Date', dataType: 'datetime', isRequired: false, isReadOnly: true, isUnique: false },
    { apiName: 'hs_deal_stage_probability', label: 'Deal Stage Probability', dataType: 'number', isRequired: false, isReadOnly: true, isUnique: false },
    { apiName: 'hs_is_closed_won', label: 'Is Closed Won', dataType: 'bool', isRequired: false, isReadOnly: true, isUnique: false },
    { apiName: 'num_associated_contacts', label: 'Number of Contacts', dataType: 'number', isRequired: false, isReadOnly: true, isUnique: false },
    { apiName: 'notes_last_updated', label: 'Notes last updated', dataType: 'datetime', isRequired: false, isReadOnly: true, isUnique: false },
  ],

  tickets: [
    { apiName: 'id', label: 'Record ID', dataType: 'string', isRequired: true, isReadOnly: true, isUnique: true },
    { apiName: 'subject', label: 'Ticket Name', dataType: 'string', isRequired: true, isReadOnly: false, isUnique: false },
    { apiName: 'content', label: 'Ticket Description', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'hs_ticket_priority', label: 'Priority', dataType: 'enumeration', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'hs_pipeline_stage', label: 'Ticket Status', dataType: 'enumeration', isRequired: true, isReadOnly: false, isUnique: false },
    { apiName: 'hs_pipeline', label: 'Pipeline', dataType: 'enumeration', isRequired: true, isReadOnly: false, isUnique: false },
    { apiName: 'hubspot_owner_id', label: 'Ticket Owner', dataType: 'reference', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'createdate', label: 'Create Date', dataType: 'datetime', isRequired: false, isReadOnly: true, isUnique: false },
    { apiName: 'hs_lastmodifieddate', label: 'Last Modified Date', dataType: 'datetime', isRequired: false, isReadOnly: true, isUnique: false },
    { apiName: 'closed_date', label: 'Close Date', dataType: 'datetime', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'source_type', label: 'Source', dataType: 'enumeration', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'time_to_close', label: 'Time to Close', dataType: 'number', isRequired: false, isReadOnly: true, isUnique: false },
  ],

  products: [
    { apiName: 'id', label: 'Record ID', dataType: 'string', isRequired: true, isReadOnly: true, isUnique: true },
    { apiName: 'name', label: 'Name', dataType: 'string', isRequired: true, isReadOnly: false, isUnique: false },
    { apiName: 'description', label: 'Description', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'price', label: 'Unit Price', dataType: 'number', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'hs_sku', label: 'SKU', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'hs_cost_of_goods_sold', label: 'Cost of Goods Sold', dataType: 'number', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'hs_recurring_billing_period', label: 'Billing Frequency', dataType: 'enumeration', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'createdate', label: 'Create Date', dataType: 'datetime', isRequired: false, isReadOnly: true, isUnique: false },
    { apiName: 'hs_lastmodifieddate', label: 'Last Modified Date', dataType: 'datetime', isRequired: false, isReadOnly: true, isUnique: false },
    { apiName: 'hs_product_type', label: 'Product Type', dataType: 'enumeration', isRequired: false, isReadOnly: false, isUnique: false },
  ],

  line_items: [
    { apiName: 'id', label: 'Record ID', dataType: 'string', isRequired: true, isReadOnly: true, isUnique: true },
    { apiName: 'name', label: 'Name', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'hs_product_id', label: 'Product ID', dataType: 'reference', isRequired: false, isReadOnly: false, isUnique: false, referenceTo: 'products', relationshipType: 'ManyToOne' },
    { apiName: 'quantity', label: 'Quantity', dataType: 'number', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'price', label: 'Unit Price', dataType: 'number', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'amount', label: 'Amount', dataType: 'number', isRequired: false, isReadOnly: true, isUnique: false },
    { apiName: 'discount', label: 'Discount (%)', dataType: 'number', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'hs_line_item_currency_code', label: 'Currency', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'createdate', label: 'Create Date', dataType: 'datetime', isRequired: false, isReadOnly: true, isUnique: false },
    { apiName: 'hs_lastmodifieddate', label: 'Last Modified Date', dataType: 'datetime', isRequired: false, isReadOnly: true, isUnique: false },
  ],

  quotes: [
    { apiName: 'id', label: 'Record ID', dataType: 'string', isRequired: true, isReadOnly: true, isUnique: true },
    { apiName: 'hs_title', label: 'Quote Name', dataType: 'string', isRequired: true, isReadOnly: false, isUnique: false },
    { apiName: 'hs_status', label: 'Quote Status', dataType: 'enumeration', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'hs_expiration_date', label: 'Expiration Date', dataType: 'date', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'hs_quote_amount', label: 'Total Amount', dataType: 'number', isRequired: false, isReadOnly: true, isUnique: false },
    { apiName: 'hs_sender_company_name', label: 'Sender Company Name', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'hs_public_url_key', label: 'Public URL Key', dataType: 'string', isRequired: false, isReadOnly: true, isUnique: true },
    { apiName: 'hs_quote_link', label: 'Quote Link', dataType: 'string', isRequired: false, isReadOnly: true, isUnique: false },
    { apiName: 'hubspot_owner_id', label: 'Quote Owner', dataType: 'reference', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'createdate', label: 'Create Date', dataType: 'datetime', isRequired: false, isReadOnly: true, isUnique: false },
    { apiName: 'hs_lastmodifieddate', label: 'Last Modified Date', dataType: 'datetime', isRequired: false, isReadOnly: true, isUnique: false },
  ],

  service_contracts: [
    { apiName: 'id', label: 'Record ID', dataType: 'string', isRequired: true, isReadOnly: true, isUnique: true },
    { apiName: 'contract_name', label: 'Contract Name', dataType: 'string', isRequired: true, isReadOnly: false, isUnique: false },
    { apiName: 'start_date', label: 'Start Date', dataType: 'date', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'end_date', label: 'End Date', dataType: 'date', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'contract_value', label: 'Contract Value', dataType: 'number', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'renewal_type', label: 'Renewal Type', dataType: 'enumeration', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'contract_status', label: 'Contract Status', dataType: 'enumeration', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'associated_company', label: 'Associated Company', dataType: 'reference', isRequired: false, isReadOnly: false, isUnique: false, referenceTo: 'companies', relationshipType: 'ManyToOne' },
    { apiName: 'notes', label: 'Notes', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'createdate', label: 'Create Date', dataType: 'datetime', isRequired: false, isReadOnly: true, isUnique: false },
    { apiName: 'hs_lastmodifieddate', label: 'Last Modified Date', dataType: 'datetime', isRequired: false, isReadOnly: true, isUnique: false },
  ],

  partner_referrals: [
    { apiName: 'id', label: 'Record ID', dataType: 'string', isRequired: true, isReadOnly: true, isUnique: true },
    { apiName: 'referral_name', label: 'Referral Name', dataType: 'string', isRequired: true, isReadOnly: false, isUnique: false },
    { apiName: 'partner_name', label: 'Partner Name', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'referral_date', label: 'Referral Date', dataType: 'date', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'referral_status', label: 'Status', dataType: 'enumeration', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'referral_amount', label: 'Referral Fee', dataType: 'number', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'associated_deal', label: 'Associated Deal', dataType: 'reference', isRequired: false, isReadOnly: false, isUnique: false, referenceTo: 'deals', relationshipType: 'ManyToOne' },
    { apiName: 'associated_contact', label: 'Referred Contact', dataType: 'reference', isRequired: false, isReadOnly: false, isUnique: false, referenceTo: 'contacts', relationshipType: 'ManyToOne' },
    { apiName: 'notes', label: 'Notes', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'createdate', label: 'Create Date', dataType: 'datetime', isRequired: false, isReadOnly: true, isUnique: false },
    { apiName: 'hs_lastmodifieddate', label: 'Last Modified Date', dataType: 'datetime', isRequired: false, isReadOnly: true, isUnique: false },
  ],

  onboarding_checklists: [
    { apiName: 'id', label: 'Record ID', dataType: 'string', isRequired: true, isReadOnly: true, isUnique: true },
    { apiName: 'checklist_name', label: 'Checklist Name', dataType: 'string', isRequired: true, isReadOnly: false, isUnique: false },
    { apiName: 'assigned_to', label: 'Assigned To', dataType: 'reference', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'associated_company', label: 'Associated Company', dataType: 'reference', isRequired: false, isReadOnly: false, isUnique: false, referenceTo: 'companies', relationshipType: 'ManyToOne' },
    { apiName: 'completion_percentage', label: 'Completion %', dataType: 'number', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'kickoff_date', label: 'Kickoff Date', dataType: 'date', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'target_completion_date', label: 'Target Completion Date', dataType: 'date', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'onboarding_status', label: 'Onboarding Status', dataType: 'enumeration', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'notes', label: 'Notes', dataType: 'string', isRequired: false, isReadOnly: false, isUnique: false },
    { apiName: 'createdate', label: 'Create Date', dataType: 'datetime', isRequired: false, isReadOnly: true, isUnique: false },
    { apiName: 'hs_lastmodifieddate', label: 'Last Modified Date', dataType: 'datetime', isRequired: false, isReadOnly: true, isUnique: false },
  ],
}

// ---------------------------------------------------------------------------
// Pre-seeded sample records per object
// ---------------------------------------------------------------------------

const DEMO_RECORDS: Record<string, Record<string, unknown>[]> = {
  contacts: [
    { id: 'c001', firstname: 'Alice', lastname: 'Martin', email: 'alice.martin@acme.com', phone: '+1-415-555-0101', jobtitle: 'VP of Sales', company: 'Acme Corp', lifecyclestage: 'customer', hs_lead_status: null, createdate: '2024-01-15T09:00:00Z', country: 'United States', city: 'San Francisco', num_associated_deals: 3 },
    { id: 'c002', firstname: 'Bob', lastname: 'Chen', email: 'bob.chen@techstart.io', phone: '+1-650-555-0202', jobtitle: 'CTO', company: 'TechStart', lifecyclestage: 'lead', hs_lead_status: 'IN_PROGRESS', createdate: '2024-02-20T11:30:00Z', country: 'United States', city: 'Palo Alto', num_associated_deals: 1 },
    { id: 'c003', firstname: 'Claire', lastname: 'Dupont', email: 'claire.dupont@euroventures.eu', phone: '+33-1-42-55-0303', jobtitle: 'CEO', company: 'EuroVentures', lifecyclestage: 'opportunity', hs_lead_status: null, createdate: '2024-03-05T14:00:00Z', country: 'France', city: 'Paris', num_associated_deals: 2 },
    { id: 'c004', firstname: 'David', lastname: 'Okonkwo', email: 'd.okonkwo@globalnet.ng', phone: '+234-801-555-0404', jobtitle: 'Business Director', company: 'GlobalNet', lifecyclestage: 'subscriber', hs_lead_status: null, createdate: '2024-03-18T08:00:00Z', country: 'Nigeria', city: 'Lagos', num_associated_deals: 0 },
    { id: 'c005', firstname: 'Emma', lastname: 'Schulz', email: 'e.schulz@digitalwerks.de', phone: '+49-89-555-0505', jobtitle: 'Marketing Manager', company: 'DigitalWerks', lifecyclestage: 'marketing_qualified_lead', hs_lead_status: 'NEW', createdate: '2024-04-01T10:15:00Z', country: 'Germany', city: 'Munich', num_associated_deals: 0 },
  ],
  companies: [
    { id: 'co001', name: 'Acme Corp', domain: 'acme.com', website: 'https://acme.com', phone: '+1-415-555-1000', industry: 'Technology', numberofemployees: 850, annualrevenue: 42000000, country: 'United States', city: 'San Francisco', lifecyclestage: 'customer', type: 'CUSTOMER', description: 'Enterprise software solutions provider' },
    { id: 'co002', name: 'TechStart', domain: 'techstart.io', website: 'https://techstart.io', phone: '+1-650-555-2000', industry: 'Technology', numberofemployees: 45, annualrevenue: 3500000, country: 'United States', city: 'Palo Alto', lifecyclestage: 'opportunity', type: 'PROSPECT', description: 'Early-stage SaaS startup' },
    { id: 'co003', name: 'EuroVentures', domain: 'euroventures.eu', website: 'https://euroventures.eu', phone: '+33-1-42-55-3000', industry: 'Finance', numberofemployees: 200, annualrevenue: 18000000, country: 'France', city: 'Paris', lifecyclestage: 'opportunity', type: 'PARTNER', description: 'European venture capital and advisory firm' },
    { id: 'co004', name: 'GlobalNet', domain: 'globalnet.ng', website: 'https://globalnet.ng', phone: '+234-1-555-4000', industry: 'Telecommunications', numberofemployees: 1200, annualrevenue: 75000000, country: 'Nigeria', city: 'Lagos', lifecyclestage: 'lead', type: 'PROSPECT', description: 'Pan-African telecommunications operator' },
    { id: 'co005', name: 'DigitalWerks', domain: 'digitalwerks.de', website: 'https://digitalwerks.de', phone: '+49-89-555-5000', industry: 'Marketing', numberofemployees: 120, annualrevenue: 9500000, country: 'Germany', city: 'Munich', lifecyclestage: 'marketing_qualified_lead', type: 'PROSPECT', description: 'Digital marketing agency' },
  ],
  deals: [
    { id: 'd001', dealname: 'Acme Corp — Enterprise Renewal', amount: 125000, dealstage: 'closedwon', pipeline: 'default', closedate: '2024-03-31', createdate: '2024-01-15T09:00:00Z', hs_deal_stage_probability: 1.0, hs_is_closed_won: true, num_associated_contacts: 2 },
    { id: 'd002', dealname: 'TechStart — Pro Plan Upgrade', amount: 18000, dealstage: 'contractsent', pipeline: 'default', closedate: '2024-04-30', createdate: '2024-02-20T11:30:00Z', hs_deal_stage_probability: 0.8, hs_is_closed_won: false, num_associated_contacts: 1 },
    { id: 'd003', dealname: 'EuroVentures — Advisory License', amount: 55000, dealstage: 'presentationscheduled', pipeline: 'default', closedate: '2024-05-15', createdate: '2024-03-05T14:00:00Z', hs_deal_stage_probability: 0.4, hs_is_closed_won: false, num_associated_contacts: 1 },
    { id: 'd004', dealname: 'GlobalNet — Pilot Project', amount: 30000, dealstage: 'qualifiedtobuy', pipeline: 'default', closedate: '2024-06-01', createdate: '2024-03-18T08:00:00Z', hs_deal_stage_probability: 0.2, hs_is_closed_won: false, num_associated_contacts: 1 },
    { id: 'd005', dealname: 'Acme Corp — Add-on Modules', amount: 42000, dealstage: 'decisionmakerboughtin', pipeline: 'default', closedate: '2024-04-15', createdate: '2024-03-25T09:00:00Z', hs_deal_stage_probability: 0.7, hs_is_closed_won: false, num_associated_contacts: 3 },
  ],
  tickets: [
    { id: 'tk001', subject: 'Cannot export data to CSV', content: 'The export button is not responding for datasets over 10k rows.', hs_ticket_priority: 'HIGH', hs_pipeline_stage: 'In Progress', hs_pipeline: 'Support Pipeline', createdate: '2024-03-01T10:00:00Z', source_type: 'EMAIL' },
    { id: 'tk002', subject: 'Billing discrepancy on March invoice', content: 'Invoice #1234 charged for 100 seats but we have 85 active users.', hs_ticket_priority: 'MEDIUM', hs_pipeline_stage: 'New', hs_pipeline: 'Support Pipeline', createdate: '2024-03-10T15:00:00Z', source_type: 'CHAT' },
    { id: 'tk003', subject: 'API rate limit hit unexpectedly', content: 'Our integration is hitting rate limits during off-peak hours.', hs_ticket_priority: 'HIGH', hs_pipeline_stage: 'Waiting on Contact', hs_pipeline: 'Support Pipeline', createdate: '2024-03-15T09:30:00Z', source_type: 'API' },
  ],
  products: [
    { id: 'p001', name: 'Starter Plan', description: 'Up to 5 users, core features', price: 49, hs_sku: 'STARTER-001', hs_cost_of_goods_sold: 10, hs_recurring_billing_period: 'MONTHLY', hs_product_type: 'SaaS' },
    { id: 'p002', name: 'Pro Plan', description: 'Up to 50 users, advanced analytics', price: 299, hs_sku: 'PRO-001', hs_cost_of_goods_sold: 60, hs_recurring_billing_period: 'MONTHLY', hs_product_type: 'SaaS' },
    { id: 'p003', name: 'Enterprise Plan', description: 'Unlimited users, dedicated support', price: 999, hs_sku: 'ENT-001', hs_cost_of_goods_sold: 200, hs_recurring_billing_period: 'MONTHLY', hs_product_type: 'SaaS' },
    { id: 'p004', name: 'Onboarding Services', description: 'Guided onboarding package (20h)', price: 2500, hs_sku: 'SVC-ONBOARD', hs_cost_of_goods_sold: 1200, hs_recurring_billing_period: null, hs_product_type: 'Service' },
    { id: 'p005', name: 'API Add-on', description: 'Extended API access, 1M calls/mo', price: 199, hs_sku: 'API-001', hs_cost_of_goods_sold: 40, hs_recurring_billing_period: 'MONTHLY', hs_product_type: 'SaaS' },
  ],
  line_items: [
    { id: 'li001', name: 'Enterprise Plan', hs_product_id: 'p003', quantity: 1, price: 999, amount: 999, discount: 0, hs_line_item_currency_code: 'USD' },
    { id: 'li002', name: 'Pro Plan', hs_product_id: 'p002', quantity: 1, price: 299, amount: 299, discount: 10, hs_line_item_currency_code: 'USD' },
    { id: 'li003', name: 'Onboarding Services', hs_product_id: 'p004', quantity: 2, price: 2500, amount: 5000, discount: 0, hs_line_item_currency_code: 'USD' },
    { id: 'li004', name: 'API Add-on', hs_product_id: 'p005', quantity: 1, price: 199, amount: 199, discount: 5, hs_line_item_currency_code: 'EUR' },
  ],
  quotes: [
    { id: 'q001', hs_title: 'Acme Corp Q1 Renewal Proposal', hs_status: 'APPROVED', hs_expiration_date: '2024-03-31', hs_quote_amount: 125000, hs_sender_company_name: 'Your Company', hs_public_url_key: 'acme-q1-2024', createdate: '2024-01-20T10:00:00Z' },
    { id: 'q002', hs_title: 'TechStart Upgrade Proposal', hs_status: 'PENDING_APPROVAL', hs_expiration_date: '2024-04-15', hs_quote_amount: 18000, hs_sender_company_name: 'Your Company', hs_public_url_key: 'techstart-upgrade-2024', createdate: '2024-02-25T14:00:00Z' },
  ],
  service_contracts: [
    { id: 'sc001', contract_name: 'Acme Corp Premium Support 2024', start_date: '2024-01-01', end_date: '2024-12-31', contract_value: 24000, renewal_type: 'AUTO', contract_status: 'ACTIVE', associated_company: 'co001', notes: 'Includes SLA: 99.9% uptime, 4h response time' },
    { id: 'sc002', contract_name: 'EuroVentures Advisory Contract', start_date: '2024-03-01', end_date: '2025-02-28', contract_value: 55000, renewal_type: 'MANUAL', contract_status: 'ACTIVE', associated_company: 'co003', notes: 'Quarterly review included' },
  ],
  partner_referrals: [
    { id: 'pr001', referral_name: 'TechStart Referral by PartnerCo', partner_name: 'PartnerCo', referral_date: '2024-02-10', referral_status: 'WON', referral_amount: 1800, associated_deal: 'd002', associated_contact: 'c002', notes: 'Referral fee: 10% of first year' },
    { id: 'pr002', referral_name: 'EuroVentures Intro by BizConnect', partner_name: 'BizConnect EU', referral_date: '2024-02-28', referral_status: 'IN_PROGRESS', referral_amount: null, associated_deal: 'd003', associated_contact: 'c003', notes: null },
  ],
  onboarding_checklists: [
    { id: 'ob001', checklist_name: 'Acme Corp Onboarding', assigned_to: null, associated_company: 'co001', completion_percentage: 100, kickoff_date: '2024-01-16', target_completion_date: '2024-02-15', onboarding_status: 'COMPLETED', notes: 'Completed ahead of schedule' },
    { id: 'ob002', checklist_name: 'TechStart Onboarding', assigned_to: null, associated_company: 'co002', completion_percentage: 40, kickoff_date: '2024-02-21', target_completion_date: '2024-03-21', onboarding_status: 'IN_PROGRESS', notes: 'API integration pending' },
  ],
}

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

export class DemoDestinationAdapter implements ConnectorAdapter {
  readonly canRead = true
  readonly canWrite = true
  readonly canWriteSchema = true

  async connect(_config: Record<string, unknown>): Promise<ConnectorConnection> {
    // Demo adapter always connects instantly — no credentials required
    return {
      id: 'demo-destination-connection',
      name: 'Demo Destination (HubSpot-like)',
      type: 'demo-destination',
      status: ConnectionStatus.CONNECTED,
      config: {},
    }
  }

  async disconnect(_connectionId: string): Promise<void> {
    // No-op for demo adapter
  }

  async getSchema(_connectionId: string): Promise<ConnectorSchema> {
    return { objects: DEMO_OBJECTS }
  }

  async getFields(_connectionId: string, objectApiName: string): Promise<ConnectorField[]> {
    const fields = DEMO_FIELDS[objectApiName]
    if (!fields) {
      throw new Error(`Unknown object: ${objectApiName}`)
    }
    return fields
  }

  async getRecords(
    _connectionId: string,
    objectApiName: string,
    page: number,
    pageSize: number
  ): Promise<PaginatedRecords> {
    const allRecords = DEMO_RECORDS[objectApiName] ?? []
    const startIndex = (page - 1) * pageSize
    const records = allRecords.slice(startIndex, startIndex + pageSize)

    return {
      records,
      totalCount: allRecords.length,
      pageSize,
      currentPage: page,
      hasNextPage: startIndex + pageSize < allRecords.length,
    }
  }

  async getRecordCount(_connectionId: string, objectApiName: string): Promise<number> {
    return (DEMO_RECORDS[objectApiName] ?? []).length
  }

  async getFieldStats(
    _connectionId: string,
    objectApiName: string,
    fieldApiName: string
  ): Promise<FieldStats> {
    const records = DEMO_RECORDS[objectApiName] ?? []
    const values = records.map((r) => r[fieldApiName])
    const nonNullValues = values.filter((v) => v !== null && v !== undefined)
    const distinctValues = [...new Set(nonNullValues)]

    return {
      fieldApiName,
      nullCount: values.length - nonNullValues.length,
      distinctCount: distinctValues.length,
      sampleValues: distinctValues.slice(0, 5),
    }
  }

  // Schema write methods (canWriteSchema: true)

  async createObject(
    _connectionId: string,
    apiName: string,
    label: string
  ): Promise<ConnectorObject> {
    // In the demo adapter we just return the object as if it were created
    const newObject: ConnectorObject = {
      apiName,
      label,
      description: `Custom object: ${label}`,
      isCustom: true,
      isSelected: false,
    }
    DEMO_OBJECTS.push(newObject)
    return newObject
  }

  async createField(
    _connectionId: string,
    objectApiName: string,
    field: Omit<ConnectorField, 'isReadOnly' | 'isUnique'>
  ): Promise<ConnectorField> {
    const newField: ConnectorField = {
      ...field,
      isReadOnly: false,
      isUnique: false,
    }

    if (!DEMO_FIELDS[objectApiName]) {
      DEMO_FIELDS[objectApiName] = []
    }
    DEMO_FIELDS[objectApiName].push(newField)

    return newField
  }
}
