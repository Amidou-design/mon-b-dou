import { supabase } from '@/lib/supabase';
import type { OwnerType } from '@/types/database';
import { formatCurrency } from './parserService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export type OrganizationType = 'personal' | 'holding' | 'company' | 'subsidiary' | 'project' | 'investment';

export interface Organization {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  currency: string;
  type: OrganizationType;
  is_default: boolean;
  sort_order: number;
}

export interface ConsolidatedData {
  organizationId: string | null; // null = all organizations
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  savingsTotal: number;
  investmentCapital: number;
  investmentValue: number;
  netWorth: number;
  transactionCount: number;
  transferAdjustment: number;
}

export async function getOrganizations(): Promise<{ data: Organization[] | null; error: string | null }> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('organizations')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) return { data: null, error: error.message };
  return { data: data as Organization[], error: null };
}

export async function getDefaultOrganization(): Promise<Organization | null> {
  const { data } = await (supabase as SupabaseClient)
    .from('organizations')
    .select('*')
    .eq('is_default', true)
    .maybeSingle();

  return data as Organization | null;
}

export async function addOrganization(org: {
  name: string;
  type: OrganizationType;
  color?: string;
  icon?: string;
}): Promise<{ data: Organization | null; error: string | null }> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('organizations')
    .insert([{
      name: org.name,
      type: org.type,
      color: org.color || '#3B82F6',
      icon: org.icon || 'Building',
    }])
    .select()
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data as Organization, error: null };
}

export async function deleteOrganization(id: string): Promise<{ error: string | null }> {
  const { error } = await (supabase as SupabaseClient)
    .from('organizations')
    .delete()
    .eq('id', id);

  return { error: error?.message || null };
}

// Map old owner field to organization
export function ownerToOrganization(owner: OwnerType): string {
  const mapping: Record<OwnerType, string> = {
    personal: 'Personnel',
    bgi: 'BGI',
    aurel: 'AUREL',
    onkoonnect: "ON'KOONNECT",
  };
  return mapping[owner] || 'Personnel';
}

export async function getConsolidatedData(
  organizationId: string | null // null = all
): Promise<ConsolidatedData> {
  // Get current month bounds
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Fetch transactions
  let query = (supabase as SupabaseClient)
    .from('transactions')
    .select('*')
    .gte('date', startOfMonth.toISOString())
    .lte('date', endOfMonth.toISOString());

  // If specific organization, filter by owner
  if (organizationId) {
    const { data: org } = await (supabase as SupabaseClient)
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .maybeSingle();

    if (org) {
      const ownerMap: Record<string, OwnerType> = {
        Personnel: 'personal',
        BGI: 'bgi',
        AUREL: 'aurel',
        "ON'KOONNECT": 'onkoonnect',
      };
      const owner = ownerMap[org.name] || 'personal';
      query = query.eq('owner', owner);
    }
  }

  const { data: transactions } = await query;

  // Fetch savings, investments, assets, liabilities
  const [savingsRes, investmentsRes, assetsRes, liabilitiesRes] = await Promise.all([
    (supabase as SupabaseClient).from('savings_transfers').select('amount, owner'),
    (supabase as SupabaseClient).from('investments').select('invested_amount, current_value, owner'),
    (supabase as SupabaseClient).from('assets').select('value, owner'),
    (supabase as SupabaseClient).from('liabilities').select('remaining_amount, owner'),
  ]);

  const txs = transactions || [];
  const savings = savingsRes.data || [];
  const investments = investmentsRes.data || [];
  const assets = assetsRes.data || [];
  const liabilities = liabilitiesRes.data || [];

  // Calculate totals
  let totalIncome = 0;
  let totalExpenses = 0;
  let transferAdjustment = 0;

  txs.forEach((t: any) => {
    if (t.transaction_nature === 'transfer') {
      // Transfers between accounts/orgs should not be double-counted
      transferAdjustment += Number(t.amount);
    } else if (t.type === 'income') {
      totalIncome += Number(t.amount);
    } else {
      totalExpenses += Number(t.amount);
    }
  });

  // Calculate savings (exclude internal transfers in consolidation mode)
  const savingsTotal = savings.reduce((sum: number, s: any) => sum + Number(s.amount), 0);

  // Calculate investments
  const investmentCapital = investments.reduce((sum: number, i: any) => sum + Number(i.invested_amount), 0);
  const investmentValue = investments.reduce((sum: number, i: any) => sum + Number(i.current_value), 0);

  // Calculate net worth
  const totalAssets = assets.reduce((sum: number, a: any) => sum + Number(a.value), 0);
  const totalLiabilities = liabilities.reduce((sum: number, l: any) => sum + Number(l.remaining_amount), 0);
  const netWorth = totalAssets - totalLiabilities;

  return {
    organizationId,
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    savingsTotal,
    investmentCapital,
    investmentValue,
    netWorth,
    transactionCount: txs.length,
    transferAdjustment,
  };
}

export async function getOrganizationStats(): Promise<{
  organizations: Organization[];
  stats: ConsolidatedData[];
  total: ConsolidatedData;
}> {
  const { data: orgs } = await getOrganizations();
  const organizations = orgs || [];

  // Get consolidated data for each organization
  const stats: ConsolidatedData[] = [];
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalBalance = 0;
  let totalSavings = 0;
  let totalInvestmentCapital = 0;
  let totalInvestmentValue = 0;

  // Note: We need to get data per organization
  // For now, group by owner field
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const { data: transactions } = await (supabase as SupabaseClient)
    .from('transactions')
    .select('*')
    .gte('date', startOfMonth.toISOString())
    .lte('date', endOfMonth.toISOString());

  if (transactions) {
    const incomeByOwner: Record<string, number> = {};
    const expenseByOwner: Record<string, number> = {};

    transactions.forEach((t: any) => {
      if (t.type === 'income') {
        incomeByOwner[t.owner] = (incomeByOwner[t.owner] || 0) + Number(t.amount);
      } else if (t.type === 'expense') {
        expenseByOwner[t.owner] = (expenseByOwner[t.owner] || 0) + Number(t.amount);
      }
    });

    for (const [owner, income] of Object.entries(incomeByOwner)) {
      const expenses = expenseByOwner[owner] || 0;
      stats.push({
        organizationId: owner,
        totalIncome: income,
        totalExpenses: expenses,
        balance: income - expenses,
        savingsTotal: 0,
        investmentCapital: 0,
        investmentValue: 0,
        netWorth: 0,
        transactionCount: 0,
        transferAdjustment: 0,
      });
      totalIncome += income;
      totalExpenses += expenses;
      totalBalance += income - expenses;
    }
  }

  // Get savings and investments totals
  const { data: savingsTx } = await (supabase as SupabaseClient)
    .from('savings_transfers')
    .select('amount');
  totalSavings = (savingsTx || []).reduce((sum: number, s: any) => sum + Number(s.amount), 0);

  const { data: investments } = await (supabase as SupabaseClient)
    .from('investments')
    .select('invested_amount, current_value');
  investments?.forEach((i: any) => {
    totalInvestmentCapital += Number(i.invested_amount);
    totalInvestmentValue += Number(i.current_value);
  });

  const total: ConsolidatedData = {
    organizationId: null,
    totalIncome,
    totalExpenses,
    balance: totalBalance,
    savingsTotal: totalSavings,
    investmentCapital: totalInvestmentCapital,
    investmentValue: totalInvestmentValue,
    netWorth: 0,
    transactionCount: transactions?.length || 0,
    transferAdjustment: 0,
  };

  return { organizations, stats, total };
}
