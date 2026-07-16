import { supabase } from '@/lib/supabase';
import type { OwnerType, AccountType, TransactionType, TransactionNatureType, DecisionReasonType, RecurringFrequencyType } from '@/types/database';

async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: TransactionType;
  category: string;
  description: string;
  account: AccountType;
  owner: OwnerType;
  transaction_nature: TransactionNatureType;
  decision_reason: DecisionReasonType | null;
  is_recurring: boolean;
  recurring_frequency: RecurringFrequencyType | null;
  recurring_end_date: string | null;
  parent_transaction_id: string | null;
  date: string;
  created_at: string;
}

export interface TransactionInsert {
  amount: number;
  type: TransactionType;
  category: string;
  description: string;
  account?: AccountType;
  owner?: OwnerType;
  transaction_nature?: TransactionNatureType;
  decision_reason?: DecisionReasonType | null;
  is_recurring?: boolean;
  recurring_frequency?: RecurringFrequencyType | null;
  recurring_end_date?: string | null;
  date?: string;
}

export interface TransactionUpdate {
  amount?: number;
  type?: TransactionType;
  category?: string;
  description?: string;
  account?: AccountType;
  owner?: OwnerType;
  date?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export async function addTransaction(
  transaction: TransactionInsert
): Promise<{ data: Transaction | null; error: string | null }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Tu dois etre connecte pour enregistrer une transaction' };
  }

  const { data, error } = await (supabase as SupabaseClient)
    .from('transactions')
    .insert([{ ...transaction, user_id: userId }])
    .select()
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as Transaction | null, error: null };
}

export async function updateTransaction(
  id: string,
  updates: TransactionUpdate
): Promise<{ data: Transaction | null; error: string | null }> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as Transaction | null, error: null };
}

export async function deleteTransaction(
  id: string
): Promise<{ error: string | null }> {
  const { error } = await (supabase as SupabaseClient)
    .from('transactions')
    .delete()
    .eq('id', id);

  return { error: error?.message || null };
}

export async function getTransactions(
  options?: {
    limit?: number;
    offset?: number;
    type?: TransactionType;
    category?: string;
    account?: string;
    owner?: OwnerType;
    startDate?: string;
    endDate?: string;
  }
): Promise<{ data: Transaction[] | null; error: string | null }> {
  let query = (supabase as SupabaseClient)
    .from('transactions')
    .select('*')
    .order('date', { ascending: false });

  if (options?.type) {
    query = query.eq('type', options.type);
  }

  if (options?.category) {
    query = query.eq('category', options.category);
  }

  if (options?.account) {
    query = query.eq('account', options.account);
  }

  if (options?.owner) {
    query = query.eq('owner', options.owner);
  }

  if (options?.startDate) {
    query = query.gte('date', options.startDate);
  }

  if (options?.endDate) {
    query = query.lte('date', options.endDate);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as Transaction[], error: null };
}

export function subscribeToTransactions(
  callback: (transactions: Transaction[]) => void
) {
  const channel = (supabase as SupabaseClient)
    .channel('transactions-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'transactions',
      },
      async () => {
        const { data } = await getTransactions();
        if (data) {
          callback(data);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function getTransactionsForPeriod(
  startDate: Date,
  endDate: Date,
  owner?: OwnerType
): Promise<{ data: Transaction[] | null; error: string | null }> {
  let query = (supabase as SupabaseClient)
    .from('transactions')
    .select('*')
    .gte('date', startDate.toISOString())
    .lte('date', endDate.toISOString())
    .order('date', { ascending: false });

  if (owner) {
    query = query.eq('owner', owner);
  }

  const { data, error } = await query;

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as Transaction[], error: null };
}

export async function getRecentTransactions(
  limit: number = 5
): Promise<{ data: Transaction[] | null; error: string | null }> {
  return getTransactions({ limit });
}
