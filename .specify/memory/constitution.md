<!--
  SYNC IMPACT REPORT
  ==================
  Version change: 1.0.0 → 1.1.0 (MINOR: tous les principes réécrits de génériques à
  spécifiques au projet ; stack défini ; 7 principes au lieu de 5)

  Principes modifiés:
    I.   Spec-First Development           → I.   Spec-First (reformulé, allégé)
    II.  User-Story-Driven Design         → II.  Lisibilité avant l'ingéniosité (nouveau)
    III. Simplicity & YAGNI               → III. Fidélité de la donnée (nouveau)
    IV.  Incremental Delivery             → IV.  Tests fonctionnels sur données réelles (nouveau)
    V.   Quality Gates at Every Phase     → V.   Idempotence des opérations (nouveau)

  Principes ajoutés:
    VI.  Traçabilité par défaut (nouveau)
    VII. Observabilité développeur (nouveau)

  Sections modifiées:
    - Technology Standards : stack Next.js + TypeScript défini (backend TBD)
    - Development Workflow : adapté au contexte SaaS de migration de données

  Templates requis:
    ✅ .specify/templates/plan-template.md  — Constitution Check à mettre à jour lors du
                                              premier /speckit.plan (pas de changement structurel)
    ✅ .specify/templates/spec-template.md  — Aligné avec Principe I ; aucune modification requise
    ✅ .specify/templates/tasks-template.md — Aligné avec Principes I et IV ; aucune modification requise
    ✅ .specify/templates/agent-file-template.md — Pas de référence à la constitution ; aucune modification

  TODOs différés:
    - TODO(BACKEND_STACK): Framework backend et base de données à définir lors du premier /speckit.plan
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

## Technology Standards

**Frontend** : Next.js (App Router) + TypeScript — standard non-négociable.

**Style** : à définir lors du premier `/speckit.plan` (ex: Tailwind CSS, shadcn/ui).

**Backend** : TODO(BACKEND_STACK) — framework et runtime Node.js à définir lors du premier
`/speckit.plan`.

**Base de données** : TODO(DATABASE) — à définir lors du premier `/speckit.plan`.

**Testing** : à définir lors du premier `/speckit.plan`, en cohérence avec le Principe IV
(tests fonctionnels sur données réelles).

**Règle d'évolution** : une fois le stack défini, il devient contraignant. Toute déviation
requiert une justification dans le plan (Complexity Tracking) et, si structurelle, un amendement
de constitution.

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

**Version**: 1.1.0 | **Ratified**: 2026-03-17 | **Last Amended**: 2026-03-17
