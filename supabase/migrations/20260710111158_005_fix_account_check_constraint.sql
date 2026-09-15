-- Fix: the app supports 'bank' and 'card' account types but the CHECK
-- constraint only allowed cash/wave/orange_money/moov_money, causing
-- inserts with bank/card to fail with a constraint violation.
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_account_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_account_check
  CHECK (account = ANY (ARRAY['cash'::text, 'wave'::text, 'orange_money'::text, 'moov_money'::text, 'bank'::text, 'card'::text]));
