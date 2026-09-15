-- Add the nullable Accounts V1 link while preserving the legacy account field.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS account_id uuid NULL
  REFERENCES public.accounts(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_account_id
  ON public.transactions(account_id);