/**
 * DASHBOARD SERVICE — FIABILISÉ V1.1
 * 
 * Ce service utilise désormais le Financial Calculator centralisé
 * pour garantir la cohérence avec tous les autres services.
 * 
 * Changements clés :
 * 1. Tous les 4 espaces (personal, bgi, aurel, onkoonnect) sont calculés
 * 2. Les transferts ne sont plus comptés comme revenus/dépenses
 * 3. Les soldes par compte sont disponibles
 * 4. La règle des 35% utilise les revenus d'entreprise consolidés
 */

import type { TransactionDB, OwnerType } from '@/types/database';
import {
  calculateSpaceFinancialData,
  calculateAccountBalances as calcAccountBalances,
  calculateDiscipline35Percent,
  getEnterpriseIncome,
  getPersonalExpenses,
  type SpaceFinancialData,
} from './financialCalculator';

export type LifeStatus = 'over' | 'balanced' | 'under';

export interface SpaceStats {
  owner: OwnerType;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  transactionCount: number;
}

export interface DashboardStats {
  personalStats: SpaceStats;
  bgiStats: SpaceStats;
  aurelStats: SpaceStats;
  onkoonnectStats: SpaceStats;
  allSpacesStats: SpaceStats[];
  globalStats: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    transactionCount: number;
  };
  discipline: {
    limit: number;
    personalExpenses: number;
    usedPercentage: number;
    status: 'conforme' | 'attention' | 'depassement' | 'inactif';
    emoji: string;
    color: string;
    availableAmount: number;
    enterpriseIncome: number;
  };
  categoryBreakdown: CategoryBreakdown[];
  accountBreakdown: AccountBreakdown[];
  accountBalances: {
    account: string;
    label: string;
    balance: number;
    color: string;
    percentage: number;
  }[];
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface AccountBreakdown {
  account: string;
  amount: number;
  percentage: number;
}

export const OWNER_CONFIG = {
  personal: { label: 'Personnel', color: '#3B82F6' },
  bgi: { label: 'BGI', color: '#8B5CF6' },
  aurel: { label: 'AUREL', color: '#F59E0B' },
  onkoonnect: { label: "ON'KOONNECT", color: '#10B981' },
} as const;

/**
 * Calcule les stats pour un espace — version fiabilisée.
 * Les transferts ne sont plus comptés comme revenus/dépenses.
 */
export function calculateSpaceStats(
  transactions: TransactionDB[],
  owner: OwnerType
): SpaceStats {
  const data = calculateSpaceFinancialData(transactions, owner);
  return {
    owner: data.owner,
    totalIncome: data.totalIncome,
    totalExpense: data.totalExpenses,
    balance: data.netCashFlow,
    transactionCount: data.transactionCount,
  };
}

/**
 * Règle des 35% — version fiabilisée.
 * Utilise TOUS les revenus d'entreprise (BGI + AUREL + ON'KOONNECT)
 * au lieu de seulement BGI.
 */
export function calculateFinancialDiscipline(
  transactions: TransactionDB[]
): DashboardStats['discipline'] {
  const enterpriseIncome = getEnterpriseIncome(transactions);
  const personalExpenses = getPersonalExpenses(transactions);

  const result = calculateDiscipline35Percent(enterpriseIncome, personalExpenses);

  return {
    limit: result.limit,
    personalExpenses: result.personalExpenses,
    usedPercentage: result.usedPercentage,
    status: result.status,
    emoji: result.emoji,
    color: result.color,
    availableAmount: result.availableAmount,
    enterpriseIncome,
  };
}

/**
 * Calcul des dépenses par catégorie — version fiabilisée.
 */
