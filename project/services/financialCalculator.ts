/**
 * FINANCIAL TRUTH LAYER — Calculateur Financier Centralisé
 * 
 * Ce service est la SOURCE UNIQUE DE VÉRITÉ pour tous les calculs financiers.
 * Tous les écrans et services doivent utiliser ces fonctions centralisées.
 * 
 * Principes :
 * 1. Une transaction TRANSFER ne modifie ni les revenus ni les dépenses
 * 2. Une transaction SAVINGS_TRANSFER ne modifie pas le patrimoine net (déplacement de cash)
 * 3. Une transaction INVESTMENT_BUY ne modifie pas le patrimoine net (déplacement de cash)
 * 4. L'épargne virtuelle (objectif) n'est pas un actif supplémentaire
 * 5. Le Net Worth = Cash total + Actifs réels + Investissements - Passifs
 * 6. Chaque espace (personal, bgi, aurel, onkoonnect) est traité de manière identique
 */

import { supabase } from '@/lib/supabase';
import { ACCOUNT_CONFIG } from '@/types/accounts';
import type { AccountType } from '@/types/accounts';
import type {
  TransactionDB,
  OwnerType,
  SavingsGoal,
  SavingsTransfer,
  Investment,
  Asset,
  Liability,
  NetWorthData,
} from '@/types/database';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

// ============================================
// TYPES CENTRALISÉS
// ============================================

export interface FinancialSummary {
  /** Revenus totaux (exclut les transferts) */
  totalIncome: number;
  /** Dépenses totales (exclut les transferts, épargne, investissements) */
  totalExpenses: number;
  /** Flux net du mois (revenus - dépenses) */
  netCashFlow: number;
  /** Cash total disponible */
  cashAvailable: number;
  /** Soldes par compte */
  accountBalances: AccountBalance[];
  /** Transferts internes (montant total déplacé) */
  internalTransfers: number;
  /** Ajustement pour double-comptage des transferts */
  transferAdjustment: number;
}

export interface AccountBalance {
  account: AccountType;
  label: string;
  balance: number;
  color: string;
  percentage: number;
}

export interface SpaceFinancialData {
  owner: OwnerType;
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
  transactionCount: number;
  // Détails
  incomeTransactions: number;
  expenseTransactions: number;
  transferTransactions: number;
}

export interface CentralizedNetWorth {
  /** Liquidités totales (somme des comptes) */
  cashAndLiquidities: number;
  /** Actifs déclarés (immobilier, véhicules, etc.) */
  declaredAssets: number;
  /** Valeur des investissements */
  investmentsValue: number;
  /** Capital investi total */
  investedCapital: number;
  /** Passifs (dettes restantes) */
  liabilities: number;
  /** Patrimoine net calculé */
  netWorth: number;
  /** Détail par type d'actif */
  assetBreakdown: { type: string; amount: number; percentage: number }[];
  /** Détail par type de passif */
  liabilityBreakdown: { type: string; amount: number; percentage: number }[];
}

export interface ConsolidatedReport {
  /** Données par espace */
  bySpace: Record<OwnerType, SpaceFinancialData>;
  /** Données globales consolidées */
  global: FinancialSummary;
  /** Tous les espaces présents dans les données */
  activeSpaces: OwnerType[];
}

// ============================================
// CONSTANTES
// ============================================

export const ALL_OWNERS: OwnerType[] = ['personal', 'bgi', 'aurel', 'onkoonnect'];

export const OWNER_CONFIG: Record<OwnerType, { label: string; color: string }> = {
  personal: { label: 'Personnel', color: '#3B82F6' },
  bgi: { label: 'BGI', color: '#8B5CF6' },
  aurel: { label: 'AUREL', color: '#F59E0B' },
  onkoonnect: { label: "ON'KOONNECT", color: '#10B981' },
};

/** Types de transaction qui NE sont PAS des dépenses de consommation */
const NON_EXPENSE_NATURES = new Set([
  'transfer',
  'savings',
  'investment',
  'repayment',
  'adjustment',
]);

// ============================================
// FONCTIONS CENTRALISÉES
// ============================================

/**
 * Calcule les statistiques financières POUR UN ESPACE donné.
 * Règle fondamentale : les transferts internes ne sont ni des revenus ni des dépenses.
 */
