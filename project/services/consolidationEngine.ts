import { supabase } from '@/lib/supabase';
import type { OwnerType, TransactionDB } from '@/types/database';
import { formatCurrency } from './parserService';
import {
  calculateFinancialSummary,
  calculateConsolidatedReport,
  getEnterpriseIncome,
  getPersonalExpenses,
  ALL_OWNERS,
} from './financialCalculator';

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
  organizationId: string | null;
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
  organizationId: string | null
): Promise<ConsolidatedData> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  let query = (supabase as SupabaseClient)
    .from('transactions')
    .select('*')
    .gte('date', startOfMonth.toISOString())
    .lte('date', endOfMonth.toISOString());

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

  const [savingsRes, investmentsRes, assetsRes, liabilitiesRes] = await Promise.all([
    (supabase as SupabaseClient).from('savings_transfers').select('amount, owner'),
    (supabase as SupabaseClient).from('investments').select('invested_amount, current_value, owner'),
    (supabase as SupabaseClient).from('assets').select('value, owner'),
    (supabase as SupabaseClient).from('liabilities').select('remaining_amount, owner'),
  ]);

  const txs = (transactions || []) as TransactionDB[];
  const savings = savingsRes.data || [];
  const investments = investmentsRes.data || [];
  const assets = assetsRes.data || [];
  const liabilities = liabilitiesRes.data || [];

  // Use centralized financial calculator
  const summary = calculateFinancialSummary(txs);

  const savingsTotal = savings.reduce((sum: number, s: any) => sum + Number(s.amount), 0);

  const investmentCapital = investments.reduce((sum: number, i: any) => sum + Number(i.invested_amount), 0);
  const investmentValue = investments.reduce((sum: number, i: any) => sum + Number(i.current_value), 0);

  const totalAssetsVal = assets.reduce((sum: number, a: any) => sum + Number(a.value), 0);
  const totalLiabilitiesVal = liabilities.reduce((sum: number, l: any) => sum + Number(l.remaining_amount), 0);
  const cashTotal = summary.accountBalances.reduce((sum, ab) => sum + ab.balance, 0);
  const netWorth = cashTotal + totalAssetsVal + investmentValue - totalLiabilitiesVal;

  return {
    organizationId,
    totalIncome: summary.totalIncome,
    totalExpenses: summary.totalExpenses,
    balance: summary.netCashFlow,
    savingsTotal,
    investmentCapital,
    investmentValue,
    netWorth,
    transactionCount: txs.length,
    transferAdjustment: summary.transferAdjustment,
  };
}

export async function getOrganizationStats(): Promise<{
  organizations: Organization[];
  stats: ConsolidatedData[];
  total: ConsolidatedData;
}> {
  const { data: orgs } = await getOrganizations();
  const organizations = orgs || [];

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const { data: transactions } = await (supabase as SupabaseClient)
    .from('transactions')
    .select('*')
    .gte('date', startOfMonth.toISOString())
    .lte('date', endOfMonth.toISOString());

  const txs = (transactions || []) as TransactionDB[];

  // Use centralized calculator for all spaces
  const report = calculateConsolidatedReport(txs);

  const stats: ConsolidatedData[] = [];
  let totalIncome = 0;
  let totalExpenses = 0;
  let totalSavings = 0;
  let totalInvestmentCapital = 0;
  let totalInvestmentValue = 0;

  for (const owner of ALL_OWNERS) {
    const data = report.bySpace[owner];
    if (data.transactionCount > 0) {
      stats.push({
        organizationId: owner,
        totalIncome: data.totalIncome,
        totalExpenses: data.totalExpenses,
        balance: data.netCashFlow,
        savingsTotal: 0,
        investmentCapital: 0,
        investmentValue: 0,
        netWorth: 0,
        transactionCount: data.transactionCount,
        transferAdjustment: 0,
      });
      totalIncome += data.totalIncome;
      totalExpenses += data.totalExpenses;
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
    totalIncome: report.global.totalIncome,
    totalExpenses: report.global.totalExpenses,
    balance: report.global.netCashFlow,
    savingsTotal: totalSavings,
    investmentCapital: totalInvestmentCapital,
    investmentValue: totalInvestmentValue,
    netWorth: 0,
    transactionCount: txs.length,
    transferAdjustment: report.global.transferAdjustment,
  };

  return { organizations, stats, total };
}
