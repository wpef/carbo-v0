# Handoff — Préparer `specs/phase-1-v4`

**Date** : 2026-05-13
**Auteur du handoff** : session debug OAuth + drift detection
**Pour** : nouvelle conversation dédiée à la création de la branche `specs/phase-1-v4`

---

## Objectif

L'utilisateur veut une nouvelle branche **specs-only** `specs/phase-1-v4` contenant :

1. Toutes les mises à jour de specs venant de `feat/oauth-schema-refresh` (31 commits, dont une bonne moitié pure-spec)
2. Toutes les mises à jour de specs venant de `claude/pensive-galileo-0ea674` (3 commits)
3. Une constitution réconciliée (les deux branches ont des bumps v1.3.0 indépendants)

Une fois cette branche review/corrigée à la main, l'utilisateur relancera **le cycle speckit complet** (`/speckit.clarify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement`) sur une nouvelle `implement/phase-1-v4`.

**Contrainte** : l'implémentation existante (`implement/phase-1-v3`) doit rester intacte — pas de squash, pas de force-push, pas de delete.

---

## État du repo après nettoyage (post 2026-05-13)

### Branches locales restantes

| Branche | Position | Usage |
|---------|----------|-------|
| `master` | base | Constitution v1.1.0, specs Phase 1 figées |
| `implement/phase-1-v3` | master +88 | Implémentation de référence — ne pas toucher |
| `claude/pensive-galileo-0ea674` | v3 +3 | À cherry-picker (specs only) |
| `feat/oauth-schema-refresh` (HEAD) | v3 +31 | À cherry-picker (specs only) |

### Branches remote restantes

`origin/master`, `origin/feat/oauth-schema-refresh`, `origin/implement/phase-1-v3`.

Toutes les anciennes branches features ont été supprimées (`001-salesforce-connector`, `002-hubspot-connector`, `003-mapping-plan`, `004-client-documents`, `specs/phase-1`, `implement/phase-1`).

### Worktrees

Un seul worktree actif (le main). Un répertoire vide locked subsiste : `.claude/worktrees/pensive-galileo-0ea674/`. À supprimer manuellement après fermeture de Claude Code (handle Node ouvert).

---

## Plan d'exécution

### Étape 0 — Préparation (la nouvelle session doit valider l'état)

```bash
git checkout master
git status                    # doit être clean
git fetch --all --prune
git pull origin master        # synchro
```

### Étape 1 — Créer la branche

```bash
git checkout -b specs/phase-1-v4 master
```

### Étape 2 — Cherry-pick `feat/oauth-schema-refresh` (specs only)

La branche `feat/oauth-schema-refresh` contient 31 commits, certains purement code, certains mixtes, certains purement specs. **À cherry-picker** :

| Commit | Sujet | Notes |
|--------|-------|-------|
| `8c60ea33` | spec: auto-trigger schema retrieval post-OAuth + manual refresh | pur spec |
| `5ffb7894` | spec: capture lessons from 2026-04-23 live SF+HS test session | pur spec |
| `0df49262` | spec(003): refresh from /source/schema must run full chain + integrity check | pur spec |
| `ed76904c` | spec(003): add full-chain rule + integrity check hook rule to plan | pur spec |
| `e4730475` | spec(007): mirror full-chain + integrity check rules from 003 | pur spec |
| `2a164384` | spec(007): add full-chain rule + integrity check hook rule to plan | pur spec |
| `9aa1a4d6` | spec(017): add Design Decisions section — no automatic FK re-binding | pur spec |
| `dd2e1af2` | spec(017): update task statuses + add MVP scope + T011/T012 | pur spec |
| `65bdc9a7` | constitution(v1.3.0): add Principle IX — human-in-the-loop | **CONFLIT** avec pensive-galileo |
| `77cd81c4` | spec(017): codify UI-side apiName matching rule + T013 task | pur spec |
| `bf3c76a7` | spec(000): FR-012 — codify 1-indexed pagination convention | pur spec |
| `a38c6c08` | spec(003): add drift detection on plan reopen + canonical modification types table | pur spec |
| `5b85b169` | spec(007): mirror drift detection on plan reopen — destination side | pur spec |
| `3ee4269a` | spec(001): plan-reopen drift detection — trigger, banner, sidebar badges | pur spec |
| `a1e7015d` | spec(011): drift highlighting on Object Mapping page | pur spec |
| `8386054d` | spec(012): drift highlighting on Field Mapping page | pur spec |

