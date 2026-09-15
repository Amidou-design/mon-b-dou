# MON BÉDOU — PROJECT STATE

## Date de l'audit
2026-08-27

## État global
🟠 PARTIEL

Le repository contient une fondation Accounts V1 et un Financial Truth Layer partiellement centralisé, mais plusieurs morceaux restent en attente de validation et de raccordement réel. L’état actuel est bien meilleur que le point zéro, mais il n’est pas encore conforme à la cible V2.1 ni complètement validé sur les invariants financiers.

## V1
- fonctionnalités terminées : fondations de comptes, types account centralisés, migration account_id, UI de sélection de compte, calculateur financier centralisé
- fonctionnalités partielles : solde réel par compte, transfert complet entre comptes, intégration complète des transactions avec compte réel, consolidation fiable, nettoyage de dépendances legacy
- fonctionnalités restantes : validation du flux complet Account → Transaction → Balance, migration des données historiques, suppression progressive du legacy, raccordement intégral aux dashboards et prévisions

## Accounts V1

| Élément | État | Preuve | Reste à faire |
|---|---|---|---|
| migration accounts | 🟢 TERMINÉ | `project/supabase/migrations/20260712000000_006_create_accounts.sql` crée la table `accounts`, RLS, index | Valider la compatibilité historique et les usages réels |
| table accounts | 🟢 TERMINÉ | table présente et accessible via service | Sécuriser le flux de création/usage en production |
| RLS accounts | 🟢 TERMINÉ | politique `users_read_own_accounts`, `users_insert_own_accounts`, `users_update_own_accounts`, `users_delete_own_accounts` | Vérifier les cas de fichiers non autorisés et les usages en app |
| account_id transactions | 🟢 TERMINÉ | migration `20260826000000_007_add_transaction_account_id.sql` ajoute la colonne + index | Vérifier la cohérence des données historiques |
| AccountType / AccountProvider | 🟢 TERMINÉ | `project/types/accounts.ts` centralise les définitions | Vérifier doublons et compatibilité avec les usages legacy |
| accountService | 🟢 TERMINÉ | `project/services/accountService.ts` contient les fonctions CRUD + calcul réel de solde | Vérifier les cas de comptes historiques et les règles de transfert |
| accountService + UI add.tsx | 🟠 PARTIEL | `project/app/(tabs)/add.tsx` sélectionne un compte réel et garde un fallback legacy | Vérifier qu’aucune double écriture n’a lieu et que les transactions sont correctement persistées |
| double écriture account / account_id | ⚠️ À VÉRIFIER | code présente les deux champs dans `database.ts` et `transactionService.ts` | Déterminer le comportement exact lors d’un insert et de la lecture |
| solde réel par compte | 🟢 TERMINÉ POUR LE BRANCHEMENT | `getAccountBalance` a été branché sur les transactions réelles en priorisant `account_id` puis le legacy | Confirmer le calcul complet avec les données réelles et les transferts futurs |
| migration historique de comptes | 🔴 NON COMMENCÉ | aucune logique de backfill ou mapping historique détectée | définir le mapping des comptes historiques |

## Financial Truth Layer

- Calculateur centralisé présent : `project/services/financialCalculator.ts`
- Règles de base connues : transferts exclus du P&L, épargne/investissement exclus de la dépense de consommation, net worth calculé via cash + actifs + investissements - passifs
- Ce qui est réel : `calculateSpaceFinancialData`, `calculateAccountBalances`, `calculateFinancialSummary`, `calculateConsolidatedReport` existent
- Ce qui reste incertain : la logique est encore profondément dépendante de `owner` et de `account` legacy dans les données, ce qui rend la consolidation fragile
- Risque majeur : les transferts ne sont pas totalement modélisés avec `source_account_id` / `destination_account_id`; le code de `calculateAccountBalances` applique un débit simple sur le compte source et ne crédite pas explicitement la destination
- Constat : le FTL est présent, mais il n’est pas encore le système unique de vérité complet sur les comptes réels et la double écriture legacy

## Database

- `accounts` table créée dans `20260712000000_006_create_accounts.sql`
- `transactions.account_id` ajouté dans `20260826000000_007_add_transaction_account_id.sql`
- `transactions.account` est conservé, comme prévu dans la fondation V1
- Contrainte FK : `account_id` référence `public.accounts(id)` et `ON DELETE SET NULL`
- Index créé : `idx_transactions_account_id`
- Risque : l’application semble utiliser simultanément `account` legacy et `account_id`, ce qui pose la possibilité de divergences de données si les deux sont renseignés de manière incohérente

## Services

- `project/services/accountService.ts` : service CRUD pour comptes, mais calcul de solde placeholder
- `project/services/transactionService.ts` : insert/update/queries avec `account_id` et `account` ; logique de fallback visible
- `project/services/parserService.ts` : parse des transactions avec `account_id` nullable et `account` legacy
- `project/services/financialCalculator.ts` : source centralisée de calculs financiers
- `project/services/dashboardService.ts` : calcule les dashboards à partir du Financial Truth Layer centralisé
- `project/services/wealthService.ts` : service destiné à patrimoine et investissement
- `project/services/consolidationEngine.ts` : logique de consolidation par espaces
- `project/services/forecastEngine.ts` : prévisions basées sur revenus / dépenses et événements

