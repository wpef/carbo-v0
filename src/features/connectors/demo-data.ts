// Connecteur de démonstration — schémas en mémoire, déterministes.
// Sert le walking skeleton et les tests e2e. Les vrais adaptateurs
// (Salesforce/HubSpot) seront portés en tranches verticales (Phase 2).
//
// Le schéma source imite volontairement une org Salesforce : objets custom
// (__c), objets système par préfixe ET par suffixe (History/Share/Feed…) —
// pour exercer la classification (02-domain-rules règle 3) dès le skeleton.

export type DemoField = {
  apiName: string;
  label: string;
  dataType: string;
  isRequired?: boolean;
  picklistValues?: string[];
};

export type DemoObject = {
  apiName: string;
  label: string;
  description?: string;
  isCustom?: boolean;
  fields: DemoField[];
};

const id = (label = "Identifiant"): DemoField => ({
  apiName: "Id",
  label,
  dataType: "id",
  isRequired: true,
});

export const DEMO_SOURCE_OBJECTS: DemoObject[] = [
  {
    apiName: "Account",
    label: "Compte",
    description: "Entreprises clientes et prospects",
    fields: [
      id(),
      { apiName: "Name", label: "Nom", dataType: "string", isRequired: true },
      { apiName: "Industry", label: "Secteur", dataType: "picklist", picklistValues: ["Tech", "Retail", "Finance"] },
      { apiName: "Website", label: "Site web", dataType: "url" },
      { apiName: "AnnualRevenue", label: "CA annuel", dataType: "currency" },
      { apiName: "CreatedDate", label: "Date de création", dataType: "datetime" },
    ],
  },
  {
    apiName: "Contact",
    label: "Contact",
    description: "Personnes rattachées aux comptes",
    fields: [
      id(),
      { apiName: "FirstName", label: "Prénom", dataType: "string" },
      { apiName: "LastName", label: "Nom", dataType: "string", isRequired: true },
      { apiName: "Email", label: "E-mail", dataType: "email" },
      { apiName: "Phone", label: "Téléphone", dataType: "phone" },
      { apiName: "AccountId", label: "Compte", dataType: "reference" },
    ],
  },
  {
    apiName: "Opportunity",
    label: "Opportunité",
    description: "Affaires en cours",
    fields: [
      id(),
      { apiName: "Name", label: "Nom", dataType: "string", isRequired: true },
      { apiName: "Amount", label: "Montant", dataType: "currency" },
      { apiName: "StageName", label: "Étape", dataType: "picklist", picklistValues: ["Prospecting", "Negotiation", "Closed Won", "Closed Lost"], isRequired: true },
      { apiName: "CloseDate", label: "Date de clôture", dataType: "date", isRequired: true },
    ],
  },
  {
    apiName: "Case",
    label: "Requête",
    description: "Tickets de support",
    fields: [
      id(),
      { apiName: "Subject", label: "Objet", dataType: "string" },
      { apiName: "Status", label: "Statut", dataType: "picklist", picklistValues: ["New", "Working", "Closed"], isRequired: true },
      { apiName: "Priority", label: "Priorité", dataType: "picklist", picklistValues: ["Low", "Medium", "High"] },
      { apiName: "Description", label: "Description", dataType: "textarea" },
    ],
  },
  {
    apiName: "Invoice__c",
    label: "Facture",
    description: "Objet custom : factures clients",
    isCustom: true,
    fields: [
      id(),
      { apiName: "Name", label: "Numéro", dataType: "string", isRequired: true },
      { apiName: "Amount__c", label: "Montant", dataType: "currency", isRequired: true },
      { apiName: "DueDate__c", label: "Échéance", dataType: "date" },
      { apiName: "Paid__c", label: "Payée", dataType: "boolean" },
    ],
  },
  // Objets système (suffixes SF) — masqués par défaut dans la sélection.
  {
    apiName: "AccountHistory",
    label: "Historique des comptes",
    fields: [id(), { apiName: "Field", label: "Champ modifié", dataType: "string" }],
  },
  {
    apiName: "ContactShare",
    label: "Partage des contacts",
    fields: [id(), { apiName: "AccessLevel", label: "Niveau d'accès", dataType: "picklist", picklistValues: ["Read", "Edit"] }],
  },
  {
    apiName: "CaseFeed",
    label: "Fil des requêtes",
    fields: [id(), { apiName: "Body", label: "Contenu", dataType: "textarea" }],
  },
];

export const DEMO_DESTINATION_OBJECTS: DemoObject[] = [
  {
    apiName: "companies",
    label: "Companies",
    description: "Fiches entreprises",
    fields: [
      id(),
      { apiName: "name", label: "Name", dataType: "string", isRequired: true },
      { apiName: "industry", label: "Industry", dataType: "picklist", picklistValues: ["Technology", "Retail", "Banking"] },
      { apiName: "website", label: "Website", dataType: "url" },
      { apiName: "annualrevenue", label: "Annual revenue", dataType: "number" },
    ],
  },
  {
    apiName: "contacts",
    label: "Contacts",
    description: "Fiches contacts",
    fields: [
      id(),
      { apiName: "firstname", label: "First name", dataType: "string" },
      { apiName: "lastname", label: "Last name", dataType: "string", isRequired: true },
      { apiName: "email", label: "Email", dataType: "email" },
      { apiName: "phone", label: "Phone", dataType: "phone" },
    ],
  },
  {
    apiName: "deals",
    label: "Deals",
    description: "Transactions",
    fields: [
      id(),
      { apiName: "dealname", label: "Deal name", dataType: "string", isRequired: true },
      { apiName: "amount", label: "Amount", dataType: "number" },
      { apiName: "dealstage", label: "Deal stage", dataType: "picklist", picklistValues: ["appointmentscheduled", "contractsent", "closedwon", "closedlost"] },
      { apiName: "closedate", label: "Close date", dataType: "date" },
    ],
  },
  {
    apiName: "tickets",
    label: "Tickets",
    description: "Tickets de support",
    fields: [
      id(),
      { apiName: "subject", label: "Subject", dataType: "string" },
      { apiName: "hs_pipeline_stage", label: "Status", dataType: "picklist", picklistValues: ["new", "waiting", "closed"] },
      { apiName: "hs_ticket_priority", label: "Priority", dataType: "picklist", picklistValues: ["LOW", "MEDIUM", "HIGH"] },
      { apiName: "content", label: "Description", dataType: "textarea" },
    ],
  },
];

/** Registre d'auto-link du connecteur démo (équivalent du registre SF→HubSpot). */
export const DEMO_OBJECT_LINK_REGISTRY: Record<string, string> = {
  Account: "companies",
  Contact: "contacts",
  Opportunity: "deals",
  Case: "tickets",
};

/** Registre d'auto-match des champs par paire d'objets (complète le name-based). */
export const DEMO_FIELD_MATCH_REGISTRY: Record<string, Record<string, string>> = {
  "Account:companies": {
    Name: "name",
    Industry: "industry",
    Website: "website",
    AnnualRevenue: "annualrevenue",
  },
  "Contact:contacts": {
    FirstName: "firstname",
    LastName: "lastname",
    Email: "email",
    Phone: "phone",
  },
  "Opportunity:deals": {
    Name: "dealname",
    Amount: "amount",
    StageName: "dealstage",
    CloseDate: "closedate",
  },
  "Case:tickets": {
    Subject: "subject",
    Status: "hs_pipeline_stage",
    Priority: "hs_ticket_priority",
    Description: "content",
  },
};
