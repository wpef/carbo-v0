# Déploiement — Carbo (Phase 1, démo testable)

Cible : **Vercel** (hébergement) + **Neon** (Postgres managé). Aligné constitution v1.3.0.

## Prérequis local (optionnel — pour lancer en local)

- **Node ≥ 20.9** : `nvm install 20 && nvm use 20`. Next 16 et Vitest 4 l'exigent (Node 18 ne build pas).
- `npm install`

## 1. Base de données — Neon  ⟵ *ton intervention #1a*

1. Compte sur https://neon.tech (gratuit) → **New Project** (région EU si testeurs en Europe).
2. Dans **Connection Details**, copie deux URLs :
   - **Pooled** (host en `-pooler`) → `DATABASE_URL`
   - **Direct** (sans `-pooler`) → `DIRECT_URL`
3. Transmets-les (ou colle-les dans Vercel à l'étape 2). Elles servent à créer la migration initiale.

## 2. Hébergement — Vercel  ⟵ *ton intervention #1b*

1. Compte https://vercel.com → **Add New → Project** → importe le repo GitHub.
2. Branche de déploiement : `implement/phase-1-v4` (poussée par l'équipe de dev).
3. **Environment Variables** → ajoute `DATABASE_URL` et `DIRECT_URL` (valeurs Neon).
4. **Deploy.** Le build exécute automatiquement `prisma migrate deploy` (script `vercel-build`).

## Variables d'environnement

| Variable | Lot | Rôle |
|----------|-----|------|
| `DATABASE_URL` | 0 | Connexion Postgres *poolée* (runtime app) |
| `DIRECT_URL` | 0 | Connexion Postgres *directe* (migrations Prisma) |
| `SALESFORCE_CLIENT_ID` / `_SECRET` | 1 | Connected App OAuth Salesforce |
| `HUBSPOT_CLIENT_ID` / `_SECRET` | 2 | App OAuth HubSpot |
| `APP_URL` | 1-2 | Base URL des callbacks OAuth (ex : `https://carbo.vercel.app`) |
| `ENCRYPTION_KEY` | 1-2 | Clé 32 octets (base64) chiffrant les tokens stockés |

Détails dans `.env.example`.

## Migration initiale (côté dev, une fois `DIRECT_URL` connu)

```bash
npx prisma migrate dev --name init   # crée prisma/migrations/ + applique sur Neon
git add prisma/migrations && git commit -m "chore(db): initial Postgres migration"
```

Ensuite chaque déploiement Vercel rejoue `prisma migrate deploy` automatiquement.
