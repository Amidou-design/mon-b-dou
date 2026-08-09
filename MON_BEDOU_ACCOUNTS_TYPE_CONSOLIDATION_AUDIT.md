# MON BÉDOU V1.0 — ACCOUNTS TYPE CONSOLIDATION AUDIT

**Date :** Étape audit
**Statut :** Audit uniquement — aucun fichier de code modifié au moment de l'audit.

---

## 0. Contexte

Accounts V1 est partiellement implémenté :
- ✅ table `accounts` créée (migration 006)
- ✅ types `Account` créés
- ✅ `accountService` créé

Avant d'ajouter `account_id` dans `transactions`, cet audit vérifie la cohérence des types de comptes.

---

## 1. Fichiers concernés

| Fichier | Rôle | Types de comptes |
|---|---|---|
| `types/database.ts` | Source de vérité TS | `AccountType`, `AccountProvider`, `Account`/`Insert`/`Update`, `source_account` |
| `services/parserService.ts` | Parser + UI | `ACCOUNT_KEYS`, `AccountKey`, `ACCOUNTS`, `ACCOUNT_KEYWORDS` |
| `services/financialCalculator.ts` | Moteur de calcul | `ACCOUNT_CONFIG`, `AccountBalance` |
| `services/transactionService.ts` | Service transactions | importe `AccountType` |
| `services/wealthService.ts` | Service épargne | importe `AccountType` |
| `services/accountService.ts` | Service comptes V1 | définit `AccountTypeV1` |
| `app/(tabs)/add.tsx` | UI | `ACCOUNTS`, `ACCOUNT_KEYS` |
| `app/(tabs)/savings.tsx` | UI | `ACCOUNTS`, `ACCOUNT_KEYS` |
| `supabase/migrations/20260712000000_006_create_accounts.sql` | Base | CHECK `account_type` (10 valeurs) |
| `supabase/migrations/20260710111158_005_fix_account_check_constraint.sql` | Base | CHECK `transactions.account` (6 valeurs) |

---

## 2. Duplications identifiées

### 2a. `AccountType` — 3 définitions divergentes

| Source | Valeurs |
|---|---|
| `database.ts` (`AccountType`) | `cash, wave, orange_money, moov_money, bank, card` (6) |
| `parserService.ts` (`ACCOUNT_KEYS`/`AccountKey`) | `cash, wave, orange_money, moov_money, bank, card` (6) |
| `accountService.ts` (`AccountTypeV1`) | `cash, wave, orange_money, moov_money, bank, card, savings, investment, mobile_money, other` (10) |
| Migration 006 (table `accounts`) | `cash, wave, orange_money, moov_money, bank, card, savings, investment, mobile_money, other` (10) |
| Migration 005 (table `transactions`) | `cash, wave, orange_money, moov_money, bank, card` (6) |
| `savings_transfers.source_account` | `AccountType` (6) |

**INCOHÉRENCE CRITIQUE** : `database.ts` `AccountType` (6 valeurs) ne couvre PAS les 10 valeurs autorisées par la table `accounts`. `accountService.ts` a dû créer `AccountTypeV1` local non partagé pour compenser.

### 2b. `AccountProvider`

Défini uniquement dans `database.ts` :
`'wave' | 'orange_money' | 'moov_money' | 'bank' | 'card' | 'cash' | 'other' | null` (7 valeurs + null).

Pas de duplication ailleurs, mais pas de config labels/couleurs (`ACCOUNT_PROVIDER_CONFIG` inexistant).

### 2c. Configurations de comptes (labels/couleurs) — 3 duplications

| Source | Nom | Contenu |
|---|---|---|
| `parserService.ts` | `ACCOUNTS` | map `AccountKey → {label, color}` (6) |
| `financialCalculator.ts` | `ACCOUNT_CONFIG` | map `AccountType → {label, color}` (6) |
| `wealthService.ts` | `ASSET_TYPES` | `cash, bank, wave, orange_money, moov_money` + actifs |

`ACCOUNTS` (parserService) et `ACCOUNT_CONFIG` (financialCalculator) sont quasi identiques (mêmes comptes/couleurs, labels légèrement différents : "Especes" vs "Espèces") → maintenance dupliquée, risque de dérive.

### 2d. `ACCOUNT_KEYS` / `ACCOUNT_LABELS`

- `ACCOUNT_KEYS` défini dans `parserService` (6).
- `AccountType` (database) = même liste (6) → duplication conceptuelle.
- Pas de `ACCOUNT_LABELS` nommé tel quel ; labels dans `ACCOUNTS` (parserService) et `ACCOUNT_CONFIG` (financialCalculator).

---

## 3. Différences Base / TypeScript / UI / Calculs