**À NE PAS cherry-picker** (commits code ou mixtes) :

| Commit | Sujet | Raison |
|--------|-------|--------|
| `412058bd` | feat(hook): add skipConnect option | code seulement |
| `304151ca` | feat(source): auto-trigger schema retrieval | code seulement |
| `4fcbb517` | feat(destination): auto-trigger schema retrieval | code seulement |
| `58d18acc` | fix(services): dedupe adapter factory | code seulement |
| `489c7c7c` | fix(hubspot): remove invalid scopes | code seulement |
| `e26f0ca9` | feat(017 T011,T012): apiName resolution + BROKEN | code seulement |
| `ea6b68d6` | feat(017 T011): apiName resolution in listObjectMappings | code seulement |
| `88aaca30` | feat(017 T012): UI rendering for BROKEN | code seulement |
| `48eb0065` | feat(017 T004,T006): checkAndUpdatePlanStatus | code seulement |
| `e297d92e` | feat(017 T007): re-check integrity on mapping CRUD | code seulement |
| `6f1351f6` | fix(003,007): full setup chain on schema page | code seulement |
| `219f1f9e` | fix(017): ObjectMappingView SVG by apiName | code seulement |
| `28f15ee2` | fix(sf,hs): record preview pagination 1-indexed | code seulement |
| `8f03722b` | spec(sf): Developer Edition pre-seeded | reverted by `b0cf72e1` |
| `b0cf72e1` | Revert "spec(sf): Developer Edition..." | reverte le précédent |

Commande type :
```bash
git cherry-pick 8c60ea33 5ffb7894 0df49262 ed76904c e4730475 2a164384 \
                9aa1a4d6 dd2e1af2 65bdc9a7 77cd81c4 bf3c76a7 a38c6c08 \
                5b85b169 3ee4269a a1e7015d 8386054d
```

**À résoudre durant le cherry-pick** : conflit sur `9aa1a4d6` (`specs/017-mapping-integrity-check/spec.md`) probable car commit suivant `dd2e1af2` réécrit dessus. À vérifier au moment du pick.

### Étape 3 — Cherry-pick `claude/pensive-galileo-0ea674`

3 commits, dans cet ordre :

| Commit | Sujet |
|--------|-------|
| `3b9ce014` | spec(constitution): bump v1.2.0 → v1.3.0, formalize hosting + tenancy |
| `563b3cb2` | spec(roadmap): add Infrastructure & Tenancy Model section, bump v2.1 → v2.2 |
| `cf0ac6df` | spec(plans): align 18 feature plans with constitution v1.3.0 |

**Conflit attendu** sur `3b9ce014` : `.specify/memory/constitution.md` — deux versions v1.3.0 différentes. **Voir Arbitrage #1 ci-dessous.**

**Conflits possibles** sur `cf0ac6df` :
- `specs/003-source-schema-retrieval/plan.md` (déjà modifié par `ed76904c`)
- `specs/007-destination-schema-retrieval/plan.md` (déjà modifié par `2a164384`)

Commande :
```bash
git cherry-pick 3b9ce014 563b3cb2 cf0ac6df
```

### Étape 4 — Vérifications

```bash
# La branche doit contenir uniquement des fichiers specs/ et .specify/
git diff master..specs/phase-1-v4 --name-only | grep -v '^specs/\|^\.specify/'
# Doit retourner zéro ligne

# Lister les fichiers modifiés
git diff master..specs/phase-1-v4 --stat
```

