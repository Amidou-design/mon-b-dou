import type { TransactionDB as Transaction } from '@/types/database';
import { formatCurrency } from './parserService';

export type DecisionReason =
  | 'need'
  | 'investment'
  | 'opportunity'
  | 'pleasure'
  | 'urgency'
  | 'unforeseen'
  | 'training'
  | 'family'
  | 'business'
  | 'other';

export const DECISION_REASONS: Record<DecisionReason, { label: string; color: string; icon: string }> = {
  need: { label: 'Besoin', color: '#3B82F6', icon: 'ShoppingCart' },
  investment: { label: 'Investissement', color: '#8B5CF6', icon: 'TrendingUp' },
  opportunity: { label: 'Opportunite', color: '#22C55E', icon: 'Sparkles' },
  pleasure: { label: 'Plaisir', color: '#EC4899', icon: 'Heart' },
  urgency: { label: 'Urgence', color: '#DC2626', icon: 'AlertTriangle' },
  unforeseen: { label: 'Imprevu', color: '#F59E0B', icon: 'HelpCircle' },
  training: { label: 'Formation', color: '#06B6D4', icon: 'GraduationCap' },
  family: { label: 'Famille', color: '#F97316', icon: 'Users' },
  business: { label: 'Business', color: '#6366F1', icon: 'Briefcase' },
  other: { label: 'Autre', color: '#9CA3AF', icon: 'MoreHorizontal' },
};

export interface DecisionAnalysis {
  totalExpenses: number;
  totalByReason: { reason: DecisionReason; amount: number; percentage: number; count: number }[];
  monthlyEvolution: { month: string; needs: number; pleasures: number; investments: number; others: number }[];
  impulsivityScore: number;
  investmentRatio: number;
  insights: string[];
}

export function analyzeDecisions(
  transactions: Transaction[],
  options?: { months?: number }
): DecisionAnalysis {
  const expenses = transactions.filter((t) => t.type === 'expense');
  const totalExpenses = expenses.reduce((sum, t) => sum + Number(t.amount), 0);

  // Group by decision reason
  const reasonMap = new Map<DecisionReason, { amount: number; count: number }>();

  expenses.forEach((t) => {
    const reason = (t.decision_reason as DecisionReason) || 'other';
    const current = reasonMap.get(reason) || { amount: 0, count: 0 };
    reasonMap.set(reason, {
      amount: current.amount + Number(t.amount),
      count: current.count + 1,
    });
  });

  const totalByReason = Array.from(reasonMap.entries())
    .map(([reason, data]) => ({
      reason,
      amount: data.amount,
      percentage: totalExpenses > 0 ? Math.round((data.amount / totalExpenses) * 100) : 0,
      count: data.count,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Calculate monthly evolution
  const monthlyData = new Map<string, { needs: number; pleasures: number; investments: number; others: number }>();
  const now = new Date();
  const monthsToAnalyze = options?.months || 6;

  for (let i = monthsToAnalyze - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyData.set(key, { needs: 0, pleasures: 0, investments: 0, others: 0 });
  }

  expenses.forEach((t) => {
    const date = new Date(t.date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const current = monthlyData.get(key);
    if (current) {
      const reason = (t.decision_reason as DecisionReason) || 'other';
      if (reason === 'need') current.needs += Number(t.amount);
      else if (reason === 'pleasure' || reason === 'opportunity') current.pleasures += Number(t.amount);
      else if (reason === 'investment' || reason === 'business') current.investments += Number(t.amount);
      else current.others += Number(t.amount);
    }
  });

  const monthlyEvolution = Array.from(monthlyData.entries())
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Calculate impulsivity score (pleasure + unforeseen / total expenses)
  const impulsiveSpending = totalByReason
    .filter((r) => r.reason === 'pleasure' || r.reason === 'unforeseen')
    .reduce((sum, r) => sum + r.amount, 0);
  const impulsivityScore = totalExpenses > 0 ? Math.round((impulsiveSpending / totalExpenses) * 100) : 0;

  // Calculate investment ratio
  const investmentSpending = totalByReason
    .filter((r) => r.reason === 'investment' || r.reason === 'business' || r.reason === 'training')
    .reduce((sum, r) => sum + r.amount, 0);
  const investmentRatio = totalExpenses > 0 ? Math.round((investmentSpending / totalExpenses) * 100) : 0;

  // Generate insights
  const insights: string[] = [];

  const needsPercentage = totalByReason.find((r) => r.reason === 'need')?.percentage || 0;
  if (needsPercentage > 40) {
    insights.push(`${needsPercentage}% de vos depenses sont liees a des besoins.`);
  }

  if (impulsivityScore > 20) {
    insights.push(`${impulsivityScore}% de vos depenses sont des achats impulsifs.`);
  }

  if (investmentRatio > 15) {
    insights.push(`L'investissement represente desormais ${investmentRatio}% de vos sorties d'argent.`);
  }

  // Check for trends
  if (monthlyEvolution.length >= 3) {
    const recentUnforeseen = monthlyEvolution.slice(-3).reduce((sum, m) => sum + m.others, 0);
    const previousUnforeseen = monthlyEvolution.slice(-6, -3).reduce((sum, m) => sum + m.others, 0);
    if (recentUnforeseen > previousUnforeseen * 1.5 && previousUnforeseen > 0) {
      insights.push('Vos depenses imprevues augmentent depuis trois mois.');
    }
  }

  return {
    totalExpenses,
    totalByReason,
    monthlyEvolution,
    impulsivityScore,
    investmentRatio,
    insights,
  };
}

export function getDecisionInfo(reason: DecisionReason) {
  return DECISION_REASONS[reason] || DECISION_REASONS.other;
}
