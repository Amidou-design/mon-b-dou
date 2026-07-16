import { supabase } from '@/lib/supabase';
import { formatCurrency } from './parserService';
import type { SavingsGoal, FinancialOpportunityInsert, NetWorthData, Json } from '@/types/database';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export interface FinancialInsight {
  type: 'success' | 'warning' | 'info' | 'opportunity';
  title: string;
  message: string;
  actionable: boolean;
  actionData?: Json;
}

export async function generateInsights(data: {
  bgiIncome: number;
  personalExpenses: number;
  savingsGoals: SavingsGoal[];
  netWorth: NetWorthData;
  disciplineStatus: string;
  savingsRate: number;
  investmentRate: number;
  monthlyIncome: number;
  passiveIncome: number;
}): Promise<FinancialInsight[]> {
  const insights: FinancialInsight[] = [];

  // 1. Discipline Insights
  if (data.disciplineStatus === 'conforme') {
    const availableToInvest = data.bgiIncome * 0.35 - data.personalExpenses;
    if (availableToInvest > 10000) {
      insights.push({
        type: 'opportunity',
        title: 'Opportunite investissement',
        message: `Tes depenses sont conformes. Tu peux investir ${formatCurrency(availableToInvest)} ce mois-ci.`,
        actionable: true,
        actionData: { type: 'invest', amount: availableToInvest } as Json,
      });
    } else {
      insights.push({
        type: 'success',
        title: 'Discipline respectee',
        message: 'Tu respectes parfaitement ta regle de 35%.',
        actionable: false,
      });
    }
  } else if (data.disciplineStatus === 'attention') {
    const remaining = data.bgiIncome * 0.35 - data.personalExpenses;
    insights.push({
      type: 'warning',
      title: 'Attention',
      message: `Tu approches de la limite. Plus que ${formatCurrency(remaining)} disponible.`,
      actionable: true,
      actionData: { type: 'reduce_expenses' } as Json,
    });
  } else if (data.disciplineStatus === 'depassement') {
    insights.push({
      type: 'warning',
      title: 'Depassement',
      message: 'Tes depenses personnelles depassent 35% des revenus BGI.',
      actionable: true,
      actionData: { type: 'reduce_expenses' } as Json,
    });
  }

  // 2. Savings Goals Insights
  data.savingsGoals.forEach((goal) => {
    const progress = (Number(goal.current_amount) / Number(goal.target_amount)) * 100;

    if (progress >= 100) {
      insights.push({
        type: 'success',
        title: 'Objectif atteint!',
        message: `Bravo! Tu as atteint "${goal.name}" (${formatCurrency(Number(goal.target_amount))}).`,
        actionable: true,
        actionData: { type: 'new_goal', achieved_goal_id: goal.id } as Json,
      });
    } else if (progress >= 80) {
      insights.push({
        type: 'opportunity',
        title: 'Presque atteint',
        message: `${progress.toFixed(0)}% de "${goal.name}". Plus que ${formatCurrency(Number(goal.target_amount) - Number(goal.current_amount))}.`,
        actionable: true,
        actionData: { type: 'add_savings', goal_id: goal.id } as Json,
      });
    }
  });

  // 3. Investment Performance
  if (data.netWorth.investmentPerformance > 20) {
    insights.push({
      type: 'success',
      title: 'Excellente performance',
      message: `Tes investissements affichent +${data.netWorth.investmentPerformance.toFixed(1)}% de rendement.`,
      actionable: false,
    });
  } else if (data.netWorth.investmentPerformance > 10) {
    insights.push({
      type: 'info',
      title: 'Bonne performance',
      message: `Rendement de +${data.netWorth.investmentPerformance.toFixed(1)}% sur tes investissements.`,
      actionable: false,
    });
  }

  // 4. Passive Income
  if (data.passiveIncome > 0) {
    const passivePercentage = data.monthlyIncome > 0 ? (data.passiveIncome / data.monthlyIncome) * 100 : 0;
    if (passivePercentage > 30) {
      insights.push({
        type: 'success',
        title: 'Revenus passifs',
        message: `${passivePercentage.toFixed(0)}% de tes revenus sont passifs. Excellent!`,
        actionable: false,
      });
    } else if (passivePercentage > 10) {
      insights.push({
        type: 'info',
        title: 'Revenus passifs',
        message: `${formatCurrency(data.passiveIncome)} de revenus passifs ce mois.`,
        actionable: false,
      });
    }
  }

  // 5. Net Worth
  if (data.netWorth.netWorth > 0) {
    insights.push({
      type: 'info',
      title: 'Patrimoine positif',
      message: `Ton patrimoine net s'eleve a ${formatCurrency(data.netWorth.netWorth)}.`,
      actionable: false,
    });
  }

  // 6. Savings Rate
  if (data.savingsRate > 20) {
    insights.push({
      type: 'success',
      title: 'Taux epargne elevé',
      message: `${data.savingsRate.toFixed(0)}% de tes revenus vont a l'epargne.`,
      actionable: false,
    });
  }

  return insights;
}

export async function saveOpportunities(userId: string, insights: FinancialInsight[]): Promise<void> {
  const opportunities: FinancialOpportunityInsert[] = insights.map((insight, index) => ({
    user_id: userId,
    type: insight.type,
    title: insight.title,
    message: insight.message,
    priority: index + 1,
    is_actionable: insight.actionable,
    action_data: insight.actionData,
  }));

  for (const opp of opportunities) {
    await (supabase as SupabaseClient)
      .from('financial_opportunities')
      .insert([opp]);
  }
}

export async function clearOpportunities(): Promise<void> {
  const { data: { user } } = await (supabase as SupabaseClient).auth.getUser();
  if (user) {
    await (supabase as SupabaseClient)
      .from('financial_opportunities')
      .delete()
      .eq('user_id', user.id);
  }
}
