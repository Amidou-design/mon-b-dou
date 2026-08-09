/*
# Accounts V1 — Fondation

Cette migration pose la fondation du système de comptes réels (Accounts V1).

## Contexte
Avant : `transactions.account` est un champ textuel énuméré (`cash`, `wave`, `orange_money`, `moov_money`, `bank`, `card`).
Après : un `Account` devient une entité réelle (table `accounts`) à laquelle
les transactions pourront être rattachées via `account_id` (étape ultérieure).

## Périmètre de CETTE migration (fondation uniquement)
- Créer la table `accounts`.
- Ajouter la RLS basée sur `user_id = auth.uid()`.
- Créer les index nécessaires.

## Exclu volontairement (étapes ultérieures)
- `financial_space_id` N'EST PAS ajouté (l'introduction de Financial Space est progressive).
- `transactions.account_id` N'EST PAS ajouté (ne pas casser l'existant).
- `transactions.account` est conservé pour la rétrocompatibilité.
- Aucune modification de la table `transactions`.

## Contraintes
- Un compte appartient à un utilisateur (`user_id`).
- RLS : chaque utilisateur ne voit/gère que ses propres comptes.
*/

-- ============================================
-- TABLE ACCOUNTS
-- ============================================
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN (
    'cash', 'wave', 'orange_money', 'moov_money', 'bank', 'card',
    'savings', 'investment', 'mobile_money', 'other'
  )),
  provider text,
  currency text NOT NULL DEFAULT 'XOF',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- SELECT : un utilisateur ne voit que ses propres comptes
DROP POLICY IF EXISTS "users_read_own_accounts" ON accounts;
CREATE POLICY "users_read_own_accounts" ON accounts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- INSERT : un utilisateur ne crée que ses propres comptes
DROP POLICY IF EXISTS "users_insert_own_accounts" ON accounts;
CREATE POLICY "users_insert_own_accounts" ON accounts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- UPDATE : un utilisateur ne modifie que ses propres comptes
DROP POLICY IF EXISTS "users_update_own_accounts" ON accounts;
CREATE POLICY "users_update_own_accounts" ON accounts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- DELETE : un utilisateur ne supprime que ses propres comptes
DROP POLICY IF EXISTS "users_delete_own_accounts" ON accounts;
CREATE POLICY "users_delete_own_accounts" ON accounts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================
-- INDEX
-- ============================================
-- Optimiser les requêtes filtrant par utilisateur
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);

-- Optimiser le filtrage par type de compte
CREATE INDEX IF NOT EXISTS idx_accounts_user_type ON accounts(user_id, account_type);

-- Optimiser le filtrage par compte actif
CREATE INDEX IF NOT EXISTS idx_accounts_user_active ON accounts(user_id, is_active);
