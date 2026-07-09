// Validation d'un champ à créer sur la destination (§13) — pur, porté de v4.
// Vérifie AVANT l'appel adaptateur, contre le schéma courant.

export function validateNewField(
  field: { apiName: string; label: string; dataType: string; picklistValues?: string[] },
  supportedFieldTypes: string[],
  existingFieldNames: Set<string>,
): string[] {
  const errors: string[] = [];

  if (!field.apiName || field.apiName.trim() === "") {
    errors.push("Le nom du champ est requis.");
  } else if (existingFieldNames.has(field.apiName)) {
    errors.push(`Le champ « ${field.apiName} » existe déjà sur cet objet.`);
  }

  if (supportedFieldTypes.length > 0 && field.dataType && !supportedFieldTypes.includes(field.dataType)) {
    errors.push(
      `Type « ${field.dataType} » non supporté. Types acceptés : ${supportedFieldTypes.join(", ")}.`,
    );
  }

  if (field.dataType === "picklist" && (!field.picklistValues || field.picklistValues.length === 0)) {
    errors.push("Une picklist requiert au moins une valeur.");
  }

  return errors;
}