export function calculateSpaceFinancialData(
  transactions: TransactionDB[],
  owner: OwnerType
): SpaceFinancialData {
  const spaceTransactions = transactions.filter((t) => t.owner === owner);

  let totalIncome = 0;
  let totalExpenses = 0;
  let incomeTransactions = 0;
  let expenseTransactions = 0;
  let transferTransactions = 0;

  for (const t of spaceTransactions) {
    const amount = Number(t.amount);

    // Un transfert n'est ni un revenu ni une dépense
    if (t.transaction_nature === 'transfer') {
      transferTransactions++;
      continue;
    }

    // L'épargne et les investissements ne sont pas des dépenses de consommation
    if (
      t.transaction_nature === 'savings' ||
      t.transaction_nature === 'investment'
    ) {
      expenseTransactions++;
      continue;
    }

    if (t.type === 'income') {
      totalIncome += amount;
      incomeTransactions++;
    } else {
      totalExpenses += amount;
      expenseTransactions++;
    }
  }

  return {
    owner,
    totalIncome,
    totalExpenses,
    netCashFlow: totalIncome - totalExpenses,
    transactionCount: spaceTransactions.length,
    incomeTransactions,
    expenseTransactions,
    transferTransactions,
  };
}

/**
 * Calcule les soldes par compte à partir des transactions.
 * Fonctionne comme un grand livre comptable : chaque transaction impacte un compte.
 */
export function calculateAccountBalances(
  transactions: TransactionDB[]
): AccountBalance[] {
  const balanceMap = new Map<AccountType, number>();

  // Initialiser tous les comptes à 0
  (Object.keys(ACCOUNT_CONFIG) as AccountType[]).forEach((acc) => {
    balanceMap.set(acc, 0);
  });

  for (const t of transactions) {
    const amount = Number(t.amount);
    const account = t.account as AccountType;
    const currentBalance = balanceMap.get(account) || 0;

    // Les transferts : le montant sort du compte source
    if (t.transaction_nature === 'transfer') {
      // Dans un transfert, l'argent sort du compte source
      balanceMap.set(account, currentBalance - amount);
      continue;
    }

    // Revenu → solde augmente
    if (t.type === 'income') {
      balanceMap.set(account, currentBalance + amount);
    }
    // Dépense → solde diminue
    else {
      balanceMap.set(account, currentBalance - amount);
    }
  }

  const totalAbsolute = Array.from(balanceMap.values()).reduce(
    (sum, b) => sum + Math.abs(b),
    0
  );

  return (Object.keys(ACCOUNT_CONFIG) as AccountType[])
    .map((account) => {
      const balance = balanceMap.get(account) || 0;
      const config = ACCOUNT_CONFIG[account];
      return {
        account,
        label: config.label,
        balance,
        color: config.color,
        percentage: totalAbsolute > 0 ? Math.round((Math.abs(balance) / totalAbsolute) * 100) : 0,
      };
    })
    .filter((ab) => ab.balance !== 0 || true) // Garder tous les comptes pour la visibilité
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
}

/**
 * Calcule le résumé financier global.
 * @param transactions Transactions à analyser
 * @param owner Optionnel : filtrer par espace
 */
export function calculateFinancialSummary(
  transactions: TransactionDB[],
  owner?: OwnerType
): FinancialSummary {
  const filtered = owner
    ? transactions.filter((t) => t.owner === owner)
    : transactions;

  let totalIncome = 0;
  let totalExpenses = 0;
  let internalTransfers = 0;

  for (const t of filtered) {
    const amount = Number(t.amount);

    // Les transferts sont exclus du P&L
    if (t.transaction_nature === 'transfer') {
      internalTransfers += amount;
      continue;
    }

    // L'épargne et les investissements sont exclus des dépenses de consommation
    if (
      t.transaction_nature === 'savings' ||
      t.transaction_nature === 'investment'
    ) {
      continue;
    }

    if (t.type === 'income') {
      totalIncome += amount;
    } else {
      totalExpenses += amount;
    }
  }

  // L'ajustement des transferts = la moitié du total des transferts
  // (car un transfert a 2 écritures : débit et crédit)
  const transferAdjustment = internalTransfers;
  const netCashFlow = totalIncome - totalExpenses;

  return {
    totalIncome,
    totalExpenses,
    netCashFlow,
    cashAvailable: 0, // Sera calculé par calculateAccountBalances
    accountBalances: calculateAccountBalances(filtered),
    internalTransfers,
    transferAdjustment,
  };
}

