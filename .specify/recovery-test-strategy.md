# Stratégie de tests — récupération v4 (validée 2026-06-16)

**Cadre** : Constitution Principe IV — tests fonctionnels sur **données réalistes** (formes SF/HubSpot réelles, jamais de lorem ipsum / fixture 1 ligne) ; unitaires réservés aux **fonctions pures** ; **tests avant implémentation** (TDD) sur les flux critiques.

**Outillage** : Vitest 4 + @testing-library/react + jsdom (déjà en deps ; `vitest.config.ts` présent). Script ajouté : `test` = `vitest run`, `test:watch` = `vitest`. **Node 22 dispo dans l'env d'exécution → les tests tournent et sont vérifiés au vert avant chaque commit.**

## 4 couches

1. **Unitaire (fonctions pures)** — cœur algorithmique restauré : matrice de compatibilité + `getSectionType`, `computeLinkStatus` (précédence 5-états BROKEN>RED_DASHED>RED_SOLID>ORANGE>GREEN), `isForwardStep`/`normalizeStep`, taxonomie drift + `detectLiveDrift`, registres sémantiques auto-link/auto-match SF→HS, `computeUnmappedFields`, moteur de descriptions, génération n° de référence, prédicats de filtres. Zéro infra, exécutables immédiatement.
2. **Intégration (services + routes API, DB de test réelle, données réalistes)** — flux critiques : plan + `advanceStep`→READY, connexion + snapshot + drift, mapping objets/champs + auto-création + transition BROKEN, filtres + toggle, unmapped + `FieldExclusion`, génération docs, schema-write.
3. **Composant (RTL smoke)** — UI interactive critique : vues de mapping, modale D1-D4, badges statut/lien, bannière drift, sidebar d'étapes.
4. **E2E (Playwright)** — non installé + exige OAuth réel → **différé** pour cette récupération (à reprendre pour la démo hébergée).

## Données de test

Module de fixtures réalistes partagé : Salesforce (Account/Contact/Lead avec apiNames réels, champs picklist + reference) + HubSpot (companies/contacts/deals). Réutilisé partout. Aligné sur la forme du demo-adapter.

## DB d'intégration (couche 2) — DÉCISION : branche Neon de test

Postgres fidèle à la prod (enums/Json/`@db.Text` natifs). L'utilisateur fournit une `DATABASE_URL` vers une branche Neon jetable (via `.env.test`). Reset entre suites. Tant que l'URL n'est pas fournie, la couche 1 (unitaire) avance sans bloquer.

## Discipline & boucle

Par feature : écrire les tests qui échouent (depuis les scénarios d'acceptation de la spec) → implémenter jusqu'au vert → `vitest run <scope>` ici → lint → commit. Couverture ciblée (cœurs algorithmiques + flux critiques + UI clé), pas 100%. Les ports depuis v3 amènent leur logique + un test neuf.
