import { supabase } from '@/lib/supabase';
import { formatCurrency } from './parserService';
import type { DecisionAnalysis } from './decisionEngine';
import type { ConsolidatedData } from './consolidationEngine';
import type { Forecast } from './forecastEngine';
import type { NetWorthData } from '@/types/database';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export type InsightCategory = 'behavior' | 'discipline' | 'patrimony' | 'savings' | 'investment' | 'forecast' | 'opportunity';

export interface Insight {
  id?: string;
  category: InsightCategory;
  type: 'success' | 'warning' | 'info' | 'opportunity';
  title: string;
  message: string;
  importance: number; // 1-5
  related_data?: any;
  is_read?: boolean;
  created_at?: string;
}

export async function generateInsights(data: {
  decisionAnalysis?: DecisionAnalysis;
  consolidatedData?: ConsolidatedData;
  netWorth?: NetWorthData;
  forecasts?: Forecast[];
  disciplineStatus?: string;
  savingsGoalsProgress?: { name: string; progress: number }[];
}): Promise<Insight[]> {
  const insights: Insight[] = [];
  const now = new Date();

  // 1. Behavior Insights
  if (data.decisionAnalysis) {
    const { impulsivityScore, investmentRatio, totalByReason, insights: decisionInsights } = data.decisionAnalysis;

    decisionInsights.forEach((text) => {
      insights.push({
        category: 'behavior',
        type: impulsivityScore > 30 ? 'warning' : 'info',
        title: 'Analyse comportementale',
        message: text,
        importance: 3,
      });
    });

    if (impulsivityScore > 25) {
      insights.push({
        category: 'behavior',
        type: 'warning',
        title: 'Achats impulsifs elevés',
        message: `${impulsivityScore}% de vos depenses sont impulsives. Essayez de planifier davantage.`,
        importance: 4,
      });
    }

    if (investmentRatio > 20) {
      insights.push({
        category: 'behavior',
        type: 'success',
        title: 'Comportement investisseur',
        message: `${investmentRatio}% de vos depenses sont des investissements. Excellent!`,
        importance: 2,
      });
    }
  }

  // 2. Discipline Insights
  if (data.disciplineStatus) {
    if (data.disciplineStatus === 'conforme') {
      insights.push({
        category: 'discipline',
        type: 'success',
        title: 'Discipline respectee',
        message: 'Vous respectez votre regle des 35%.',
        importance: 2,
      });
    } else if (data.disciplineStatus === 'attention') {
      insights.push({
        category: 'discipline',
        type: 'warning',
        title: 'Attention a la discipline',
        message: 'Vous approchez de la limite de 35% des revenus BGI.',
        importance: 4,
      });
    } else if (data.disciplineStatus === 'depassement') {
      insights.push({
        category: 'discipline',
        type: 'warning',
        title: 'Depassement de discipline',
        message: 'Vos depenses personnelles depassent 35% des revenus BGI.',
        importance: 5,
      });
    }
  }

  // 3. Patrimony Insights
  if (data.netWorth) {
    const { netWorth, investmentPerformance } = data.netWorth;

    if (netWorth > 0) {
      insights.push({
        category: 'patrimony',
        type: 'success',
        title: 'Patrimoine positif',
        message: `Votre patrimoine net s'eleve a ${formatCurrency(netWorth)}.`,
        importance: 2,
      });
    } else if (netWorth < 0) {
      insights.push({
        category: 'patrimony',
        type: 'warning',
        title: 'Patrimoine negatif',
        message: `Votre patrimoine net est en deficit de ${formatCurrency(Math.abs(netWorth))}.`,
        importance: 4,
      });
    }

    if (investmentPerformance > 15) {
      insights.push({
        category: 'patrimony',
        type: 'success',
        title: 'Performance exceptionnelle',
        message: `Vos investissements affichent un rendement de ${investmentPerformance.toFixed(1)}%.`,
        importance: 2,
      });
    }
  }

  // 4. Savings Insights
  if (data.savingsGoalsProgress) {
    data.savingsGoalsProgress.forEach((goal) => {
      if (goal.progress >= 100) {
        insights.push({
          category: 'savings',
          type: 'success',
          title: 'Objectif atteint!',
          message: `Bravo! Vous avez atteint votre objectif "${goal.name}".`,
          importance: 3,
        });
      } else if (goal.progress >= 80) {
        insights.push({
          category: 'savings',
          type: 'opportunity',
          title: 'Objectif presque atteint',
          message: `Votre objectif "${goal.name}" est a ${goal.progress.toFixed(0)}%. Plus qu'un petit effort!`,
          importance: 3,
        });
      }
    });
  }

  // 5. Investment Insights
  if (data.netWorth && data.netWorth.investmentCapital > 0) {
    const { investmentCapital, investmentValue, investmentIncome } = data.netWorth;

    if (investmentIncome > 0) {
      insights.push({
        category: 'investment',
        type: 'success',
        title: 'Revenus passifs',
        message: `Vos investissements ont genere ${formatCurrency(investmentIncome)} de revenus.`,
        importance: 2,
      });
    }
  }

  // 6. Forecast Insights
  if (data.forecasts && data.forecasts.length > 0) {
    data.forecasts.forEach((forecast) => {
      const daysText = forecast.forecast_type === '7days'
        ? '7 jours'
        : forecast.forecast_type === '30days'
          ? '30 jours'
          : 'fin du mois';

      insights.push({
        category: 'forecast',
        type: forecast.estimated_balance < 0 ? 'warning' : 'info',
        title: `Prevision ${daysText}`,
        message: `Solde estime: ${formatCurrency(Math.abs(forecast.estimated_balance))}${forecast.estimated_balance < 0 ? ' (deficit prevu)' : ''}. Confiance: ${forecast.confidence_level}%.`,
        importance: forecast.estimated_balance < 0 ? 4 : 2,
      });
    });
  }

  // 7. Opportunity Insights
  if (data.consolidatedData && data.disciplineStatus === 'conforme') {
    // Calculate potential investment amount
    const { totalIncome, totalExpenses } = data.consolidatedData;
    const availableToInvest = totalIncome * 0.35 - totalExpenses;

    if (availableToInvest > 10000) {
      insights.push({
        category: 'opportunity',
        type: 'opportunity',
        title: 'Opportunite investissement',
        message: `Vous pouvez investir ${formatCurrency(availableToInvest)} ce mois-ci en respectant votre discipline.`,
        importance: 3,
      });
    }
  }

  // Sort by importance
  insights.sort((a, b) => b.importance - a.importance);

  return insights;
}

