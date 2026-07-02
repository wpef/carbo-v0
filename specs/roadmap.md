# Carbo-v0 — Feature Roadmap v2.2

**Date**: 2026-05-12
**Constitution**: v1.3.0 (Technology Standards: Vercel + Neon DB-per-tenant)

## Architecture

The application is split into two layers:

- **Core App** (Layer 1): Generic features that work with any connector. No reference to Salesforce, HubSpot, or any specific system.
- **Adapters** (Layer 2): Connector-specific implementations that plug into the Core App via the Connector Interface.

## Core UX Principle: The Plan is the Container

**Everything lives inside a Migration Plan.** The plan is the top-level entity that contains:
source connection, destination connection, object selection, field mapping, rules, filters, and
documents.

There are no standalone connector pages. The consultant cannot connect to a system without
first creating a plan. The home page is a list of plans.

### User flow:
1. **Home** → list of plans + "New Plan" button
2. **Create Plan** → name, description
3. **Inside the plan** — sequential steps:
   - 3a. Configure Source → choose adapter type, authenticate, select objects
   - 3b. Configure Destination → choose adapter type, authenticate
   - 3c. Map Objects → associate source objects to destination objects
   - 3d. Map Fields → map fields, add rules, add filters
   - 3e. Generate Documents → text + contractual
   - 3f. Run Migration (Phase 2)

## Phase 1 — Validate the full workflow

### Foundation

| # | Feature | Scope | Depends on |
|---|---------|-------|------------|
| 000 | Connector Interface | Abstract types and interfaces for all connectors | — |

### Plan & Connection

| # | Feature | Scope | Depends on |
|---|---------|-------|------------|
| 001 | Migration Plan | Create/list/delete plans — the top-level container for everything | 000 |
| 002 | Source Connection | Within a plan, connect to a source system (choose adapter, authenticate) | 001 |
| 003 | Source Schema Retrieval | Retrieve the list of source objects after connection | 002 |
| 004 | Source Object Selection | Select which source objects to include in migration scope | 003 |
| 005 | Source Field Retrieval | Retrieve fields for selected source objects only | 004 |
| 006 | Destination Connection | Within a plan, connect to a destination system | 001 |
| 007 | Destination Schema Retrieval | Retrieve the list of destination objects | 006 |
| 008 | Destination Field Retrieval | Retrieve fields for destination objects | 007 |

### Data Preview (on-demand, within plan context)

| # | Feature | Scope | Depends on |
|---|---------|-------|------------|
| 009 | Record Preview | Paginated data preview for any connected object | 005 or 008 |
| 010 | Field Stats | Per-field stats: null count, distinct values, samples | 009 |

### Mapping (within plan)

| # | Feature | Scope | Depends on |
|---|---------|-------|------------|
| 011 | Object Mapping | Map source object to destination object | 005, 008 |
| 012 | Field Mapping | Map source field to destination property, type compatibility | 011 |
| 013 | Migration Logic | Define migration logic rules (value equivalence, classification prompt, informational, error) | 012 |
| 015 | Migration Filters | Define filters on source records per object | 011 |
| 016 | Unmapped Fields Detection | Explicit warnings for unmapped fields (Principle III) | 012 |
| 017 | Mapping Integrity Check | Detect broken mappings after schema changes | 012 |

### Documents (within plan)

| # | Feature | Scope | Depends on |
|---|---------|-------|------------|
| 018 | Rule Description Engine | Translate rules to natural language (templates + LLM) | 013 |
| 019 | Text Document Generation | Readable document for the client | 018, 016 |
| 020 | Contractual Document Generation | Formal contractual document with signature block | 018, 016 |
| 021 | PDF Export | HTML to PDF conversion | 019 or 020 |

### Schema Write (optional, within plan)

| # | Feature | Scope | Depends on |
|---|---------|-------|------------|
| 022 | Schema Write | Create objects/properties in destination (gated by adapter capability) | 008 |

### Adapters (Layer 2)

| Adapter | Role | Implements |
|---------|------|-----------|
| Salesforce | Source | Connection, Schema, Fields, Records |
| HubSpot | Destination | Connection, Schema, Fields, Records, Schema Write |

## Phase 2 — Production mode

| # | Feature | Scope |
|---|---------|-------|
| 023 | Export/Import JSON | Serialize a plan to portable JSON |
| 024 | Migration Execution | Apply mapping on real data (dry-run + execute) |

## Phase 3 — Scale

| Feature | Scope |
|---------|-------|
| Project Management | Group multiple plans |
| New Adapters | Airtable, Dynamics, etc. via Connector Interface |
| Auto-mapping Suggestions | Field mapping suggestions based on name/type similarity |

