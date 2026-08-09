# MON BÉDOU — ARCHITECTURE V2.1
## FINANCIAL SPACE MODEL — RAPPORT D'ARCHITECTURE CIBLE

---

> **Document :** Rapport d'Architecture V2.1  
> **Projet :** Mon Bédou — Application de Gestion Financière Personnelle  
> **Auteur :** Senior Software Architect & Database Architect  
> **Date :** Révision basée sur la décision architecturale Financial Space  
> **Statut :** Document de conception cible — Aucun code ni migration inclus

---

## 1. RÉSUMÉ EXÉCUTIF

Le présent rapport acte l'abandon du modèle `organization_id` comme abstraction universelle des données financières. Il introduit le concept de **Financial Space (Espace Financier)** comme nouveau pilier central de l'architecture de Mon Bédou.

**Constat :** L'architecture actuelle utilise un champ `owner` de type énuméré (`'personal' | 'bgi' | 'aurel' | 'onkoonnect'`) pour segmenter les données financières. Une table `organizations` existe parallèlement avec des types distincts (`'personal' | 'holding' | 'company' | 'subsidiary' | 'project' | 'investment'`). Cette dualité crée une confusion conceptuelle et limite l'extensibilité.

**Décision :** Le modèle `organization_id` universel est abandonné au profit de `financial_space_id`. Le Financial Space devient l'abstraction principale pour organiser, isoler et consolider les données financières.

**Impact :** Migration du champ `owner` vers `financial_space_id` dans toutes les tables financières. Conservation de la table `organizations` avec un rôle redéfini. Introduction d'un modèle hiérarchique via `parent_space_id`. Architecture extensible vers le multi-utilisateur sans refonte.

---

## 2. POURQUOI LE MODÈLE organization_id UNIVERSEL EST ABANDONNÉ

### Problèmes identifiés dans l'architecture actuelle

1. **Confusion conceptuelle :** La table `organizations` a un type `'personal'` qui n'est pas une organisation juridique. Cela force une interprétation erronée où les finances personnelles sont traitées comme une "organisation".

2. **Mélange des rôles :** `owner` et `organizations` coexistent sans relation claire. `owner` est une énumération statique dans le code, tandis que `organizations` est une table de base de données avec des types différents.

3. **Absence de hiérarchie :** Le modèle actuel ne permet pas de représenter des relations parent-enfant (ex: BGI → AUREL). La consolidation financière est limitée à un filtrage plat par `owner`.

4. **Extensibilité limitée :** L'énumération `OwnerType` est codée en dur dans les types TypeScript et les contraintes SQL CHECK. Ajouter un nouvel espace financier nécessite une migration de schéma et une modification du code.

5. **Organisation hybride :** `organizations` sert à la fois de représentation d'entité juridique ET d'espace de segmentation financière, ce qui viole le principe de responsabilité unique.

### Ce que Financial Space résout

- Abstraction universelle sans mélange conceptuel
- Hiérarchie native pour la consolidation
- Extensibilité sans migration de schéma
- Séparation claire entre "qui possède" (user) et "où ça se trouve" (financial_space)

---

## 3. DÉFINITION OFFICIELLE DE FINANCIAL SPACE

> **Un Financial Space (Espace Financier) est un contexte financier cohérent auquel appartiennent des données financières, permettant leur organisation, leur isolation et leur consolidation indépendamment de la structure juridique ou organisationnelle sous-jacente.**

### Caractéristiques fondamentales

- **Abstraction financière pure :** Ne représente pas nécessairement une organisation juridique.
- **Périmètre défini :** Correspond à un ensemble cohérent de données financières (transactions, comptes, budgets, objectifs, actifs, passifs).
- **Hiérarchisable :** Peut avoir un parent (`parent_space_id`) pour permettre la consolidation.
- **Multi-devise :** Chaque espace peut avoir sa devise par défaut.
- **Propriété utilisateur :** Appartient à un utilisateur (`owner_user_id`).

### Exemples concrets

| Financial Space | Type | Parent | Description |
|---|---|---|---|
| Personnel | `personal` | NULL | Finances personnelles d'Amidou |
| BGI | `enterprise` | NULL | Holding/Entreprise BGI |
| AUREL | `subsidiary` | BGI | Filiale AUREL |
| ON'KOONNECT | `subsidiary` | BGI | Filiale ON'KOONNECT |
| Investissements | `portfolio` | Personnel | Portefeuille d'investissement |
| Patrimoine | `wealth` | Personnel | Gestion patrimoniale |

### Types de Financial Space (proposés)

```
'personal'       → Finances personnelles
'enterprise'     → Entreprise / Holding
'subsidiary'     → Filiale
'portfolio'      → Portefeuille d'investissement
'wealth'         → Gestion de patrimoine
'project'        → Projet financier spécifique
'custom'         → Type personnalisé
```

---

## 4. DIFFÉRENCE ENTRE LES CONCEPTS FONDAMENTAUX

### User (Utilisateur)

- **Rôle :** Personne physique qui utilise l'application.
- **Propriété :** Est propriétaire des données et des Financial Spaces.
- **Champ :** `user_id` (ou `created_by` / `owner_user_id`).
- **RLS :** Base de la sécurité — un utilisateur ne voit que ses propres données.
- **Ne représente PAS :** Un espace financier, une organisation ou un compte.

### Financial Space (Espace Financier)

- **Rôle :** Contexte financier auquel appartiennent des données.
- **Périmètre :** Organisationnel, personnel, d'investissement ou patrimonial.
- **Hiérarchie :** Peut être parent ou enfant d'un autre Financial Space.
- **Champ :** `financial_space_id`.
- **RLS :** Détermine le périmètre de consolidation et de visualisation.
- **Ne représente PAS :** Un utilisateur, une organisation juridique ou un compte bancaire.

### Organization (Organisation Juridique)

- **Rôle :** Entité juridique réelle (entreprise, holding, filiale).
- **Statut :** Peut avoir un numéro RCCM, un NIU, une existence légale.
- **Relation :** Peut être liée à un ou plusieurs Financial Spaces.
- **Champ :** `organization_id` (conceptuellement distinct de `financial_space_id`).
- **Ne représente PAS :** Un espace financier, bien qu'il puisse y être associé.

### Account (Compte Financier)

- **Rôle :** Support de détention de liquidités (Wave, OM, Banque, Carte, Cash).
- **Instance :** Un compte Wave spécifique, un compte bancaire spécifique.
- **Champ :** `account_id` (nouvelle table proposée).
- **Appartient à :** Un Financial Space.
- **Ne représente PAS :** Un Financial Space ou un portefeuille.

### Portfolio (Portefeuille d'Investissement)

- **Rôle :** Ensemble structuré d'investissements.
- **Instance :** Portefeuille BGI, Portefeuille Personnel.
- **Appartient à :** Un Financial Space (ou peut en être un).
- **Contient :** Des positions d'investissement.
- **Ne représente PAS :** Un marché financier ou un actif individuel.

### Investment Account (Compte/Titulaire de Détention)

- **Rôle :** Compte réel auprès d'un intermédiaire financier (SGI, banque).
- **Exemple :** Compte titre SGI BICICI, Compte PEA.
- **Appartient à :** Un Portfolio.

### Position (Position d'Investissement)

