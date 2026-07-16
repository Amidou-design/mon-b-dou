import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { getTransactions } from '@/services/transactionService';
import type { Transaction } from '@/services/transactionService';
import {
  calculateDashboardStats,
  filterTransactionsForCurrentMonth,
} from '@/services/dashboardService';
import type { DashboardStats, SpaceStats } from '@/services/dashboardService';
import {
  calculateNetWorth,
  getSavingsGoals,
  getFinancialOpportunities,
} from '@/services/wealthService';
import type { NetWorthData, SavingsGoal, FinancialOpportunity } from '@/types/database';
import { formatCurrency, getCategoryInfo } from '@/services/parserService';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Building2,
  User,
  Globe,
  Shield,
  AlertTriangle,
  PiggyBank,
  Target,
  BarChart2,
  Lightbulb,
} from 'lucide-react-native';
import { router } from 'expo-router';

export default function DashboardScreen() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [netWorth, setNetWorth] = useState<NetWorthData | null>(null);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [opportunities, setOpportunities] = useState<FinancialOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [txRes, nwRes, goalsRes, oppRes] = await Promise.all([
      getTransactions(),
      calculateNetWorth(),
      getSavingsGoals(),
      getFinancialOpportunities(),
    ]);

    if (txRes.data) {
      setTransactions(txRes.data);
      const currentMonthData = filterTransactionsForCurrentMonth(txRes.data);
      setStats(calculateDashboardStats(currentMonthData));
    }

    setNetWorth(nwRes);
    setSavingsGoals(goalsRes.data || []);
    setOpportunities(oppRes.data || []);

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  const renderSpaceCard = (spaceStats: SpaceStats, title: string, icon: React.ReactNode, color: string) => (
    <View style={[styles.spaceCard, { borderLeftColor: color }]}>
      <View style={styles.spaceCardHeader}>
        {icon}
        <Text style={[styles.spaceCardTitle, { color }]}>{title}</Text>
      </View>
      <View style={styles.spaceCardStats}>
        <View style={styles.spaceStat}>
          <Text style={styles.spaceStatLabel}>Solde</Text>
          <Text style={[styles.spaceStatValue, { color: spaceStats.balance >= 0 ? '#22C55E' : '#DC2626' }]}>
            {formatCurrency(Math.abs(spaceStats.balance))}
            {spaceStats.balance < 0 && ' (deficit)'}
          </Text>
        </View>
        <View style={styles.spaceStatRow}>
          <View style={styles.spaceStat}>
            <Text style={styles.spaceStatLabel}>Revenus</Text>
            <Text style={[styles.spaceStatValue, { color: '#22C55E', fontSize: 14 }]}>
              +{formatCurrency(spaceStats.totalIncome)}
            </Text>
          </View>
          <View style={styles.spaceStat}>
            <Text style={styles.spaceStatLabel}>Depenses</Text>
            <Text style={[styles.spaceStatValue, { color: '#DC2626', fontSize: 14 }]}>
              -{formatCurrency(spaceStats.totalExpense)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#059669']} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Bonjour {user?.email?.split('@')[0] || 'utilisateur'}</Text>
        <Text style={styles.headerSubtitle}>Voici ta situation financiere ce mois</Text>
      </View>

      {/* Financial Opportunities */}
      {opportunities.length > 0 && (
        <View style={styles.opportunitiesSection}>
          <View style={styles.sectionHeaderRow}>
            <Lightbulb size={18} color="#F59E0B" />
            <Text style={styles.opportunitiesTitle}>Opportunites</Text>
          </View>
          {opportunities.slice(0, 2).map((opp) => (
            <View key={opp.id} style={styles.opportunityCard}>
              <Text style={styles.opportunityTitle}>{opp.title}</Text>
              <Text style={styles.opportunityMessage}>{opp.message}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Financial Discipline Card */}
      {stats?.discipline && (
        <View style={[styles.disciplineCard, { borderColor: stats.discipline.color }]}>
          <View style={styles.disciplineHeader}>
            <Shield size={24} color={stats.discipline.color} />
            <Text style={[styles.disciplineTitle, { color: stats.discipline.color }]}>
              Discipline financiere
            </Text>
          </View>

          <View style={styles.disciplineContent}>
            <View style={styles.disciplineRow}>
              <Text style={styles.disciplineLabel}>Limite autorisee (35% BGI)</Text>
              <Text style={styles.disciplineValue}>{formatCurrency(stats.discipline.limit)}</Text>
            </View>
            <View style={styles.disciplineRow}>
              <Text style={styles.disciplineLabel}>Depenses personnelles</Text>
              <Text style={styles.disciplineValue}>{formatCurrency(stats.discipline.personalExpenses)}</Text>
            </View>
            <View style={styles.disciplineRow}>
              <Text style={styles.disciplineLabel}>Utilisation</Text>
              <Text style={[styles.disciplineValue, { color: stats.discipline.color }]}>
                {stats.discipline.usedPercentage}%
              </Text>
            </View>
          </View>

          <View style={[styles.disciplineStatus, { backgroundColor: stats.discipline.color + '15' }]}>
            <Text style={styles.disciplineEmoji}>{stats.discipline.emoji}</Text>
            <Text style={[styles.disciplineStatusText, { color: stats.discipline.color }]}>
              {stats.discipline.status === 'conforme' && 'Conforme - Tu respectes ta strategie'}
              {stats.discipline.status === 'attention' && 'Attention - Approche de la limite'}
              {stats.discipline.status === 'depassement' && 'Depassement - Reajuste tes depenses'}
            </Text>
          </View>
        </View>
      )}

      {!stats?.discipline && stats?.bgiStats.totalIncome === 0 && (
        <View style={styles.disciplineHint}>
          <AlertTriangle size={20} color="#F59E0B" />
          <Text style={styles.disciplineHintText}>
            Ajoute des revenus BGI pour activer l'indicateur de discipline financiere
          </Text>
        </View>
      )}

      {/* PERSONAL Space */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <User size={20} color="#3B82F6" />
          <Text style={[styles.sectionTitle, { color: '#3B82F6' }]}>PERSONNEL</Text>
        </View>
        {renderSpaceCard(
          stats?.personalStats || { owner: 'personal', totalIncome: 0, totalExpense: 0, balance: 0, transactionCount: 0 },
          'Espace Personnel',
          <User size={18} color="#3B82F6" />,
          '#3B82F6'
        )}
      </View>

      {/* BGI Space */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Building2 size={20} color="#8B5CF6" />
          <Text style={[styles.sectionTitle, { color: '#8B5CF6' }]}>BGI</Text>
        </View>
        {renderSpaceCard(
          stats?.bgiStats || { owner: 'bgi', totalIncome: 0, totalExpense: 0, balance: 0, transactionCount: 0 },
          'Espace BGI',
          <Building2 size={18} color="#8B5CF6" />,
          '#8B5CF6'
        )}
      </View>

      {/* Global Vision */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Globe size={20} color="#059669" />
          <Text style={[styles.sectionTitle, { color: '#059669' }]}>VISION GLOBALE</Text>
        </View>
        <View style={[styles.globalCard]}>
          <View style={styles.globalStats}>
            <View style={styles.globalStatItem}>
              <Wallet size={24} color="#059669" />
              <Text style={styles.globalStatLabel}>Solde Total</Text>
              <Text style={[styles.globalStatValue, { color: (stats?.globalStats.balance || 0) >= 0 ? '#059669' : '#DC2626' }]}>
                {formatCurrency(Math.abs(stats?.globalStats.balance || 0))}
              </Text>
            </View>
          </View>
          <View style={styles.globalRow}>
            <View style={styles.globalCol}>
              <TrendingUp size={20} color="#22C55E" />
              <Text style={styles.globalColLabel}>Revenus cumules</Text>
              <Text style={[styles.globalColValue, { color: '#22C55E' }]}>
                +{formatCurrency(stats?.globalStats.totalIncome || 0)}
              </Text>
            </View>
            <View style={styles.globalCol}>
              <TrendingDown size={20} color="#DC2626" />
              <Text style={styles.globalColLabel}>Depenses cumulees</Text>
              <Text style={[styles.globalColValue, { color: '#DC2626' }]}>
                -{formatCurrency(stats?.globalStats.totalExpense || 0)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Patrimoine Section */}
      <TouchableOpacity style={styles.patrimoineSection} onPress={() => router.push('/patrimoine')}>
        <View style={styles.patrimoineHeader}>
          <BarChart2 size={20} color="#111827" />
          <Text style={styles.patrimoineTitle}>Construction du Patrimoine</Text>
        </View>

        <View style={styles.patrimoineCard}>
          <View style={styles.patrimoineMain}>
            <Text style={styles.patrimoineLabel}>Patrimoine Net</Text>
            <Text style={[styles.patrimoineValue, { color: (netWorth?.netWorth || 0) >= 0 ? '#059669' : '#DC2626' }]}>
              {formatCurrency(Math.abs(netWorth?.netWorth || 0))}
              {(netWorth?.netWorth || 0) < 0 && ' (deficit)'}
            </Text>
          </View>

          <View style={styles.patrimoineGrid}>
            <View style={styles.patrimoineItem}>
              <PiggyBank size={16} color="#059669" />
              <Text style={styles.patrimoineItemLabel}>Epargne</Text>
              <Text style={styles.patrimoineItemValue}>{formatCurrency(netWorth?.savingsTotal || 0)}</Text>
            </View>
            <View style={styles.patrimoineItem}>
              <Target size={16} color="#8B5CF6" />
              <Text style={styles.patrimoineItemLabel}>Capital investi</Text>
              <Text style={styles.patrimoineItemValue}>{formatCurrency(netWorth?.investmentCapital || 0)}</Text>
            </View>
            <View style={styles.patrimoineItem}>
              <TrendingUp size={16} color="#22C55E" />
              <Text style={styles.patrimoineItemLabel}>Valeur actuelle</Text>
              <Text style={styles.patrimoineItemValue}>{formatCurrency(netWorth?.investmentValue || 0)}</Text>
            </View>
            <View style={styles.patrimoineItem}>
              <BarChart2 size={16} color="#3B82F6" />
              <Text style={styles.patrimoineItemLabel}>Rendement</Text>
              <Text style={[styles.patrimoineItemValue, { color: (netWorth?.investmentPerformance || 0) >= 0 ? '#22C55E' : '#DC2626' }]}>
                {(netWorth?.investmentPerformance || 0).toFixed(1)}%
              </Text>
            </View>
          </View>
        </View>

        {/* Top Savings Goals */}
        {savingsGoals.length > 0 && (
          <View style={styles.goalsPreview}>
            <Text style={styles.goalsPreviewTitle}>Objectifs prioritaires</Text>
            {savingsGoals.slice(0, 3).map((goal) => {
              const progress = (Number(goal.current_amount) / Number(goal.target_amount)) * 100;
              return (
                <View key={goal.id} style={styles.goalPreviewItem}>
                  <Text style={styles.goalPreviewName}>{goal.name}</Text>
                  <View style={styles.goalPreviewProgress}>
                    <View style={styles.goalPreviewBar}>
                      <View
                        style={[
                          styles.goalPreviewFill,
                          { width: `${Math.min(progress, 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.goalPreviewPercent}>{progress.toFixed(0)}%</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </TouchableOpacity>

      {/* Category Breakdown */}
      {stats && stats.categoryBreakdown.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitleDark}>Repartition des depenses</Text>
          <View style={styles.categoryList}>
            {stats.categoryBreakdown.slice(0, 5).map((cat) => (
              <View key={cat.category} style={styles.categoryItem}>
                <View style={styles.categoryHeader}>
                  <View
                    style={[
                      styles.categoryDot,
                      { backgroundColor: getCategoryInfo(cat.category).color },
                    ]}
                  />
                  <Text style={styles.categoryName}>
                    {getCategoryInfo(cat.category).label}
                  </Text>
                  <Text style={styles.categoryPercentage}>{cat.percentage}%</Text>
                </View>
                <View style={styles.categoryBar}>
                  <View
                    style={[
                      styles.categoryBarFill,
                      { width: `${cat.percentage}%`, backgroundColor: getCategoryInfo(cat.category).color },
                    ]}
                  />
                </View>
                <Text style={styles.categoryAmount}>{formatCurrency(cat.amount)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Recent Transactions */}
      {transactions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitleDark}>Transactions recentes</Text>
          {transactions.slice(0, 5).map((transaction) => (
            <View key={transaction.id} style={styles.transactionItem}>
              <View style={styles.transactionLeft}>
                <View
                  style={[
                    styles.transactionDot,
                    { backgroundColor: transaction.type === 'income' ? '#059669' : '#DC2626' },
                  ]}
                />
                <View>
                  <Text style={styles.transactionDescription}>{transaction.description}</Text>
                  <View style={styles.transactionMeta}>
                    <Text style={styles.transactionCategory}>
                      {getCategoryInfo(transaction.category).label}
                    </Text>
                    <Text style={styles.transactionOwner}>
                      {transaction.owner === 'personal' ? 'Perso' : 'BGI'}
                    </Text>
                  </View>
                </View>
              </View>
              <Text
                style={[
                  styles.transactionAmount,
                  { color: transaction.type === 'income' ? '#059669' : '#DC2626' },
                ]}
              >
                {transaction.type === 'income' ? '+' : '-'} {formatCurrency(Number(transaction.amount))}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Empty State */}
      {transactions.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>💡</Text>
          <Text style={styles.emptyTitle}>Aucune transaction</Text>
          <Text style={styles.emptySubtitle}>
            Commence a ajouter tes revenus et depenses pour voir ton tableau de bord
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  opportunitiesSection: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  opportunitiesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
  },
  opportunityCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  opportunityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  opportunityMessage: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  disciplineCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  disciplineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  disciplineTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  disciplineContent: {
    gap: 12,
    marginBottom: 16,
  },
  disciplineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  disciplineLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  disciplineValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  disciplineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
  },
  disciplineEmoji: {
    fontSize: 20,
  },
  disciplineStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  disciplineHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  disciplineHintText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionTitleDark: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  spaceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  spaceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  spaceCardTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  spaceCardStats: {
    gap: 12,
  },
  spaceStat: {
    gap: 4,
  },
  spaceStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  spaceStatLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  spaceStatValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  globalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  globalStats: {
    alignItems: 'center',
    marginBottom: 20,
  },
  globalStatItem: {
    alignItems: 'center',
    gap: 8,
  },
  globalStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
  },
  globalStatValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  globalRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  globalCol: {
    alignItems: 'center',
    gap: 8,
  },
  globalColLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  globalColValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  patrimoineSection: {
    marginBottom: 20,
  },
  patrimoineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  patrimoineTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  patrimoineCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  patrimoineMain: {
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  patrimoineLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  patrimoineValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  patrimoineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  patrimoineItem: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
  },
  patrimoineItemLabel: {
    flex: 1,
    fontSize: 11,
    color: '#6B7280',
  },
  patrimoineItemValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  goalsPreview: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 14,
  },
  goalsPreviewTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#065F46',
    marginBottom: 10,
  },
  goalPreviewItem: {
    marginBottom: 8,
  },
  goalPreviewName: {
    fontSize: 12,
    color: '#065F46',
    marginBottom: 4,
  },
  goalPreviewProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalPreviewBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#D1FAE5',
    borderRadius: 2,
  },
  goalPreviewFill: {
    height: 4,
    backgroundColor: '#059669',
    borderRadius: 2,
  },
  goalPreviewPercent: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
    width: 30,
    textAlign: 'right',
  },
  categoryList: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryItem: {
    gap: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryName: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  categoryPercentage: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  categoryBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginLeft: 18,
  },
  categoryBarFill: {
    height: 6,
    borderRadius: 3,
  },
  categoryAmount: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 18,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  transactionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  transactionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  transactionCategory: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  transactionOwner: {
    fontSize: 11,
    color: '#9CA3AF',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