### Étape 5 — Push

```bash
git push -u origin specs/phase-1-v4
```

---

## Arbitrages à demander à l'utilisateur

Ces 4 questions doivent être posées **avant** de finaliser la branche.

### Arbitrage #1 — Constitution : deux v1.3.0 concurrentes

Deux commits indépendants ont bumpé la constitution à v1.3.0 :

- **`65bdc9a7`** (feat/oauth-schema-refresh) ajoute **Principe IX : Human-in-the-loop**
  > L'automation ne prend jamais de décision destructive ou ambiguë à la place du consultant. Pas de re-binding FK silencieux, pas d'auto-suppression de mappings cassés, pas d'auto-remap fuzzy.

- **`3b9ce014`** (claude/pensive-galileo) reformule **Technology Standards**
  > Base de données SQLite local-first → **Neon Postgres** (managed serverless). Nouveau **Hosting : Vercel**. Nouveau **Modèle de tenancy : DB-per-tenant** (1 Neon DB par consultant). Provisioning automatisé via API Neon à l'inscription.

**Question à l'utilisateur** :
> Les deux changements sont orthogonaux et compatibles. Veux-tu :
> - **(a)** Une constitution **v1.4.0** unifiée qui embarque les deux (Principe IX + Tenancy/Hosting) — proposition par défaut
> - **(b)** Garder un seul des deux changements (lequel ?) et reporter l'autre
> - **(c)** Versions séparées : v1.3.0 = pensive, v1.4.0 = Principe IX (deux bumps séparés dans l'historique de v4)

### Arbitrage #2 — Spec 023 (Connection Reconfiguration)

`claude/pensive-galileo` contient :
- `21f10791` ajoute spec 023 (Connection Reconfiguration)
- `adadfabc` **revert** 023 et intègre la reconfig directement dans specs 002/006

Le cherry-pick de `cf0ac6df` n'embarque PAS ces deux commits (ils sont absents de la liste à cherry-picker). Mais la branche pensive contient bien le résultat final (reconfig intégrée dans 002/006) au moment du commit `cf0ac6df`.

**Question à l'utilisateur** :
> Veux-tu embarquer aussi `21f10791` puis `adadfabc` dans v4 (ce qui ajoute des changements à 002/006) ? Sinon, la reconfig n'apparaîtra pas du tout dans v4 et il faudra la respec plus tard.

### Arbitrage #3 — Ordre des cherry-pick

Deux ordres possibles :

- **(a)** D'abord feat/oauth-schema-refresh puis pensive-galileo
  - Avantage : on pose le Principe IX d'abord, puis on overlay Tenancy/Hosting + alignement des plans
  - Le commit `cf0ac6df` (18 plans alignés) risque d'écraser les modifs de `ed76904c` (plan 003) et `2a164384` (plan 007)
- **(b)** D'abord pensive-galileo puis feat/oauth-schema-refresh
  - Avantage : on pose la base v1.3.0 Tenancy + plans alignés, puis on superpose les fixes spec
  - Conflit sur la constitution arrive tôt et clair

**Question à l'utilisateur** :
> Quel ordre préfères-tu ? Recommandation : **(b)** pour avoir le conflit constitution traité en premier et propre.

### Arbitrage #4 — Que faire des commits code de `feat/oauth-schema-refresh` ?

15 commits code ont été appliqués pendant la session debug (fix Bug A/B/C, implémentation T011/T012 mapping integrity, etc.). Ils ne vont pas dans v4 (specs-only) — mais ils existent toujours sur `feat/oauth-schema-refresh`.

**Question à l'utilisateur** :
> Une fois v4 spécifié et validé, la nouvelle `implement/phase-1-v4` repartira de zéro depuis les specs v4. Que veux-tu faire de l'implémentation de `feat/oauth-schema-refresh` :
> - **(a)** L'archiver telle quelle (la branche reste sur origin, à titre de référence pour comparer l'ancien comportement)
> - **(b)** La merger dans `implement/phase-1-v3` pour que v3 reflète l'état debuggé
> - **(c)** La supprimer une fois v4 implémenté