- **Rôle :** Ligne d'un actif détenu dans un portefeuille.
- **Exemple :** 100 actions SONATEL, 50 obligations État CI.
- **Appartient à :** Un Investment Account.
- **Lié à :** Un Asset (l'actif financier sous-jacent).

### Asset (Actif Financier)

- **Rôle :** L'instrument financier lui-même (action, obligation, etc.).
- **Exemple :** Action SONATEL, Obligation État de Côte d'Ivoire 6.25%.
- **Indépendant :** Existe sur un marché, quelle que soit la détention.
- **Marché :** BRVM, Marché Obligataire, etc.

### Market (Marché Financier)

- **Rôle :** Place de marché où les actifs sont négociés.
- **Exemple :** BRVM, Bourse de Paris, Marché des Changes.
- **Ne représente PAS :** Un Financial Space. BRVM n'est PAS un Financial Space.

### Tableau Récapitulatif

| Concept | Nature | Champ Clé | Parent possible |
|---|---|---|---|
| User | Personne physique | `user_id` | — |
| Financial Space | Contexte financier | `financial_space_id` | `parent_space_id` |
| Organization | Entité juridique | `organization_id` | — |
| Account | Support de liquidité | `account_id` | Financial Space |
| Portfolio | Ensemble d'investissements | `portfolio_id` | Financial Space |
| Investment Account | Compte de détention | `investment_account_id` | Portfolio |
| Position | Ligne de détention | `position_id` | Investment Account |
| Asset | Instrument financier | `asset_id` | Market |
| Market | Place de marché | `market_id` | — |

---

## 5. ARCHITECTURE ACTUELLE (V2.0)

### Modèle de données actuel

```
USER (auth.users)
│
├── profiles (user_id)
│
├── transactions (user_id, owner, account)
│
├── organizations (user_id, type)
│
├── financial_events (user_id, organization_id nullable)
├── financial_forecasts (user_id, organization_id nullable)
│
├── savings_goals (user_id, owner)
├── savings_transfers (user_id, owner)
├── investments (user_id, owner)
├── assets (user_id, owner)
├── liabilities (user_id, owner)
│
├── insights_history (user_id)
├── financial_opportunities (user_id)
```

### Système owner actuel

- `owner` est un champ texte avec contrainte CHECK : `IN ('personal', 'bgi', 'aurel', 'onkoonnect')`
- Utilisé dans : `transactions`, `savings_goals`, `savings_transfers`, `investments`, `assets`, `liabilities`
- Pas de relation avec la table `organizations`
- Pas de hiérarchie possible
- Pas d'extensibilité sans migration

### Problèmes identifiés de V2.0

1. `owner` = énumération rigide, pas de modèle flexible
2. `organizations` = concept hybride non aligné avec `owner`
3. Pas de hiérarchie pour la consolidation
4. Double comptabilisation non traitée
5. RLS basée uniquement sur `user_id = auth.uid()`
6. Investissements = table plate sans structure portefeuille/position/marché

---

## 6. ARCHITECTURE CIBLE (V2.1)

### Principes directeurs

1. **Financial Space** = abstraction centrale des données financières
2. **user_id** = identité de l'utilisateur (propriétaire, créateur, responsable)
3. **financial_space_id** = contexte financier (appartenance, consolidation)
4. **organizations** = conservée pour les entités juridiques uniquement
5. **Hiérarchie** = consolidation via `parent_space_id`
6. **RLS** = extensible vers multi-utilisateur sans refonte

### Modèle conceptuel cible

```
USER
│
├── Financial Spaces
│   │
│   ├── [Personal]─────────────── user_id only (pas de financial_space pour le profil)
│   │   │
│   │   ├── Savings Goals (user_id + financial_space_id)
│   │   ├── Assets (user_id + financial_space_id)
│   │   ├── Liabilities (user_id + financial_space_id)
│   │   └── Portfolio: Investissements
│   │           ├── Investment Accounts
│   │           │   └── Positions → Asset → Market
│   │           └── ...
│   │
│   ├── [BGI]──────────────────── financial_space_id
│   │   │
│   │   ├── Transactions (user_id + financial_space_id)
│   │   ├── Accounts (financial_space_id)
│   │   ├── Budgets (financial_space_id)
│   │   ├── Financial Goals (financial_space_id)
│   │   ├── [AUREL] (child_space)
│   │   └── [ON'KOONNECT] (child_space)
│   │
│   └── [Autres espaces]───────── ...
│
├── Profile (user_id only)
├── Preferences (user_id only)
└── Notifications (user_id only)
```

---

## 7. MODÈLE RELATIONNEL COMPLET (CIBLE)

### Table : `financial_spaces` (NOUVELLE)

```sql
CREATE TABLE financial_spaces (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_space_id uuid REFERENCES financial_spaces(id) ON DELETE SET NULL,
  name          text NOT NULL,
  type          text NOT NULL CHECK (type IN (
    'personal', 'enterprise', 'subsidiary', 'portfolio',
    'wealth', 'project', 'custom'
  )),
  description   text,
  currency      text NOT NULL DEFAULT 'XOF',
  color         text DEFAULT '#3B82F6',
  icon          text DEFAULT 'FolderOpen',
  is_active     boolean DEFAULT true,
  sort_order    integer DEFAULT 0,
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_financial_spaces_owner ON financial_spaces(owner_user_id);
CREATE INDEX idx_financial_spaces_parent ON financial_spaces(parent_space_id);

-- RLS
ALTER TABLE financial_spaces ENABLE ROW LEVEL SECURITY;

-- V1: User can only see their own spaces
CREATE POLICY "user_own_spaces" ON financial_spaces
  FOR ALL USING (owner_user_id = auth.uid());
```

### Ajout de `financial_space_id` aux tables existantes

Chaque table financière recevra `financial_space_id` comme colonne nullable initialement, puis NOT NULL après migration.

```
transactions       → + financial_space_id
savings_goals      → + financial_space_id (remplace owner)
savings_transfers  → + financial_space_id (remplace owner)
investments        → + financial_space_id (remplace owner)
assets             → + financial_space_id (remplace owner)
liabilities        → + financial_space_id (remplace owner)
financial_events   → + financial_space_id (remplace organization_id)
financial_forecasts→ + financial_space_id (remplace organization_id)
```

### Tables qui NE reçoivent PAS financial_space_id

```
profiles                  → user_id uniquement (données personnelles)
insights_history          → user_id uniquement (historique de l'utilisateur)
financial_opportunities   → user_id uniquement (opportunités personnelles)
organizations             → table indépendante (entités juridiques)
```

---

## 8. STRUCTURE PROPOSÉE DE `financial_spaces`

### Colonnes détaillées

| Colonne | Type | Contrainte | Description |
|---|---|---|---|
| `id` | uuid | PK, DEFAULT gen_random_uuid() | Identifiant unique |
| `owner_user_id` | uuid | NOT NULL, FK → auth.users | Propriétaire de l'espace |
| `parent_space_id` | uuid | FK → financial_spaces(id), NULLABLE | Espace parent pour hiérarchie |
| `name` | text | NOT NULL | Nom de l'espace (ex: "BGI") |
| `type` | text | NOT NULL, CHECK types | Type d'espace financier |
| `description` | text | NULLABLE | Description optionnelle |
| `currency` | text | NOT NULL, DEFAULT 'XOF' | Devise principale |
| `color` | text | DEFAULT '#3B82F6' | Couleur d'affichage |
| `icon` | text | DEFAULT 'FolderOpen' | Icône d'affichage |
| `is_active` | boolean | DEFAULT true | Si l'espace est actif |
| `sort_order` | integer | DEFAULT 0 | Ordre d'affichage |
| `metadata` | jsonb | DEFAULT '{}' | Métadonnées extensibles |
| `created_at` | timestamptz | NOT NULL | Date de création |
| `updated_at` | timestamptz | NOT NULL | Date de mise à jour |

### Données initiales (seed)

```sql
-- Pour chaque utilisateur existant, créer les Financial Spaces par défaut
INSERT INTO financial_spaces (owner_user_id, name, type, color, icon, sort_order)
SELECT 
  u.id, 'Personnel', 'personal', '#3B82F6', 'User', 0
FROM auth.users u;

INSERT INTO financial_spaces (owner_user_id, name, type, color, icon, sort_order)
SELECT
  u.id, 'BGI', 'enterprise', '#8B5CF6', 'Building2', 1
FROM auth.users u;
```

---

## 9. STRATÉGIE `parent_space_id`

### Principe

Le champ `parent_space_id` permet de créer une hiérarchie entre Financial Spaces. Cette hiérarchie sert exclusivement à la **consolidation financière** et n'implique pas de droits d'accès supplémentaires.

### Modèle hiérarchique

```
Personnel (parent_space_id = NULL)
│
├── Investissements (parent_space_id = Personnel.id)
│
BGI (parent_space_id = NULL)
│
├── AUREL (parent_space_id = BGI.id)
│
└── ON'KOONNECT (parent_space_id = BGI.id)
```

### Règles de consolidation

1. **Sans consolidation :** Voir uniquement BGI (données avec `financial_space_id = BGI.id`)
2. **Avec consolidation parent :** Voir BGI + AUREL + ON'KOONNECT (BGI et ses descendants)
3. **Filtrage strict :** Voir uniquement AUREL (données avec `financial_space_id = AUREL.id`)

### Fonction de consolidation récursive (conceptuelle)

```sql
-- Fonction pour obtenir tous les IDs d'un espace et ses descendants
CREATE OR REPLACE FUNCTION get_space_tree(p_space_id uuid)
RETURNS TABLE(space_id uuid) AS $$
  WITH RECURSIVE space_tree AS (
    SELECT id FROM financial_spaces WHERE id = p_space_id
    UNION ALL
    SELECT fs.id FROM financial_spaces fs
    INNER JOIN space_tree st ON st.space_id = fs.parent_space_id
  )
  SELECT space_id FROM space_tree;
$$ LANGUAGE sql STABLE;
```

### Risques et précautions

- **Limiter la profondeur :** Recommander max 3-4 niveaux pour des raisons de performance et de lisibilité.
- **Éviter les cycles :** Ajouter une contrainte CHECK ou un trigger pour empêcher les cycles (ex: A → B → A).
- **Performance :** Indexer `parent_space_id` et utiliser des CTE récursives optimisées.

### À vérifier dans le projet

- Si une fonction récursive similaire existe déjà dans les migrations.
- Si le moteur de base de données supporte les CTE récursives avec de grands jeux de données.

---

## 10. STRATÉGIE `user_id`

### Rôle dual de user_id

1. **Propriétaire des données :** `user_id` dans chaque table indique qui possède l'enregistrement.
2. **Acteur :** `created_by` (ou `user_id`) indique qui a créé/modifié l'enregistrement.

### Tables avec `user_id` UNIQUEMENT

Ces tables concernent l'utilisateur lui-même et n'ont pas de sens financier transverse :

| Table | Justification |
|---|---|
| `profiles` | Données personnelles du compte |
| `insights_history` | Historique d'insights personnels |
| `financial_opportunities` | Opportunités personnelles |
| `notifications` (future) | Préférences de notification |

### Tables avec `user_id` + `financial_space_id`

Ces tables ont un propriétaire ET un contexte financier :

| Table | user_id rôle | financial_space_id rôle |
|---|---|---|
| `transactions` | Créateur de la transaction | Espace financier de la transaction |
| `savings_goals` | Propriétaire de l'objectif | Espace de l'objectif |
| `savings_transfers` | Initiateur du transfert | Espace du transfert |
| `investments` | Propriétaire de l'investissement | Espace de l'investissement |
| `assets` | Propriétaire de l'actif | Espace de l'actif |
| `liabilities` | Propriétaire du passif | Espace du passif |
| `financial_events` | Créateur de l'événement | Espace de l'événement |
| `financial_forecasts` | Bénéficiaire de la prévision | Espace de la prévision |

### Tables avec `financial_space_id` UNIQUEMENT (sans user_id direct)

| Table | Justification |
|---|---|
| `accounts` (future) | Le compte appartient à un espace, géré par ses règles |
| `budgets` (future) | Le budget est défini pour un espace |
| `financial_goals` (future) | L'objectif est lié à un espace |

---

## 11. STRATÉGIE `organization`

### Décision : Conserver la table `organizations` mais avec un rôle redéfini

**Rôle futur de `organizations` :** Représentation d'entités juridiques réelles (RCCM, NIU, statuts légaux).

**Ne pas supprimer** la table. La conserver comme entité indépendante, distincte de `financial_spaces`.

### Relation Organisation ↔ Financial Space

Une organisation juridique PEUT être liée à un ou plusieurs Financial Spaces, mais ce n'est pas obligatoire.

**Exemple :**

```
Table: organizations

| id | name | rccm | niu | tax_id |
|----|------|------|-----|--------|
| 1  | BGI  | CI-xxx | 123456 | A-2024 |

Table: financial_spaces

| id | name | type | organization_id (nullable) |
|----|------|------|---------------------------|
| 1  | BGI  | enterprise | 1 (FK → organizations) |
| 2  | AUREL | subsidiary | NULL (pas d'entité séparée) |
```

### Pourquoi conserver `organizations` ?

1. **Conformité légale :** Nécessaire pour la comptabilité d'entreprise réelle.
2. **Reporting fiscal :** Les organisations juridiques ont des obligations déclaratives.
3. **Future séparation :** Un Financial Space peut précéder la création d'une organisation juridique.

### Pourquoi NE PAS fusionner `organizations` et `financial_spaces` ?

1. **Concept distinct :** Un Financial Space peut exister sans personnalité juridique (ex: "Investissements Personnels").
2. **Cycle de vie différent :** On peut créer un espace financier pour un projet temporaire sans créer d'entreprise.
3. **Extensibilité :** Une organisation peut avoir plusieurs Financial Spaces (ex: BGI holding avec BGI Opérations et BGI Immobilier).

### Recommandation finale

- **Court terme :** `organizations` reste inchangée. `financial_spaces` est la nouvelle table maître.
- **Moyen terme :** Ajouter `organization_id` nullable dans `financial_spaces` pour lier les deux.
- **Long terme :** Déprécier `owner` et `organizations` comme deux concepts distincts alignés.

---

## 12. STRATÉGIE `owner` → `financial_space_id`

### Principe de migration

Le champ `owner` (enum textuel) est remplacé par `financial_space_id` (FK vers `financial_spaces`). La migration doit être progressive pour ne pas casser l'application.

### Étape 1 : Création des Financial Spaces

Créer les entrées dans `financial_spaces` pour chaque valeur `owner` existante :

| owner | financial_space créé |
|---|---|
| `personal` | Personnel (type: personal) |
| `bgi` | BGI (type: enterprise) |
| `aurel` | AUREL (type: subsidiary, parent: BGI) |
| `onkoonnect` | ON'KOONNECT (type: subsidiary, parent: BGI) |

### Étape 2 : Ajout de `financial_space_id` en NULLABLE

Ajouter la colonne `financial_space_id` à chaque table concernée :

```sql
ALTER TABLE transactions ADD COLUMN financial_space_id uuid 
  REFERENCES financial_spaces(id) ON DELETE SET NULL;
-- (Idem pour savings_goals, savings_transfers, investments, assets, liabilities)
```

### Étape 3 : Mapping des données existantes

```sql
-- Mapping basé sur les noms d'owner
UPDATE transactions t
SET financial_space_id = fs.id
FROM financial_spaces fs
WHERE fs.owner_user_id = t.user_id
  AND (
    (t.owner = 'personal' AND fs.name = 'Personnel')
    OR (t.owner = 'bgi' AND fs.name = 'BGI')
    OR (t.owner = 'aurel' AND fs.name = 'AUREL')
    OR (t.owner = 'onkoonnect' AND fs.name = 'ON''KOONNECT')
  );
```

### Étape 4 : Validation

Vérifier que toutes les lignes ont un `financial_space_id` non nul :

```sql
SELECT COUNT(*) FROM transactions WHERE financial_space_id IS NULL;
```

### Étape 5 : Double écriture temporaire

Pendant la période de transition, l'application écrit à la fois `owner` ET `financial_space_id` :

```typescript
// Dans le service de création de transaction
insert({
  ...data,
  owner: owner, // Ancien champ, conservé temporairement
  financial_space_id: financialSpaceId, // Nouveau champ
});
```

### Étape 6-7 : Migration progressive des services puis de l'UI

1. Les services backend lisent d'abord `financial_space_id` s'il existe, sinon fallback sur `owner`.
2. Les écrans utilisent `financial_space_id` pour la visualisation.
3. L'UI existante continue de fonctionner avec `owner`.

### Étape 8 : Validation complète

- Tests de régression sur toutes les fonctionnalités financières.
- Vérification que la consolidation fonctionne avec `financial_space_id`.
- Vérification que les calculs de patrimoine sont corrects.

### Étape 9 : Passage en NOT NULL

```sql
ALTER TABLE transactions ALTER COLUMN financial_space_id SET NOT NULL;
```

### Étape 10 : Suppression éventuelle de `owner`

```sql
ALTER TABLE transactions DROP COLUMN owner;
```

**Cette étape est optionnelle** et peut être reportée si la rétrocompatibilité est nécessaire.

---

## 13. STRATÉGIE `accounts`

### Problème actuel

Le champ `account` est une énumération textuelle dans `transactions` : `'cash' | 'wave' | 'orange_money' | 'moov_money' | 'bank' | 'card'`. C'est un type de compte, pas un compte spécifique.

### Proposition V2.1

Créer une table `accounts` pour représenter des comptes réels :

```sql
CREATE TABLE accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_space_id uuid NOT NULL REFERENCES financial_spaces(id),
  name          text NOT NULL,
  type          text NOT NULL CHECK (type IN (
    'cash', 'wave', 'orange_money', 'moov_money', 'bank', 'card', 
    'savings', 'investment', 'mobile_money', 'other'
  )),
  currency      text DEFAULT 'XOF',
  balance       numeric DEFAULT 0,
  is_active     boolean DEFAULT true,
  description   text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
```

### Relation avec `transactions`

```sql
-- Ajouter account_id dans transactions (nullable, migration future)
ALTER TABLE transactions ADD COLUMN account_id uuid REFERENCES accounts(id);
```

### Bénéfices

1. Un utilisateur peut avoir plusieurs comptes Wave (Wave Pro, Wave Perso).
2. Les comptes appartiennent à un Financial Space (un compte BGI ≠ un compte personnel).
3. Le champ `account` textuel actuel devient une vue simplifiée basée sur le type.

### Note d'implémentation

Ne pas précipiter la migration. `account` (champ texte) reste utilisable en V2.1. La table `accounts` est créée mais n'est pas obligatoire immédiatement.

---

## 14. STRATÉGIE `categories`

### Modèle actuel

Les catégories sont :
- Une énumération dans le code : `transport, alimentation, revenu, logement, sante, shopping, loisir, education, internet, telephone, factures, autres`
- Stockées comme texte libre dans `transactions.category`

### Proposition V2.1

Créer un système de catégories hiérarchique :

```sql
CREATE TABLE categories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_space_id uuid REFERENCES financial_spaces(id), -- NULL = catégorie globale
  parent_id       uuid REFERENCES categories(id),
  name            text NOT NULL,
  icon            text DEFAULT 'Folder',
  color           text DEFAULT '#6B7280',
  keywords        jsonb DEFAULT '[]', -- Mots-clés pour le parser
  is_active       boolean DEFAULT true,
  sort_order      integer DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);
```

### Types de catégories

| Type | Description | financial_space_id |
|---|---|---|
| **Globale** | Accessible à tous les espaces (Transport, Alimentation) | NULL |
| **Personnalisée** | Spécifique à un Financial Space (ex: "Frais BGI") | ID de l'espace |
| **Sous-catégorie** | Enfant d'une catégorie existante (ex: "Carburant" sous "Transport") | parent_id |

### Règle de catégorisation automatique

Le parser actuel utilise des mots-clés codés en dur. La V2.1 propose de stocker ces mots-clés dans la table `categories.keywords` :

```json
// Exemple pour "Transport"
["taxi", "bus", "metro", "velo", "parking", "uber", "essence", "carburant"]

// Exemple pour "Santé"
["medicament", "pharmacie", "medecin", "hopital"]
```

Le parser questionne la base de données plutôt que d'utiliser un dictionnaire codé en dur :

```typescript
async function findCategoryMatch(text: string, financialSpaceId?: string) {
  // 1. Chercher dans les catégories spécifiques à l'espace financier
  // 2. Chercher dans les catégories globales
  // 3. Fallback sur 'Autres'
}
```

### Priorité

- **P1 :** Création de la table `categories` + migration des catégories existantes.
- **P2 :** Alimentation des mots-clés dans la base.
- **P2 :** Mise à jour du parser pour utiliser la base.

---

## 15. STRATÉGIE `savings`

### Modèle actuel

- `savings_goals` : user_id, owner, name, target_amount, current_amount, priority
- `savings_transfers` : user_id, owner, goal_id, source_account, amount

### Modèle cible V2.1

`savings_goals` + `financial_space_id` :

```sql
-- Modification : Ajout de financial_space_id, conservation de owner temporairement
ALTER TABLE savings_goals ADD COLUMN financial_space_id uuid REFERENCES financial_spaces(id);
ALTER TABLE savings_transfers ADD COLUMN financial_space_id uuid REFERENCES financial_spaces(id);
```

### Règles métier

1. Un objectif d'épargne appartient à **un seul** Financial Space.
2. Un transfert vers un objectif hérite du Financial Space de l'objectif.
3. La consolidation d'épargne = somme des `current_amount` de tous les objectifs d'un espace et ses descendants.
4. Un objectif personnel est dans `financial_space_id = Personnel`.

### Exemple

```
Financial Space: Personnel
├── Objectif: "Voyage" (Personnel)
├── Objectif: "Fonds d'urgence" (Personnel)

Financial Space: BGI
├── Objectif: "Réserve BGI" (BGI)
├── Objectif: "Équipement bureau" (BGI)

Financial Space: AUREL (enfant de BGI)
├── Objectif: "Trésorerie AUREL" (AUREL)
```

Consolidation BGI = Objectifs BGI + Objectifs AUREL + Objectifs ON'KOONNECT.

---

## 16. STRATÉGIE `investments`

### Problème actuel

La table `investments` est plate : `user_id, owner, name, type, invested_amount, current_value`. Il n'y a pas de séparation entre :

- Le portefeuille (ensemble d'investissements)
- Le compte de détention (SGI, banque)
- La position (ligne spécifique)
- L'actif sous-jacent (action, obligation)
- Le marché (BRVM, etc.)

### Modèle cible : Architecture multidimensionnelle

```
Financial Space
│
└── Portfolio (portefeuille)
    │
    └── Investment Account (compte de détention)
        │
        ├── Position (ex: 100 actions SONATEL)
        │   └── Asset (ex: Action SONATEL)
        │       └── Market (ex: BRVM)
        │
        └── Position (ex: 50 obligations État CI)
            └── Asset (ex: Obligation État CI 6.25%)
                └── Market (ex: Marché Obligataire)
```

### Tables proposées

```sql
-- Portefeuille
CREATE TABLE portfolios (
  id                uuid PRIMARY KEY,
  financial_space_id uuid NOT NULL REFERENCES financial_spaces(id),
  name              text NOT NULL,
  description       text,
  strategy          text, -- 'growth', 'income', 'balanced', 'speculative'
  created_at        timestamptz DEFAULT now()
);

-- Compte de détention (SGI, banque)
CREATE TABLE investment_accounts (
  id                uuid PRIMARY KEY,
  portfolio_id      uuid NOT NULL REFERENCES portfolios(id),
  name              text NOT NULL, -- "SGI BICICI", "PEA"
  institution       text, -- Nom de l'intermédiaire
  account_number    text,
  currency          text DEFAULT 'XOF',
  created_at        timestamptz DEFAULT now()
);

-- Marché financier
CREATE TABLE markets (
  id                uuid PRIMARY KEY,
  name              text NOT NULL, -- "BRVM", "Euronext"
  country           text,
  currency          text DEFAULT 'XOF',
  is_active         boolean DEFAULT true
);

-- Actif financier
CREATE TABLE financial_assets (
  id                uuid PRIMARY KEY,
  market_id         uuid REFERENCES markets(id),
  name              text NOT NULL, -- "SONATEL"
  ticker            text, -- "SNTS"
  asset_type        text CHECK (asset_type IN (
    'stock', 'bond', 'etf', 'mutual_fund', 't-bond',
    'real_estate', 'crypto', 'commodity', 'other'
  )),
  sector            text,
  isin_code         text
);

-- Position (détention réelle)
CREATE TABLE positions (
  id                uuid PRIMARY KEY,
  investment_account_id uuid NOT NULL REFERENCES investment_accounts(id),
  financial_asset_id    uuid NOT NULL REFERENCES financial_assets(id),
  quantity          numeric NOT NULL,
  unit_price        numeric NOT NULL,
  acquisition_date  timestamptz NOT NULL,
  current_price     numeric,
  last_updated      timestamptz
);
```

### Relation avec la table `investments` existante

La table `investments` actuelle peut être conservée comme une **vue simplifiée** pour les investissements non structurés (ex: un terrain, un commerce). Les investissements de marché (actions BRVM, obligations) migreront vers le nouveau modèle.

### Priorité

- **P1 :** Ajout de `financial_space_id` à la table `investments` existante.
- **P2 :** Création des nouvelles tables (`portfolios`, `investment_accounts`, `markets`, `financial_assets`, `positions`).
- **P3 :** Migration des investissements BRVM vers le modèle structuré.
- **P3 :** Interface de gestion des positions.

### Recommandation importante

**BRVM n'est PAS un Financial Space.** C'est un marché. Ne pas créer "BRVM" comme Financial Space. BRVM est une instance de la table `markets`.

---

## 17. STRATÉGIE `assets` et `liabilities`

### Modèle actuel

- `assets` : user_id, owner, type, value
- `liabilities` : user_id, owner, type, amount, remaining_amount

### Modèle cible V2.1

```sql
-- Ajout de financial_space_id
ALTER TABLE assets ADD COLUMN financial_space_id uuid REFERENCES financial_spaces(id);
ALTER TABLE liabilities ADD COLUMN financial_space_id uuid REFERENCES financial_spaces(id);
```

### Règles

1. Un actif appartient à un seul Financial Space.
2. Un passif appartient à un seul Financial Space.
3. La consolidation patrimoniale (Net Worth) s'effectue par espace et par hiérarchie :
   - Net Worth Personnel = Actifs Personnel - Passifs Personnel
   - Net Worth BGI = Actifs BGI + Actifs AUREL + Actifs ON'KOONNECT - (Passifs BGI + Passifs AUREL + Passifs ON'KOONNECT)
   - Net Worth Global = Net Worth Personnel + Net Worth BGI

### Double comptabilisation à éviter

- Un actif détenu par BGI ne doit PAS être compté dans le patrimoine personnel ET dans BGI.
- Le Consolidation Engine doit s'assurer que chaque actif/passif n'apparaît qu'une fois dans le scope demandé.

### Table `asset_types` existante

À vérifier dans le projet si une table `asset_types` existe ou si c'est juste une énumération dans le code (fichier `wealthService.ts`). Actuellement, `ASSET_TYPES` et `LIABILITY_TYPES` sont dans `wealthService.ts` comme constantes TypeScript.

---

## 18. STRATÉGIE `budgets`

### Modèle proposé

```sql
CREATE TABLE budgets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_space_id uuid NOT NULL REFERENCES financial_spaces(id),
  name              text NOT NULL,
  category_id       uuid REFERENCES categories(id), -- NULL = budget global
  period            text NOT NULL CHECK (period IN ('weekly', 'monthly', 'quarterly', 'annual')),
  amount            numeric NOT NULL CHECK (amount > 0),
  spent_amount      numeric DEFAULT 0,
  start_date        date NOT NULL,
  end_date          date,
  is_active         boolean DEFAULT true,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
```

### Règles métier

1. Un budget est défini pour un Financial Space spécifique.
2. Un budget peut être global (toutes catégories) ou par catégorie.
3. La comparaison `budget vs réel` utilise `financial_space_id` pour filtrer les transactions.
4. La consolidation des budgets = somme des budgets des espaces enfants dans le parent.

### Priorité

- **P2 :** Création de la table `budgets`.
- **P2 :** Interface de définition de budget.
- **P2 :** Alertes de dépassement.

---

## 19. STRATÉGIE `financial_goals`

### Modèle proposé

```sql
CREATE TABLE financial_goals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_space_id uuid NOT NULL REFERENCES financial_spaces(id),
  user_id           uuid NOT NULL REFERENCES auth.users(id),
  name              text NOT NULL,
  goal_type         text NOT NULL CHECK (goal_type IN (
    'savings', 'investment', 'debt_reduction', 'net_worth', 'income', 'expense_reduction'
  )),
  target_value      numeric NOT NULL CHECK (target_value > 0),
  current_value     numeric DEFAULT 0,
  target_date       date,
  priority          integer DEFAULT 1,
  is_achieved       boolean DEFAULT false,
  achieved_at       timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
```

### Différence avec `savings_goals`

- `savings_goals` = objectifs d'épargne spécifiques (déjà existant).
- `financial_goals` = objectifs financiers génériques (réduction de dette, patrimoine, revenus).

### Priorité

- **P2 :** Fusion conceptuelle avec `savings_goals` à long terme.
- **P2 :** Création de `financial_goals` pour les objectifs non-épargne.

---

## 20. STRATÉGIE `business_rules`

### Problème

Actuellement, la règle des 35% (dépenses personnelles ≤ 35% revenus BGI) est codée en dur dans :
- `dashboardService.ts` → `calculateFinancialDiscipline()`
- `wealthService.ts` → `generateFinancialOpportunities()`
- `intelligenceService.ts` → `generateInsights()`

### Proposition : Table `business_rules`

```sql
CREATE TABLE business_rules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  description       text,
  rule_type         text NOT NULL CHECK (rule_type IN (
    'ratio', 'threshold', 'constraint', 'goal'
  )),
  -- Les Financial Spaces impliqués dans la règle
  source_space_id   uuid REFERENCES financial_spaces(id), -- Espace source (ex: BGI)
  target_space_id   uuid REFERENCES financial_spaces(id), -- Espace cible (ex: Personnel)
  -- Paramètres de la règle
  parameters        jsonb NOT NULL DEFAULT '{}',
  -- Quand la règle est-elle évaluée ?
  evaluation_event  text DEFAULT 'on_transaction' CHECK (evaluation_event IN (
    'on_transaction', 'daily', 'weekly', 'monthly', 'manual'
  )),
  is_active         boolean DEFAULT true,
  severity          text DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  created_at        timestamptz DEFAULT now()
);
```

### Exemple : Règle des 35%

```json
{
  "name": "Règle des 35% BGI",
  "rule_type": "ratio",
  "source_space_id": "<BGI.id>",
  "target_space_id": "<Personnel.id>",
  "parameters": {
    "numerator": {
      "type": "expense_sum",
      "financial_space_id": "<Personnel.id>",
      "period": "monthly"
    },
    "denominator": {
      "type": "income_sum",
      "financial_space_id": "<BGI.id>",
      "period": "monthly"
    },
    "max_ratio": 0.35,
    "thresholds": {
      "warning": 0.80,
      "critical": 1.00
    }
  },
  "evaluation_event": "monthly",
  "severity": "warning"
}
```

---

## 21. STRATÉGIE `RuleEngine`

### Architecture proposée

Le RuleEngine est un service qui :
1. Charge toutes les `business_rules` actives.
2. Pour chaque règle, exécute la fonction d'évaluation correspondante.
3. Génère des insights/alertes en cas de violation.

```
┌──────────────────┐
│  RuleEngine       │
│  (Service)        │
├──────────────────┤
│  loadRules()      │
│  evaluateRules()  │
│  checkCondition() │
│  generateAlert()  │
└──────────────────┘
        │
        ▼
┌───────────────────┐       ┌──────────────────┐
│ business_rules    │──────▶│  Evaluators       │
│ (BDD)             │       │  ┌──────────────┐ │
│                   │       │  │ RatioEval    │ │
│                   │       │  │ ThresholdEval│ │
│                   │       │  │ ConstraintEval│ │
│                   │       │  └──────────────┘ │
└───────────────────┘       └──────────────────┘
```

### Règle cross-Financial Space

La force de ce modèle est qu'une règle peut référencer **plusieurs** Financial Spaces :

- **Ratio :** `expenses(Personnel) / income(BGI) ≤ 0.35`
- **Croissance :** `net_worth(current month) - net_worth(last month) > 0` (même espace)
- **Transfert :** `sum(investments(global)) - sum(withdrawals(global)) ≥ 0` (tous espaces)

### Stockage des résultats

```sql
CREATE TABLE rule_evaluations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id       uuid NOT NULL REFERENCES business_rules(id),
  user_id       uuid NOT NULL REFERENCES auth.users(id),
  evaluated_at  timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL CHECK (status IN ('compliant', 'warning', 'violated')),
  details       jsonb,
  insight_id    uuid REFERENCES insights_history(id)
);
```

---

## 22. STRATÉGIE `Consolidation Engine`

### Problème actuel

Le `consolidationEngine.ts` actuel :
- Filtre par `owner` mappé depuis `organization.name`
- Ne gère pas la hiérarchie (BGI → AUREL + ON'KOONNECT)
- Ne prévient pas les doubles comptages
- Limité à 4 valeurs d'owner possibles

### Architecture cible

```
┌──────────────────────────────────────────┐
│           Consolidation Engine            │
├──────────────────────────────────────────┤
│  getConsolidatedData(scope, options)      │
│    ├── scope: Financial Space ID          │
│    ├── include_descendants: boolean       │
│    ├── period: DateRange                  │
│    └── exclude_internal_transfers: boolean│
├──────────────────────────────────────────┤
│  Résultat :                               │
│  - Income / Expenses / Balance            │
│  - Savings / Investments                  │
│  - Assets / Liabilities / Net Worth       │
│  - Category Breakdown                     │
│  - Internal Transfer Adjustments          │
└──────────────────────────────────────────┘
```

### Types de consolidation

| Scope | Description |
|---|---|
| `financial_space_id = X` | Données de X uniquement |
| `financial_space_id IN (X + descendants)` | X et ses enfants |
| `all` | Tous les espaces de l'utilisateur |
| `type = 'personal'` | Tous les espaces personnels |
| `type = 'enterprise'` | Toutes les entreprises |

### Algorithme de consolidation

```
1. Déterminer le scope
   ├── Si espace seul : {space.id}
   ├── Si arbre : space.id + RECURSIVE(descendants)
   └── Si tous : tous les espaces de l'utilisateur

2. Filtrer les données financières par financial_space_id IN (scope)

3. Ajuster les transferts internes
   ├── Une transaction 'transfer' entre deux espaces du scope
   │   EST un transfert interne → déduire du total
   └── Une transaction 'transfer' vers un espace hors scope
       EST une sortie réelle → compter

4. Consolider
   ├── Somme des revenus/ dépenses par espace
   ├── Agrégation des catégories
   ├── Agrégation des comptes
   └── Calcul des ratios
```

---

## 23. STRATÉGIE `RLS` (Row Level Security)

### Modèle actuel

Toutes les politiques RLS sont basées sur `user_id = auth.uid()` :

```sql
CREATE POLICY "users_read_own" ON transactions
  FOR SELECT USING (auth.uid() = user_id);
```

### Modèle cible V2.1

Pour les Financial Spaces :

```sql
-- V1: Accès simple (actuel + financial_space)
CREATE POLICY "access_own_financial_spaces" ON transactions
  FOR SELECT USING (
    auth.uid() = user_id
    AND financial_space_id IN (
      SELECT id FROM financial_spaces WHERE owner_user_id = auth.uid()
    )
  );
```

### Extensibilité future (V3.0)

Pour permettre le multi-utilisateur sans refonte, l'architecture prévoit une table de jointure :

```sql
-- FUTURE (V3.0) : Table de membership
CREATE TABLE financial_space_members (
  id                uuid PRIMARY KEY,
  financial_space_id uuid NOT NULL REFERENCES financial_spaces(id),
  user_id           uuid NOT NULL REFERENCES auth.users(id),
  role              text NOT NULL CHECK (role IN (
    'owner', 'admin', 'contributor', 'viewer', 'accountant'
  )),
  permissions       jsonb DEFAULT '{}',
  invited_by        uuid REFERENCES auth.users(id),
  invited_at        timestamptz DEFAULT now(),
  joined_at         timestamptz,
  is_active         boolean DEFAULT true
);
```

### Évolution RLS

```
V2.1 (actuelle) :  user → financial_spaces (propriétaire unique)

V3.0 (future) :    user → financial_space_members → financial_spaces
                    (plusieurs utilisateurs par espace)
```

La politique RLS évoluerait vers :

```sql
-- FUTURE V3.0
CREATE POLICY "access_via_membership" ON transactions
  FOR SELECT USING (
    financial_space_id IN (
      SELECT financial_space_id 
      FROM financial_space_members 
      WHERE user_id = auth.uid() 
        AND is_active = true
    )
  );
```

Pour le V2.1 actuel, on conserve le modèle `owner_user_id` simple mais on structure déjà `financial_space_id` dans les tables pour que la transition vers `financial_space_members` soit triviale.

---

## 24. STRATÉGIE FUTURE MULTI-UTILISATEUR

### Architecture actuelle (V2.1)

- User unique propriétaire de tous ses Financial Spaces.
- RLS : `owner_user_id = auth.uid()`.

### Scénarios futurs (V3.0+)

1. **Comptable :** Accès en lecture aux espaces financiers d'une entreprise.
2. **Associé :** Accès partagé à un espace BGI avec Amidou.
3. **Collaborateur :** Peut ajouter des dépenses dans l'espace BGI.
4. **Conjoint :** Accès à l'espace Personnel en visibilité et contribution.
5. **Administrateur :** Gère les membres et les rôles.

### Table d'extension

```sql
-- Créée en V2.1 mais non utilisée avant V3.0
CREATE TABLE financial_space_members (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_space_id uuid NOT NULL REFERENCES financial_spaces(id),
  user_id           uuid NOT NULL REFERENCES auth.users(id),
  role              text NOT NULL DEFAULT 'viewer' CHECK (role IN (
    'owner', 'admin', 'editor', 'viewer'
  )),
  invited_by        uuid REFERENCES auth.users(id),
  invited_at        timestamptz DEFAULT now(),
  joined_at         timestamptz,
  is_active         boolean DEFAULT false, -- Doit accepter l'invitation
  permissions       jsonb DEFAULT '{}',
  UNIQUE(financial_space_id, user_id)
);
```

### Pas d'implémentation maintenant

> **Décision :** Cette table est définie dans l'architecture mais n'est PAS créée ni implémentée en V2.1. L'application reste mono-utilisateur. La simple présence de `financial_space_id` (au lieu de `owner` ou `organization_id`) rendra l'ajout du multi-utilisateur trivial.

---

## 25. STRATÉGIE MULTI-DEVISE

### Contexte

Toutes les données actuelles sont en XOF. Le modèle cible doit permettre la multi-devise sans complexité excessive.

### Modèle proposé

1. **Financial Space :** Chaque espace a une devise par défaut (`currency`).
2. **Transactions :** Stockées dans la devise du Financial Space.
3. **Taux de conversion :** Table facultative pour consolidation multi-devise.

```sql
-- Optionnel : Si consolidation multi-devise nécessaire
CREATE TABLE exchange_rates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL,
  to_currency   text NOT NULL,
  rate          numeric NOT NULL,
  date          date NOT NULL DEFAULT CURRENT_DATE,
  source        text DEFAULT 'manual',
  UNIQUE(from_currency, to_currency, date)
);
```

### Règle

- **V2.1 :** Devise unique (XOF). Le champ `currency` dans `financial_spaces` est défini mais pas activement utilisé pour la conversion.
- **V2.2+ :** Support multi-devise avec conversion automatique basée sur les taux.

---

## 26. STRATÉGIE `audit_logs`

### Pourquoi des audit logs ?

1. Traçabilité des modifications financières.
2. Conformité (comptable, fiscal).
3. Débogage et support.

### Table proposée

```sql
-- NON BLOQUANT : Créée mais pas utilisée activement en V2.1
CREATE TABLE audit_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id),
  financial_space_id uuid REFERENCES financial_spaces(id),
  table_name        text NOT NULL,
  record_id         uuid NOT NULL,
  action            text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data          jsonb,
  new_data          jsonb,
  ip_address        text,
  user_agent        text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_space ON audit_logs(financial_space_id);
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name, record_id);
```

### Activation progressive

- **V2.1 :** Audit passif pour les opérations financières critiques (transactions, investissements).
- **V2.2+ :** Audit complet activé.

---

## 27. STRATÉGIE `notifications`

### Modèle proposé (non bloquant V2.1)

```sql
CREATE TABLE notifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id),
  financial_space_id uuid REFERENCES financial_spaces(id), -- NULL = notification système
  type              text NOT NULL CHECK (type IN (
    'insight', 'alert', 'reminder', 'opportunity', 'system'
  )),
  title             text NOT NULL,
  message           text,
  is_read           boolean DEFAULT false,
  is_actionable     boolean DEFAULT false,
  action_data       jsonb,
  valid_until       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
```

### Règles

- Les notifications sont liées à `user_id` (destinataire).
- Optionnellement liées à `financial_space_id` (contexte).
- En V2.1, le système actuel `insights_history` + `financial_opportunities` reste suffisant.

---

## 28. STRATÉGIE DE MIGRATION V1 → V2.1

### Phases de migration

#### Phase 0 : Préparation (Sprint 1)

- [ ] Créer la table `financial_spaces`.
- [ ] Créer les espaces par défaut pour chaque utilisateur existant.
- [ ] Ajouter `financial_space_id` en NULLABLE dans les tables financières.

#### Phase 1 : Backfill (Sprint 1-2)

- [ ] Mapper les données existantes : `owner` → `financial_space_id`.
- [ ] Valider l'intégrité : aucune donnée orpheline.
- [ ] Mettre à jour les services pour lire `financial_space_id` en priorité.

#### Phase 2 : Double écriture (Sprint 2-3)

- [ ] Les services écrivent `owner` ET `financial_space_id`.
- [ ] Les deux champs sont maintenus synchronisés.
- [ ] L'application continue de fonctionner avec `owner`.

#### Phase 3 : Migration des services (Sprint 3-4)

- [ ] `dashboardService.ts` : utiliser `financial_space_id` pour les stats.
- [ ] `consolidationEngine.ts` : utiliser la hiérarchie `parent_space_id`.
- [ ] `wealthService.ts` : filtrer par `financial_space_id`.
- [ ] `parserService.ts` : détecter le Financial Space depuis l'entrée utilisateur.

#### Phase 4 : Migration UI (Sprint 4-5)

- [ ] Écrans de sélection : remplacer le sélecteur `owner` par le sélecteur Financial Space.
- [ ] Affichage consolidé : utiliser l'arbre des Financial Spaces.
- [ ] Nouvel écran de gestion des Financial Spaces (CRUD).

#### Phase 5 : Validation (Sprint 5)

- [ ] Tests de régression complets.
- [ ] Vérification de la consolidation hiérarchique.
- [ ] Vérification de l'absence de double comptabilisation.
- [ ] Validation des calculs de patrimoine.

#### Phase 6 : Finalisation (Sprint 6)

- [ ] `financial_space_id` passe en NOT NULL.
- [ ] `owner` rendu optionnel dans les INSERT (compatibilité).
- [ ] Nettoyage du code : suppression des références à `owner` dans les nouveaux services.

---

## 29. RISQUES DE MIGRATION

### Risque 1 : Données orphelines

**Problème :** Des transactions avec `owner` mais sans `financial_space_id` correspondant.

**Mitigation :**
- Script de mapping exhaustif avant publication.
- Requête de validation : `SELECT COUNT(*) FROM transactions WHERE financial_space_id IS NULL`.

### Risque 2 : Performance des CTE récursives

**Problème :** La consolidation avec des CTE récursives peut être lente sur de grands volumes.

**Mitigation :**
- Indexer `parent_space_id` et `financial_space_id`.
- Limiter la profondeur de hiérarchie (max 4 niveaux recommandé).
- Cacher les résultats de consolidation fréquents.

### Risque 3 : Casser l'existant

**Problème :** Les services existants utilisent `owner` et pourraient être cassés.

**Mitigation :**
- Phase de double écriture (owner + financial_space_id).
- Tests de régression complets.
- Feature flags pour basculer progressivement.

### Risque 4 : Complexité pour l'utilisateur

**Problème :** Le concept de Financial Space peut être abstrait pour l'utilisateur.

**Mitigation :**
- UI simple : l'utilisateur voit "Personnel", "BGI", "AUREL", "ON'KOONNECT" comme avant.
- La hiérarchie est gérée en arrière-plan.
- L'utilisateur n'a pas besoin de comprendre "Financial Space".

### Risque 5 : Migration ARUEL et ON'KOONNECT

**Problème :** Aurel et On'Koonnect n'ont peut-être pas encore de données. Si owner = 'aurel' n'existe pas, le mapping sera inexistant.

**Mitigation :**
- Créer quand même les Financial Spaces AUREL et ON'KOONNECT.
- Les données arriveront après la migration.

---

## 30. RISQUES DE DOUBLE COMPTABILISATION

### Scénarios identifiés

#### Scénario 1 : Transaction comptée dans l'espace ET dans son parent

**Problème :** Une transaction avec `financial_space_id = AUREL.id` ne doit PAS être comptée dans AUREL ET dans BGI si on consolide BGI.

**Solution :**
- Le Consolidation Engine utilise `IN (espace + descendants)` avec `DISTINCT`.
- Une transaction n'appartient qu'à UN SEUL Financial Space.

```sql
-- CORRECT : Une seule occurrence par transaction
SELECT SUM(amount) FROM transactions
WHERE financial_space_id IN (
  SELECT id FROM get_space_tree('bgi-uuid')
);
```

#### Scénario 2 : Transfert interne compté comme revenu ET dépense

**Problème :** Un transfert de BGI vers Personnel est :
- Une dépense dans BGI
- Un revenu dans Personnel
En consolidation globale, il ne doit compter ni comme revenu ni comme dépense.

**Solution :**
- Le Consolidation Engine détecte les transferts internes (`transaction_nature = 'transfer'` entre deux espaces du scope).
- Il soustrait le montant du total consolidé.

```typescript
// Dans le Consolidation Engine
const internalTransfers = transactions.filter(t => 
  t.transaction_nature === 'transfer'
  && scope.includes(t.source_financial_space_id)
  && scope.includes(t.destination_financial_space_id)
);
const adjustment = internalTransfers.reduce((sum, t) => sum + t.amount, 0);
// Ne pas compter les transferts internes dans le total consolidé
```

#### Scénario 3 : Actif détenu par une organisation et consolidé par son parent

**Problème :** Un terrain au nom de AUREL est compté dans AUREL et dans BGI consolidé.

**Solution :**
- Un actif appartient à un seul Financial Space (`financial_space_id`).
- En consolidation, la somme est unique via `IN (descendants)`.

#### Scénario 4 : Mélange patrimoine personnel et entreprise

**Problème :** Une voiture utilisée à titre personnel mais achetée par BGI.

**Solution :**
- Règle métier : taguer la transaction avec `financial_space_id = BGI` mais ajouter un champ `usage_type` ou créer une écriture de "mise à disposition" dans Personnel.
- Le rapport consolidé "Patrimoine global" additionne simplement tous les espaces, mais les rapports individuels sont séparés.

### Règle fondamentale

> **Chaque donnée financière appartient à UN et UN SEUL Financial Space. La consolidation est une agrégation par ensemble, jamais une duplication.**

---

## 31. COMPATIBILITÉ AVEC L'APPLICATION ACTUELLE

### Ce qui reste compatible

1. Tous les écrans existants continuent de fonctionner (double écriture owner + financial_space_id).
2. Le parser utilise `owner` → mappé vers `financial_space_id` en backend.
3. Les API REST/services existants retournent `owner` ET `financial_space_id`.
4. Les organisations existantes (`organizations`) restent inchangées.

### Ce qui change

1. Le sélecteur d'owner dans l'UI peut évoluer pour montrer la hiérarchie.
2. Le Consolidation Engine devient plus intelligent (hiérarchie, transferts internes).
3. Les nouveaux écrans (budgets, goals) utilisent directement `financial_space_id`.

### Rétrocompatibilité

Pendant toute la phase de migration (Sprints 1-5), l'application est 100% rétrocompatible :
- `owner` est toujours lu et écrit.
- `financial_space_id` est ajouté sans supprimer `owner`.
- Les anciennes requêtes SQL fonctionnent encore.

---

## 32. PRIORISATION P0 / P1 / P2

### P0 — Critique (Sprint 1-2)

| Tâche | Justification |
|---|---|
| Créer `financial_spaces` | Fondation de toute l'architecture |
| Ajouter `financial_space_id` NULLABLE | Permet la migration progressive |
| Mapper `owner` → `financial_space_id` | Évite la perte de données |
| Mettre à jour `dashboardService` | Core business impacté immédiatement |
| Mettre à jour `consolidationEngine` | Core business impacté immédiatement |

### P1 — Important (Sprint 3-4)

| Tâche | Justification |
|---|---|
| Double écriture owner + financial_space_id | Rétrocompatibilité |
| Migration des services wealth | Épargne, investissements, patrimoine |
| Migration UI (sélecteur d'espace) | Expérience utilisateur |
| Gestion de la hiérarchie parent_space_id | Consolidation |
| Mise à jour du parserService | Détection automatique du Financial Space |

### P2 — Souhaitable (Sprint 5+)

| Tâche | Justification |
|---|---|
| Table `accounts` | Comptes réels |
| Table `categories` | Catégories extensibles |
| Table `budgets` | Gestion budgétaire |
| Table `financial_goals` | Objectifs étendus |
| Table `business_rules` + `RuleEngine` | Règles métier dynamiques |
| `financial_space_id` → NOT NULL | Finalisation migration |
| Suppression éventuelle de `owner` | Nettoyage |
| Architecture investissements structurée | Portefeuilles, positions, marchés |
| Table `financial_space_members` | Préparation multi-utilisateur |

---

## 33. CE QUI DOIT ÊTRE REPORTÉ

### Reporté à V3.0 (multi-utilisateur)

1. `financial_space_members` — Pas avant que le besoin soit validé.
2. Workflow d'approbation multi-utilisateur.
3. Rôles et permissions avancés.

### Reporté à V2.2 (prochain cycle)

1. Table `accounts` (comptes réels).
2. Support multi-devise avec conversion.
3. Audit logs complet.
4. Suppression du champ `owner`.

### Reporté à V2.3 (cycle futur)

1. Modèle investissement structuré (`portfolios`, `positions`, `financial_assets`).
2. `RuleEngine` complet avec évaluation en temps réel.
3. Synchronisation automatique BRVM (API externe).

---

## 34. CE QU'IL NE FAUT SURTOUT PAS FAIRE

### ❌ Interdictions absolues

1. **Ne PAS supprimer `owner` immédiatement.** La migration doit être progressive.
2. **Ne PAS fusionner `organizations` et `financial_spaces`.** Ce sont deux concepts différents.
3. **Ne PAS créer BRVM comme Financial Space.** BRVM est un marché, pas un espace financier.
4. **Ne PAS casser l'existant** en déployant la migration sans double écriture.
5. **Ne PAS implémenter le multi-utilisateur maintenant.** L'architecture le prépare mais ne l'implémente pas.
6. **Ne PAS forcer `financial_space_id NOT NULL` tant que toutes les données ne sont pas migrées.**
7. **Ne PAS modifier les RLS des tables existantes** tant que la migration n'est pas terminée.

### ⚠️ Risques à ne pas prendre

1. **Ne PAS supposer que `organization = financial_space`.** Une organisation peut avoir plusieurs espaces, un espace peut ne pas être une organisation.
2. **Ne PAS supprimer la contrainte CHECK sur `owner`** avant d'avoir migré toutes les données.
3. **Ne PAS migrer les investissements vers le modèle structuré** sans avoir d'abord ajouté `financial_space_id`.
4. **Ne PAS créer de code d'implémentation** dans ce document d'architecture.

---

## 35. ARCHITECTURE RECOMMANDÉE POUR LES 3 PROCHAINES ANNÉES

### V2.1 (2024) — Fondation Financial Space

```
Objectif : Migrer le modèle owner → financial_space_id, poser les bases.
Durée : 6 sprints (~3 mois)

Livrables :
- Table financial_spaces avec hiérarchie parent_space_id
- Migration owner → financial_space_id
- Consolidation Engine V2 (hiérarchique)
- Dashboard compatible Financial Space
- Parser compatible Financial Space
```

### V2.2 (2024-2025) — Enrichissement

```
Objectif : Ajouter les fonctionnalités bloquées par le modèle V2.0.
Durée : 4 sprints (~2 mois)

Livrables :
- Table accounts (comptes réels)
- Table categories (extensible, mots-clés en base)
- Table budgets
- Table financial_goals
- Support multi-devise
- Audit logs basique
- Suppression du champ owner (finalisation)
```

### V2.3 (2025) — Investissements & Règles

```
Objectif : Architecture d'investissement structurée, RuleEngine.
Durée : 4 sprints (~2 mois)

Livrables :
- portfolios, investment_accounts, markets, financial_assets, positions
- RuleEngine + business_rules
- Règle des 35% paramétrable
- Alertes et notifications
- API BRVM (si disponible)
```

### V3.0 (2025-2026) — Multi-utilisateur

```
Objectif : Ouverture aux collaborateurs, comptables, associés.
Durée : 6 sprints (~3 mois)

Livrables :
- financial_space_members
- RLS basée sur les memberships
- Rôles : owner, admin, editor, viewer
- Invitations et workflow d'acceptation
- Audit logs complet
```

---

## ARCHITECTURE V2.1 RECOMMANDÉE PAR LE CTO

### Schéma ASCII du modèle final

```
┌──────────────────────────────────────────────────────────────┐
│                     AUTH.USERS (Supabase Auth)                │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  PROFILES (user_id)        INSIGHTS_HISTORY (user_id)        │
│  FINANCIAL_OPPORTUNITIES (user_id)                           │
│  (Données personnelles — PAS de financial_space_id)          │
└──────────────────────────────────────────────────────────────┘
                         │
                         │ owner_user_id
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                     FINANCIAL SPACES                          │
│  ┌───────────┬────────────┬─────────────┬───────────────┐   │
│  │ Personal  │    BGI     │ Invest.     │ Future Spaces │   │
│  │           │   (parent) │ (portfolio) │               │   │
│  │           │   ┌────┐ ┌──────┐        │               │   │
│  │           │   │ARU │ │ON'KN │        │               │   │
│  │           │   └────┘ └──────┘        │               │   │
│  └───────────┴────────────┴─────────────┴───────────────┘   │
└──────────────────────────────────────────────────────────────┘
                         │
                         │ financial_space_id
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                     DONNÉES FINANCIÈRES                       │
│                                                              │
│  TRANSACTIONS  : user_id + financial_space_id                │
│  SAVINGS_GOALS : user_id + financial_space_id                │
│  INVESTMENTS   : user_id + financial_space_id                │
│  ASSETS        : user_id + financial_space_id                │
│  LIABILITIES   : user_id + financial_space_id                │
│  FINANCIAL_EVENTS: user_id + financial_space_id              │
│  FORECASTS     : user_id + financial_space_id                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                     SERVICES / ENGINES                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Consolidation │  │  RuleEngine  │  │  AI Intelligence │   │
│  │    Engine     │  │              │  │                  │   │
│  │  - scoped     │  │  - business  │  │  - insights      │   │
│  │  - recursive  │  │    _rules    │  │  - opportunities │   │
│  │  - transfer   │  │  - multi-    │  │  - forecasts     │   │
│  │    adjustments│  │    space     │  │                  │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                     RLS (SÉCURITÉ)                           │
│                                                              │
│  V2.1 : owner_user_id = auth.uid()                           │
│  V3.0 : financial_space_members → table de jointure          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Recommandations fermes du CTO

#### 1. Le concept Financial Space est-il suffisamment robuste ?

**OUI.** Le Financial Space est l'abstraction centrale qui manquait à Mon Bédou. Il remplace `owner` (trop rigide) et `organization_id` (trop spécifique) par un concept universel, hiérarchique et extensible. Il permet :
- La consolidation financière
- L'isolation des données
- L'extensibilité sans migration
- La préparation au multi-utilisateur

#### 2. Quelles données doivent avoir financial_space_id ?

**Toutes les données financières** : transactions, savings_goals, savings_transfers, investments, assets, liabilities, financial_events, financial_forecasts, budgets, financial_goals.

#### 3. Quelles données doivent avoir user_id ?

**Les données personnelles et d'authentification** : profiles, insights_history, financial_opportunities, notifications, préférences utilisateur.

#### 4. Quelles données doivent avoir les deux ?

**Les données financières créées par un utilisateur** : toutes les tables financières ci-dessus (user_id = créateur/propriétaire, financial_space_id = contexte financier).

#### 5. Quel rôle exact doit conserver `organizations` ?

**Représentation d'entités juridiques.** Ne pas supprimer. Lier optionnellement via `organization_id` dans `financial_spaces`.

#### 6. Comment éviter les doubles comptages dans la consolidation hiérarchique ?

Par trois mécanismes :
1. **Attribution unique** : chaque donnée appartient à UN seul Financial Space.
2. **Détection des transferts internes** : les flux entre espaces du scope sont exclus du total.
3. **Aggrégation distincte** : `SELECT DISTINCT` ou `IN (descendants)` garantit l'unicité.

#### 7. Comment migrer owner vers financial_space_id sans casser l'application ?

**Migration en 10 étapes** (détaillée section 12) avec phase de double écriture, validation progressive, et passage en NOT NULL uniquement à la fin.

#### 8. Quel est le modèle exact recommandé pour les investissements ?

**Modèle structuré multi-couche** : Financial Space → Portfolio → Investment Account → Position → Asset → Market. BRVM est un marché, pas un Financial Space.

#### 9. Quelle architecture doit être mise en place maintenant ?

**Financial Space model V2.1** : créer `financial_spaces`, ajouter `financial_space_id`, migrer `owner`, mettre à jour le Consolidation Engine, garder la compatibilité.

#### 10. Qu'est-ce qui doit être reporté ?

Multi-utilisateur (V3.0), audit logs complet (V2.2), modèle investissement structuré (V2.3), suppression du champ `owner` (V2.2), RuleEngine complet (V2.3).

---

> **Document d'architecture V2.1 — Financial Space Model**  
> *Mon Bédou — Application de Gestion Financière Personnelle*  
> *Aucun code, aucune migration, aucune modification de projet inclus dans ce document*

