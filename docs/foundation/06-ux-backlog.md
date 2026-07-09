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

---

## Recette utilisateur du 2026-07-09 — À TRAITER (non traité, capturé tel quel)

Lot de retours pris en recette sur la démo (port 3001). **Aucun n'est traité** —
liste de travail pour les prochaines tranches. ID = `R<écran>.<n>`.

### R0 — Home
- **R0.1** Le CTA « **Reprendre : Source** » n'a pas de sens sur un plan qu'on
  vient de créer (rien à « reprendre »). → libellé contextuel (« Commencer :
  Source » à la création, « Reprendre : <étape> » ensuite).

### R1 — /source/objects
- **R1.1** Pouvoir **visualiser le schéma ET des enregistrements** par objet
  *à ce stade* (voir ce qu'on synchronise) — aujourd'hui l'aperçu n'existe qu'à
  l'étape champs. (recoupe §4 / R2)
- **R1.2** Ne pas afficher « **0 champs** » quand c'est juste que les champs ne
  sont pas encore récupérés (message trompeur).
- **R1.3** Ajouter un filtre « **Personnalisé** » (comme le filtre Système) pour
  n'afficher que les objets custom.
- **R1.4** Le bouton **Continuer doit rester toujours visible** (remarque
  générale — sticky footer d'étape).

### R2 — /source/fields (écran à REVOIR COMPLÈTEMENT)
- **R2.1** L'intérêt de la page n'est pas clair : on voit les champs mais on
  n'en fait rien. Aperçu extraits + stats **peu clair**. → repenser l'écran
  (fusionner avec R1.1 ? donner une action : exclure, prévisualiser, préparer
  le mapping). Remet en cause le §4 tel qu'implémenté (aperçu par accordéon).

### R3 — Connexion HubSpot
- **R3.1** OAuth HubSpot échoue : « le développeur de l'application n'a pas signé
  la politique d'utilisation acceptable » (**AUP HubSpot non signée**). →
  blocker recette CONNU : signer l'AUP dans le portail dev HubSpot, OU passer
  par le **token Private App** (déjà implémenté, bouton « Utiliser un token »).

### R4 — /destination/fields
- **R4.1** Le bouton « **Créer un champ** » est mal placé (sous l'accordéon
  d'aperçu de données, pas regroupé avec les champs). → le remonter au niveau
  de la liste des champs de l'objet. (revoit l'intégration §13 dans l'UI)

### R5 — /object-mapping
- **R5.1** Voir un **détail des champs** de chaque objet dans cette vue (savoir
  si le mapping objet↔objet est pertinent avant de plonger dans les champs).
- **R5.2** Pouvoir **filtrer les enregistrements** à migrer *au niveau objet*
  (ex : Contact dont CreatedDate < 01/01/2021). = filtres §10 remontés/visibles
  dès l'étape object-mapping (aujourd'hui les filtres vivent dans field-mapping).
- **R5.3** Un objet source pouvant viser **plusieurs objets destination**, le
  visualiser dans la liste (aujourd'hui la liste ne montre qu'une cible).
- **R5.4** Filtre « **non mappés** » sur la liste des objets.

### R6 — /field-mapping (le plus gros lot)
- **R6.1** **Statut de mapping PAR OBJET**, mis à jour automatiquement :
  distinguer p. ex. « tous les champs dest complets & valides », « tous les
  champs dest OBLIGATOIRES complets & valides », « commencé mais pas fini »,
  « rien fait », « modifié depuis ma dernière intervention ». Logique de statut
  par objet — **déjà spécifiée** (recoupe §7 linkStatus + intégrité + drift, à
  agréger au niveau objet et à afficher).
- **R6.2** L'ajout de **champ de destination** doit se faire ICI (c'est ici
  qu'on réalise qu'il en manque), pas seulement sur /destination/fields. (déplace
  ou duplique l'entrée §13)
- **R6.3** Quand on mappe 2 champs qui **nécessitent une configuration**, ouvrir
  **automatiquement la modal** de logique à la volée (pas d'ouverture manuelle).
- **R6.4** Modal picklist↔picklist : la **visualisation des liens par vecteurs
  SVG ne fonctionne pas** → remplacer par un système plus simple (ex : liste
  de correspondances déroulantes, ou 2 colonnes avec sélection ligne à ligne).
- **R6.5** **Vue d'ensemble des statuts d'objets** : voir rapidement lesquels
  sont correctement mappés / à quel point / pas commencés / commencés-non-finis
  / modifiés depuis la dernière intervention. Rien de tout ça n'existe
  aujourd'hui dans la vue. (coeur de R6.1, à concevoir comme un tableau de bord
  de la vue field-mapping)
- **R6.6** La **classification par prompt (D2)** est bancale → proposer un
  système plus simple mais qui fonctionne (piste backlog : mapping de valeurs
  manuel type D1 même pour texte→picklist, + règles simples « contient/égale »,
  au lieu d'un prompt LLM ; garder le LLM en option assistée).
- **R6.7** Proposer des **systèmes de transformation de la donnée** pour chaque
  type et chaque combinaison (piste : catalogue de transformations par paire de
  types normalisés — concat, split, format date, upper/lower, map de valeurs,
  défaut, expression — au-delà de la seule équivalence D1).
- **R6.8** Dans la modal, pouvoir **gérer explicitement le statut** du mapping
  (en plus du mécanisme auto qui check) — override manuel « validé / à revoir ».

> Transverse R6 : R6.1/R6.5/R6.8 forment une **refonte du modèle de statut de
> mapping** (par champ ET par objet, auto + manuel), à cadrer avant de coder.