/**
 * Calcule le patrimoine net (Net Worth) de manière centralisée.
 * 
 * Formule officielle :
 * NET WORTH = Cash disponible + Actifs déclarés + Valeur des investissements - Passifs
 * 
 * L'épargne n'est PAS ajoutée séparément car elle est déjà dans le cash
 * (ou doit y être).
 */
export async function calculateCentralizedNetWorth(
  owner?: OwnerType
): Promise<CentralizedNetWorth> {
  // Récupérer les données
  let query = supabase.from('transactions').select('*');
  if (owner) {
    query = query.eq('owner', owner);
  }
  const { data: transactions } = await (query as SupabaseClient);
  const txList = (transactions || []) as TransactionDB[];

  // Cash disponible = calculé à partir des transactions
  const accountBalances = calculateAccountBalances(txList);
  const cashAndLiquidities = accountBalances.reduce(
    (sum, ab) => sum + ab.balance,
    0
  );

  // Actifs déclarés
  let assetsQuery = supabase.from('assets').select('*');
  if (owner) {
    assetsQuery = assetsQuery.eq('owner', owner);
  }
  const { data: assets } = await (assetsQuery as SupabaseClient);
  const assetsList = (assets || []) as Asset[];
  const declaredAssets = assetsList.reduce(
    (sum, a) => sum + Number(a.value),
    0
  );

  // Investissements
  let invQuery = supabase.from('investments').select('*');
  if (owner) {
    invQuery = invQuery.eq('owner', owner);
  }
  const { data: investments } = await (invQuery as SupabaseClient);
  const investmentsList = (investments || []) as Investment[];
  const activeInvestments = investmentsList.filter(
    (i) => i.status === 'active'
  );
  const investmentsValue = activeInvestments.reduce(
    (sum, i) => sum + Number(i.current_value),
    0
  );
  const investedCapital = activeInvestments.reduce(
    (sum, i) => sum + Number(i.invested_amount),
    0
  );

  // Passifs
  let liabQuery = supabase.from('liabilities').select('*');
  if (owner) {
    liabQuery = liabQuery.eq('owner', owner);
  }
  const { data: liabilities } = await (liabQuery as SupabaseClient);
  const liabilitiesList = (liabilities || []) as Liability[];
  const totalLiabilities = liabilitiesList.reduce(
    (sum, l) => sum + Number(l.remaining_amount),
    0
  );

  // Détail par type d'actif
  const assetsByTypeMap = new Map<string, number>();
  assetsList.forEach((a) => {
    const current = assetsByTypeMap.get(a.type) || 0;
    assetsByTypeMap.set(a.type, current + Number(a.value));
  });
  const assetBreakdown = Array.from(assetsByTypeMap.entries())
    .map(([type, amount]) => ({
      type,
      amount,
      percentage:
        declaredAssets > 0
          ? Math.round((amount / declaredAssets) * 100)
          : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Détail par type de passif
  const liabByTypeMap = new Map<string, number>();
  liabilitiesList.forEach((l) => {
    const current = liabByTypeMap.get(l.type) || 0;
    liabByTypeMap.set(l.type, current + Number(l.remaining_amount));
  });
  const liabilityBreakdown = Array.from(liabByTypeMap.entries())
    .map(([type, amount]) => ({
      type,
      amount,
      percentage:
        totalLiabilities > 0
          ? Math.round((amount / totalLiabilities) * 100)
          : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // NET WORTH = Cash + Actifs + Investissements - Passifs
  // L'épargne n'est PAS ajoutée car elle est déjà dans le cash
  const netWorth = cashAndLiquidities + declaredAssets + investmentsValue - totalLiabilities;

  return {
    cashAndLiquidities,
    declaredAssets,
    investmentsValue,
    investedCapital,
    liabilities: totalLiabilities,
    netWorth,
    assetBreakdown,
    liabilityBreakdown,
  };
}

/**
 * Consolide les données pour TOUS les espaces.
 */
export function calculateConsolidatedReport(
  transactions: TransactionDB[]
): ConsolidatedReport {
  const bySpace = {} as Record<OwnerType, SpaceFinancialData>;
  const activeSpaces: OwnerType[] = [];

  for (const owner of ALL_OWNERS) {
    const data = calculateSpaceFinancialData(transactions, owner);
    bySpace[owner] = data;
    if (data.transactionCount > 0) {
      activeSpaces.push(owner);
    }
  }

  const global = calculateFinancialSummary(transactions);

  return {
    bySpace,
    global,
    activeSpaces,
  };
}

/**
 * Vérifie si une transaction est un transfert interne entre deux espaces.
 * Dans ce cas, elle ne doit impacter ni les revenus ni les dépenses consolidés.
 */
export function isInternalTransfer(transaction: TransactionDB): boolean {
  return transaction.transaction_nature === 'transfer';
}

/**
 * Vérifie si un montant est une dépense de consommation réelle
 * (pas un transfert, pas de l'épargne, pas un investissement).
 */
export function isRealExpense(transaction: TransactionDB): boolean {
  if (transaction.type !== 'expense') return false;
  if (NON_EXPENSE_NATURES.has(transaction.transaction_nature)) return false;
  return true;
}

/**
 * Vérifie si un montant est un revenu réel
 * (pas un transfert entrant).
 */
export function isRealIncome(transaction: TransactionDB): boolean {
  if (transaction.type !== 'income') return false;
  if (transaction.transaction_nature === 'transfer') return false;
  return true;
}

/**
 * Règle des 35 % — VERSION CENTRALISÉE TEMPORAIRE
 * 
 * ATTENTION : Ceci est une implémentation temporaire.
 * À terme, cette règle doit être configurable via Business Rules.
 * 
 * Actuellement, la règle compare :
 * - Revenus éligibles (BGI + AUREL + ON'KOONNECT = tous les revenus d'entreprise)
 * - Dépenses personnelles
 * 
 * Seuil : les dépenses personnelles ≤ 35% des revenus d'entreprise
 */
export function calculateDiscipline35Percent(
  enterpriseIncome: number,
  personalExpenses: number
): {
  limit: number;
  personalExpenses: number;
  usedPercentage: number;
  status: 'conforme' | 'attention' | 'depassement' | 'inactif';
  emoji: string;
  color: string;
  availableAmount: number;
} {
  // Si pas de revenus d'entreprise, la règle est inactive
  if (enterpriseIncome <= 0) {
    return {
      limit: 0,
      personalExpenses: 0,
      usedPercentage: 0,
      status: 'inactif',
      emoji: '⚪',
      color: '#9CA3AF',
      availableAmount: 0,
    };
  }

  const limit = enterpriseIncome * 0.35;
  const usedPercentage = Math.round((personalExpenses / limit) * 100);
  const availableAmount = Math.max(0, limit - personalExpenses);

  let status: 'conforme' | 'attention' | 'depassement' | 'inactif';
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
    availableAmount,
  };
}

/**
 * Obtient les revenus d'entreprise consolidés (BGI + AUREL + ON'KOONNECT)
 */
export function getEnterpriseIncome(
  transactions: TransactionDB[]
): number {
  let total = 0;
  for (const t of transactions) {
    if (
      (t.owner === 'bgi' || t.owner === 'aurel' || t.owner === 'onkoonnect') &&
      t.type === 'income' &&
      t.transaction_nature !== 'transfer'
    ) {
      total += Number(t.amount);
    }
  }
  return total;
}

/**
 * Obtient les dépenses personnelles
 */
export function getPersonalExpenses(
  transactions: TransactionDB[]
): number {
  let total = 0;
  for (const t of transactions) {
    if (
      t.owner === 'personal' &&
      t.type === 'expense' &&
      t.transaction_nature !== 'transfer' &&
      t.transaction_nature !== 'savings' &&
      t.transaction_nature !== 'investment'
    ) {
      total += Number(t.amount);
    }
  }
  return total;
}

/**
 * Calcule la performance des investissements
 */
export function calculateInvestmentPerformance(
  investedCapital: number,
  currentValue: number
): {
  performance: number;
  gain: number;
  gainOrLoss: 'gain' | 'loss' | 'neutral';
  formattedPerformance: string;
} {
  if (investedCapital <= 0) {
    return {
      performance: 0,
      gain: 0,
      gainOrLoss: 'neutral',
      formattedPerformance: '0%',
    };
  }

  const gain = currentValue - investedCapital;
  const performance = (gain / investedCapital) * 100;
  const gainOrLoss = gain > 0 ? 'gain' : gain < 0 ? 'loss' : 'neutral';

  return {
    performance,
    gain: Math.abs(gain),
    gainOrLoss,
    formattedPerformance: `${performance >= 0 ? '+' : ''}${performance.toFixed(1)}%`,
  };
}
