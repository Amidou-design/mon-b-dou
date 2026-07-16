/*
# Create Transactions and Profiles Tables

This migration sets up the core database schema for Mon Bédou, a personal finance app.

## Tables Created

### profiles
- `id` (uuid, primary key, references auth.users)
- `email` (text, unique)
- `full_name` (text, optional)
- `avatar_url` (text, optional)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### transactions
- `id` (uuid, primary key)
- `user_id` (uuid, not null, references auth.users with CASCADE delete)
- `amount` (decimal, not null)
- `type` (text, not null) - 'income' or 'expense'
- `category` (text, not null) - transport, alimentation, revenu, autres, etc.
- `description` (text, not null)
- `account` (text, not null, default 'cash') - cash, wave, orange_money, moov_money
- `date` (timestamp, not null, default now())
- `created_at` (timestamp, default now())

## Security

1. Enable RLS on both tables
2. Profiles: users can only read/update their own profile
3. Transactions: full CRUD scoped to authenticated user's own data
4. user_id defaults to auth.uid() for automatic ownership on insert

## Indexes
- idx_transactions_user_date: optimize queries filtering by user and sorting by date
- idx_transactions_user_type: optimize income/expense calculations
- idx_transactions_user_category: optimize category breakdowns
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  amount decimal(12,2) NOT NULL CHECK (amount > 0),
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  category text NOT NULL,
  description text NOT NULL,
  account text NOT NULL DEFAULT 'cash' CHECK (account IN ('cash', 'wave', 'orange_money', 'moov_money')),
  date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
CREATE POLICY "users_read_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
CREATE POLICY "users_update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users_insert_own_profile" ON profiles;
CREATE POLICY "users_insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- Transactions policies (full CRUD for authenticated users, scoped to own data)
DROP POLICY IF EXISTS "users_read_own_transactions" ON transactions;
CREATE POLICY "users_read_own_transactions" ON transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_insert_own_transactions" ON transactions;
CREATE POLICY "users_insert_own_transactions" ON transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_transactions" ON transactions;
CREATE POLICY "users_update_own_transactions" ON transactions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_transactions" ON transactions;
CREATE POLICY "users_delete_own_transactions" ON transactions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON transactions(user_id, category);

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto-creating profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();