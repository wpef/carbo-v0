// Numéro de référence contractuel (05-acceptance §12). Porté de v4.
//
// Format : CARBO-YYYYMMDD-XXXX  (ex. CARBO-20260616-0001)
//
// Fonctions PURES uniquement.
//   generateReferenceNumber() — incrémenteur en mémoire ; séquentiel par jour.
//   generateReferenceNumberForDate() — variante déterministe pour les tests.
//   isValidReferenceNumber() — validateur de format.
//   parseReferenceNumber() — déstructuration d'un numéro valide.
//
// En production, l'unicité inter-session est assurée par un comptage DB dans la
// couche service (contractual-document-service).

// ---------------------------------------------------------------------------
// Compteur en module (reset au redémarrage du serveur)
// ---------------------------------------------------------------------------

let _dailyState: { date: string; count: number } = { date: "", count: 0 };

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

/** Formate une date en YYYYMMDD. */
function formatDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/** Formate un compteur en séquence à 4 chiffres. */
function formatSeq(n: number): string {
  return String(n).padStart(4, "0");
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

/**
 * Génère un numéro de référence unique dans la session courante.
 * Format : CARBO-YYYYMMDD-XXXX
 *
 * Séquentiel par jour dans la même session serveur.
 */
export function generateReferenceNumber(now: Date = new Date()): string {
  const dateStr = formatDateStr(now);

  if (_dailyState.date !== dateStr) {
    _dailyState = { date: dateStr, count: 0 };
  }

  _dailyState.count += 1;
  return `CARBO-${dateStr}-${formatSeq(_dailyState.count)}`;
}

/**
 * Variante déterministe pour les tests : génère un numéro à partir d'une date
 * et d'un numéro de séquence fournis explicitement. N'affecte pas le compteur.
 */
export function generateReferenceNumberForDate(date: Date, seq: number): string {
  return `CARBO-${formatDateStr(date)}-${formatSeq(seq)}`;
}

/** Valide qu'une chaîne respecte le format CARBO-YYYYMMDD-XXXX. */
export function isValidReferenceNumber(ref: string): boolean {
  return /^CARBO-\d{8}-\d{4}$/.test(ref);
}

/** Résultat de parseReferenceNumber. */
export interface ParsedReferenceNumber {
  dateStr: string; // ex. "20260616"
  sequence: number; // ex. 1
}

/**
 * Déstructure un numéro de référence valide.
 * Retourne null si le format est invalide.
 */
export function parseReferenceNumber(ref: string): ParsedReferenceNumber | null {
  if (!isValidReferenceNumber(ref)) return null;
  const parts = ref.split("-");
  return {
    dateStr: parts[1],
    sequence: parseInt(parts[2], 10),
  };
}

/** Réinitialise le compteur interne (usage test uniquement). */
export function _resetCounterForTests(): void {
  _dailyState = { date: "", count: 0 };
}
