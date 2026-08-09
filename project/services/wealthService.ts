import { supabase } from '@/lib/supabase';
import type {
  SavingsGoal,
  SavingsGoalInsert,
  SavingsGoalUpdate,
  SavingsTransfer,
  SavingsTransferInsert,
  Investment,
  InvestmentInsert,
  InvestmentUpdate,
  Asset,
  AssetInsert,
  Liability,
  LiabilityInsert,
  FinancialOpportunity,
  FinancialOpportunityInsert,
  OwnerType,
  AccountType,
} from '@/types/database';
import { formatCurrency } from './parserService';
import {
  calculateCentralizedNetWorth,
  calculateInvestmentPerformance as calcInvestmentPerformance,
} from './financialCalculator';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

// ============================================
// SAVINGS GOALS
// ============================================

export async function getSavingsGoals(): Promise<{ data: SavingsGoal[] | null; error: string | null }> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('savings_goals')
    .select('*')
    .order('priority', { ascending: true });

  if (error) return { data: null, error: error.message };
  return { data: data as SavingsGoal[], error: null };
}

export async function addSavingsGoal(goal: SavingsGoalInsert): Promise<{ data: SavingsGoal | null; error: string | null }> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('savings_goals')
    .insert([goal])
    .select()
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data as SavingsGoal, error: null };
}

export async function updateSavingsGoal(id: string, updates: SavingsGoalUpdate): Promise<{ data: SavingsGoal | null; error: string | null }> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('savings_goals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data as SavingsGoal, error: null };
}

export async function deleteSavingsGoal(id: string): Promise<{ error: string | null }> {
  const { error } = await (supabase as SupabaseClient)
    .from('savings_goals')
    .delete()
    .eq('id', id);

  return { error: error?.message || null };
}

// ============================================
// SAVINGS TRANSFERS
// ============================================

export async function getSavingsTransfers(): Promise<{ data: SavingsTransfer[] | null; error: string | null }> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('savings_transfers')
    .select('*, goal:savings_goals(name, target_amount)')
    .order('date', { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: data as SavingsTransfer[], error: null };
}

export async function addSavingsTransfer(transfer: SavingsTransferInsert): Promise<{ data: SavingsTransfer | null; error: string | null }> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('savings_transfers')
    .insert([transfer])
    .select()
    .maybeSingle();

  if (error) return { data: null, error: error.message };

  // Update goal current_amount if goal_id is provided
  if (transfer.goal_id && data) {
    const { data: goal } = await (supabase as SupabaseClient)
      .from('savings_goals')
      .select('current_amount')
      .eq('id', transfer.goal_id)
      .maybeSingle();

    if (goal) {
      await (supabase as SupabaseClient)
        .from('savings_goals')
        .update({ current_amount: Number(goal.current_amount) + Number(transfer.amount) })
        .eq('id', transfer.goal_id);
    }
  }

  return { data: data as SavingsTransfer, error: null };
}

// ============================================
// INVESTMENTS
// ============================================

export const INVESTMENT_TYPES = {
  stocks: { label: 'Actions', icon: 'TrendingUp', color: '#3B82F6' },
  brvm: { label: 'BRVM', icon: 'BarChart2', color: '#10B981' },
  real_estate: { label: 'Immobilier', icon: 'Building', color: '#8B5CF6' },
  land: { label: 'Terrain', icon: 'Map', color: '#F59E0B' },
  business: { label: 'Commerce', icon: 'Store', color: '#EC4899' },
  aquaculture: { label: 'Pisciculture', icon: 'Fish', color: '#06B6D4' },
  agriculture: { label: 'Agriculture', icon: 'Leaf', color: '#22C55E' },
  livestock: { label: 'Elevage', icon: 'Bird', color: '#F97316' },
  company: { label: 'Entreprise', icon: 'Briefcase', color: '#6366F1' },
  crypto: { label: 'Crypto-actifs', icon: 'Bitcoin', color: '#FCD34D' },
  gold: { label: 'Or', icon: 'Gem', color: '#D97706' },
  equipment: { label: 'Equipements professionnels', icon: 'Wrench', color: '#64748B' },
  other: { label: 'Autres', icon: 'Package', color: '#9CA3AF' },
} as const;

export type InvestmentTypeKey = keyof typeof INVESTMENT_TYPES;

export async function getInvestments(): Promise<{ data: Investment[] | null; error: string | null }> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('investments')
    .select('*')
    .order('acquisition_date', { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: data as Investment[], error: null };
}

