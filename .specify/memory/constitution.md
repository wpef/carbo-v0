<!--
  SYNC IMPACT REPORT
  ==================
  Version change: 1.1.0 → 1.2.0 (MINOR: nouveau principe VIII, stack résolu)

  Principes ajoutés:
    VIII. Modularité et isolation (nouveau) — features isolées, freezable, US atomiques

  Sections modifiées:
    - Technology Standards : stack complet défini (Tailwind, Prisma/SQLite, Vitest, jsforce, etc.)
      Résolution de tous les TODOs (BACKEND_STACK, DATABASE, Testing)
    - Principe VIII : inter-module isolation via interfaces abstraites, Open/Closed, US atomiques

  Templates requis:
    ✅ .specify/templates/plan-template.md  — Constitution Check doit inclure Principe VIII
    ✅ .specify/templates/spec-template.md  — US stories doivent être atomiques (Principe VIII)
    ✅ .specify/templates/tasks-template.md — Pas de changement structurel
    ✅ .specify/templates/agent-file-template.md — Pas de changement

  TODOs résolus:
    - ✅ TODO(BACKEND_STACK): Next.js Route Handlers
    - ✅ TODO(DATABASE): SQLite via Prisma ORM
-->

# Carbo-v0 Constitution

## Core Principles

### I. Spec-First

Aucune implémentation ne PEUT démarrer sans une spécification (`spec.md`) approuvée. La spec DOIT
inclure des user stories priorisées avec scénarios d'acceptance, des exigences fonctionnelles, et
des critères de succès mesurables et agnostiques de toute technologie. Une feature branch créée
sans spec complète est une violation de gouvernance et NE DOIT PAS être mergée sur `main`.

**Rationale** : évite le travail gâché sur des besoins mal compris et aligne toutes les parties
avant qu'une ligne de code soit écrite.

### II. Lisibilité avant l'ingéniosité

Le code DOIT être compréhensible par un nouveau développeur en moins d'une heure. Aucune
abstraction sans nom explicite, aucune magie framework non documentée, aucun raccourci clever
qui obscurcit l'intention. Next.js + TypeScript est le standard de la codebase — toute déviation
DOIT être justifiée dans le plan.

**Rationale** : Carbo-v0 a vocation à être repris et maintenu par des humains. Un code brillant
mais illisible est un passif, pas un actif.

### III. Fidélité de la donnée

Aucune transformation, troncature ou perte de donnée ne PEUT survenir silencieusement. Chaque
règle de transformation DOIT être nommée, explicite et tracée. La donnée source originale DOIT
toujours être conservée en parallèle de sa version transformée. Un champ sans correspondance dans
le mapping DOIT lever une erreur explicite — jamais être ignoré.

**Rationale** : un consultant qui livre une migration à son client doit pouvoir prouver que rien
n'a été perdu ou altéré sans raison. C'est le fondement de la confiance contractuelle.

### IV. Tests fonctionnels sur données réelles

Les chemins critiques — moteur de mapping, règles de transformation, export, exécution de
migration — DOIVENT être couverts par des tests fonctionnels utilisant des données dont la forme
est réaliste (pas de fixtures à une seule ligne, pas de valeurs lorem ipsum). Les tests unitaires
sont réservés aux fonctions pures. Les tests DOIVENT être écrits avant l'implémentation sur les
chemins critiques.

**Rationale** : les bugs de migration surgissent aux edges cases de données réelles. Des fixtures
simplifiées donnent une fausse confiance.

### V. Idempotence des opérations

Tout scénario de migration DOIT être rejouable sans effet de bord. Exécuter la même migration
deux fois DOIT produire le même résultat. Les runs partiels DOIVENT être reprenables depuis leur
point d'interruption. Toute opération destructive (écrasement, suppression) DOIT être explicite
et confirmée.

**Rationale** : les migrations échouent. Les consultants doivent pouvoir corriger et rejouer sans
crainte d'effets de bord cumulatifs.

### VI. Traçabilité par défaut

Chaque opération significative — connexion à une source, décision de mapping, run de
transformation, export, exécution de migration — DOIT être loguée dans un audit trail
persistant. La piste d'audit est un citoyen de première classe : elle alimente directement les
documents de validation contractuels produits pour le client final (livrable 1.c.i).

**Rationale** : les documents contractuels ne peuvent être fiables que si l'audit trail qui les
sous-tend l'est aussi.

### VII. Observabilité développeur