| Couche | Valeurs comptes | Problème |
|---|---|---|
| Base — table `accounts` | 10 | Le type TS ne couvre que 6 |
| Base — table `transactions` | 6 | — |
| TypeScript `AccountType` | 6 | Manque 4 valeurs de la table accounts |
| TypeScript `AccountTypeV1` (accountService) | 10 | Type local, non partagé |
| UI (add.tsx, savings.tsx) | 6 (via parserService) | Ne peut pas afficher savings/investment/mobile_money/other |
| Calculs (financialCalculator) | 6 | Ne gère pas les nouveaux comptes |
| `source_account` (épargne) | 6 | Cohérent transactions mais ≠ table accounts |

**Risque majeur** : après ajout de `account_id` dans transactions, un compte de type `savings`/`investment`/`mobile_money`/`other` serait rejeté à la compilation TS et non affiché/calculé par l'UI.

---

## 4. Problèmes trouvés

1. **P1 — `AccountType` trop étroit** : database.ts définit 6 valeurs alors que la table `accounts` en autorise 10. Incohérence DB ↔ TS.
2. **P1 — Type local dupliqué** : `AccountTypeV1` dans accountService.ts contourne le problème au lieu de le résoudre à la source.
3. **P2 — Double config comptes** : `ACCOUNTS` (parserService) et `ACCOUNT_CONFIG` (financialCalculator) quasi identiques → risque de dérive.
4. **P2 — UI figée à 6 comptes** : add.tsx et savings.tsx itèrent sur `ACCOUNT_KEYS` (6), ne peuvent pas afficher les nouveaux types.
5. **P2 — `source_account` (épargne) limité à 6** : incohérent avec les 10 types de la table accounts.
6. **P3 — Pas de `ACCOUNT_PROVIDER_CONFIG`** : provider seulement typé, aucun label/couleur centralisé.

---

## 5. Risques

- **Risque de compilation** : création d'un compte `savings`/`investment` via le service échouerait au typecheck TS tant que `AccountType` n'inclut pas ces valeurs.
- **Risque fonctionnel** : `getAccountsByType('savings')` compile mais l'UI ne saurait pas l'afficher.
- **Risque de régression** : modifier `AccountType` sans vérifier les 6 fichiers importeurs (transactionService, financialCalculator, wealthService, database.ts, add.tsx, savings.tsx) casserait le typing.
- **Risque de dérive** : 2 configs (ACCOUNTS/ACCOUNT_CONFIG) peuvent diverger (labels/couleurs).

---

## 6. Architecture cible proposée — `types/accounts.ts`

```ts
// types/accounts.ts  (source unique)
export type AccountType =
  | 'cash' | 'wave' | 'orange_money' | 'moov_money'
  | 'bank' | 'card' | 'savings' | 'investment'
  | 'mobile_money' | 'other';                          // 10 valeurs = table accounts

export type AccountProvider =
  | 'wave' | 'orange_money' | 'moov_money'
  | 'bank' | 'card' | 'cash' | 'other' | null;

export const ACCOUNT_KEYS: readonly AccountType[];

export const ACCOUNT_CONFIG: Record<AccountType, { label: string; color: string; icon: string }>;

export const ACCOUNT_PROVIDER_CONFIG: Record<Exclude<AccountProvider, null>, { label: string; color: string }>;

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string>;
```

**Refactorings associés** :
- `database.ts` : ré-exporter `AccountType`/`AccountProvider` depuis `types/accounts.ts` (ou les y déplacer).
- `parserService.ts` : importer `ACCOUNT_CONFIG`/`ACCOUNT_KEYS` depuis `types/accounts.ts` (supprimer `ACCOUNTS`, `AccountKey` locaux).
- `financialCalculator.ts` : importer `ACCOUNT_CONFIG` depuis `types/accounts.ts` (supprimer sa copie locale).
- `accountService.ts` : supprimer `AccountTypeV1`, utiliser `AccountType` centralisé.
- UI (add.tsx, savings.tsx) : importer depuis `types/accounts.ts`.
- `wealthService.ts` : `ASSET_TYPES` reste distinct (concerne les actifs) mais peut réutiliser `ACCOUNT_CONFIG` pour les types comptes communs.

---

## 7. Plan de migration recommandé

```
Étape 1 — Créer types/accounts.ts (types + config, source unique)
Étape 2 — Élargir AccountType à 10 valeurs dans database.ts (ou ré-exporter)
Étape 3 — Faire consommer types/accounts.ts par parserService, financialCalculator, accountService
Étape 4 — Mettre à jour l'UI (add.tsx, savings.tsx) pour itérer sur ACCOUNT_KEYS élargi
Étape 5 — Aligner savings_transfers.source_account sur les 10 valeurs (si souhaité)
Étape 6 — tsc --noEmit + vérification non-régression
Étape 7 — (futur) ajouter transactions.account_id
```

---

## 8. Périmètre non modifié

Cet audit ne touche pas :
- `transactions`
- `transactionService`
- `financialCalculator` (logique)
- `dashboard`
- l'UI
- Financial Events
- Financial Spaces

Migration progressive préservée.
