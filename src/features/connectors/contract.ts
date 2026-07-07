// Contrat des connecteurs — LE point d'extension du système.
// Ajouter un CRM = créer un dossier d'adaptateur qui implémente
// ConnectorAdapter + l'enregistrer dans registry.ts. Rien d'autre à toucher.
//
// Périmètre de cette tranche : cycle de connexion + lecture du schéma
// (objets, champs). Les capacités records / écriture de schéma arriveront
// avec leurs tranches (record preview, schema-write) — le contrat les
// annonce via `capabilities` pour que l'UI puisse s'adapter sans casser.

/** Objet exposé par le CRM (sans état de sélection — la sélection est un concept Carbo). */
export type ConnectorObjectDef = {
  apiName: string;
  label: string;
  description?: string;
  isCustom: boolean;
};

/** Champ d'un objet, normalisé dans le vocabulaire de types Carbo. */
export type ConnectorFieldDef = {
  apiName: string;
  label: string;
  dataType: string;
  isRequired: boolean;
  isReadOnly: boolean;
  isUnique: boolean;
  /** false si l'utilisateur authentifié ne peut pas lire ce champ (jamais de perte silencieuse). */
  isAccessible: boolean;
  referenceTo?: string;
  picklistValues?: string[];
};

export type ConnectorCapabilities = {
  canRead: boolean;
  canWrite: boolean;
  canWriteSchema: boolean;
};

/** Classification des objets système + pré-sélection par défaut, propre à chaque CRM. */
export type AdapterObjectMetadata = {
  /** Objets métier pré-sélectionnés par défaut. */
  defaultSelectedObjects: string[];
  /** Noms exacts toujours considérés système. */
  systemExactNames: string[];
  systemPrefixes: string[];
  systemSuffixes: string[];
};

/** Ce que l'UI a besoin de savoir pour afficher un connecteur (sans l'instancier). */
export type AdapterDescriptor = {
  type: string;
  label: string;
  description: string;
  /** Où ce connecteur peut être branché. */
  sides: ("SOURCE" | "DESTINATION")[];
  /**
   * Comment on s'y connecte :
   * - direct  : POST simple (démo)
   * - oauth   : redirection navigateur vers /api/connectors/{type}/auth
   * - oauth-or-token : oauth OU saisie d'un token (HubSpot Private App)
   */
  connectMode: "direct" | "oauth" | "oauth-or-token";
};

export interface ConnectorAdapter {
  readonly descriptor: AdapterDescriptor;
  readonly capabilities: ConnectorCapabilities;
  readonly objectMetadata: AdapterObjectMetadata;

  /** Liste des objets du CRM (léger — PAS les champs). */
  getObjects(connectionId: string): Promise<ConnectorObjectDef[]>;
  /** Champs d'UN objet (coûteux côté SF : 1 describe par objet — d'où la séparation). */
  getFields(connectionId: string, objectApiName: string): Promise<ConnectorFieldDef[]>;
}
