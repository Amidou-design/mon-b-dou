/*
# V1.3: Decisions financieres, Mode CEO et Calendrier financier

This migration adds:
- Decision tracking for transactions
- Organizations for multi-entity management
- Financial events for calendar and recurring operations
- Forecasts for cash predictions
*/

-- Add decision_reason to transactions
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS decision_reason text;

-- Check constraint for decision_reason
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_decision_reason_check;
ALTER TABLE transactions 
ADD CONSTRAINT transactions_decision_reason_check 
CHECK (decision_reason IS NULL OR decision_reason IN ('need', 'investment', 'opportunity', 'pleasure', 'urgency', 'unforeseen', 'training', 'family', 'business', 'other'));

-- Add recurring info to transactions
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS recurring_frequency text;

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_recurring_frequency_check;
ALTER TABLE transactions 
ADD CONSTRAINT transactions_recurring_frequency_check 
CHECK (recurring_frequency IS NULL OR recurring_frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'semiannual', 'annual'));

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS recurring_end_date timestamptz;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS parent_transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL;

-- ============================================
-- ORGANIZATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#3B82F6',
  icon text DEFAULT 'Building',
  currency text DEFAULT 'XOF',
  type text NOT NULL DEFAULT 'personal' CHECK (type IN ('personal', 'holding', 'company', 'subsidiary', 'project', 'investment')),
  is_default boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_organizations" ON organizations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_organizations" ON organizations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_organizations" ON organizations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_organizations" ON organizations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================
-- FINANCIAL EVENTS (Calendar)
-- ============================================
CREATE TABLE IF NOT EXISTS financial_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  event_type text NOT NULL CHECK (event_type IN ('income', 'expense', 'savings', 'investment', 'transfer')),
  amount numeric NOT NULL CHECK (amount > 0),
  expected_date timestamptz NOT NULL,
  is_recurring boolean DEFAULT false,
  recurring_frequency text CHECK (recurring_frequency IS NULL OR recurring_frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'semiannual', 'annual')),
  recurring_end_date timestamptz,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  linked_transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for financial_events
ALTER TABLE financial_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_events" ON financial_events FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_events" ON financial_events FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_events" ON financial_events FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_events" ON financial_events FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================
-- FINANCIAL FORECASTS
-- ============================================
CREATE TABLE IF NOT EXISTS financial_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  forecast_date timestamptz NOT NULL,
  forecast_type text NOT NULL CHECK (forecast_type IN ('7days', '30days', 'end_of_month')),
  estimated_balance numeric NOT NULL,
  expected_income numeric NOT NULL DEFAULT 0,
  expected_expenses numeric NOT NULL DEFAULT 0,
  confidence_level numeric CHECK (confidence_level >= 0 AND confidence_level <= 100),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for financial_forecasts
ALTER TABLE financial_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_forecasts" ON financial_forecasts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_forecasts" ON financial_forecasts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_forecasts" ON financial_forecasts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================
-- INSIGHTS HISTORY
-- ============================================
CREATE TABLE IF NOT EXISTS insights_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  category text NOT NULL CHECK (category IN ('behavior', 'discipline', 'patrimony', 'savings', 'investment', 'forecast', 'opportunity')),
  importance integer DEFAULT 1 CHECK (importance >= 1 AND importance <= 5),
  related_data jsonb,
  is_read boolean DEFAULT false,
  is_dismissed boolean DEFAULT false,
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for insights_history
ALTER TABLE insights_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_insights" ON insights_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_insights" ON insights_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_insights" ON insights_history FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_insights" ON insights_history FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_organizations_user ON organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_events_user ON financial_events(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_events_date ON financial_events(expected_date);
CREATE INDEX IF NOT EXISTS idx_financial_forecasts_user ON financial_forecasts(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_history_user ON insights_history(user_id);

-- Create default organizations for existing users
INSERT INTO organizations (user_id, name, type, color, icon, is_default, sort_order)
SELECT 
  id as user_id,
  'Personnel' as name,
  'personal' as type,
  '#3B82F6' as color,
  'User' as icon,
  true as is_default,
  0 as sort_order
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM organizations WHERE user_id = auth.users.id AND type = 'personal'
)
ON CONFLICT DO NOTHING;

INSERT INTO organizations (user_id, name, type, color, icon, is_default, sort_order)
SELECT 
  id as user_id,
  'BGI' as name,
  'company' as type,
  '#8B5CF6' as color,
  'Building2' as icon,
  false as is_default,
  1 as sort_order
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM organizations WHERE user_id = auth.users.id AND name = 'BGI'
)
ON CONFLICT DO NOTHING;