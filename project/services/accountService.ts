import { supabase } from '@/lib/supabase';
import type { AccountType } from '@/types/accounts';
import type {
  Account,
  AccountInsert,
  AccountUpdate,
  AccountProvider,
} from '@/types/database';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ============================================
// 1. GET ALL ACCOUNTS
// Retourne tous les comptes de l'utilisateur connecté.
// Tri : created_at DESC
// ============================================
export async function getAccounts(): Promise<{ data: Account[] | null; error: string | null }> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: data as Account[], error: null };
}

// ============================================
// 2. GET ACTIVE ACCOUNTS
// Retourne uniquement les comptes actifs (is_active = true)
// ============================================
export async function getActiveAccounts(): Promise<{ data: Account[] | null; error: string | null }> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('accounts')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: data as Account[], error: null };
}

// ============================================
// 3. GET ACCOUNT BY ID
// Retourne un compte précis.
// ============================================
export async function getAccountById(id: string): Promise<{ data: Account | null; error: string | null }> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('accounts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data as Account | null, error: null };
}

// ============================================
// 4. CREATE ACCOUNT
// Crée un nouveau compte.
// Validation : name obligatoire, account_type obligatoire,
//              currency par défaut XOF, provider nullable
// ============================================
export async function createAccount(
  account: Omit<AccountInsert, 'user_id'>
): Promise<{ data: Account | null; error: string | null }> {
  // Validation client
  if (!account.name || account.name.trim() === '') {
    return { data: null, error: 'Le nom du compte est obligatoire' };
  }
  if (!account.account_type) {
    return { data: null, error: "Le type de compte est obligatoire" };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: 'Tu dois etre connecte pour creer un compte' };
  }

  const { data, error } = await (supabase as SupabaseClient)
    .from('accounts')
    .insert([{
      ...account,
      user_id: userId,
      currency: account.currency || 'XOF',
    }])
    .select()
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data as Account | null, error: null };
}

// ============================================
// 5. UPDATE ACCOUNT
// Modifie : name, provider, description, is_active
// ============================================
export async function updateAccount(
  id: string,
  data: Pick<AccountUpdate, 'name' | 'provider' | 'description' | 'is_active'>
): Promise<{ data: Account | null; error: string | null }> {
  const { data: updated, error } = await (supabase as SupabaseClient)
    .from('accounts')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: updated as Account | null, error: null };
}

// ============================================
// 6. DEACTIVATE ACCOUNT
// Ne supprime pas physiquement. Passe is_active = false.
// ============================================
export async function deactivateAccount(id: string): Promise<{ data: Account | null; error: string | null }> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('accounts')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data as Account | null, error: null };
}

// ============================================
// 7. GET ACCOUNTS BY TYPE
// Filtrer par type de compte.
// ============================================
export async function getAccountsByType(
  account_type: AccountType
): Promise<{ data: Account[] | null; error: string | null }> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('accounts')
    .select('*')
    .eq('account_type', account_type)
    .order('created_at', { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: data as Account[], error: null };
}

// ============================================
// 8. GET ACCOUNT BALANCE
//
// IMPORTANT — V1 (structure préparatoire) :
// Le champ transactions.account_id n'existe PAS encore dans la table
// transactions. Le calcul réel du solde ne peut donc pas être effectué.
//
// On retourne un placeholder propre indiquant que le calcul réel sera
// connecté après la migration transaction.account_id.
// ============================================

export interface AccountBalance {
  accountId: string;
  balance: number;
  currency: string;
  isPlaceholder: boolean;
  message: string;
}

export async function getAccountBalance(accountId: string): Promise<{ data: AccountBalance | null; error: string | null }> {
  // Récupérer le compte pour connaître sa devise
  const { data: account } = await getAccountById(accountId);
  if (!account) {
    return { data: null, error: 'Compte introuvable' };
  }

  return {
    data: {
      accountId,
      balance: 0,
      currency: account.currency || 'XOF',
      isPlaceholder: true,
      message:
        'Calcul du solde non disponible en V1 : le champ transactions.account_id ' +
        'n\'existe pas encore. Le solde réel sera connecté après la migration ' +
        'transaction.account_id.',
    },
    error: null,
  };
}

// Ré-export pour compatibilité avec les appels typés
export type { Account, AccountInsert, AccountUpdate, AccountProvider };