## UI

- `project/app/(tabs)/add.tsx` affiche un sélecteur de comptes réels avec fallback legacy
- le flux réel est bien : sélection compte réel → `account_id` → transaction → `account_id` + `account` legacy fallback
- ce comportement est un bon signe de progression, mais il n’y a pas de preuve de validation complète du cycle complet (sauvegarde + lecture + balance)
- pas de preuve d’un écran de solde réel par compte connecté à la vraie logique financière

## Tests

- TypeScript : exécuté avec succès via `cd "c:\Users\DS PC\Downloads\projectbd\project"; npm run typecheck`
- Résultat : commande terminée sans erreur signalée
- Aucun test unitaire ou d’intégration spécifique trouvé dans le repo (aucun fichier de test correspondant aux motifs `*.test.*` / `*.spec.*`)
- ESLint : NON CONFIGURÉ
- `git diff --check` : exécuté; uniquement des avertissements de fin de ligne (LF→CRLF) sans erreur de patch significative
- Validation réelle Supabase : BLOQUÉE. Le projet ne contient pas de table `public.accounts` dans le schéma actuel et la table `transactions` est vide ; il n’y a donc pas de données de compte réelles disponibles pour le test fonctionnel demandé.

## Documentation

- `MON_BEDOU_ARCHITECTURE_V2.1.md` : document de conception cible et architecture Financial Space
- `MON_BEDOU_ACCOUNTS_V1_ARCHITECTURE.md` : document d’architecture concerné par Accounts V1
- `MON_BEDOU_ACCOUNTS_TYPE_CONSOLIDATION_AUDIT.md` : audit technique sur types et consolidation
- `TODO.md` et `TODO_ORCHESTRATOR.md` : traces de planification, mais non preuve d’implémentation terminée

## Risques actuels

- double source de vérité : `account` legacy + `account_id` réel
- calcul de solde incomplet et placeholder
- dépendance au `owner` legacy dans le Financial Truth Layer
- possibilité de double comptabilisation lors d'un flux de transfert ou de migration historique
- absence de tests end-to-end sur la chaîne de compte réelle

## Blocages

- le vrai calcul du solde est encore non connecté
- la logique complète de transfert entre comptes n’est pas confirmée dans le code
- les données historiques ne sont pas migrées ni mappées de manière explicite
- la consolidation et la roadmap V2.1 restent dépendantes d’un nettoyage conceptuel plus large

## Roadmap vers V2.1

| Étape | Description | État | Dépendances |
|---|---|---|---|
| Étape 1 — Fondations Accounts | table `accounts`, RLS, types | 🟢 TERMINÉ | migration SQL + types |
| Étape 2 — account_id sur transactions | ajout de la colonne | 🟢 TERMINÉ | schema + service |
| Étape 3 — sélection/usage de comptes dans l’UI | sélection réelle + fallback | 🟠 PARTIEL | `add.tsx`, `parserService.ts`, `transactionService.ts` |
| Étape 4 — solde réel par compte | calculer depuis `account_id` et transactions | 🔴 NON COMMENCÉ | `accountService.ts`, `transactionService.ts`, `financialCalculator.ts` |
| Étape 5 — transfert complet entre comptes | source/destination + invariants | 🔴 NON COMMENCÉ | `transactions` + `financialCalculator.ts` |
| Étape 6 — migration historique et legacy cleanup | mapping + fallback + suppression progressive | 🔴 NON COMMENCÉ | migrations + services + validation |
| Étape 7 — Financial Space / V2.1 | abstraction financière cible | 🔴 NON COMMENCÉ | architecture + migrations |

## PROCHAINE ÉTAPE UNIQUE

### Objectif
Valider et corriger la chaîne réelle Accounts V1 : sélection de compte → `account_id` → transaction enregistrée → calcul de solde par compte sans double compter ni dépendre du legacy.

### Pourquoi maintenant
C’est l’étape la plus critique et la plus bloquante pour sécuriser le reste du flux financier. Sans cela, les dashboards, la consolidation, les prévisions et les validations financières restent fondés sur un modèle incomplet.

### Fichiers probablement concernés
- `project/services/accountService.ts`
- `project/services/transactionService.ts`
- `project/services/financialCalculator.ts`
- `project/services/parserService.ts`
- `project/types/database.ts`
- `project/app/(tabs)/add.tsx`

### Dépendances
- migration `20260826000000_007_add_transaction_account_id.sql`
- table `accounts`
- logique existante de parsing et d’écriture transactions
- invariants financiers définis dans le Financial Truth Layer

### Risques
- faux solde + double comptage
- incohérence entre `account` et `account_id`
- corruption des historiques ou des rapports financiers
- fausse impression de complétude malgré un flux partiel

### Validation prévue
- typecheck
- revue des transactions insertées avec compte réel
- vérification du solde calculé par compte
- contrôle des écritures legacy vs `account_id`
- recherche de régression sur le P&L et les dashboards