## Cross-cutting: Workflow Navigation

Inside a plan, the UI MUST guide the consultant through each step with:
- A vertical step indicator showing all steps and current progress
- What was just completed (green checkmark)
- What the next step is (highlighted, call-to-action)
- Ability to go back to any completed step to review/modify

The home page shows a list of all plans with their current step/status.

## Infrastructure & Tenancy Model

**Date de décision** : 2026-05-12
**Statut** : Accepté
**Constitution alignée** : v1.3.0 — §Technology Standards

### Decision 1 — Hosting : Netlify

**Décision** : l'application Next.js est déployée sur **Netlify** (amendé le 2026-06-15 ; remplace Vercel).

**Amendement (2026-06-15)** : bascule de Vercel vers Netlify. Motif : compte Netlify payant
déjà en place côté équipe, et le tier gratuit Vercel interdit l'usage commercial sur repo
privé (Pro requis). Next.js 16 est pleinement supporté sur Netlify via l'adaptateur OpenNext
officiel (Adapter API stable depuis Next 16.2). La base de données reste **Neon en direct** —
on n'utilise PAS Netlify DB (simple wrapper Neon, cf. alternative écartée ci-dessous). Le
rationale Vercel ci-dessous est conservé pour mémoire mais ne s'applique plus.

**Décision initiale (conservée pour historique)** : l'application Next.js est déployée sur Vercel.

**Rationale** :
- Vercel est l'éditeur de Next.js — App Router, Route Handlers, ISR, edge config sont supportés
  nativement sans configuration ad hoc.
- Provisioning par PR (preview deployments) aligné avec le workflow speckit (une branche
  feature = un environnement testable).
- Connection pooling vers Postgres pris en charge nativement (clé pour les Route Handlers
  serverless qui ouvrent/ferment des connexions de façon non-prévisible).

**Alternatives écartées** :
- *Netlify (+ Netlify DB)* : Netlify DB est en réalité un wrapper sur Neon — donc on
  ajouterait un intermédiaire qui prend une marge sans valeur supplémentaire pour Next.js.
- *Railway / Render* : pricing prévisible et app+DB groupés, mais Next.js n'y est pas un
  citoyen de première classe (ISR, edge runtime, bundle limits sont du sur-mesure).
- *Self-hosted (Docker / VPS)* : coût opérationnel disproportionné pour un v0 ; à
  reconsidérer si une variante "self-host pour grands comptes" devient une exigence Phase 3.
- *AWS Amplify / Cloudflare Pages* : moins matures sur Next.js App Router à la date de
  décision (mai 2026), pas de gain net sur Vercel.

### Decision 2 — Base de données : Neon Postgres

**Décision** : la persistance est assurée par Neon (Postgres managé, serverless, branching).
La cible SQLite local-first du v0 initial est abandonnée au profit de Postgres dès la
première mise en hébergement.

**Rationale** :
- **Scale-to-zero** : critique pour le modèle DB-per-tenant (cf. Decision 3) — les bases
  inactives ne coûtent rien.
- **Branching copy-on-write** : aligné avec le Principe V (idempotence). On peut exécuter
  un dry-run de migration sur une branche éphémère, valider, puis détruire ou merger.
- **PITR 7 jours gratuit** : aligné avec le Principe VI (traçabilité) — retour en arrière
  facile en cas d'erreur d'exécution sur les données réelles d'un tenant.
