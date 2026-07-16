import { supabase } from '@/lib/supabase';
import { formatCurrency } from './parserService';
import { getFinancialEvents, type FinancialEvent, type EventFrequency } from './calendarEngine';

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

export async function getCurrentBalance(): Promise<number> {
  // Get all transactions and calculate balance
  const { data: transactions } = await (supabase as SupabaseClient)
    .from('transactions')
    .select('amount, type, transaction_nature');

  if (!transactions) return 0;

  let balance = 0;

  transactions.forEach((t: any) => {
    if (t.transaction_nature === 'transfer') {
      // Transfers don't affect total balance (internal)
      return;
    }

    const amount = Number(t.amount);
    if (t.type === 'income') {
      balance += amount;
    } else {
      balance -= amount;
    }
  });

  return balance;
}

export async function calculateForecast(forecastType: ForecastType): Promise<Forecast> {
  const now = new Date();
  let targetDate: Date;
  let daysAhead: number;

  switch (forecastType) {
    case '7days':
      targetDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      daysAhead = 7;
      break;
    case '30days':
      targetDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      daysAhead = 30;
      break;
    case 'end_of_month':
      targetDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      daysAhead = Math.ceil((targetDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      break;
  }

  // Get current balance
  const currentBalance = await getCurrentBalance();

  // Get scheduled financial events in the period
  const { data: events } = await getFinancialEvents({
    startDate: now,
    endDate: targetDate,
  });

  // Calculate projected amounts
  let expectedIncome = 0;
  let expectedExpenses = 0;
  const projectedEvents: ProjectedEvent[] = [];

  if (events) {
    for (const event of events) {
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

  // Analyze transaction patterns for confidence
  const { data: recentTransactions } = await (supabase as SupabaseClient)
    .from('transactions')
    .select('amount, date, type')
    .order('date', { ascending: false })
    .limit(30);

  // Calculate confidence based on data availability
  let confidenceLevel = 50; // Base confidence

  if (recentTransactions && recentTransactions.length > 0) {
    // More historical data = higher confidence
    confidenceLevel += Math.min(20, recentTransactions.length);

    // Check forecast accuracy potential (simplified)
    const avgDailySpending = recentTransactions
      .filter((t: any) => t.type === 'expense')
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0) / 30;

    if (avgDailySpending > 0) {
      confidenceLevel += 10;
    }
  }

  if (events && events.length > 0) {
    // More scheduled events = higher confidence
    confidenceLevel += Math.min(20, events.length);
  }

  // Ensure confidence doesn't exceed 95
  confidenceLevel = Math.min(95, confidenceLevel);

  const estimatedBalance = currentBalance + expectedIncome - expectedExpenses;

  // Save forecast to database
  await (supabase as SupabaseClient).from('financial_forecasts').insert([{
    forecast_type: forecastType,
    forecast_date: targetDate.toISOString(),
    estimated_balance: estimatedBalance,
    expected_income: expectedIncome,
    expected_expenses: expectedExpenses,
    confidence_level: confidenceLevel,
  }]);

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

export async function getAllForecasts(): Promise<{
  weekForecast: Forecast;
  monthForecast: Forecast;
  endOfMonthForecast: Forecast;
}> {
  const [weekForecast, monthForecast, endOfMonthForecast] = await Promise.all([
    calculateForecast('7days'),
    calculateForecast('30days'),
    calculateForecast('end_of_month'),
  ]);

  return {
    weekForecast,
    monthForecast,
    endOfMonthForecast,
  };
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

  return `Si aucune nouvelle depense n'est effectuee, votre solde estime dans ${daysText} sera de ${formatCurrency(Math.abs(estimated_balance))}${estimated_balance < 0 ? ' (deficit)' : ''
    }. Le solde ${trendText} de ${formatCurrency(Math.abs(balanceDiff))}. Niveau de confiance: ${confidence_level}%.`;
}