export async function saveInsights(insights: Insight[]): Promise<void> {
  const { data: { user } } = await (supabase as SupabaseClient).auth.getUser();
  if (!user) return;

  for (const insight of insights) {
    await (supabase as SupabaseClient).from('insights_history').insert([{
      user_id: user.id,
      insight_type: insight.type,
      title: insight.title,
      message: insight.message,
      category: insight.category,
      importance: insight.importance,
      related_data: insight.related_data,
    }]);
  }
}

export async function getInsightsHistory(limit: number = 20): Promise<{ data: Insight[] | null; error: string | null }> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('insights_history')
    .select('*')
    .eq('is_dismissed', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { data: null, error: error.message };
  return { data: data as Insight[], error: null };
}

export async function markInsightRead(id: string): Promise<void> {
  await (supabase as SupabaseClient)
    .from('insights_history')
    .update({ is_read: true })
    .eq('id', id);
}

export async function dismissInsight(id: string): Promise<void> {
  await (supabase as SupabaseClient)
    .from('insights_history')
    .update({ is_dismissed: true })
    .eq('id', id);
}

export async function clearOldInsights(): Promise<void> {
  // Clear insights older than 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  await (supabase as SupabaseClient)
    .from('insights_history')
    .delete()
    .lt('created_at', thirtyDaysAgo.toISOString());
}
