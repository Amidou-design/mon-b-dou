# MON BÉDOU — ACCOUNTS V1 ARCHITECTURE

## Architecture Cible & Plan de Migration

---

> **Document :** Rapport d'Architecture Accounts V1  
> **Projet :** Mon Bédou — Application de Gestion Financière Personnelle & Entrepreneuriale  
> **Auteur :** Architecte Backend / CTO  
> **Date :** Révision basée sur l'audit du codebase existant (V2.0 / V2.1)  
> **Statut :** Document de conception — Aucun code, aucune migration, aucune modification de projet inclus dans ce document. À valider avant implémentation.

---

## TABLE DES MATIÈRES

1. [Résumé exécutif](#1-résumé-exécutif)
2. [État actuel](#2-état-actuel)
3. [Problèmes identifiés](#3-problèmes-identifiés)
4. [Architecture cible](#4-architecture-cible)
5. [Modèle Accounts](#5-modèle-accounts)
6. [Account Types](#6-account-types)
7. [Financial Space](#7-financial-space)
8. [Transactions](#8-transactions)
9. [Transferts internes](#9-transferts-internes)
10. [Transferts inter-spaces](#10-transferts-inter-spaces)
11. [Épargne](#11-épargne)
12. [Investissements](#12-investissements)
13. [Soldes des comptes](#13-soldes-des-comptes)
14. [Financial Truth Layer](#14-financial-truth-layer)
15. [Financial Events](#15-financial-events)
16. [Calendar](#16-calendar)
17. [RLS (Row Level Security)](#17-rls-row-level-security)
18. [Migration des transactions historiques](#18-migration-des-transactions-historiques)
19. [Migration de Savings Transfers](#19-migration-de-savings-transfers)
20. [Tests à prévoir](#20-tests-à-prévoir)
21. [Plan de migration](#21-plan-de-migration)
22. [Compatibilité future](#22-compatibilité-future)
23. [Risques](#23-risques)
24. [Priorités P0 / P1 / P2](#24-priorités-p0--p1--p2)
25. [Recommandation CTO finale](#25-recommandation-cto-finale)

---

## 1. RÉSUMÉ EXÉCUTIF

**Mon Bédou** est une application de gestion financière personnelle et entrepreneuriale qui évolue vers une architecture **Financial Space** (V2.1). Le système actuel ne possède **aucune table `accounts`** : le concept de compte est réduit à une énumération textuelle (`account: AccountType`) dans la table `transactions`. Cela empêche :

- D'identifier des comptes réels (ex : "Banque BGI" ≠ "Banque Personnel")
- De représenter correctement les **transferts** (pas de compte destination)
- D'effectuer des **transferts inter-financial-spaces**
- De distinguer **épargne virtuelle** (objectif) et **épargne réelle** (compte)
- D'avoir un **solde par compte** fiable

**Accounts V1** introduit une véritable table `accounts` permettant de représenter des comptes financiers identifiables, appartenant à des Financial Spaces, et supportant les opérations de transfert complètes.

**Ce document est une conception uniquement.** Aucune modification du codebase, aucune migration SQL, aucune modification UI ne sont incluses. La validation du CTO est requise avant toute implémentation.

---

## 2. ÉTAT ACTUEL

### 2.1 Tables existantes (auditées via les migrations SQL)

| Table | Rôle | Champ espace | Comptes |
|---|---|---|---|
| `profiles` | Profil utilisateur | — | — |
| `transactions` | Opérations financières | `owner` (text CHECK) | `account` (text CHECK : cash, wave, orange_money, moov_money, bank, card) |
| `organizations` | Entités organisationnelles | — | — |
| `savings_goals` | Objectifs d'épargne | `owner` | — |
| `savings_transfers` | Transferts vers épargne | `owner` | `source_account` (AccountType), `destination_account` (text, par défaut 'savings') |
| `investments` | Investissements | `owner` | — |
| `assets` | Actifs déclarés | `owner` | — |
| `liabilities` | Passifs | `owner` | — |
| `financial_events` | Événements calendaires | `organization_id` | — |
| `financial_forecasts` | Prévisions | `organization_id` | — |
| `insights_history` | Historique d'insights | — | — |
| `financial_opportunities` | Opportunités | — | — |

### 2.2 Types actuels (extraits de `database.ts`)

```typescript
export type OwnerType = 'personal' | 'bgi' | 'aurel' | 'onkoonnect';
export type AccountType = 'cash' | 'wave' | 'orange_money' | 'moov_money' | 'bank' | 'card';
```

### 2.3 Services core (Financial Truth Layer)

Le **Financial Calculator** (`financialCalculator.ts`) est la source de vérité actuelle. Il calcule :
- Soldes par compte (via `calculateAccountBalances`)
- Résumé financier (revenus, dépenses, flux net)
- Patrimoine net (Cash + Actifs + Investissements - Passifs)
- Règle des 35%

### 2.4 Problème du transfert

Dans `calculateAccountBalances`, un transfert est traité comme :

```typescript
if (t.transaction_nature === 'transfer') {
  balanceMap.set(account, currentBalance - amount); // Seulement débit !
  continue;
}
```

Le compte destination n'est **jamais crédité**.

---

## 3. PROBLÈMES IDENTIFIÉS

### 3.1 🔴 Critique : Absence de comptes réels

- `account` est une énumération, pas une entité
- Impossible d'avoir "Banque Personnel" ET "Banque BGI"
- Pas de solde persistant par compte
- Pas d'historique des soldes

### 3.2 🔴 Critique : Transferts incomplets

- Pas de `destination_account` dans les transactions
- Un transfert débite le source mais ne crédite jamais le destination
- **Perte artificielle de liquidité** dans les calculs

### 3.3 🔴 Critique : Pas de transfert inter-financial-space

- Impossible de track un mouvement Banque Personnel → Wave ON'KOONNECT
- Pas de `destination_owner` ou `destination_financial_space_id`

### 3.4 🟠 Élevé : Épargne ambiguë

- `savings_goals` = objectifs virtuels
- `savings_transfers.destination_account = 'savings'` n'est pas un vrai compte
- Pas de distinction entre épargne réelle et objectif virtuel
- Double comptage potentiel du patrimoine

### 3.5 🟠 Élevé : Migration historique bloquée

- Des transactions avec `account = 'bank'` existent
- Impossible de déterminer si c'est la banque personnelle, BGI, AUREL ou ON'KOONNECT
- Risque de mauvaise affectation silencieuse

### 3.6 🟡 Moyen : Investissements plats

- Pas de structure portefeuille/position/marché
- Pas de lien entre un investissement et le compte bancaire source
- Un investissement est traité comme une dépense (perte de liquidité)

### 3.7 🟡 Moyen : Financial Events / Calendar sans lien compte

- `financial_events` utilise `organization_id` (pas de lien avec accounts)
- Impossible de planifier un événement sur un compte spécifique
- Workflow Event → Transaction → Compte absent

### 3.8 🟢 Faible : RLS basique

- RLS uniquement sur `user_id = auth.uid()`
- Compatible avec V1 mais doit préparer l'évolution multi-espace

---

## 4. ARCHITECTURE CIBLE

### 4.1 Principe général

```
USER
│
└── FINANCIAL SPACE (owner / financial_space_id)
    │
    └── ACCOUNTS (comptes réels identifiables)
        │
        ├── TRANSACTIONS normales (account_id)
        │
        └── TRANSFERS (source_account_id → destination_account_id)
```

### 4.2 Règles fondamentales

1. **Un compte appartient à UN et UN SEUL Financial Space.**
2. **Une transaction appartient à UN et UN SEUL compte.**
3. **Un transfert relie DEUX comptes (source et destination).**
4. **Les comptes peuvent être dans le même Financial Space ou dans des espaces différents.**
5. **Le solde d'un compte est la vérité comptable (initial_balance + toutes les opérations).**
6. **Les transferts ne modifient JAMAIS le P&L (Profit & Loss).**
7. **L'épargne réelle est un compte comme les autres.**
8. **L'objectif d'épargne est un marqueur, pas un compte.**

### 4.3 Schéma conceptuel cible

```
┌─────────────────────────────────────────────────────────────────┐
│                      auth.users                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    financial_spaces                               │
│  (À créer en V2.1 - prérequis pour Accounts V1)                  │
│                                                                  │
│  Personnel (personal)        BGI (enterprise)                    │
│  ├── Banque Personnel        ├── Banque BGI                      │
│  ├── Wave Personnel          ├── Wave BGI                        │
│  ├── Cash Personnel          ├── Cash BGI                        │
│  ├── Épargne Personnel       │                                  │
│  └── Carte Personnel         ├── AUREL (subsidiary)              │
│                               │   └── Cash AUREL                 │
│                               │                                  │
│                               └── ON'KOONNECT (subsidiary)       │
│                                   ├── Banque ON'KOONNECT         │
│                                   └── Wave ON'KOONNECT           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. MODÈLE ACCOUNTS

### 5.1 Table `accounts`

```sql
CREATE TABLE accounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- financial_space_id sera ajouté dans une phase ultérieure (V2.1+)
  -- En V1, on utilise owner comme mécanisme transitoire
  owner             text NOT NULL DEFAULT 'personal' CHECK (owner IN ('personal', 'bgi', 'aurel', 'onkoonnect')),
  name              text NOT NULL,
  type              text NOT NULL CHECK (type IN (
    'cash', 'bank', 'mobile_money', 'card', 'savings', 'investment', 'other'
  )),
  -- Provider : spécifique mobile_money (wave, orange_money, moov_money, mtn_money, etc.)
  -- NULL pour les autres types
  provider          text,
  currency          text NOT NULL DEFAULT 'XOF',
  initial_balance   numeric NOT NULL DEFAULT 0,
  -- balance calculée dynamiquement (voir section 13)
  -- stocké pour performance mais jamais source de vérité
  cached_balance    numeric NOT NULL DEFAULT 0,
  description       text,
  is_active         boolean NOT NULL DEFAULT true,
  is_archived       boolean NOT NULL DEFAULT false,
  metadata          jsonb NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  archived_at       timestamptz,

  -- Contraintes d'unicité
  -- (user_id, owner, name) permet d'avoir "Wave Personnel" ET "Wave BGI"
  UNIQUE(user_id, owner, name)
);

-- Indexes
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_accounts_owner ON accounts(owner);
CREATE INDEX idx_accounts_type ON accounts(type);
CREATE INDEX idx_accounts_active ON accounts(user_id, is_active);

-- RLS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_accounts" ON accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_accounts" ON accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_accounts" ON accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_accounts" ON accounts
  FOR DELETE USING (auth.uid() = user_id);
```

### 5.2 Justification de l'unicité

**Décision :** `UNIQUE(user_id, owner, name)`

**Raison :**

- `(user_id, name)` ne suffit PAS car "Wave" peut exister dans Personnel ET BGI
- `(user_id, owner, name)` permet :
  - `Wave Personnel` (owner=personal, name=Wave)
  - `Wave BGI` (owner=bgi, name=Wave)
  - `Banque Personnel` (owner=personal, name=Banque)
  - `Banque BGI` (owner=bgi, name=Banque)

**Alternative rejetée :** `UNIQUE(user_id, owner, type)` — ne permettrait pas d'avoir deux comptes bank dans le même espace.

**Évolution future :** Quand `financial_space_id` remplacera `owner`, la contrainte deviendra `UNIQUE(user_id, financial_space_id, name)`.

### 5.3 Polymorphisme owner / financial_space_id

En V1, `accounts` utilise `owner` (compatible avec le modèle existant). La migration vers `financial_space_id` se fera en V2.1+.

**Stratégie transitoire :**
- `owner` est présent dans `accounts` pour compatibilité avec les données et services existants
- À terme, `owner` sera remplacé par `financial_space_id` (FK vers `financial_spaces`)
- Les deux colonnes peuvent coexister temporairement

### 5.4 Données initiales (seed)

Pour chaque utilisateur existant, créer les comptes par défaut :

```sql
-- Personnal
INSERT INTO accounts (user_id, owner, name, type, provider) VALUES
  (uid, 'personal', 'Espèces', 'cash', NULL),
  (uid, 'personal', 'Banque', 'bank', NULL),
  (uid, 'personal', 'Wave', 'mobile_money', 'wave'),
  (uid, 'personal', 'Orange Money', 'mobile_money', 'orange_money'),
  (uid, 'personal', 'Moov Money', 'mobile_money', 'moov_money'),
  (uid, 'personal', 'Carte', 'card', NULL);

-- BGI
INSERT INTO accounts (user_id, owner, name, type, provider) VALUES
  (uid, 'bgi', 'Espèces BGI', 'cash', NULL),
  (uid, 'bgi', 'Banque BGI', 'bank', NULL),
  (uid, 'bgi', 'Wave BGI', 'mobile_money', 'wave');

-- AUREL
INSERT INTO accounts (user_id, owner, name, type, provider) VALUES
  (uid, 'aurel', 'Espèces AUREL', 'cash', NULL);

-- ON'KOONNECT
INSERT INTO accounts (user_id, owner, name, type, provider) VALUES
  (uid, 'onkoonnect', 'Banque ON\'KOONNECT', 'bank', NULL),
  (uid, 'onkoonnect', 'Wave ON\'KOONNECT', 'mobile_money', 'wave');
```

---

## 6. ACCOUNT TYPES

### 6.1 Taxonomie

| Type | Description | Provider possible |
|---|---|---|
| `cash` | Espèces physiques | NULL |
| `bank` | Compte bancaire | NULL (ou nom de la banque en metadata) |
| `mobile_money` | Argent mobile | wave, orange_money, moov_money, mtn_money, telecel_money |
| `card` | Carte bancaire / crédit | visa, mastercard, etc. en metadata |
| `savings` | Compte d'épargne réel | NULL |
| `investment` | Compte d'investissement / SGI / PEA | NULL (ou institution en metadata) |
| `other` | Autre type de support | Défini en metadata |

### 6.2 Décision architecturale : Provider vs Type

**Question :** Wave, Orange Money, Moov Money doivent-ils être des `account_type` ou des `provider` ?

**Analyse comparative :**

| Critère | Approche A : Types séparés | Approche B : Provider |
|---|---|---|
| **Types** | `cash, wave, orange_money, moov_money, bank, card` | `cash, mobile_money, bank, card` |
| **Provider** | — | `wave, orange_money, moov_money` |
| **Ajouter MTN Money** | Nouveau type + migration CHECK | Nouveau provider dans la même table |
| **Ajouter PayPal** | Nouveau type + migration CHECK | Nouveau provider (ou nouveau type) |
| **Code switch** | `if (type === 'wave')` | `if (type === 'mobile_money' && provider === 'wave')` |
| **Requêtes groupées** | Agrégation par type explicite | Agrégation par type puis par provider |
| **Migration existante** | Renommer les types existants | Ajouter provider, mapper les anciennes valeurs |

**Recommandation : APPROCHE B — Provider**

**Justification :**
1. **Évolutivité maximale** : Ajouter `MTN Money` ou `Telecel Money` ne nécessite aucune migration de schéma, juste un nouvel enregistrement dans la table
2. **Généralisation future** : Le pattern `type + provider` peut s'étendre à d'autres domaines (ex: `bank` provider = `SGB`, `NSIA`, etc.)
3. **Regroupement logique** : On peut agréger tous les mobile_money ensemble, ce qui est plus pertinent pour les rapports
4. **Rétrocompatibilité** : Les anciennes valeurs `wave`, `orange_money` deviennent simplement `mobile_money` avec `provider` correspondant

**Inconvénient :** Complexité supplémentaire pour le filtrage (deux champs au lieu d'un). Mitigé par des vues simplifiées et des helpers dans le code.

### 6.3 Mapping de migration pour AccountType

```typescript
// Ancien → Nouveau
const ACCOUNT_TYPE_MIGRATION: Record<string, { type: string; provider: string | null }> = {
  'cash':          { type: 'cash',          provider: null },
  'bank':          { type: 'bank',          provider: null },
  'card':          { type: 'card',          provider: null },
  'wave':          { type: 'mobile_money',   provider: 'wave' },
  'orange_money':  { type: 'mobile_money',   provider: 'orange_money' },
  'moov_money':    { type: 'mobile_money',   provider: 'moov_money' },
};
```

### 6.4 Provider taxonomy extensible

```typescript
export type ProviderType = 
  | 'wave' 
  | 'orange_money' 
  | 'moov_money' 
  | 'mtn_money' 
  | 'telecel_money'
  | 'paypal'
  | 'wise'
  | string; // Extensible
```

---

## 7. FINANCIAL SPACE

### 7.1 Relation Accounts → Financial Spaces

**Décision :** En V1, `accounts` utilise `owner` (enum textuel) comme mécanisme transitoire de segmentation par espace.

**Relation :**
- Chaque compte appartient à UN owner (`personal`, `bgi`, `aurel`, `onkoonnect`)
- La table `accounts.owner` référence conceptuellement un Financial Space
- Il n'y a PAS de FK formelle vers `organizations` ou `financial_spaces` en V1

### 7.2 Stratégie de transition en 4 phases

#### PHASE 1 — V1 (Accounts V1)

```
accounts.owner: text CHECK (personal, bgi, aurel, onkoonnect)
```

- Compatible avec le modèle `owner` existant dans toutes les tables
- Les comptes sont segmentés par `owner`
- Les services continuent d'utiliser `owner` pour le filtrage

#### PHASE 2 — V2.1 (Financial Spaces créés)

```
financial_spaces table created
accounts + financial_space_id (nullable)
```

- La table `financial_spaces` est créée
- `financial_space_id` est ajouté à `accounts` en NULLABLE
- Migration : `owner` → `financial_space_id` via mapping des noms

#### PHASE 3 — V2.1+ (Migration progressive)

```
accounts.financial_space_id = NOT NULL
accounts.owner = toujours présent mais déprécié
```

- Double écriture `owner` + `financial_space_id`
- Les services utilisent `financial_space_id` en priorité
- `owner` conservé pour rétrocompatibilité

#### PHASE 4 — V2.2+ (Finalisation)

```
accounts.owner = supprimé
```

- `owner` est retiré
- `financial_space_id` est la seule colonne d'appartenance

### 7.3 Mapping owner → Financial Space

| owner | Financial Space | Type | Parent |
|---|---|---|---|
| `personal` | Personnel | `personal` | NULL |
| `bgi` | BGI | `enterprise` | NULL |
| `aurel` | AUREL | `subsidiary` | BGI |
| `onkoonnect` | ON'KOONNECT | `subsidiary` | BGI |

---

## 8. TRANSACTIONS

### 8.1 Évolution de la table transactions

#### Actuel

```sql
transactions (
  id, user_id, amount, type, category, description,
  account: AccountType,     -- TEXT enum
  owner: OwnerType,          -- TEXT enum
  transaction_nature, ...
)
```

#### Cible V1 — Option recommandée

```sql
transactions (
  id, user_id, amount, type, category, description,
  account_id: uuid REFERENCES accounts(id),  -- NOUVEAU
  owner: OwnerType,                           -- Conservé temporairement
  account: AccountType,                       -- Conservé temporairement (nullable)
  -- Transferts
  destination_account_id: uuid REFERENCES accounts(id),  -- NOUVEAU (nullable)
  destination_owner: OwnerType,                          -- NOUVEAU (nullable)
  transaction_nature,
  -- Champs existants conservés
)
```

### 8.2 Comparaison des options pour la gestion des transferts

| Option | Description | Avantages | Inconvénients |
|---|---|---|---|
| **A** | `account_id` uniquement | Simple, minimal | Pas de transfert, pas de destination |
| **B** | `source_account_id` + `destination_account_id` | Un champ commun pour toute opération | Toute transaction a une source ET une destination (même les opérations normales) |
| **C** | `account_id` pour normales + `source_account_id` + `destination_account_id` pour transferts | Séparation claire des cas | Complexité : champs conditionnels, logique de validation métier |
| **D** | Table `financial_operations` séparée | Modèle propre, extensible | Surcoût de création, migration lourde, rupture avec l'existant |

**Recommandation : OPTION C (modifiée)**

```
Pour transaction_nature != 'transfer' :
  - account_id (compte source/cible unique)

Pour transaction_nature = 'transfer' :
  - account_id = compte source
  - destination_account_id = compte destination
  - destination_owner = espace destination (si différent)
```

**Justification :**
1. **Rétrocompatibilité** : `account_id` nullable permet aux anciennes transactions de coexister
2. **Clarté** : Pas de champs inutiles pour les opérations normales
3. **Transfets complets** : `destination_account_id` capture la destination réelle
4. **Inter-espace** : `destination_owner` capture le Financial Space destination
5. **Migration progressive** : On commence par ajouter `account_id`, puis `destination_account_id`

### 8.3 Nouveaux index

```sql
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_destination ON transactions(destination_account_id);
CREATE INDEX idx_transactions_dest_owner ON transactions(destination_owner);
```

### 8.4 TypeScript types mis à jour (conceptuels)

```typescript
export interface TransactionDB {
  // ... existing fields
  account_id: string | null;                // NOUVEAU
  destination_account_id: string | null;    // NOUVEAU
  destination_owner: OwnerType | null;      // NOUVEAU
}
```

---

## 9. TRANSFERTS INTERNES

### 9.1 Définition

Un **transfert interne** est un mouvement de fonds entre DEUX comptes appartenant au MÊME Financial Space.

**Exemple :** Personnel
```
Banque Personnel → Wave Personnel
Montant : 100 000 €
```

### 9.2 Représentation

```sql
INSERT INTO transactions (
  user_id, amount, type, category, description,
  account_id, destination_account_id,
  owner, transaction_nature
) VALUES (
  'user-uuid', 100000, 'expense', 'transfert',
  'Virement Banque → Wave',
  'banque-personnel-uuid',    -- account_id = source
  'wave-personnel-uuid',       -- destination_account_id = cible
  'personal',
  'transfer'
);
```

### 9.3 Règles métier

1. Le système **débite** le compte source (`account_id`)
2. Le système **crédite** le compte destination (`destination_account_id`)
3. Le type est `'expense'` pour la ligne source (débit)
4. `transaction_nature = 'transfer'` signale que ce n'est PAS une vraie dépense
5. **Aucun revenu** n'est créé côté destination (pas de ligne revenu séparée)
6. **P&L inchangé** : ni revenu ni dépense
7. **Net Worth inchangé** : l'argent est simplement déplacé
8. **Soldes modifiés** : Banque -100k, Wave +100k

### 9.4 Logique de calcul (Financial Truth Layer)

```typescript
function calculateAccountBalance(transactions: TransactionDB[], accountId: string): number {
  let balance = account.initial_balance;

  for (const t of transactions) {
    const amount = Number(t.amount);

    // Débit du compte source
    if (t.account_id === accountId) {
      if (t.type === 'income') balance += amount;
      else balance -= amount; // expense ou transfer sortant
    }

    // Crédit du compte destination (transfert entrant)
    if (t.destination_account_id === accountId) {
      balance += amount; // L'argent arrive
    }
  }

  return balance;
}
```

### 9.5 Validation des transferts internes

```typescript
function validateInternalTransfer(
  sourceAccount: Account,
  destinationAccount: Account,
  amount: number
): { valid: boolean; error?: string } {
  // 1. Même propriétaire (même Financial Space)
  if (sourceAccount.owner !== destinationAccount.owner) {
    return { valid: false, error: 'Transfert inter-espace détecté' };
  }

  // 2. Comptes différents
  if (sourceAccount.id === destinationAccount.id) {
    return { valid: false, error: 'Source et destination identiques' };
  }

  // 3. Source active
  if (!sourceAccount.is_active) {
    return { valid: false, error: 'Compte source inactif' };
  }

  // 4. Solde suffisant (optionnel en V1, recommandé)
  if (getAccountBalance(sourceAccount.id) < amount) {
    return { valid: false, error: 'Solde insuffisant' };
  }

  return { valid: true };
}
```

---

## 10. TRANSFERTS INTER-FINANCIAL-SPACES

### 10.1 Définition

Un **transfert inter-financial-space** est un mouvement de fonds entre DEUX comptes appartenant à DES Financial Spaces DIFFÉRENTS.

**Exemple :**
```
PERSONAL → ON'KOONNECT
Banque Personnel → Wave ON'KOONNECT
Montant : 100 000 €
```

### 10.2 Représentation

```sql
INSERT INTO transactions (
  user_id, amount, type, category, description,
  account_id,                    -- Banque Personnel (source)
  destination_account_id,        -- Wave ON'KOONNECT (destination)
  destination_owner,             -- 'onkoonnect'
  owner, transaction_nature
) VALUES (
  'user-uuid', 100000, 'expense', 'transfert',
  'Apport ON\'KOONNECT',
  'banque-personnel-uuid',
  'wave-onkoonnect-uuid',
  'onkoonnect',                  -- destination_owner
  'personal',
  'transfer'
);
```

### 10.3 1 opération atomique vs 2 écritures liées

| Critère | 1 opération atomique | 2 écritures liées |
|---|---|---|
| **Complexité** | Une seule ligne en base | Deux lignes (débit + crédit) |
| **Risque d'incohérence** | Faible (une transaction) | Moyen (deux lignes à synchroniser) |
| **Traçabilité** | Complète (une référence) | Nécessite un `transfer_id` ou `linked_transaction_id` |
| **Calcul de solde** | Doit gérer `destination_account_id` | Chaque ligne impacte un compte normalement |
| **Simplicité V1** | Plus simple (une insertion) | Plus complexe (deux insertions coordonnées) |
| **Query** | Nécessite de check `account_id` ET `destination_account_id` | Chaque compte voit ses propres lignes |

**Recommandation : 1 OPÉRATION ATOMIQUE pour V1**

**Justification :**
1. **Atomicité garantie** : Une seule transaction SQL, pas de risque de moitié d'écriture
2. **Traçabilité immédiate** : Une ligne = un mouvement, avec `account_id` (source) et `destination_account_id` (cible)
3. **Rollback simple** : Si une erreur survient, une seule ligne à annuler
4. **Évolution possible** : Si le besoin de dédoubler se fait sentir, on peut toujours migrer vers 2 écritures

### 10.4 Règles métier inter-espace

1. Le transfert est enregistré dans l'espace **source** (`owner = personal`)
2. Le `destination_owner` indique l'espace **destination** (`destination_owner = 'onkoonnect'`)
3. **Pas de double comptabilisation** : la transaction n'apparaît qu'une fois
4. **Consolidation** : Le Consolidation Engine doit détecter les transferts inter-espaces pour les exclure du P&L consolidé
5. **Pas de revenu/dépense** : Le transfert reste un transfert

### 10.5 Consolidation et transferts inter-espaces

```typescript
function consolidateFinancialSpaces(spaceIds: string[]): ConsolidatedResult {
  const allTransactions = getTransactionsInSpaces(spaceIds);

  let totalIncome = 0;
  let totalExpenses = 0;
  let internalTransfers = 0;

  for (const t of allTransactions) {
    if (t.transaction_nature === 'transfer') {
      // Transfert entre deux espaces du scope = interne
      if (spaceIds.includes(t.destination_owner)) {
        internalTransfers += Number(t.amount);
        continue; // Exclure du P&L consolidé
      }
      // Transfert vers un espace hors scope = sortie réelle
      else {
        totalExpenses += Number(t.amount);
        continue;
      }
    }
    // Traitement normal
    if (t.type === 'income') totalIncome += Number(t.amount);
    else totalExpenses += Number(t.amount);
  }

  return { totalIncome, totalExpenses, internalTransfers };
}
```

---

## 11. ÉPARGNE

### 11.1 Séparation claire : Savings Goal vs Savings Account

**Problème actuel :** Les deux concepts sont confondus.

**Architecture cible :**

| Concept | Nature | Table | Solde réel |
|---|---|---|---|
| **Savings Goal** | Objectif virtuel | `savings_goals` | Non (current_amount = tracking) |
| **Savings Account** | Compte réel | `accounts` | Oui (balance = vérité) |

### 11.2 Savings Goal (objectif)

- Reste dans `savings_goals` (inchangé en V1)
- `current_amount` = suivi de progression, PAS un solde bancaire
- N'impacte PAS le Net Worth (c'est un objectif, pas un actif)
- Peut être lié à un Savings Account via `goal_id` (future)

### 11.3 Savings Account (compte épargne réel)

- Nouveau compte dans `accounts` avec `type = 'savings'`
- `name` = "Épargne Personnel", "Épargne BGI", etc.
- Solde réel = `initial_balance + crédits - débits`
- Impacte le Net Worth (c'est de l'argent réel)

### 11.4 Interaction entre Savings Goal et Savings Account

**Scénario :**

```
1. Objectif "Voyage" créé dans savings_goals
   target_amount = 1 000 000 €
   current_amount = 0 €

2. Compte "Épargne Voyage" créé dans accounts (type='savings')
   initial_balance = 0 €

3. Transfert Banque → Épargne Voyage
   Banque : -300 000 €
   Épargne Voyage : +300 000 €
   Net Worth inchangé (déplacement de cash)

4. Mise à jour de l'objectif
   savings_goals.current_amount = 300 000 € (tracking)
   accounts.balance = 300 000 € (argent réel)
```

### 11.5 Éviter le double comptage

**Règle :** `savings_goals.current_amount` N'EST JAMAIS ajouté au Net Worth.

Le Net Worth inclut uniquement :
- Soldes des comptes (dont savings accounts)
- Actifs déclarés
- Investissements
- Passifs

### 11.6 Migration de savings_transfers

Les anciens `savings_transfers` avec `destination_account = 'savings'` doivent être migrés vers des vrais comptes d'épargne (voir [Section 19](#19-migration-de-savings-transfers)).

---

## 12. INVESTISSEMENTS

### 12.1 Interaction Accounts ↔ Investments

Accounts V1 doit être compatible avec le modèle d'investissement actuel et futur.

**Principe :** Un investissement est un **déplacement de capital** depuis un compte.

```
Compte bancaire
  ↓ -200 000 € (transaction nature = 'investment')
Investissement
  ↑ +200 000 € (valeur comptable)
Net Worth : inchangé à l'achat
```

### 12.2 Achat d'investissement

```sql
-- Débit du compte
INSERT INTO transactions (
  user_id, amount, type, category, description,
  account_id, transaction_nature
) VALUES (
  'user-uuid', 200000, 'expense', 'investissement',
  'Achat actions SONATEL',
  'banque-personnel-uuid',
  'investment'
);

-- Enregistrement dans investments (inchangé en V1)
INSERT INTO investments (
  user_id, name, type, owner, invested_amount, current_value
) VALUES (
  'user-uuid', 'Actions SONATEL', 'brvm', 'personal', 200000, 200000
);
```

### 12.3 Vente d'investissement

```sql
-- Crédit du compte
INSERT INTO transactions (
  user_id, amount, type, category, description,
  account_id, transaction_nature
) VALUES (
  'user-uuid', 250000, 'income', 'investissement',
  'Vente actions SONATEL (+50k gain)',
  'banque-personnel-uuid',
  'investment'
);

-- Mise à jour dans investments
UPDATE investments SET status = 'closed', closed_date = now() WHERE id = '...';
```

### 12.4 Gain latent (non réalisé)

Le gain latent N'EST PAS une transaction. Il est calculé :

```typescript
const gainLatent = investment.current_value - investment.invested_amount;
```

- Impacte le Net Worth via `investments.current_value`
- N'impacte PAS le cash disponible
- N'est PAS compté comme revenu tant qu'il n'est pas réalisé

### 12.5 Dividendes

```sql
-- Transaction revenu normale
INSERT INTO transactions (
  user_id, amount, type, category, description,
  account_id, transaction_nature
) VALUES (
  'user-uuid', 5000, 'income', 'dividendes',
  'Dividendes SONATEL 2024',
  'banque-personnel-uuid',
  'income'
);
```

### 12.6 Compatibilité avec l'architecture future

Le modèle Accounts V1 est compatible avec l'architecture cible :
- **Portfolio** : Plusieurs investissements groupés par Financial Space
- **Position** : Lien investissement → actif sous-jacent
- **Market** : BRVM, Marché Obligataire, etc.

Les investissements existants (`investments` table) sont conservés et simplement enrichis.

---

## 13. SOLDES DES COMPTES

### 13.1 Source de vérité

**Décision : B. Balance calculé dynamiquement**

Le solde d'un compte est CALCULÉ à partir des transactions, jamais stocké comme source de vérité.

**Raison :**
1. **Cohérence garantie** : Impossible d'avoir un décalage entre le solde affiché et les transactions
2. **Auditabilité** : Chaque variation de solde est traçable via une transaction
3. **Concurrence** : Pas de race condition entre mise à jour de solde et insertion de transaction
4. **Replay** : On peut reconstruire le solde à une date donnée en replayant les transactions

### 13.2 Mécanisme de calcul

```typescript
function calculateAccountBalance(
  account: Account,
  transactions: TransactionDB[],
  asOfDate?: Date
): number {
  let balance = account.initial_balance;

  const filtered = asOfDate
    ? transactions.filter(t => new Date(t.date) <= asOfDate)
    : transactions;

  for (const t of filtered) {
    const amount = Number(t.amount);

    // Débit du compte source
    if (t.account_id === account.id) {
      if (t.type === 'income') balance += amount;
      else balance -= amount;
    }

    // Crédit du compte destination (transfert entrant)
    if (t.destination_account_id === account.id) {
      balance += amount;
    }
  }

  return balance;
}
```

### 13.3 Cache de performance (Hybride)

Bien que le solde soit calculé dynamiquement, un **cached_balance** peut être stocké dans `accounts` pour les performances d'affichage.

**Règles du cache :**
- Mis à jour à chaque insertion de transaction (dans le même appel API)
- Jamais source de vérité : toujours recalculable
- Recalculé en batch chaque nuit (cron job)
- Recalculé à la demande si `updated_at` > dernier recalcul

```sql
-- Fonction de mise à jour du cache
CREATE OR REPLACE FUNCTION update_account_cached_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculer le solde du compte source
  UPDATE accounts SET
    cached_balance = calculate_balance(NEW.account_id),
    updated_at = now()
  WHERE id = NEW.account_id;

  -- Si c'est un transfert, recalculer aussi le compte destination
  IF NEW.destination_account_id IS NOT NULL THEN
    UPDATE accounts SET
      cached_balance = calculate_balance(NEW.destination_account_id),
      updated_at = now()
    WHERE id = NEW.destination_account_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 13.4 Formule officielle du solde

```
Account Balance = initial_balance
                + SUM(income WHERE account_id = this.id)
                - SUM(expense WHERE account_id = this.id)
                - SUM(transfer WHERE account_id = this.id)  -- sortie
                + SUM(transfer WHERE destination_account_id = this.id)  -- entrée
```

### 13.5 Financial Truth Layer

Le Financial Truth Layer (centralisé dans `financialCalculator.ts`) doit être mis à jour pour :

1. **Calculer les soldes par compte réel** (via `account_id`) plutôt que par `account` (enum)
2. **Gérer les transferts complets** (débit source + crédit destination)
3. **Maintenir la compatibilité** avec l'ancien système `account` (enum) pour les données historiques
4. **Fournir une API unifiée** : `getAccountBalance(accountId)` qui fonctionne pour tous les cas

---

## 14. FINANCIAL TRUTH LAYER

### 14.1 Modifications nécessaires

Les services suivants doivent être adaptés pour utiliser les vrais comptes :

| Service | Changement principal |
|---|---|
| `financialCalculator.ts` | Ajouter `calculateAccountBalanceById()`, modifier `calculateAccountBalances()` pour supporter `account_id` |
| `dashboardService.ts` | Utiliser les soldes par compte réel dans `calculateDashboardStats()` |
| `consolidationEngine.ts` | Détecter et ajuster les transferts inter-espaces complets |
| `wealthService.ts` | Utiliser `account_id` pour le Net Worth (cash = somme des soldes des comptes) |
| `forecastEngine.ts` | Prévisions basées sur les soldes réels des comptes |

### 14.2 Nouvelle logique de solde

```typescript
// financialCalculator.ts — VERSION ACCOUNTS V1

export async function getAccountBalance(accountId: string): Promise<number> {
  const { data: account } = await supabase
    .from('accounts')
    .select('initial_balance')
    .eq('id', accountId)
    .single();

  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount, type, account_id, destination_account_id, transaction_nature')
    .or(`account_id.eq.${accountId},destination_account_id.eq.${accountId}`);

  let balance = Number(account?.initial_balance || 0);

  for (const t of transactions || []) {
    const amount = Number(t.amount);

    // Transaction sur ce compte
    if (t.account_id === accountId) {
      if (t.type === 'income') balance += amount;
      else balance -= amount; // expense ou transfer sortant
    }

    // Transfert entrant vers ce compte
    if (t.destination_account_id === accountId) {
      balance += amount;
    }
  }

  return balance;
}
```

### 14.3 Nouvelle règle P&L

```
# Account Balance - Formule officielle V1

Initial Balance
+
Income (revenus réels)
------
Expenses (dépenses réelles) — exclut transfers, savings, investments
+
Transfers In (transferts entrants)
------
Transfers Out (transferts sortants)
=
Account Balance

# Net Worth - Formule officielle V1

SUM(Account Balances)        ← Tous les comptes (cash, bank, mobile_money, etc.)
+
SUM(Assets)                   ← Immobilier, véhicules, terrains
+
SUM(Investments Current Value) ← Valeur actuelle des investissements
------
SUM(Liabilities Remaining)    ← Dettes restantes
=
NET WORTH
```

### 14.4 Règle des 35% (inchangée conceptuellement)

La règle reste la même : `dépenses personnelles ≤ 35% revenus entreprise`. Seul le mode de calcul des soldes change (via comptes réels).

---

## 15. FINANCIAL EVENTS

### 15.1 Workflow Event → Account

Accounts V1 doit permettre le workflow suivant :

```
Financial Event
  → planned_account_id (compte prévu pour l'opération)
  → Notification
  → Confirmation
  → Transaction avec account_id
  → Mise à jour du solde du compte
  → Event COMPLETED
```

### 15.2 Champs nécessaires dans Financial Events

```typescript
// Ajouts conceptuels à financial_events
export interface FinancialEventAccountsV1 {
  // ... existing fields
  planned_account_id: string | null;      // Compte prévu pour l'opération
  actual_account_id: string | null;       // Compte réel (après confirmation)
  linked_transaction_id: string | null;   // Transaction générée (existant)
}
```

### 15.3 Impact sur le calendrier

Le calendrier peut désormais montrer :
- **Événements prévus** avec leur compte planifié (`planned_account_id`)
- **Événements réalisés** avec leur compte réel et la transaction liée
- **Solde prévisionnel** basé sur les comptes réels

---

## 16. CALENDAR

### 16.1 Workflow complet avec comptes

```
10 août
  Événement : Starlink - 65 000 €
  Financial Space : ON'KOONNECT
  Compte prévu : Banque ON'KOONNECT
  Statut : PENDING

  ↓

11 août (notification)
  Confirmation utilisateur : OUI

  ↓

Transaction créée :
  account_id = Banque ON'KOONNECT
  amount = 65 000 €
  type = expense
  transaction_nature = expense

  ↓

Événement : COMPLETED
Compte Banque ON'KOONNECT : -65 000 €
```

### 16.2 Modifications nécessaires

- `calendarEngine.ts` doit pouvoir filtrer les événements par `planned_account_id`
- Le calendrier doit afficher le solde prévisionnel des comptes
- Les événements récurrents doivent créer des transactions sur les bons comptes

---

## 17. RLS (ROW LEVEL SECURITY)

### 17.1 Stratégie V1

En V1, la RLS reste basée sur `user_id = auth.uid()` :

```sql
-- Accounts
CREATE POLICY "users_own_accounts" ON accounts
  FOR ALL USING (auth.uid() = user_id);

-- Transactions (inchangé, mais account_id est protégé via FK)
-- La FK vers accounts garantit qu'on ne peut référencer qu'un compte qu'on possède
```

### 17.2 Évolution future

Quand `financial_space_id` remplacera `owner`, la RLS évoluera :

```sql
-- V2 RLS avec financial_spaces
CREATE POLICY "accounts_via_financial_spaces" ON accounts
  FOR ALL USING (
    financial_space_id IN (
      SELECT id FROM financial_spaces WHERE owner_user_id = auth.uid()
    )
  );
```

### 17.3 Compatibilité multi-utilisateur (V3+)

```sql
-- V3 RLS avec financial_space_members
CREATE POLICY "accounts_via_membership" ON accounts
  FOR SELECT USING (
    financial_space_id IN (
      SELECT financial_space_id
      FROM financial_space_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
```

### 17.4 Protection des transferts

```sql
-- Vérification que destination_account_id appartient bien à l'utilisateur
-- (ou est autorisé par les règles inter-espaces)
-- Cette validation sera faite au niveau applicatif en V1
```

---

## 18. MIGRATION DES TRANSACTIONS HISTORIQUES

### 18.1 Problème critique

Des transactions historiques existent avec `account = 'bank'`, mais on ne sait pas si c'est :
- Banque Personnel
- Banque BGI
- Banque AUREL
- Banque ON'KOONNECT

**Aucune transaction ne doit être silencieusement attribuée au mauvais compte.**

### 18.2 Analyse des options

| Option | Description | Risque | Complexité |
|---|---|---|---|
| **A** | Créer un compte par type ET par Financial Space | Mapping automatique par owner | Faible si owner est fiable |
| **B** | Compte "Legacy Bank" par espace | Qualitatif mais clair | Faible |
| **C** | Laisser `account_id` NULL | Aucune perte, mais pas de migration | Très faible |
| **D** | Semi-automatique avec validation utilisateur | Meilleure qualité | Élevée |
| **E** | Combinaison (automatique + validation) | Équilibre optimal | Moyenne |

### 18.3 Recommandation : OPTION E — Combinaison

**Stratégie en 3 étapes :**

#### Étape 1 : Migration automatique des cas sûrs

Pour chaque transaction avec un `owner` défini :

| `owner` | `account` | Compte cible |
|---|---|---|
| `personal` | `bank` | Banque Personnel |
| `personal` | `wave` | Wave Personnel |
| `personal` | `cash` | Espèces Personnel |
| `bgi` | `bank` | Banque BGI |
| `bgi` | `wave` | Wave BGI |
| `onkoonnect` | `bank` | Banque ON'KOONNECT |
| `onkoonnect` | `wave` | Wave ON'KOONNECT |

**Ces mappings sont SURS car `owner` est connu et fiable.**

#### Étape 2 : Transactions sans owner fiable

Si `owner` est NULL ou invalide (ne devrait pas arriver avec la contrainte CHECK actuelle) :
- `account_id = NULL` (conservé)
- Créer un compte "Legacy" par défaut

#### Étape 3 : Validation utilisateur

Proposer un écran de validation :

```
"Nous avons trouvé N transactions historiques avec 'Banque'.
Veuillez confirmer qu'elles appartiennent bien au compte 'Banque Personnel'."

[Confirmer] [Changer de compte]
```

### 18.4 Script de migration conceptuel

```sql
-- Phase 1 : Créer les comptes par défaut (voir section 5.4)

-- Phase 2 : Mapper les transactions historiques
UPDATE transactions t
SET account_id = a.id
FROM accounts a
WHERE t.user_id = a.user_id
  AND t.owner = a.owner
  AND (
    (t.account = 'cash' AND a.type = 'cash')
    OR (t.account = 'bank' AND a.type = 'bank')
    OR (t.account = 'card' AND a.type = 'card')
    OR (t.account = 'wave' AND a.type = 'mobile_money' AND a.provider = 'wave')
    OR (t.account = 'orange_money' AND a.type = 'mobile_money' AND a.provider = 'orange_money')
    OR (t.account = 'moov_money' AND a.type = 'mobile_money' AND a.provider = 'moov_money')
  );

-- Phase 3 : Validation
SELECT COUNT(*) FROM transactions WHERE account_id IS NULL;
-- Doit être 0 si tout est migré correctement
```

### 18.5 Traçabilité

```sql
-- Ajouter un champ metadata pour tracer la migration
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

UPDATE transactions
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'),
  '{migrated_from}',
  to_jsonb(account)
)
WHERE account_id IS NOT NULL;
```

---

## 19. MIGRATION DE SAVINGS TRANSFERS

### 19.1 État actuel

```sql
savings_transfers (
  source_account: AccountType,     -- Compte source (enum)
  destination_account: text,       -- 'savings' par défaut
  owner: OwnerType                 -- Espace
)
```

### 19.2 Problème

`destination_account = 'savings'` n'est pas un vrai compte. L'argent est "envoyé" vers une destination fictive.

### 19.3 Stratégie de migration

**Décision : Les anciens savings_transfers restent dans savings_transfers, mais sont liés aux nouveaux comptes.**

```sql
-- Ajouter des FKs vers accounts
ALTER TABLE savings_transfers
  ADD COLUMN source_account_id uuid REFERENCES accounts(id),
  ADD COLUMN destination_account_id uuid REFERENCES accounts(id);

-- Migration des données
UPDATE savings_transfers st
SET
  source_account_id = a1.id,
  destination_account_id = a2.id
FROM accounts a1, accounts a2
WHERE st.user_id = a1.user_id
  AND st.owner = a1.owner
  AND (
    (st.source_account = 'cash' AND a1.type = 'cash')
    OR (st.source_account = 'bank' AND a1.type = 'bank')
    OR (st.source_account = 'wave' AND a1.type = 'mobile_money' AND a1.provider = 'wave')
    -- ... autres mappings
  )
  AND st.user_id = a2.user_id
  AND st.owner = a2.owner
  AND a2.type = 'savings'
  -- Premier compte savings de l'espace
  AND a2.id = (
    SELECT id FROM accounts
    WHERE user_id = a2.user_id AND owner = a2.owner AND type = 'savings'
    ORDER BY created_at ASC
    LIMIT 1
  );
```

### 19.4 Doublons avec transactions

Si un `savings_transfer` a déjà une transaction correspondante (bien que ce ne soit pas le cas actuellement), il faut les lier via `linked_transaction_id`.

En V1, on conserve les deux tables :
- `savings_transfers` → historique, peut être déprécié à terme
- `transactions` avec `account_id` et `transaction_nature = 'savings'` → nouveau standard

---

## 20. TESTS À PRÉVOIR

### 20.1 Suite de tests minimale

| # | Test | Description | Résultat attendu |
|---|---|---|---|
| **T1** | Revenu sur compte | Créer un revenu sur Banque Personnel +500k | Solde Banque = +500k, Net Worth = +500k |
| **T2** | Dépense sur compte | Créer une dépense sur Wave Personnel -50k | Solde Wave = -50k, Net Worth inchangé? (dépense réelle = -50k) |
| **T3** | Transfert interne | Transférer 100k de Banque vers Wave (même espace) | Banque -100k, Wave +100k, Net Worth inchangé, P&L inchangé |
| **T4** | Transfert inter-espace | Transférer 100k de Banque Personnel vers Wave ON'KOONNECT | Personnal Banque -100k, ON'KOONNECT Wave +100k |
| **T5** | Transfert vers épargne | Transférer 50k de Banque vers Épargne Voyage | Banque -50k, Épargne +50k, Net Worth inchangé |
| **T6** | Objectif d'épargne virtuel | Créer objectif "Voyage" 1M€ | Net Worth NON impacté par le goal |
| **T7** | Achat investissement | Acheter investissement 200k depuis Banque | Banque -200k, Investissement +200k, Net Worth inchangé |
| **T8** | Vente investissement | Vendre investissement 250k vers Banque | Banque +250k, Investissement fermé, Net Worth +50k |
| **T9** | Transaction historique legacy | Transaction avec `account = 'bank'` sans `account_id` | Solde calculé via l'ancien système en fallback |
| **T10** | RLS | Utilisateur B ne voit pas les comptes de l'utilisateur A | 0 compte retourné |
| **T11** | Net Worth consolidé | Toutes les données de tous les espaces | Net Worth = Cash + Actifs + Investissements - Passifs |
| **T12** | Forecast avec comptes | Prévision basée sur les soldes des comptes réels | Solde prévisionnel correct |
| **T13** | Financial Event futur | Créer un événement avec `planned_account_id` | L'événement est lié au compte |

### 20.2 Tests de non-régression

- Toutes les fonctionnalités existantes doivent continuer de fonctionner (double écriture `account` textuel + `account_id`)
- Les anciennes transactions sans `account_id` doivent être calculables
- La règle des 35% doit donner les mêmes résultats

---

## 21. PLAN DE MIGRATION

### 21.1 PHASE 0 — Préparation et Backup (Sprint 0)

**Durée estimée :** 2-3 jours

- [ ] Backup complet de la base de données
- [ ] Audit des transactions existantes par `owner` et `account`
- [ ] Audit des `savings_transfers` existants
- [ ] Création d'un script de validation des données
- [ ] Préparation des comptes par défaut pour chaque utilisateur
- [ ] Communication avec l'équipe : gel des modifications de schéma

### 21.2 PHASE 1 — Créer la table Accounts (Sprint 1)

**Durée estimée :** 3-5 jours

- [ ] Écrire la migration SQL de création de `accounts`
- [ ] Ajouter les index et les contraintes d'unicité
- [ ] Ajouter les politiques RLS
- [ ] Ajouter les types TypeScript (`AccountDB`, `AccountInsert`, `AccountUpdate`)
- [ ] Créer le service `accountService.ts` (CRUD basique)
- [ ] Tester la création de comptes

### 21.3 PHASE 2 — Créer les comptes initiaux (Sprint 1)

**Durée estimée :** 2-3 jours

- [ ] Écrire le script de seed pour les comptes par défaut
- [ ] Créer les comptes pour les utilisateurs existants
- [ ] Valider que chaque utilisateur a ses comptes
- [ ] Ajouter la création automatique de comptes pour les nouveaux utilisateurs

### 21.4 PHASE 3 — Ajouter account_id aux transactions (Sprint 2)

**Durée estimée :** 5-7 jours

- [ ] Migration SQL : ajouter `account_id` (nullable) à `transactions`
- [ ] Migration SQL : ajouter `destination_account_id` (nullable) à `transactions`
- [ ] Migration SQL : ajouter `destination_owner` (nullable) à `transactions`
- [ ] Mettre à jour les types TypeScript
- [ ] Mettre à jour `transactionService.ts` pour supporter `account_id`
- [ ] Mettre à jour `addTransaction()` pour lier un compte
- [ ] Mettre à jour `parserService.ts` pour mapper `account` → `account_id`

### 21.5 PHASE 4 — Migrer les données historiques (Sprint 2)

**Durée estimée :** 3-5 jours

- [ ] Exécuter le script de mapping automatique (owner + account → account_id)
- [ ] Valider qu'aucune transaction n'a d'`account_id` NULL
- [ ] Créer l'écran de validation utilisateur pour les cas ambigus
- [ ] Exécuter les requêtes de vérification d'intégrité
- [ ] Tracer la migration dans `metadata`

### 21.6 PHASE 5 — Implémenter les transferts (Sprint 3)

**Durée estimée :** 5-7 jours

- [ ] Créer la fonction `createTransfer()` dans `transactionService.ts`
- [ ] Implémenter la logique de débit + crédit
- [ ] Ajouter la validation des transferts (solde suffisant, comptes actifs)
- [ ] Tester les transferts internes (même espace)
- [ ] Tester les transferts inter-espaces
- [ ] Mettre à jour les calculs de solde

### 21.7 PHASE 6 — Adapter Financial Truth Layer (Sprint 3)

**Durée estimée :** 5-7 jours

- [ ] Modifier `financialCalculator.ts` :
  - Ajouter `calculateAccountBalanceById()`
  - Modifier `calculateAccountBalances()` pour supporter les deux systèmes
  - Ajouter la détection des transferts complets
- [ ] Modifier `dashboardService.ts` pour utiliser les soldes par compte réel
- [ ] Modifier `consolidationEngine.ts` pour gérer les transferts inter-espaces
- [ ] Modifier `wealthService.ts` pour le Net Worth basé sur les comptes
- [ ] Modifier `forecastEngine.ts` pour les prévisions basées comptes
- [ ] Tester tous les calculs avec les nouveaux comptes

### 21.8 PHASE 7 — Tests de cohérence (Sprint 4)

**Durée estimée :** 3-5 jours

- [ ] Exécuter les tests T1 à T13
- [ ] Comparer les résultats anciens vs nouveaux (pour les données historiques)
- [ ] Vérifier l'absence de double comptabilisation
- [ ] Vérifier la règle des 35%
- [ ] Vérifier le Net Worth global
- [ ] Tests de performance (calcul de solde sur grands volumes)

### 21.9 PHASE 8 — Activer Accounts V1 (Sprint 4)

**Durée estimée :** 2-3 jours

- [ ] Feature flag : activer les comptes pour les utilisateurs progressivement
- [ ] Surveiller les logs et les erreurs
- [ ] Recueillir les retours utilisateur
- [ ] Correction des bugs éventuels

### 21.10 PHASE 9 — Déprécier progressivement account textuel (Sprint 5+)

**Durée estimée :** En continu

- [ ] Marquer `account` (text) comme déprécié dans les types
- [ ] Ajouter des warnings dans les logs quand un service lit `account`
- [ ] Migration des anciens services vers `account_id`
- [ ] Suppression de l'ancien champ `account` (uniquement quand tout est migré)

---

## 22. COMPATIBILITÉ FUTURE

### 22.1 Financial Space

✅ **Compatible.** `accounts.owner` est conçu pour être migré vers `financial_space_id` sans refonte.

### 22.2 Organizations

✅ **Compatible.** `organizations` reste une table indépendante. Les comptes peuvent être liés via `owner` → `organizations.name`.

### 22.3 Projects (futur)

✅ **Compatible.** Un projet aura son propre Financial Space (ou sera rattaché à un espace existant). Les comptes du projet seront dans `accounts` avec `owner` correspondant.

### 22.4 Investments

✅ **Compatible.** Les investissements existants continuent de fonctionner. Les futurs portefeuilles et positions s'appuieront sur les comptes pour tracer les mouvements de cash.

### 22.5 Savings

✅ **Compatible.** La distinction Savings Goal / Savings Account est claire. Les savings goals existants restent inchangés.

### 22.6 Financial Events

✅ **Compatible.** L'ajout de `planned_account_id` et `actual_account_id` permet le workflow complet Event → Transaction → Compte.

### 22.7 Calendar

✅ **Compatible.** Le calendrier peut afficher les événements par compte et les soldes prévisionnels.

### 22.8 Forecast

✅ **Compatible.** Les prévisions peuvent être basées sur les soldes réels des comptes.

### 22.9 Consolidation

✅ **Compatible.** `consolidationEngine.ts` peut être étendu pour consolider par Financial Space avec détection des transferts internes.

### 22.10 Futur : Projet IDI, Investisseurs, Parts, Distributions

✅ **Compatible.** Chaque projet aura des comptes dédiés. Les investisseurs et les distributions utiliseront les comptes pour tracer les mouvements de fonds.

### 22.11 Multi-utilisateur (V3+)

✅ **Compatible.** La RLS basée sur `user_id` peut évoluer vers `financial_space_members` sans changer la structure des comptes.

---

## 23. RISQUES

### 23.1 🔴 Critique : Migration historique des transactions

**Risque :** Mauvaise affectation des transactions `account = 'bank'` à un mauvais compte.

**Mitigation :**
- Mapping automatique validé par `owner` (fiable)
- `account_id` nullable pour les cas non résolus
- Validation utilisateur pour les cas ambigus
- Traçabilité dans `metadata`

### 23.2 🔴 Critique : Double comptabilisation

**Risque :** Une transaction est comptée à la fois dans l'ancien système `account` et dans le nouveau `account_id`.

**Mitigation :**
- Le Financial Truth Layer doit avoir une logique claire : si `account_id` est présent, ignorer `account`
- Phase de double écriture avec validation

### 23.3 🟠 Élevé : Perte de données

**Risque :** Une migration SQL échoue et perd des transactions.

**Mitigation :**
- Backup complet avant chaque phase
- Migration en plusieurs étapes validées
- Scripts de rollback préparés

### 23.4 🟠 Élevé : Mauvais rattachement Financial Space

**Risque :** Un compte est créé dans le mauvais Financial Space.

**Mitigation :**
- `owner` est déjà présent et fiable dans les données existantes
- Mapping univoque : une valeur `owner` → un Financial Space

### 23.5 🟡 Moyen : Performance des calculs de solde

**Risque :** Calculer le solde dynamiquement à chaque requête peut être lent.

**Mitigation :**
- `cached_balance` pour les affichages fréquents
- Index sur `account_id` et `destination_account_id`
- Recalcul batch la nuit

### 23.6 🟡 Moyen : Complexité des transferts inter-espaces

**Risque :** La logique de consolidation des transferts inter-espaces est complexe.

**Mitigation :**
- Tests approfondis (T3, T4, T11)
- Logique centralisée dans le Financial Truth Layer
- Détection claire : `destination_owner` vs `owner`

### 23.7 🟡 Moyen : RLS et transferts inter-espaces

**Risque :** Un utilisateur ne peut pas référencer un compte d'un autre espace dans un transfert.

**Mitigation :**
- En V1, tous les comptes appartiennent au même utilisateur (`user_id`)
- La validation inter-espace est applicative, pas SQL

### 23.8 🟢 Faible : Cache incohérent

**Risque :** `cached_balance` est décalé par rapport au vrai solde.

**Mitigation :**
- Le cache n'est jamais source de vérité
- Toujours recalculable à la demande

### 23.9 🟢 Faible : Compatibilité Financial Truth Layer

**Risque :** Les services existants (insightEngine, intelligenceService) utilisent l'ancien système.

**Mitigation :**
- Phase de compatibilité : les deux systèmes coexistent
- Les anciennes fonctions conservent leur signature

---

## 24. PRIORITÉS P0 / P1 / P2

### 24.1 P0 — Critique (Doit être fait en premier)

| # | Tâche | Justification |
|---|---|---|
| 1 | Créer la table `accounts` | Fondation de toute l'architecture |
| 2 | Créer les comptes par défaut pour tous les utilisateurs | Permet la suite |
| 3 | Ajouter `account_id` nullable à `transactions` | Permet la migration progressive |
| 4 | Mapper les transactions historiques (owner + account → account_id) | Évite la perte de données |
| 5 | Implémenter `calculateAccountBalanceById()` dans Financial Truth Layer | Source de vérité |

### 24.2 P1 — Important (À faire dans la foulée)

| # | Tâche | Justification |
|---|---|---|
| 6 | Ajouter `destination_account_id` et `destination_owner` à `transactions` | Transferts complets |
| 7 | Implémenter `createTransfer()` dans `transactionService.ts` | Transferts fonctionnels |
| 8 | Mettre à jour `dashboardService.ts` pour utiliser les comptes réels | Cohérence dashboard |
| 9 | Mettre à jour `consolidationEngine.ts` pour les transferts inter-espaces | Consolidation correcte |
| 10 | Mettre à jour `wealthService.ts` pour le Net Worth basé comptes | Patrimoine correct |
| 11 | Adapter `parserService.ts` pour mapper `account` → `account_id` | Saisie utilisateur |

### 24.3 P2 — Souhaitable (À faire ensuite)

| # | Tâche | Justification |
|---|---|---|
| 12 | Ajouter `planned_account_id` à `financial_events` | Workflow Event → Compte |
| 13 | Mettre à jour `forecastEngine.ts` | Prévisions basées comptes |
| 14 | Migrer `savings_transfers` vers le nouveau modèle | Épargne réelle |
| 15 | Ajouter `cached_balance` et trigger de mise à jour | Performance |
| 16 | Créer l'écran de validation utilisateur pour la migration historique | Qualité données |
| 17 | Déprécier `account` textuel dans les types et services | Nettoyage |

### 24.4 Ce qui NE DOIT PAS être fait maintenant

| ❌ | Tâche | Raison |
|---|---|---|
| ❌ | Supprimer `account` (champ texte) des transactions | Rupture avec l'existant |
| ❌ | Rendre `account_id` NOT NULL | Impossible tant que les données historiques ne sont pas toutes migrées |
| ❌ | Migrer vers `financial_space_id` | Dépend de la V2.1 des Financial Spaces |
| ❌ | Implémenter le multi-utilisateur | V3+ uniquement |
| ❌ | Créer la table `portfolios` | Dépend de l'architecture investissements V2.3 |
| ❌ | Supprimer `savings_transfers` | Données historiques à conserver |

---

## 25. RECOMMANDATION CTO FINALE

### 25.1 Architecture recommandée

**J'approuve l'architecture Accounts V1 décrite dans ce document.**

Les décisions clés validées :

1. **Provider pattern pour les types mobile_money** (`type = 'mobile_money'` + `provider = 'wave'`) — Plus évolutif que des types séparés.

2. **Option C modifiée pour les transactions** — `account_id` pour les opérations normales, `destination_account_id` ajouté pour les transferts. Meilleur équilibre entre clarté et simplicité.

3. **1 opération atomique pour les transferts** — Une seule ligne SQL avec `account_id` (source) et `destination_account_id` (cible). Plus fiable que 2 écritures liées.

4. **Balance calculée dynamiquement** — Aucun stockage de solde comme source de vérité. Cache de performance uniquement (`cached_balance`).

5. **Migration en Option E (combinaison)** — Migration automatique des cas sûrs + validation utilisateur pour les ambigus. Traçabilité complète.

6. **Séparation Savings Goal / Savings Account** — L'objectif est un marqueur virtuel, le compte est le support réel.

### 25.2 Ce qui doit être implémenté maintenant (P0)

1. **Table `accounts`** avec ses index, contraintes et RLS
2. **Migration SQL** pour ajouter `account_id`, `destination_account_id`, `destination_owner` aux transactions
3. **Script de création** des comptes par défaut pour les utilisateurs existants
4. **Mapping automatique** des transactions historiques (owner + account → account_id)
5. **Fonction `calculateAccountBalanceById()`** dans le Financial Truth Layer

### 25.3 Ce qui doit être implémenté immédiatement après (P1)

6. **Fonction `createTransfer()`** dans `transactionService.ts`
7. **Mise à jour de `dashboardService.ts`**, `consolidationEngine.ts`, `wealthService.ts`
8. **Mise à jour de `parserService.ts`** pour mapper les comptes
9. **Tests T1 à T13**

### 25.4 Ce qui doit être reporté

- Migration vers `financial_space_id` → Après validation de la V2.1 Financial Spaces
- Multi-utilisateur → V3+ (pas avant 2025-2026)
- Portfolio / Position / Market → V2.3 (architecture investissements structurée)
- Suppression du champ `account` textuel → Sprint 5+ (quand tout est migré)
- Suppression de `savings_transfers` → Jamais (données historiques)

### 25.5 Ce qui ne doit surtout pas être fait

1. **Ne PAS rendre `account_id` NOT NULL** tant que la migration historique n'est pas validée à 100%
2. **Ne PAS supprimer `account`** (champ texte) des transactions — rétrocompatibilité indispensable
3. **Ne PAS fusionner `savings_goals` et `accounts`** — ce sont deux concepts distincts
4. **Ne PAS implémenter le multi-utilisateur maintenant** — l'architecture le prépare mais ne l'implémente pas
5. **Ne PAS forcer tous les utilisateurs à valider leur migration en même temps** — progressif

### 25.6 Ordre exact des prochains prompts d'implémentation

1. **Prompt 1 :** Migration SQL — Création de la table `accounts`
2. **Prompt 2 :** Script de seed — Comptes par défaut pour tous les utilisateurs
3. **Prompt 3 :** Migration SQL — Ajout de `account_id`, `destination_account_id`, `destination_owner` aux transactions
4. **Prompt 4 :** Service TypeScript — `accountService.ts` (CRUD)
5. **Prompt 5 :** Script de migration — Mapping des transactions historiques
6. **Prompt 6 :** Service — `createTransfer()` dans `transactionService.ts`
7. **Prompt 7 :** Financial Truth Layer — Mise à jour de `financialCalculator.ts` (solde par compte)
8. **Prompt 8 :** Dashboard — Mise à jour de `dashboardService.ts`
9. **Prompt 9 :** Consolidation — Mise à jour de `consolidationEngine.ts`
10. **Prompt 10 :** Wealth — Mise à jour de `wealthService.ts`

---

> **Document d'architecture Accounts V1 — Mon Bédou**  
> *Aucun code, aucune migration, aucune modification de projet inclus dans ce document.*  
> *À valider par le CTO avant toute implémentation.*

