import { supabase } from '@/lib/supabase';
import { formatCurrency } from './parserService';
import { getFinancialEvents, type FinancialEvent } from './calendarEngine';
import type { OwnerType } from '@/types/database';
import { calculateFinancialSummary } from './financialCalculator';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export type ForecastType = '7days' | '30days' | 'end_of_month';

export interface Forecast {
  forecast_type: ForecastType;
  forecast_date: Date;
  estimated_balance: number;
  current_balance: number;
  expected_income: number;
  expected_expenses: number;
  confidence_level: number;
  projected_events: ProjectedEvent[];
}

export interface ProjectedEvent {
  date: Date;
  event: FinancialEvent;
  impact: number;
}

export async function getCurrentBalance(owner?: OwnerType): Promise<number> {
  let query = (supabase as SupabaseClient)
    .from('transactions')
    .select('amount, type, transaction_nature, owner');

  if (owner) {
    query = query.eq('owner', owner);
  }

  const { data: transactions } = await query;
  if (!transactions) return 0;

  const summary = calculateFinancialSummary(transactions);
  return summary.totalIncome - summary.totalExpenses;
}

export async function calculateForecast(
  forecastType: ForecastType,
  owner?: OwnerType
): Promise<Forecast> {
  const now = new Date();
  let targetDate: Date;

  switch (forecastType) {
    case '7days':
      targetDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case '30days':
      targetDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      break;
    case 'end_of_month':
      targetDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
  }

  const currentBalance = await getCurrentBalance(owner);

  const { data: events } = await getFinancialEvents({
    startDate: now,
    endDate: targetDate,
  });

  let expectedIncome = 0;
  let expectedExpenses = 0;
  const projectedEvents: ProjectedEvent[] = [];

  if (events) {
    for (const event of events) {
      if (event.is_completed) continue;

      const amount = Number(event.amount);
      const eventDate = new Date(event.expected_date);

      if (event.event_type === 'income') {
        expectedIncome += amount;
      } else if (event.event_type === 'expense') {
        expectedExpenses += amount;
      }

      projectedEvents.push({
        date: eventDate,
        event,
        impact: event.event_type === 'income' ? amount : -amount,
      });
    }
  }

  let query = (supabase as SupabaseClient)
    .from('transactions')
    .select('amount, date, type')
    .order('date', { ascending: false })
    .limit(30);

  if (owner) {
    query = query.eq('owner', owner);
  }

  const { data: recentTransactions } = await query;

  let confidenceLevel = 50;
  if (recentTransactions && recentTransactions.length > 0) {
    confidenceLevel += Math.min(20, recentTransactions.length);
    const avgDailySpending = recentTransactions
      .filter((t: any) => t.type === 'expense')
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0) / 30;
    if (avgDailySpending > 0) confidenceLevel += 10;
  }

  if (events && events.length > 0) {
    confidenceLevel += Math.min(20, events.length);
  }

  confidenceLevel = Math.min(95, confidenceLevel);

  const estimatedBalance = currentBalance + expectedIncome - expectedExpenses;

  const forecastRecord: Record<string, any> = {
    forecast_type: forecastType,
    forecast_date: targetDate.toISOString(),
    estimated_balance: estimatedBalance,
    expected_income: expectedIncome,
    expected_expenses: expectedExpenses,
    confidence_level: confidenceLevel,
  };
  if (owner) forecastRecord.organization_id = owner;

  await (supabase as SupabaseClient).from('financial_forecasts').insert([forecastRecord]);

  return {
    forecast_type: forecastType,
    forecast_date: targetDate,
    estimated_balance: estimatedBalance,
    current_balance: currentBalance,
    expected_income: expectedIncome,
    expected_expenses: expectedExpenses,
    confidence_level: confidenceLevel,
    projected_events: projectedEvents.sort((a, b) => a.date.getTime() - b.date.getTime()),
  };
}

export async function getAllForecasts(owner?: OwnerType): Promise<{
  weekForecast: Forecast;
  monthForecast: Forecast;
  endOfMonthForecast: Forecast;
}> {
  const [weekForecast, monthForecast, endOfMonthForecast] = await Promise.all([
    calculateForecast('7days', owner),
    calculateForecast('30days', owner),
    calculateForecast('end_of_month', owner),
  ]);

  return { weekForecast, monthForecast, endOfMonthForecast };
}

export function formatForecastMessage(forecast: Forecast): string {
  const { forecast_type, estimated_balance, current_balance, confidence_level } = forecast;

  const daysText = forecast_type === '7days'
    ? '7 jours'
    : forecast_type === '30days'
      ? '30 jours'
      : 'la fin du mois';

  const balanceDiff = estimated_balance - current_balance;
  const trendText = balanceDiff >= 0 ? 'augmentera' : 'diminuera';

  return `Si aucune nouvelle depense n'est effectuee, votre solde estime dans ${daysText} sera de ${formatCurrency(Math.abs(estimated_balance))}${estimated_balance < 0 ? ' (deficit)' : ''}. Le solde ${trendText} de ${formatCurrency(Math.abs(balanceDiff))}. Niveau de confiance: ${confidence_level}%.`;
}
