# Déploiement — Carbo (Phase 1, démo testable)

Cible : **Netlify** (hébergement) + **Neon** (Postgres managé).

> Bascule Vercel → Netlify (2026-06-15) : compte Netlify payant déjà en place, et le tier
> gratuit Vercel interdit l'usage commercial sur repo privé. Next 16 est pleinement supporté
> sur Netlify via l'adaptateur OpenNext officiel. La base reste **Neon en direct** (pas
> Netlify DB, qui n'est qu'un wrapper Neon).

## Prérequis local (optionnel — pour lancer en local)

- **Node ≥ 20.9** : `nvm install 20 && nvm use 20`. Next 16 et Vitest 4 l'exigent (Node 18 ne build pas).
- `npm install`

## 1. Base de données — Neon  ⟵ *ton intervention #1a*

1. Compte sur https://neon.tech (gratuit) → **New Project** (région EU si testeurs en Europe).
2. Dans **Connection Details**, copie deux URLs :
   - **Pooled** (host en `-pooler`) → `DATABASE_URL`
   - **Direct** (sans `-pooler`) → `DIRECT_URL`
3. Transmets-les (ou colle-les dans Netlify à l'étape 2). Elles servent à créer la migration initiale.

## 2. Hébergement — Netlify  ⟵ *ton intervention #1b*

1. https://app.netlify.com → **Add new site → Import an existing project** → GitHub → `Fils-de-Projet/carbo-v0`.
2. **Branch to deploy** : `implement/phase-1-v4`.
3. Build : rien à configurer à la main — `netlify.toml` (committé) fournit la commande
   (`npx prisma migrate deploy && npm run build`) et fixe Node 20. Le runtime Next.js s'installe seul.
4. **Environment variables** → ajoute `DATABASE_URL` et `DIRECT_URL` (valeurs Neon).
5. **Deploy.** Le build applique les migrations puis build l'app.

## Variables d'environnement

| Variable | Lot | Rôle |
|----------|-----|------|
| `DATABASE_URL` | 0 | Connexion Postgres *poolée* (runtime app) |
| `DIRECT_URL` | 0 | Connexion Postgres *directe* (migrations Prisma) |
| `SALESFORCE_CLIENT_ID` / `_SECRET` | 1 | Connected App OAuth Salesforce |
| `SALESFORCE_CALLBACK_URL` | 1 | `https://<ton-site>.netlify.app/api/connectors/salesforce/callback` |
| `HUBSPOT_CLIENT_ID` / `_SECRET` | 2 | App OAuth HubSpot |
| `APP_URL` | 1-2 | Base URL des callbacks OAuth (ex : `https://<ton-site>.netlify.app`) |
| `ENCRYPTION_KEY` | 1-2 | Clé 32 octets (base64) chiffrant les tokens stockés |

Détails dans `.env.example`.

## Schéma de la base (phase démo)

Le build Netlify exécute `prisma db push` : il synchronise directement le schéma Prisma vers
Neon (création des tables au 1er déploiement, no-op ensuite si inchangé). Pas de fichiers de
migration à gérer pendant que le schéma évolue (ajout des adapters). On formalisera de vraies
migrations Prisma (`migrate deploy`) avant la mise en production.

## Notes Prisma sur Netlify

- Le client Prisma est généré avec `binaryTargets = ["native", "rhel-openssl-3.0.x"]`
  (cf. `prisma/schema.prisma`) — indispensable pour que le moteur de requête soit trouvé
  dans les fonctions Netlify en Node 20.
- Si une fonction ne trouve pas le moteur au runtime, ajouter dans `netlify.toml` un bloc
  `[functions] included_files = ["node_modules/.prisma/client/**"]`.
