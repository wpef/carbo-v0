# Dossier de fondation — Carbo v5

**Doc vivante du cycle v5** (reconstruction from-scratch, 2026-07-02). Ce dossier remplace les 22 dossiers speckit de `specs/` comme référence de travail. `specs/` est une **archive figée** (tag `v5` sur master) : on la lit pour comprendre l'historique, on ne la modifie plus.

Règle de maintenance : toute évolution de comportement, de parcours, de règle métier ou de data-model se réplique **ici**, dans le fichier existant concerné.

| Document | Contenu | Statut |
|---|---|---|
| [00-intent.md](00-intent.md) | Enjeu produit, périmètre phase 1, digest constitution (9 principes), statut des artefacts | Normatif |
| [01-journeys.md](01-journeys.md) | **Le graphe de navigation complet** : parcours guidé, frontières d'étape, effets de bord automatiques, anti-régressions de câblage | Normatif — le plus critique |
| [02-domain-rules.md](02-domain-rules.md) | Les 11 règles métier calculées (sémantique exacte + sources v4 + tests à porter) | Normatif |
| [03-data-model.md](03-data-model.md) | Décisions canoniques du data-model (le `prisma/schema.prisma` de la v4 récupérée sera copié tel quel) + trous historiques | Normatif |
| [04-lessons.md](04-lessons.md) | Chronologie v1→v5, les 5 modes d'échec documentés + contre-mesures, leçons opérationnelles | Contexte |
| [05-acceptance.md](05-acceptance.md) | Checklist d'acceptation (106 items dérivés de l'audit des 130 régressions) + gates transverses | Grille de recette |
| [06-ux-backlog.md](06-ux-backlog.md) | Constats de la revue UX 2026-07-02 reportés ou écartés | Backlog |

## Méthode v5 (rappel)

1. **Phase 1 — Walking skeleton** : le parcours complet (source → sélection → champs → destination → mappings → documents → plan READY), mince mais câblé bout-en-bout, test e2e Playwright dès le premier commit. Data-model = schéma réconcilié copié de v4.
2. **Phase 2+ — Tranches verticales** dans l'ordre du parcours. Definition of done par tranche : e2e étendu vert + tests métier (validés par l'utilisateur avant implémentation) + tranche atteignable depuis le parcours + items `05-acceptance.md` cochés sur preuve (test ou recette réelle), jamais sur déclaration.
3. **Recette sur org SF réelle** (>1000 objets) à chaque jalon — l'adaptateur démo ne suffit jamais.

## Références de lecture (ne pas modifier)

- v4 récupérée (source du port) : worktree `.claude/worktrees/keen-matsumoto-22c856` @02ac798d
- v3 (référence recette historique) : worktree `.claude/worktrees/v3-recette-ref` @b87e926d
- Audit des 130 régressions : [.specify/regression-audit-v3-v4.md](../../.specify/regression-audit-v3-v4.md)

## Décisions ouvertes (à trancher en Phase 1)

- **V1 (filtres)** : ajouter `IS_NOT_NULL`/`NOT_IN` à `FilterOperator` ou amender la décision — cf. [03-data-model.md](03-data-model.md) §7.
- **Dettes v4 documentées** ([01-journeys.md](01-journeys.md) §6) à corriger en v5 plutôt que reproduire : `migrateSelection` jamais appelée (sélection perdue au refresh de schéma), piège READY→BROKEN→DRAFT définitif, READY posé par simple navigation sans validation de contenu, `?object=` ignoré par field-mapping.