Tout traitement substantiel DOIT émettre des logs console explicites : erreurs, warnings, étapes
clés de calcul (parsing d'une source, application d'une règle, résultat d'un run). En phase de
développement, le terminal DOIT permettre de suivre l'exécution complète sans ouvrir un debugger.
Les logs DOIVENT être suffisamment verbeux pour diagnostiquer un comportement inattendu à
distance.

**Rationale** : la complexité des pipelines de migration rend le suivi d'exécution non-trivial.
Un logging explicite réduit drastiquement le temps de débogage.

### VIII. Modularité et isolation

Chaque feature DOIT être un module isolé avec une interface publique explicite (types + fonctions
exportées). Aucun module NE DOIT dépendre des internals d'un autre module — toute communication
inter-modules passe par des interfaces abstraites (types partagés dans `src/types/`).

Un module validé ("DONE") NE DOIT PLUS être modifié dans son implémentation interne. Si un besoin
émerge, on DOIT étendre l'interface publique sans modifier le code interne existant (Open/Closed).

Les user stories DOIVENT être découpées en unités atomiques indépendamment testables et
validables. Une US qui mélange plusieurs responsabilités (ex: auth + browsing + preview) DOIT
être décomposée en sous-US. Chaque sous-US DOIT pouvoir être marquée "DONE" indépendamment.

**Rationale** : l'itération sur une feature ne doit jamais casser les autres. Un consultant qui
valide le connecteur Salesforce ne veut pas que le travail sur le mapping plan régresse cette
validation. La granularité atomique des US permet une validation incrémentale et une priorisation
fine.

## Technology Standards

**Frontend** : Next.js 14+ (App Router) + TypeScript + Tailwind CSS + shadcn/ui.

**Backend** : Next.js Route Handlers (unified single project — no separate backend).

**Base de données** : SQLite via Prisma ORM (local-first pour v0 ; migratable vers PostgreSQL).

**Testing** : Vitest (unit + integration) + Playwright (E2E).

**Salesforce SDK** : jsforce v3.x (note : ne supporte pas PKCE nativement — token exchange
via HTTP POST direct).

**HubSpot SDK** : @hubspot/api-client.

**LLM** : @anthropic-ai/sdk (Claude API) pour la description des règles en langage naturel.

**PDF** : Puppeteer (HTML → PDF).

**Règle d'évolution** : ce stack est désormais contraignant. Toute déviation requiert une
justification dans le plan (Complexity Tracking) et, si structurelle, un amendement de
constitution.

## Development Workflow

Tout développement de feature SUIT le workflow speckit dans l'ordre ci-dessous. Aucune phase
ne peut être sautée sans justification enregistrée dans l'artefact concerné.

1. `/speckit.specify`  — Créer `spec.md` avec user stories et exigences.
2. `/speckit.clarify`  — Résoudre les ambiguïtés avant la planification *(optionnel mais fortement recommandé)*.
3. `/speckit.plan`     — Produire `plan.md`, `research.md`, `data-model.md`, `contracts/`,
   `quickstart.md`. Inclut l'évaluation du Constitution Check.
4. `/speckit.tasks`    — Générer `tasks.md` depuis les artefacts de design.
5. `/speckit.implement`— Exécuter les tâches en ordre de dépendance, story par story.

**Nommage des branches** : `###-feature-name` (ex: `001-source-connector`).

**Commits** : un commit par tâche ou groupe logique ; le message DEVRAIT référencer l'ID de
tâche (ex: `feat(T014): implement mapping engine`).

**PRs** : DOIVENT inclure le résultat du Constitution Check issu de `plan.md` avant approbation.

## Governance

Cette constitution prévaut sur toutes les autres pratiques et conventions du projet. En cas de
conflit entre ce document et toute autre directive, cette constitution a la priorité.

**Procédure d'amendement** :
1. Proposer le changement avec rationale (description de PR ou document de design lié).
2. Incrémenter `CONSTITUTION_VERSION` selon les règles ci-dessous.
3. Mettre à jour `LAST_AMENDED_DATE` au format ISO 8601 (YYYY-MM-DD).
4. Lancer `/speckit.constitution` pour propager les changements et régénérer le Sync Impact Report.
5. Merger la constitution amendée avant toute feature qui en dépend.

**Politique de versionnement** :
- **MAJOR** : principe supprimé, redéfini, ou mécanisme de gouvernance modifié de façon incompatible.
- **MINOR** : nouveau principe ou section ajouté ; guidance existante matériellement étendue.
- **PATCH** : clarifications, reformulations, corrections typographiques uniquement.

**Revue de conformité** : chaque PR DOIT vérifier les gates du Constitution Check définis dans
le `plan.md` de la feature. Toute violation DOIT être justifiée dans le Complexity Tracking du
plan, faute de quoi la PR est bloquée.

**Version**: 1.2.0 | **Ratified**: 2026-03-17 | **Last Amended**: 2026-03-25