export async function addInvestment(investment: InvestmentInsert): Promise<{ data: Investment | null; error: string | null }> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('investments')
    .insert([investment])
    .select()
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data as Investment, error: null };
}

export async function updateInvestment(id: string, updates: InvestmentUpdate): Promise<{ data: Investment | null; error: string | null }> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('investments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data as Investment, error: null };
}

export async function deleteInvestment(id: string): Promise<{ error: string | null }> {
  const { error } = await (supabase as SupabaseClient)
    .from('investments')
    .delete()
    .eq('id', id);

  return { error: error?.message || null };
}

export function calculateInvestmentPerformance(investment: Investment) {
  const invested = Number(investment.invested_amount);
  const current = Number(investment.current_value);
  const performance = invested > 0 ? ((current - invested) / invested) * 100 : 0;
  const gain = current - invested;
  const gainOrLoss = gain >= 0 ? 'gain' : 'loss';

  return {
    performance,
    gain: Math.abs(gain),
    gainOrLoss,
    formattedPerformance: `${performance >= 0 ? '+' : ''}${performance.toFixed(1)}%`,
    formattedGain: `${gain >= 0 ? '+' : '-'}${formatCurrency(Math.abs(gain))}`,
  };
}

// ============================================
// ASSETS
// ============================================

export const ASSET_TYPES = {
  cash: { label: 'Especes', icon: 'Wallet', color: '#22C55E' },
  bank: { label: 'Compte bancaire', icon: 'Landmark', color: '#3B82F6' },
  wave: { label: 'Wave', icon: 'Smartphone', color: '#1B4DFF' },
  orange_money: { label: 'Orange Money', icon: 'Smartphone', color: '#FF6600' },
  moov_money: { label: 'Moov Money', icon: 'Smartphone', color: '#00A3E0' },
  savings: { label: 'Epargne', icon: 'PiggyBank', color: '#059669' },
  investment: { label: 'Investissements', icon: 'TrendingUp', color: '#8B5CF6' },
  real_estate: { label: 'Immobilier', icon: 'Building', color: '#EC4899' },
  vehicle: { label: 'Vehicules', icon: 'Car', color: '#F59E0B' },
  equipment: { label: 'Equipements', icon: 'Wrench', color: '#64748B' },
  receivable: { label: 'Creances', icon: 'HandCoins', color: '#06B6D4' },
  other: { label: 'Autres actifs', icon: 'Package', color: '#9CA3AF' },
} as const;

export type AssetTypeKey = keyof typeof ASSET_TYPES;

export async function getAssets(): Promise<{ data: Asset[] | null; error: string | null }> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('assets')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: data as Asset[], error: null };
}

export async function addAsset(asset: AssetInsert): Promise<{ data: Asset | null; error: string | null }> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('assets')
    .insert([asset])
    .select()
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data as Asset, error: null };
}

export async function deleteAsset(id: string): Promise<{ error: string | null }> {
  const { error } = await (supabase as SupabaseClient)
    .from('assets')
    .delete()
    .eq('id', id);

  return { error: error?.message || null };
}

// ============================================
// LIABILITIES
// ============================================

export const LIABILITY_TYPES = {
  debt: { label: 'Dette', icon: 'CreditCard', color: '#DC2626' },
  loan: { label: 'Emprunt', icon: 'Banknote', color: '#EF4444' },
  overdraft: { label: 'Decouvert', icon: 'AlertTriangle', color: '#F97316' },
  credit: { label: 'Credit', icon: 'Receipt', color: '#F59E0B' },
  other: { label: 'Autres obligations', icon: 'FileX', color: '#9CA3AF' },
} as const;

export type LiabilityTypeKey = keyof typeof LIABILITY_TYPES;

export async function getLiabilities(): Promise<{ data: Liability[] | null; error: string | null }> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('liabilities')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return { data: null, error: error.message };
  return { data: data as Liability[], error: null };
}

export async function addLiability(liability: LiabilityInsert): Promise<{ data: Liability | null; error: string | null }> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('liabilities')
    .insert([liability])
    .select()
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data as Liability, error: null };
}

export async function deleteLiability(id: string): Promise<{ error: string | null }> {
  const { error } = await (supabase as SupabaseClient)
    .from('liabilities')
    .delete()
    .eq('id', id);

  return { error: error?.message || null };
}

// ============================================
// NET WORTH CALCULATION
// ============================================

