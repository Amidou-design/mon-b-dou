import { supabase } from '@/lib/supabase';
import { formatCurrency } from './parserService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export type EventFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual';
export type EventType = 'income' | 'expense' | 'savings' | 'investment' | 'transfer';

export interface FinancialEvent {
  id: string;
  user_id: string;
  organization_id: string | null;
  title: string;
  description: string | null;
  event_type: EventType;
  amount: number;
  expected_date: string;
  is_recurring: boolean;
  recurring_frequency: EventFrequency | null;
  recurring_end_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  linked_transaction_id: string | null;
  metadata: any;
}

export interface FinancialEventInsert {
  title: string;
  description?: string | null;
  event_type: EventType;
  amount: number;
  expected_date: string;
  is_recurring?: boolean;
  recurring_frequency?: EventFrequency | null;
  recurring_end_date?: string | null;
  organization_id?: string | null;
}

export interface CalendarDay {
  date: Date;
  events: FinancialEvent[];
  totalAmount: number;
  isToday: boolean;
  isPast: boolean;
}

export interface CalendarWeek {
  startDate: Date;
  endDate: Date;
  days: CalendarDay[];
  totalAmount: number;
}

export interface CalendarMonth {
  year: number;
  month: number;
  weeks: CalendarWeek[];
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
}

export const EVENT_TYPE_CONFIG = {
  income: { label: 'Revenu', color: '#22C55E', icon: 'TrendingUp' },
  expense: { label: 'Depense', color: '#DC2626', icon: 'TrendingDown' },
  savings: { label: 'Epargne', color: '#059669', icon: 'PiggyBank' },
  investment: { label: 'Investissement', color: '#8B5CF6', icon: 'BarChart2' },
  transfer: { label: 'Transfert', color: '#3B82F6', icon: 'ArrowRight' },
};

export const FREQUENCY_CONFIG = {
  daily: { label: 'Quotidien', days: 1 },
  weekly: { label: 'Hebdomadaire', days: 7 },
  monthly: { label: 'Mensuel', days: 30 },
  quarterly: { label: 'Trimestriel', days: 90 },
  semiannual: { label: 'Semestriel', days: 180 },
  annual: { label: 'Annuel', days: 365 },
};

export async function getFinancialEvents(options?: {
  startDate?: Date;
  endDate?: Date;
  eventType?: EventType;
  includeRecurringInstances?: boolean;
}): Promise<{ data: FinancialEvent[] | null; error: string | null }> {
  let query = (supabase as SupabaseClient)
    .from('financial_events')
    .select('*')
    .order('expected_date', { ascending: true });

  if (options?.startDate) {
    query = query.gte('expected_date', options.startDate.toISOString());
  }

  if (options?.endDate) {
    query = query.lte('expected_date', options.endDate.toISOString());
  }

  if (options?.eventType) {
    query = query.eq('event_type', options.eventType);
  }

  const { data, error } = await query;

  if (error) return { data: null, error: error.message };
  return { data: data as FinancialEvent[], error: null };
}

export async function addFinancialEvent(event: FinancialEventInsert): Promise<{ data: FinancialEvent | null; error: string | null }> {
  const { data, error } = await (supabase as SupabaseClient)
    .from('financial_events')
    .insert([event])
    .select()
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data as FinancialEvent, error: null };
}

export async function updateFinancialEvent(id: string, updates: Partial<FinancialEvent>): Promise<{ error: string | null }> {
  const { error } = await (supabase as SupabaseClient)
    .from('financial_events')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  return { error: error?.message || null };
}

export async function deleteFinancialEvent(id: string): Promise<{ error: string | null }> {
  const { error } = await (supabase as SupabaseClient)
    .from('financial_events')
    .delete()
    .eq('id', id);

  return { error: error?.message || null };
}

export async function markEventCompleted(id: string, transactionId?: string): Promise<{ error: string | null }> {
  const updates: Partial<FinancialEvent> = {
    is_completed: true,
    completed_at: new Date().toISOString(),
  };

  if (transactionId) {
    updates.linked_transaction_id = transactionId;
  }

  return updateFinancialEvent(id, updates);
}

