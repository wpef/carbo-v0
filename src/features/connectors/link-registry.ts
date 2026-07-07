// Registres de correspondances prévisibles entre systèmes (port v4, specs 011/012).
// L'auto-link (objets) est REGISTRE SEUL ; l'auto-match (champs) est l'UNION
// du registre et d'un rapprochement par nom insensible à la casse.
// Fonctions pures — testables sans base ni réseau.

export type ResolvedObjectPair = { sourceObjectName: string; destinationObjectName: string };
export type ResolvedFieldPair = { sourceFieldName: string; destinationFieldName: string };

// --- Objets : clé `${sourceAdapter}:${destAdapter}` ---

const OBJECT_LINK_MAP: Record<string, Array<{ source: string; dest: string }>> = {
  "salesforce:hubspot": [
    { source: "Account", dest: "companies" },
    { source: "Contact", dest: "contacts" },
    { source: "Opportunity", dest: "deals" },
    { source: "Lead", dest: "contacts" },
    { source: "Case", dest: "tickets" },
  ],
  "demo-source:demo-destination": [
    { source: "Account", dest: "companies" },
    { source: "Contact", dest: "contacts" },
    { source: "Opportunity", dest: "deals" },
    { source: "Case", dest: "tickets" },
  ],
};

/**
 * Paires d'objets que l'auto-link doit créer : une paire est retenue quand
 * ses deux objets existent dans les schémas actuels et que la source n'est
 * pas déjà mappée. Plusieurs sources peuvent viser la même destination
 * (Contact + Lead → contacts) — la dédup est par objet source.
 */
export function computeAutoLinkPairs(
  sourceAdapterType: string,
  destAdapterType: string,
  sourceObjectNames: string[],
  destObjectNames: string[],
  alreadyMappedSourceNames: string[] = [],
): ResolvedObjectPair[] {
  const registry = OBJECT_LINK_MAP[`${sourceAdapterType}:${destAdapterType}`] ?? [];
  const sourceSet = new Set(sourceObjectNames);
  const destSet = new Set(destObjectNames);
  const used = new Set(alreadyMappedSourceNames);
  const pairs: ResolvedObjectPair[] = [];

  for (const { source, dest } of registry) {
    if (used.has(source)) continue;
    if (!sourceSet.has(source) || !destSet.has(dest)) continue;
    pairs.push({ sourceObjectName: source, destinationObjectName: dest });
    used.add(source);
  }
  return pairs;
}

// --- Champs : clé `${sourceAdapter}:${destAdapter}:${sourceObj}:${destObj}` ---

const FIELD_MATCH_MAP: Record<string, Array<{ source: string; dest: string }>> = {
  "salesforce:hubspot:Contact:contacts": [
    { source: "FirstName", dest: "firstname" },
    { source: "LastName", dest: "lastname" },
    { source: "Email", dest: "email" },
    { source: "Phone", dest: "phone" },
    { source: "MobilePhone", dest: "mobilephone" },
    { source: "Title", dest: "jobtitle" },
  ],
  "salesforce:hubspot:Account:companies": [
    { source: "Name", dest: "name" },
    { source: "Website", dest: "domain" },
    { source: "Phone", dest: "phone" },
    { source: "BillingCity", dest: "city" },
    { source: "BillingCountry", dest: "country" },
    { source: "NumberOfEmployees", dest: "numberofemployees" },
    { source: "Industry", dest: "industry" },
  ],
  "salesforce:hubspot:Lead:contacts": [
    { source: "FirstName", dest: "firstname" },
    { source: "LastName", dest: "lastname" },
    { source: "Email", dest: "email" },
    { source: "Phone", dest: "phone" },
    { source: "Title", dest: "jobtitle" },
    { source: "Company", dest: "company" },
  ],
  "salesforce:hubspot:Opportunity:deals": [
    { source: "Name", dest: "dealname" },
    { source: "Amount", dest: "amount" },
    { source: "CloseDate", dest: "closedate" },
    { source: "StageName", dest: "dealstage" },
  ],
  "salesforce:hubspot:Case:tickets": [
    { source: "Subject", dest: "subject" },
    { source: "Status", dest: "hs_pipeline_stage" },
    { source: "Priority", dest: "hs_ticket_priority" },
    { source: "Description", dest: "content" },
  ],
  "demo-source:demo-destination:Account:companies": [
    { source: "Name", dest: "name" },
    { source: "Industry", dest: "industry" },
    { source: "Website", dest: "website" },
    { source: "AnnualRevenue", dest: "annualrevenue" },
  ],
  "demo-source:demo-destination:Contact:contacts": [
    { source: "FirstName", dest: "firstname" },
    { source: "LastName", dest: "lastname" },
    { source: "Email", dest: "email" },
    { source: "Phone", dest: "phone" },
  ],
  "demo-source:demo-destination:Opportunity:deals": [
    { source: "Name", dest: "dealname" },
    { source: "Amount", dest: "amount" },
    { source: "StageName", dest: "dealstage" },
    { source: "CloseDate", dest: "closedate" },
  ],
  "demo-source:demo-destination:Case:tickets": [
    { source: "Subject", dest: "subject" },
    { source: "Status", dest: "hs_pipeline_stage" },
    { source: "Priority", dest: "hs_ticket_priority" },
    { source: "Description", dest: "content" },
  ],
};

function normalizeFieldName(name: string): string {
  return name.toLowerCase().replace(/__c$/, "").replace(/[_\s]/g, "");
}

/**
 * Paires de champs que l'auto-match doit créer : UNION du registre puis du
 * name-based (normalisé) pour les champs source non couverts. Dédup des deux
 * côtés (un source par destination, une destination par source). Les champs
 * de type `id` ne sont jamais auto-mappés (identifiants régénérés à l'import).
 */
export function computeFieldMatchPairs(
  sourceAdapterType: string,
  destAdapterType: string,
  sourceObjectName: string,
  destObjectName: string,
  sourceFields: Array<{ apiName: string; dataType: string }>,
  destinationFields: Array<{ apiName: string; dataType: string }>,
  alreadyMapped: Array<{ sourceFieldName: string; destinationFieldName: string }> = [],
): ResolvedFieldPair[] {
  const registry =
    FIELD_MATCH_MAP[
      `${sourceAdapterType}:${destAdapterType}:${sourceObjectName}:${destObjectName}`
    ] ?? [];
  const destByApiName = new Map(destinationFields.map((f) => [f.apiName, f]));
  const destByNormalized = new Map(destinationFields.map((f) => [normalizeFieldName(f.apiName), f]));
  const usedSource = new Set(alreadyMapped.map((m) => m.sourceFieldName));
  const usedDest = new Set(alreadyMapped.map((m) => m.destinationFieldName));
  const registryBySource = new Map(registry.map((p) => [p.source, p.dest]));
  const pairs: ResolvedFieldPair[] = [];

  for (const sourceField of sourceFields) {
    if (usedSource.has(sourceField.apiName)) continue;
    if (sourceField.dataType === "id") continue;

    const registryTarget = destByApiName.get(registryBySource.get(sourceField.apiName) ?? "");
    const nameTarget = destByNormalized.get(normalizeFieldName(sourceField.apiName));
    const target = registryTarget ?? nameTarget;
    if (!target || usedDest.has(target.apiName) || target.dataType === "id") continue;

    pairs.push({ sourceFieldName: sourceField.apiName, destinationFieldName: target.apiName });
    usedSource.add(sourceField.apiName);
    usedDest.add(target.apiName);
  }
  return pairs;
}