---

## Récap des fichiers concernés

### Spec files modifiés sur feat/oauth-schema-refresh (cherry-pick spec-only)

```
.specify/memory/constitution.md                         (CONFLIT avec pensive)
specs/000-connector-interface/spec.md
specs/001-migration-plan/spec.md
specs/002-source-connection/spec.md
specs/003-source-schema-retrieval/spec.md
specs/003-source-schema-retrieval/plan.md               (probable conflit avec pensive)
specs/004-source-object-selection/plan.md
specs/005-source-field-retrieval/plan.md
specs/006-destination-connection/spec.md
specs/007-destination-schema-retrieval/spec.md
specs/007-destination-schema-retrieval/plan.md          (probable conflit avec pensive)
specs/009-record-preview/spec.md
specs/011-object-mapping/spec.md
specs/012-field-mapping/spec.md
specs/017-mapping-integrity-check/spec.md
specs/017-mapping-integrity-check/tasks.md
specs/adapters/hubspot/{contracts/api.md,plan.md,quickstart.md,research.md,spec.md}
specs/adapters/salesforce/{plan.md,quickstart.md,research.md,spec.md}
```

### Spec files modifiés sur claude/pensive-galileo

```
.specify/memory/constitution.md                         (CONFLIT avec feat/oauth)
specs/roadmap.md
specs/001-migration-plan/plan.md
specs/002-source-connection/plan.md
specs/003-source-schema-retrieval/plan.md               (probable conflit)
specs/004-source-object-selection/plan.md
specs/005-source-field-retrieval/plan.md
specs/006-destination-connection/plan.md
specs/007-destination-schema-retrieval/plan.md          (probable conflit)
specs/008-destination-field-retrieval/plan.md
specs/011-object-mapping/plan.md
specs/012-field-mapping/plan.md
specs/013-transformation-rules/plan.md
specs/015-migration-filters/plan.md
specs/016-unmapped-fields-detection/plan.md
specs/017-mapping-integrity-check/plan.md
specs/019-text-document/plan.md
specs/020-contractual-document/plan.md
specs/021-pdf-export/plan.md
specs/022-schema-write/plan.md
specs/adapters/hubspot/{quickstart.md,research.md}
specs/adapters/salesforce/{quickstart.md,research.md}
```

### Files communs (zones de conflit)

- `.specify/memory/constitution.md` — Arbitrage #1 obligatoire
- `specs/003-source-schema-retrieval/plan.md` — fusion manuelle des deux contenus
- `specs/007-destination-schema-retrieval/plan.md` — fusion manuelle des deux contenus
- `specs/adapters/salesforce/quickstart.md` + `research.md` — orthogonal probable
- `specs/adapters/hubspot/quickstart.md` + `research.md` — orthogonal probable

---

## Après v4 — Workflow speckit complet

Une fois `specs/phase-1-v4` review/corrigée par l'utilisateur :

1. `/speckit.analyze` — vérifier la cohérence cross-spec
2. `/speckit.clarify` — résoudre les ambiguïtés
3. `/speckit.plan` — régénérer plan.md/research.md/data-model.md/contracts/quickstart.md feature par feature
4. `/speckit.tasks` — régénérer tasks.md
5. `/speckit.implement` — exécuter sur branche `implement/phase-1-v4`

`implement/phase-1-v3` reste intacte comme référence historique.

---

## Première action de la nouvelle session

Lire ce fichier, puis poser **les 4 arbitrages** à l'utilisateur **avant tout cherry-pick**. Ne pas commencer le travail sans avoir les réponses sur :

1. Constitution v1.3.0 unifiée vs v1.4.0 vs versions séparées
2. Inclusion de la spec 023 (reconfiguration connexion)
3. Ordre de cherry-pick (a) ou (b)
4. Avenir de la branche `feat/oauth-schema-refresh` post-v4
