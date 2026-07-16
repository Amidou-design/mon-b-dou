/*
# V1.2: Epargne, Investissements et Patrimoine

This migration adds the foundation for wealth management features.
*/

-- Add transaction_nature to existing transactions
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS transaction_nature text NOT NULL DEFAULT 'expense';

-- Check constraint for transaction_nature
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_nature_check;
ALTER TABLE transactions 
ADD CONSTRAINT transactions_nature_check 
CHECK (transaction_nature IN ('income', 'expense', 'transfer', 'savings', 'investment', 'debt', 'repayment', 'adjustment'));

-- Add index for nature queries
CREATE INDEX IF NOT EXISTS idx_transactions_nature ON transactions(user_id, transaction_nature);

-- ============================================
-- SAVINGS GOALS
-- ============================================
CREATE TABLE IF NOT EXISTS savings_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  target_amount numeric NOT NULL CHECK (target_amount > 0),
  current_amount numeric NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  owner text NOT NULL DEFAULT 'personal' CHECK (owner IN ('personal', 'bgi', 'aurel', 'onkoonnect')),
  priority integer NOT NULL DEFAULT 1 CHECK (priority >= 1 AND priority <= 10),
  color text DEFAULT '#059669',
  icon text DEFAULT 'Target',
  target_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for savings_goals
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_savings_goals" ON savings_goals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_savings_goals" ON savings_goals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_savings_goals" ON savings_goals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_savings_goals" ON savings_goals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================
-- SAVINGS TRANSFERS
-- ============================================
CREATE TABLE IF NOT EXISTS savings_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id uuid REFERENCES savings_goals(id) ON DELETE SET NULL,
  source_account text NOT NULL CHECK (source_account IN ('cash', 'wave', 'orange_money', 'moov_money', 'bank', 'card')),
  destination_account text NOT NULL DEFAULT 'savings',
  amount numeric NOT NULL CHECK (amount > 0),
  owner text NOT NULL DEFAULT 'personal' CHECK (owner IN ('personal', 'bgi', 'aurel', 'onkoonnect')),
  comment text,
  date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for savings_transfers
ALTER TABLE savings_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_savings_transfers" ON savings_transfers FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_savings_transfers" ON savings_transfers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_savings_transfers" ON savings_transfers FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================
-- INVESTMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'other',
  category text,
  description text,
  owner text NOT NULL DEFAULT 'personal' CHECK (owner IN ('personal', 'bgi', 'aurel', 'onkoonnect')),
  invested_amount numeric NOT NULL CHECK (invested_amount > 0),
  current_value numeric NOT NULL CHECK (current_value >= 0),
  generated_income numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  acquisition_date timestamptz NOT NULL DEFAULT now(),
  closed_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for investments
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_investments" ON investments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_investments" ON investments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_investments" ON investments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_investments" ON investments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================
-- ASSETS
-- ============================================
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'other',
  owner text NOT NULL DEFAULT 'personal' CHECK (owner IN ('personal', 'bgi', 'aurel', 'onkoonnect')),
  value numeric NOT NULL CHECK (value >= 0),
  acquisition_date timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for assets
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_assets" ON assets FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_assets" ON assets FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_assets" ON assets FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_assets" ON assets FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================
-- LIABILITIES
-- ============================================
CREATE TABLE IF NOT EXISTS liabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'debt',
  owner text NOT NULL DEFAULT 'personal' CHECK (owner IN ('personal', 'bgi', 'aurel', 'onkoonnect')),
  amount numeric NOT NULL CHECK (amount > 0),
  remaining_amount numeric NOT NULL CHECK (remaining_amount >= 0),
  interest_rate numeric,
  due_date timestamptz,
  creditor text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for liabilities
ALTER TABLE liabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_liabilities" ON liabilities FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_liabilities" ON liabilities FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_liabilities" ON liabilities FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_liabilities" ON liabilities FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================
-- FINANCIAL OPPORTUNITIES
-- ============================================
CREATE TABLE IF NOT EXISTS financial_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  priority integer NOT NULL DEFAULT 1,
  is_read boolean NOT NULL DEFAULT false,
  is_actionable boolean NOT NULL DEFAULT false,
  action_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for financial_opportunities
ALTER TABLE financial_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_opportunities" ON financial_opportunities FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_opportunities" ON financial_opportunities FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_opportunities" ON financial_opportunities FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_opportunities" ON financial_opportunities FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_savings_goals_user ON savings_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_transfers_user ON savings_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_user ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_user ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_liabilities_user ON liabilities(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_user ON financial_opportunities(user_id);