export interface NetWorthData {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  assetsByType: { type: string; amount: number; percentage: number }[];
  liabilitiesByType: { type: string; amount: number; percentage: number }[];
  savingsTotal: number;
  investmentCapital: number;
  investmentValue: number;
  investmentIncome: number;
  investmentPerformance: number;
}

export async function calculateNetWorth(): Promise<NetWorthData> {
  // Utiliser le calculateur centralisé (Cash + Actifs + Investissements - Passifs)
  const centralized = await calculateCentralizedNetWorth();

  const [assetsRes, liabilitiesRes, savingsRes, investmentsRes] = await Promise.all([
    getAssets(),
    getLiabilities(),
    getSavingsTransfers(),
    getInvestments(),
  ]);

  const assets = assetsRes.data || [];
  const liabilities = liabilitiesRes.data || [];
  const savings = savingsRes.data || [];
  const investments = investmentsRes.data || [];

  const totalAssets = assets.reduce((sum, a) => sum + Number(a.value), 0);
  const totalLiabilities = liabilities.reduce((sum, l) => sum + Number(l.remaining_amount), 0);
  const savingsTotal = savings.reduce((sum, s) => sum + Number(s.amount), 0);
  const investmentCapital = centralized.investedCapital;
  const investmentValue = centralized.investmentsValue;
  const investmentIncome = investments.reduce((sum, i) => sum + Number(i.generated_income), 0);
  const netWorth = centralized.netWorth;

  // Group assets by type
  const assetsByTypeMap = new Map<string, number>();
  assets.forEach((a) => {
    const current = assetsByTypeMap.get(a.type) || 0;
    assetsByTypeMap.set(a.type, current + Number(a.value));
  });

  const assetsByType = Array.from(assetsByTypeMap.entries())
    .map(([type, amount]) => ({
      type,
      amount,
      percentage: totalAssets > 0 ? Math.round((amount / totalAssets) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Group liabilities by type
  const liabilitiesByTypeMap = new Map<string, number>();
  liabilities.forEach((l) => {
    const current = liabilitiesByTypeMap.get(l.type) || 0;
    liabilitiesByTypeMap.set(l.type, current + Number(l.remaining_amount));
  });

  const liabilitiesByType = Array.from(liabilitiesByTypeMap.entries())
    .map(([type, amount]) => ({
      type,
      amount,
      percentage: totalLiabilities > 0 ? Math.round((amount / totalLiabilities) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const investmentPerformance = investmentCapital > 0
    ? ((investmentValue - investmentCapital) / investmentCapital) * 100
    : 0;

  return {
    totalAssets,
    totalLiabilities,
    netWorth,
    assetsByType,
    liabilitiesByType,
    savingsTotal,
    investmentCapital,
    investmentValue,
    investmentIncome,
    investmentPerformance,
  };
}

// ============================================
// FINANCIAL OPPORTUNITIES
// ============================================

export async function getFinancialOpportunities(): Promise<{ data: FinancialOpportunity[] | null; error: string | null }> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('financial_opportunities')
    .select('*')
    .order('priority', { ascending: true })
    .limit(10);

  if (error) return { data: null, error: error.message };
  return { data: data as FinancialOpportunity[], error: null };
}

export async function markOpportunityAsRead(id: string): Promise<{ error: string | null }> {
  const { error } = await (supabase as SupabaseClient)
    .from('financial_opportunities')
    .update({ is_read: true })
    .eq('id', id);

  return { error: error?.message || null };
}

export async function generateFinancialOpportunities(
  data: {
    bgiIncome: number;
    personalExpenses: number;
    savingsGoals: SavingsGoal[];
    netWorth: NetWorthData;
    disciplineStatus: string;
    savingsRate: number;
    investmentRate: number;
    monthlyIncome: number;
    passiveIncome: number;
  }
): Promise<void> {
  const opportunities: FinancialOpportunityInsert[] = [];

  data.savingsGoals.forEach((goal) => {
    const progress = (Number(goal.current_amount) / Number(goal.target_amount)) * 100;
    if (progress >= 100) {
      opportunities.push({
        type: 'savings_achieved',
        title: 'Objectif atteint!',
        message: `Bravo! Tu as atteint ton objectif "${goal.name}" de ${formatCurrency(Number(goal.target_amount))}.`,
        priority: 1,
        is_actionable: true,
        action_data: { goal_id: goal.id, type: 'create_new_goal' },
      });
    } else if (progress >= 80) {
      opportunities.push({
        type: 'savings_close',
        title: 'Objectif presque atteint',
        message: `Tu es a ${progress.toFixed(0)}% de ton objectif "${goal.name}". Plus que ${formatCurrency(Number(goal.target_amount) - Number(goal.current_amount))} a atteindre!`,
        priority: 2,
        is_actionable: true,
        action_data: { goal_id: goal.id, type: 'add_savings' },
      });
    }
  });

  if (data.disciplineStatus === 'conforme') {
    const availableToInvest = data.bgiIncome * 0.35 - data.personalExpenses;
    if (availableToInvest > 10000) {
      opportunities.push({
        type: 'investment_opportunity',
        title: "Opportunite d'investissement",
        message: `Tes depenses personnelles sont conformes. Tu peux investir ${formatCurrency(availableToInvest)} ce mois-ci.`,
        priority: 3,
        is_actionable: true,
        action_data: { amount: availableToInvest, type: 'invest' },
      });
    }
  } else if (data.disciplineStatus === 'attention') {
    const remaining = data.bgiIncome * 0.35 - data.personalExpenses;
    opportunities.push({
      type: 'discipline_warning',
      title: 'Attention a la discipline',
      message: `Tu approches de la limite de 35%. Il te reste ${formatCurrency(remaining)} avant depassement.`,
      priority: 2,
      is_actionable: false,
    });
  } else if (data.disciplineStatus === 'depassement') {
    opportunities.push({
      type: 'discipline_alert',
      title: 'Depassement detecte',
      message: 'Tes depenses personnelles depassent 35% des revenus BGI. Reajuste ton budget.',
      priority: 1,
      is_actionable: false,
    });
  }

  if (data.netWorth.investmentPerformance > 15) {
    opportunities.push({
      type: 'investment_performance',
      title: 'Excellente performance',
      message: `Tes investissements affichent un rendement de ${data.netWorth.investmentPerformance.toFixed(1)}%`,
      priority: 4,
      is_actionable: false,
    });
  }

  if (data.passiveIncome > 0) {
    const passivePercentage = (data.passiveIncome / data.monthlyIncome) * 100;
    if (passivePercentage > 20) {
      opportunities.push({
        type: 'passive_income',
        title: 'Revenus passifs solides',
        message: `${passivePercentage.toFixed(0)}% de tes revenus sont passifs. Continue comme ca!`,
        priority: 4,
        is_actionable: false,
      });
    }
  }

  if (data.netWorth.netWorth > 0) {
    opportunities.push({
      type: 'net_worth',
      title: 'Patrimoine positif',
      message: `Ton patrimoine net s'eleve a ${formatCurrency(data.netWorth.netWorth)}`,
      priority: 5,
      is_actionable: false,
    });
  }

  for (const opp of opportunities) {
    await (supabase as SupabaseClient)
      .from('financial_opportunities')
      .insert([opp]);
  }
}

// ============================================
// KPI CALCULATIONS
// ============================================

export interface FinancialKPIs {
  savingsRate: number;
  investmentRate: number;
  personalExpenseRatio: number;
  netWorthToIncomeRatio: number;
  passiveIncome: number;
  monthlyNetWorthChange: number;
  averageInvestmentReturn: number;
}

export function calculateKPIs(data: {
  totalIncome: number;
  totalExpense: number;
  savingsTransfers: SavingsTransfer[];
  investments: Investment[];
  netWorth: NetWorthData;
}): FinancialKPIs {
  const savings = data.savingsTransfers.reduce((sum, s) => sum + Number(s.amount), 0);
  const activeInvestments = data.investments.filter((i) => i.status === 'active');
  const totalInvested = activeInvestments.reduce((sum, i) => sum + Number(i.invested_amount), 0);
  const totalCurrentValue = activeInvestments.reduce((sum, i) => sum + Number(i.current_value), 0);
  const passiveIncome = activeInvestments.reduce((sum, i) => sum + Number(i.generated_income), 0);

  const savingsRate = data.totalIncome > 0 ? (savings / data.totalIncome) * 100 : 0;
  const investmentRate = data.totalIncome > 0 ? (totalInvested / data.totalIncome) * 100 : 0;
  const averageInvestmentReturn = totalInvested > 0
    ? ((totalCurrentValue - totalInvested) / totalInvested) * 100
    : 0;
  const netWorthToIncomeRatio = data.totalIncome > 0
    ? data.netWorth.netWorth / (data.totalIncome * 12)
    : 0;

  return {
    savingsRate,
    investmentRate,
    personalExpenseRatio: 0,
    netWorthToIncomeRatio,
    passiveIncome,
    monthlyNetWorthChange: 0,
    averageInvestmentReturn,
  };
}