export function calculateCategoryBreakdown(
  transactions: TransactionDB[]
): CategoryBreakdown[] {
  const expenses = transactions.filter(
    (t) =>
      t.type === 'expense' &&
      t.transaction_nature !== 'transfer' &&
      t.transaction_nature !== 'savings' &&
      t.transaction_nature !== 'investment'
  );
  const totalExpense = expenses.reduce((sum, t) => sum + Number(t.amount), 0);
  if (totalExpense === 0) return [];

  const categoryMap = new Map<string, { amount: number; count: number }>();
  for (const t of expenses) {
    const current = categoryMap.get(t.category) || { amount: 0, count: 0 };
    categoryMap.set(t.category, {
      amount: current.amount + Number(t.amount),
      count: current.count + 1,
    });
  }

  const breakdown: CategoryBreakdown[] = [];
  categoryMap.forEach((value, key) => {
    breakdown.push({
      category: key,
      amount: value.amount,
      percentage: Math.round((value.amount / totalExpense) * 100),
      count: value.count,
    });
  });
  return breakdown.sort((a, b) => b.amount - a.amount);
}

/**
 * Répartition par compte — version fiabilisée.
 */
export function calculateAccountBreakdown(
  transactions: TransactionDB[]
): AccountBreakdown[] {
  const nonTransferTxs = transactions.filter(
    (t) => t.transaction_nature !== 'transfer'
  );
  const total = nonTransferTxs.reduce((sum, t) => sum + Number(t.amount), 0);
  if (total === 0) return [];

  const accountMap = new Map<string, number>();
  for (const t of nonTransferTxs) {
    const current = accountMap.get(t.account) || 0;
    if (t.type === 'income') {
      accountMap.set(t.account, current + Number(t.amount));
    } else {
      accountMap.set(t.account, current - Number(t.amount));
    }
  }

  const breakdown: AccountBreakdown[] = [];
  accountMap.forEach((amount, account) => {
    breakdown.push({ account, amount, percentage: Math.round((amount / total) * 100) });
  });
  return breakdown.sort((a, b) => b.amount - a.amount);
}

/**
 * Dashboard Stats — VERSION FIABILISÉE.
 * Inclut PERSONAL, BGI, AUREL, ON'KOONNECT.
 * Les transferts sont exclus du P&L.
 */
export function calculateDashboardStats(
  transactions: TransactionDB[]
): DashboardStats {
  const personalStats = calculateSpaceStats(transactions, 'personal');
  const bgiStats = calculateSpaceStats(transactions, 'bgi');
  const aurelStats = calculateSpaceStats(transactions, 'aurel');
  const onkoonnectStats = calculateSpaceStats(transactions, 'onkoonnect');

  const allSpacesStats = [personalStats, bgiStats, aurelStats, onkoonnectStats];

  const globalStats = {
    totalIncome:
      personalStats.totalIncome +
      bgiStats.totalIncome +
      aurelStats.totalIncome +
      onkoonnectStats.totalIncome,
    totalExpense:
      personalStats.totalExpense +
      bgiStats.totalExpense +
      aurelStats.totalExpense +
      onkoonnectStats.totalExpense,
    balance:
      personalStats.balance +
      bgiStats.balance +
      aurelStats.balance +
      onkoonnectStats.balance,
    transactionCount: transactions.length,
  };

  const discipline = calculateFinancialDiscipline(transactions);
  const categoryBreakdown = calculateCategoryBreakdown(transactions);
  const accountBreakdown = calculateAccountBreakdown(transactions);
  const accountBalances = calcAccountBalances(transactions).map((ab) => ({
    account: ab.account,
    label: ab.label,
    balance: ab.balance,
    color: ab.color,
    percentage: ab.percentage,
  }));

  return {
    personalStats,
    bgiStats,
    aurelStats,
    onkoonnectStats,
    allSpacesStats,
    globalStats,
    discipline,
    categoryBreakdown,
    accountBreakdown,
    accountBalances,
  };
}

export function getCurrentMonthBounds(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

export function filterTransactionsForCurrentMonth(
  transactions: TransactionDB[]
): TransactionDB[] {
  const { start, end } = getCurrentMonthBounds();
  return transactions.filter((t) => {
    const date = new Date(t.date);
    return date >= start && date <= end;
  });
}
