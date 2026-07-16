import type { TransactionDB, OwnerType } from '@/types/database';

export type LifeStatus = 'over' | 'balanced' | 'under';

export interface SpaceStats {
  owner: OwnerType;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  transactionCount: number;
}

export interface DashboardStats {
  // Per-space stats
  personalStats: SpaceStats;
  bgiStats: SpaceStats;
  // Global totals
  globalStats: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    transactionCount: number;
  };
  // Financial discipline
  discipline: {
    limit: number; // 35% of BGI income
    personalExpenses: number;
    usedPercentage: number;
    status: 'conforme' | 'attention' | 'depassement';
    emoji: string;
    color: string;
  } | null;
  // Category breakdown for current month
  categoryBreakdown: CategoryBreakdown[];
  accountBreakdown: AccountBreakdown[];
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

export function calculateSpaceStats(
  transactions: TransactionDB[],
  owner: OwnerType
): SpaceStats {
  const ownerTransactions = transactions.filter((t) => t.owner === owner);
  const totalIncome = ownerTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = ownerTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  return {
    owner,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    transactionCount: ownerTransactions.length,
  };
}

export function calculateFinancialDiscipline(
  bgiIncome: number,
  personalExpenses: number
): DashboardStats['discipline'] {
  if (bgiIncome === 0) {
    return null;
  }

  const limit = bgiIncome * 0.35;
  const usedPercentage = Math.round((personalExpenses / limit) * 100);

  let status: 'conforme' | 'attention' | 'depassement';
  let emoji: string;
  let color: string;

  if (usedPercentage < 80) {
    status = 'conforme';
    emoji = '🟢';
    color = '#22C55E';
  } else if (usedPercentage <= 100) {
    status = 'attention';
    emoji = '🟠';
    color = '#F59E0B';
  } else {
    status = 'depassement';
    emoji = '🔴';
    color = '#DC2626';
  }

  return {
    limit,
    personalExpenses,
    usedPercentage,
    status,
    emoji,
    color,
  };
}

export function calculateCategoryBreakdown(
  transactions: TransactionDB[]
): CategoryBreakdown[] {
  const expenses = transactions.filter((t) => t.type === 'expense');
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

export function calculateAccountBreakdown(
  transactions: TransactionDB[]
): AccountBreakdown[] {
  const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

  if (total === 0) return [];

  const accountMap = new Map<string, number>();

  for (const t of transactions) {
    const current = accountMap.get(t.account) || 0;
    accountMap.set(t.account, current + Number(t.amount));
  }

  const breakdown: AccountBreakdown[] = [];
  accountMap.forEach((amount, account) => {
    breakdown.push({
      account,
      amount,
      percentage: Math.round((amount / total) * 100),
    });
  });

  return breakdown.sort((a, b) => b.amount - a.amount);
}

export function calculateDashboardStats(
  transactions: TransactionDB[]
): DashboardStats {
  // Calculate per-space stats
  const personalStats = calculateSpaceStats(transactions, 'personal');
  const bgiStats = calculateSpaceStats(transactions, 'bgi');

  // Calculate global totals
  const globalStats = {
    totalIncome: personalStats.totalIncome + bgiStats.totalIncome,
    totalExpense: personalStats.totalExpense + bgiStats.totalExpense,
    balance: personalStats.balance + bgiStats.balance,
    transactionCount: transactions.length,
  };

  // Calculate financial discipline
  const discipline = calculateFinancialDiscipline(
    bgiStats.totalIncome,
    personalStats.totalExpense
  );

  // Category and account breakdowns
  const categoryBreakdown = calculateCategoryBreakdown(transactions);
  const accountBreakdown = calculateAccountBreakdown(transactions);

  return {
    personalStats,
    bgiStats,
    globalStats,
    discipline,
    categoryBreakdown,
    accountBreakdown,
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
