-- Corrective migration: add the missing owner field expected by the app schema.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS owner text;

UPDATE public.transactions
SET owner = 'personal'
WHERE owner IS NULL;

ALTER TABLE public.transactions
  ALTER COLUMN owner SET DEFAULT 'personal';

ALTER TABLE public.transactions
  ALTER COLUMN owner SET NOT NULL;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_owner_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_owner_check
  CHECK (owner IN ('personal', 'bgi', 'aurel', 'onkoonnect'));

CREATE INDEX IF NOT EXISTS idx_transactions_owner
  ON public.transactions (user_id, owner);
