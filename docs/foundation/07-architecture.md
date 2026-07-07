# 07 — Architecture & prise en main

> Objectif : pouvoir itérer sur UNE vue ou UNE fonctionnalité sans toucher au
> reste. Ce document dit où vit chaque chose et quelles sont les frontières.

## Vue d'ensemble

```
src/
├── app/                          ← ROUTING SEULEMENT (pages minces + routes API fines)
│   ├── plans/[planId]/*/page.tsx     chaque page = 3 lignes : monte un composant de feature
│   └── api/                          routes = validation des entrées + appel d'UN service
├── features/                     ← LE CODE MÉTIER, isolé par fonctionnalité
│   ├── connectors/                   back : contrat, registre, adaptateurs (voir ci-dessous)
│   ├── connections/                  front : pages de connexion source/destination
│   ├── schema/                       sélection d'objets, catalogue/récupération des champs
│   ├── plans/                        cycle de vie du plan, étapes, stepper
│   ├── object-mapping/               mapping des objets
│   ├── field-mapping/                mapping des champs
│   └── documents/                    génération de documents
├── components/ui/                ← primitives shadcn/Base UI (génériques, sans métier)
└── lib/                          ← transverses minces : db (Prisma), audit, utils
```

**Règle de dépendance** : `app/` → `features/` → `lib/`. Une feature n'importe
pas les composants d'une autre feature ; les échanges passent par les routes
API (front) ou par les services (back). Exceptions transverses assumées :
`plans/lib/steps.ts` + `record-step.ts` (le parcours) et
`connectors/contract.ts` (types du contrat).

## Anatomie d'une feature front

```
features/connections/
├── components/       composants de rendu (une responsabilité chacun)
│   ├── connection-page.tsx      orchestration (quel sous-composant montrer)
│   ├── adapter-picker.tsx       choix du connecteur
│   ├── connection-card.tsx      connexion active + actions
│   └── private-app-token-form.tsx
└── hooks/
    └── use-connection.ts        TOUTE la logique (état, fetch, actions)
```

Pattern systématique : **la page `app/` monte, le hook pense, les composants
rendent**. Modifier l'apparence = toucher un composant. Modifier le
comportement = toucher le hook. La page ne change jamais.

## Le module connecteurs (back)

```
features/connectors/
├── contract.ts        ← LE point d'extension : interface ConnectorAdapter
├── registry.ts        ← la seule liste des adaptateurs
├── link-registry.ts   ← correspondances auto-link/auto-match par paire de CRM
├── connection-service.ts   cycle de vie connexion + schéma (objets)
├── salesforce/        auth.ts (OAuth2+PKCE) · schema.ts (mappings purs) · adapter.ts · constants · types
├── hubspot/           auth.ts (OAuth2 + Private App) · schema.ts · adapter.ts · constants · types
└── demo/              data.ts · adapter.ts (source + destination)
```

**Ajouter un CRM** : créer `features/connectors/<crm>/` qui implémente
`ConnectorAdapter` (descriptor, capabilities, objectMetadata, getObjects,
getFields), puis l'ajouter à `registry.ts`. Le picker UI, la connexion, la
sélection d'objets, la récupération de champs et les pages fonctionnent sans
autre modification. Si le CRM a des correspondances prévisibles avec un autre,
les déclarer dans `link-registry.ts`.

### Décisions structurantes

- **Objets ≠ champs** : la connexion récupère les OBJETS (léger) ; les CHAMPS
  passent par `field-retrieval-service` (1 describe/objet sur Salesforce),
  scopés aux objets sélectionnés côté source, à l'arrivée sur la page champs
  (auto-récupération §4.2). Ne jamais re-fusionner les deux.
- **Tokens** : persistés dans `ConnectorConnection.config` (JSON) ; le refresh
  est transparent et INTERNE à l'adaptateur (`getValidConfig` /
  `getValidAccessToken`) — aucun appelant ne gère l'expiration.
- **OAuth** : `/api/connectors/{type}/auth` initie, `/callback` termine
  (crée la connexion, la lie au plan, fetch le schéma en best-effort ; le
  client a un filet §4.1). Le `state` porte `planId:nonce` ; le verifier PKCE
  SF survit au hot-reload via `globalThis`.
- **Salesforce = source only, HubSpot = destination only** (périmètre
  phase 1) — déclaré dans `descriptor.sides`, appliqué par les routes et le
  picker.
- **HubSpot sans OAuth approuvé** : le POST `/api/connectors/hubspot/auth`
  accepte un token Private App (formulaire dans le picker).

## Où toucher quoi (recettes rapides)

| Je veux… | Je touche |
|---|---|
| Changer l'écran de sélection d'objets | `features/schema/components/object-selection-page.tsx` |
| Changer la logique de connexion (pas l'UI) | `features/connections/hooks/use-connection.ts` |
| Ajouter un opérateur de filtre, une règle métier | le service de la feature + son test |
| Ajouter un CRM | `features/connectors/<crm>/` + `registry.ts` (+ `link-registry.ts`) |
| Changer les correspondances auto SF→HubSpot | `features/connectors/link-registry.ts` |
| Changer l'ordre/les règles des étapes | `features/plans/lib/steps.ts` + `services/plan-service.ts` |
| Modifier une route API | `app/api/**` (validation) ou le service appelé (logique) |

## Gardes

- `npm run test:e2e` — le parcours complet (le garde anti-« construit mais
  pas câblé »). Doit être vert avant tout commit qui touche au parcours.
- `npm test` — tests unitaires (adaptateurs SDK-mockés, registres purs).
- `npx tsc --noEmit` — zéro erreur, toujours.
- Env : `.env.local` (gitignoré) porte `SALESFORCE_*` et `HUBSPOT_*` ;
  dev sur le port **3001** (les callbacks OAuth y sont enregistrés).
