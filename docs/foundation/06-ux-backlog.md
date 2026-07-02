# 06 — Backlog UX (revue du 2026-07-02)

Constats de la revue 3 lentilles (logique / clarté / simplicité) **jugés
défendables mais reportés** — soit parce qu'ils dépendent de features Phase 2,
soit parce que le rapport valeur/complexité ne justifiait pas de les traiter
dans le walking skeleton. À reconsidérer à chaque tranche verticale touchant
la zone concernée. Les constats traités sont documentés dans
[01-journeys.md](01-journeys.md) §7 (commit `95137cb3`).

## Reportés — à reconsidérer

| # | Zone | Constat | Quand le traiter |
|---|------|---------|------------------|
| 1 | Sidebar | L'étape « Source » recouvre 3 sous-pages sans que le stepper le montre (pas de sous-étapes affichées, clic sur l'étape active = retour racine) | Si la recette réelle montre de la désorientation ; design : sous-étapes indentées dans le stepper |
| 2 | Home | La carte d'un plan passe par le hub avant l'étape (1 clic de transit) | Si friction confirmée en usage ; fix : CTA « Reprendre » directement sur la carte |
| 3 | Source/destination en revisite | `/source` connectée n'est qu'un écran de transit vers objects | Avec l'adaptateur SF (l'écran gagnera refresh schéma/drift/déconnexion — il cessera d'être vide) |
| 4 | Onglets field-mapping | Compteur « 0 champ » mensonger tant que l'onglet n'a pas été visité (auto-match lazy) ; pastille « non traité » à prévoir | Avec le port du linkStatus 5 états (02-domain-rules règle 1) qui refondra les badges d'onglets |
| 5 | Badge « à vérifier » | Explication au survol posée, mais toujours pas d'ACTION (« Confirmer » → compatible) | Avec le port de la matrice de compatibilité réelle + migration-logic (D1–D4) |
| ~~6~~ | ~~Documents~~ | ~~apiNames bruts, pas d'alerte paires à 0 champ~~ **RÉSOLU vague 2** : libellés humains + « ⚠ aucune correspondance définie » dans le document | — |
| 7 | Statut du plan | Pas de tooltip définissant Brouillon/Prêt/Erreur sur le badge header ; « Erreur » (BROKEN) ni expliqué ni actionnable | Avec l'intégrité/BROKEN (Phase 2) — le badge deviendra cliquable vers le panneau d'issues |
| 8 | Auto-link/auto-match | Notices non fermables (pas de ×) ; acceptable tant qu'elles sont rares | Si elles deviennent envahissantes |

## Traités en vague 2 (contre-vérification adversariale)

- État transitoire object-mapping : « Association automatique des objets en
  cours… » pendant l'auto-link ; CTA « Mapper les champs → » toujours visible
  mais désactivé (avec raison) à 0 paire.
- Document généré : libellés humains + alerte paires vides (ex-item 6).
- « 2. Champs destination restants » (symétrie des en-têtes).
- Dernière paire : CTA bas « Terminer le mapping → » (plus de doublon de
  libellé avec le CTA haut).
- Confirmations et aria-labels de suppression de paire : libellés humains.
- Outil ux-snapshots : attentes explicites (plus de captures « Chargement… »).

## Écartés (décision assumée)

- **Modales custom au lieu de `window.confirm`** pour les suppressions en
  cascade : sur-design à ce stade (verdict lentille simplicité).
- **Réduire le double-clic source→destination** du mapping manuel : coût réel
  faible tant que l'auto-match absorbe l'essentiel ; à re-questionner sur des
  objets à 50+ champs (org réelle).
- **Confirmation sur suppression d'un champ mappé** : volontairement absente
  (recréation en 2 clics = réversible) ; le statut du plan redescend
  visiblement (recomputeReadiness + refresh header) si c'était le dernier.