export async function generateRecurringInstances(
  event: FinancialEvent,
  startDate: Date,
  endDate: Date
): Promise<FinancialEvent[]> {
  if (!event.is_recurring || !event.recurring_frequency) {
    return [event];
  }

  const instances: FinancialEvent[] = [];
  const frequency = FREQUENCY_CONFIG[event.recurring_frequency];
  let currentDate = new Date(event.expected_date);
  const finalDate = event.recurring_end_date
    ? new Date(event.recurring_end_date)
    : endDate;

  // Generate instances
  while (currentDate <= endDate && currentDate <= finalDate) {
    if (currentDate >= startDate) {
      instances.push({
        ...event,
        id: `${event.id}-${currentDate.toISOString().split('T')[0]}`,
        expected_date: currentDate.toISOString(),
      });
    }

    // Move to next occurrence
    switch (event.recurring_frequency) {
      case 'daily':
        currentDate.setDate(currentDate.getDate() + 1);
        break;
      case 'weekly':
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case 'monthly':
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
      case 'quarterly':
        currentDate.setMonth(currentDate.getMonth() + 3);
        break;
      case 'semiannual':
        currentDate.setMonth(currentDate.getMonth() + 6);
        break;
      case 'annual':
        currentDate.setFullYear(currentDate.getFullYear() + 1);
        break;
    }
  }

  return instances;
}

export async function getCalendarMonth(year: number, month: number): Promise<CalendarMonth> {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59);

  const { data: events } = await getFinancialEvents({
    startDate,
    endDate,
    includeRecurringInstances: true,
  });

  // Generate all instances including recurring
  const allEvents: FinancialEvent[] = [];
  if (events) {
    for (const event of events) {
      if (event.is_recurring) {
        allEvents.push(...await generateRecurringInstances(event, startDate, endDate));
      } else {
        allEvents.push(event);
      }
    }
  }

  // Build calendar days
  const days: CalendarDay[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Add empty days for padding (start from Monday)
  const startPadding = (firstDay.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
  for (let i = 0; i < startPadding; i++) {
    const prevMonthDay = new Date(year, month, -startPadding + i + 1);
    days.push({
      date: prevMonthDay,
      events: [],
      totalAmount: 0,
      isToday: false,
      isPast: prevMonthDay < today,
    });
  }

  // Add actual days
  let totalIncome = 0;
  let totalExpenses = 0;

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    const dayEvents = allEvents.filter((e) => {
      const eventDate = new Date(e.expected_date);
      return eventDate.toDateString() === date.toDateString();
    });

    const totalAmount = dayEvents.reduce((sum, e) => {
      const amount = Number(e.amount);
      if (e.event_type === 'income' || e.event_type === 'transfer') {
        return sum + amount;
      }
      return sum - amount;
    }, 0);

    const income = dayEvents
      .filter((e) => e.event_type === 'income')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const expenses = dayEvents
      .filter((e) => e.event_type === 'expense')
      .reduce((sum, e) => sum + Number(e.amount), 0);

    totalIncome += income;
    totalExpenses += expenses;

    days.push({
      date,
      events: dayEvents,
      totalAmount,
      isToday: date.toDateString() === today.toDateString(),
      isPast: date < today,
    });
  }

  // Build weeks (6 rows)
  const weeks: CalendarWeek[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const weekDays = days.slice(i, i + 7);
    if (weekDays.length > 0) {
      const weekStart = weekDays[0].date;
      const weekEnd = weekDays[weekDays.length - 1].date;
      weeks.push({
        startDate: weekStart,
        endDate: weekEnd,
        days: weekDays,
        totalAmount: weekDays.reduce((sum, d) => sum + d.totalAmount, 0),
      });
    }
  }

  // Pad remaining days
  const remainingDays = 7 - (days.length % 7);
  if (remainingDays < 7) {
    const lastWeek = weeks[weeks.length - 1];
    for (let i = 1; i <= remainingDays; i++) {
      const nextMonthDay = new Date(year, month + 1, i);
      lastWeek.days.push({
        date: nextMonthDay,
        events: [],
        totalAmount: 0,
        isToday: false,
        isPast: false,
      });
    }
  }

  return {
    year,
    month,
    weeks,
    totalIncome,
    totalExpenses,
    netAmount: totalIncome - totalExpenses,
  };
}

export function getEventTypeConfig(type: EventType) {
  return EVENT_TYPE_CONFIG[type] || EVENT_TYPE_CONFIG.expense;
}

export function getFrequencyConfig(frequency: EventFrequency) {
  return FREQUENCY_CONFIG[frequency] || FREQUENCY_CONFIG.monthly;
}