- **Vrai Postgres standard** : pas de fork. Toutes les extensions disponibles (`pgcrypto`
  pour chiffrer les tokens OAuth source/destination, `pg_trgm` pour la recherche d'objets).
- **Prisma natif** : zéro adaptation par rapport au schéma existant ; basculer SQLite →
  Postgres dans `schema.prisma` est une opération bornée.

**Alternatives écartées** :
- *Supabase Postgres* : Postgres aussi, mais pas de scale-to-zero — chaque projet facture du
  compute en continu, rédhibitoire en DB-per-tenant. Les services bundle (auth, storage, RLS)
  ne servent pas dans notre modèle (cf. Decision 3). À reconsidérer si la collaboration
  multi-utilisateurs Phase 3 nous oriente vers RLS partagée.
- *RDS / Cloud SQL* : instance always-on ~$15-30/mois minimum, pas d'API simple de
  provisioning, surdimensionné pour des tenants qui dorment 95% du temps.
- *PlanetScale* : MySQL (pas Postgres) ; pricing changé en 2024 défavorable ; pas pertinent
  pour notre stack Prisma+Postgres.
- *Turso / Cloudflare D1 (SQLite distribué)* : modèle DB-per-tenant natif (un fichier =
  une DB), aligné avec la vision local-first initiale. Écarté car JSON/types complexes
  (rules, audit trail) plus ergonomiques en Postgres, et l'écosystème migration data
  (extensions, monitoring) reste plus mature sur Postgres.
- *Vercel Postgres* : utilise Neon sous le capot — passer par l'intermédiaire ajoute une
  couche de facturation sans gain.

**Conséquences** :
- Le schéma Prisma doit être audité pour types Postgres-spécifiques (ex: `Json` au lieu
  de `String` sérialisé, `Decimal` au lieu de `Float` pour les montants).
- Les tests d'intégration ne peuvent plus utiliser un SQLite in-memory — ils doivent cibler
  un Postgres réel (Neon branche éphémère en CI, Docker local en dev).
- Cold start après inactivité : ~300-500ms sur la première requête. Acceptable car le
  consultant ouvre l'app puis travaille en continu.

### Decision 3 — Modèle de tenancy : DB-per-tenant

**Décision** : chaque consultant inscrit possède **sa propre base Neon physiquement isolée**.
Une seule codebase Next.js déployée sur Vercel ; le runtime résout la `DATABASE_URL` Prisma
à partir du contexte d'authentification (`tenant_id` → DSN Neon stocké chiffré).

**Rationale** :
- **Sensibilité des données** : un consultant manipule l'intégralité du CRM d'un client
  (Salesforce + HubSpot, dizaines de milliers de contacts, deals, opportunités). Une fuite
  cross-tenant serait catastrophique commercialement et juridiquement. L'isolation physique
  rend cette fuite impossible *par construction*, pas par code applicatif.
- **Tokens OAuth source/destination** : stockés par tenant uniquement dans sa DB. Aucun
  index global ne permet de cross-référencer.
- **Économique grâce à Neon scale-to-zero** : 200 tenants × ~0$/mois inactifs = viable.
  Le même modèle sur RDS coûterait des milliers de dollars/mois.
- **Pas de gymnastique RLS** : aucune table partagée → aucun bug de policy possible.
- **Aligné avec Principe VIII (Modularité & Isolation)** : étend l'isolation logique des
  modules à l'isolation physique des données entre clients.

**Alternatives écartées** :
- *Multi-tenant logique (table partagée + `tenant_id` + RLS)* : standard SaaS, le moins
  cher, le plus scalable. Écarté car (a) la donnée manipulée est trop sensible pour
  s'appuyer uniquement sur des policies applicatives, (b) un bug RLS = fuite immédiate.
- *Instance complète par tenant (1 déploiement Vercel par client)* : isolation maximale
  mais orchestration impraticable (200 projets Vercel à provisionner, monitorer, mettre à
  jour). Réservé enterprise.
- *Desktop app Tauri (chaque consultant a son binaire local)* : très aligné avec la vision
  local-first initiale. Écarté pour Phase 1 car (a) bloque la Phase 3 collaborative,
  (b) onboarding et facturation plus complexes qu'un SaaS, (c) packaging cross-OS coûteux.
  Reste une option viable pour un futur produit "Carbo Studio" hors-roadmap.

**Conséquences** :
- Composant `lib/db/tenant-resolver.ts` à concevoir : résout `tenant_id` (extrait de la
  session) → instance Prisma client cachée par tenant.
- Provisioning automatisé à l'inscription : créer un projet Neon, exécuter `prisma migrate
  deploy` sur le DSN, stocker le DSN chiffré.
- Migrations Prisma exécutées **N fois** (une par tenant). Stratégie de rollout à définir
  (background job ou démarrage paresseux).
- Audit trail également par tenant — aucun audit cross-tenant possible. Conforme à VI.
- **Étape v0 pragmatique** : tant qu'un seul consultant est onboardé, on tourne avec une
  seule base Neon. Le code multi-tenant est conçu dès le départ mais l'orchestration de
  provisioning attend que le 2e tenant arrive.

## Key principles

- **The plan is the container** — no feature exists outside of a plan context
- **Each feature is independently freezable** — once validated, its internal code is not modified (Principle VIII)
- **Core features are connector-agnostic** — they work via abstract interfaces
- **Adapters are plugins** — adding a new connector requires zero changes to the core
- **User stories are atomic** — each feature has exactly one responsibility
- **Workflow guidance** — the consultant is never left wondering "what's next?"
- **Demo mode is connector-scoped** — "Use Demo Data" appears only in the connection step of a plan, replaces real auth with mock data
