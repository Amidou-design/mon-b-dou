import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { formatCurrency } from '@/services/parserService';
import {
  getInsightsHistory,
  generateInsights,
  dismissInsight,
  type Insight,
  type InsightCategory,
} from '@/services/insightEngine';
import { analyzeDecisions } from '@/services/decisionEngine';
import { calculateNetWorth } from '@/services/wealthService';
import { getTransactions } from '@/services/transactionService';
import { calculateForecast } from '@/services/forecastEngine';
import type { Forecast } from '@/services/forecastEngine';
import {
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Target,
  PiggyBank,
  BarChart2,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const CATEGORY_CONFIG: Record<InsightCategory, { label: string; color: string; icon: string }> = {
  behavior: { label: 'Comportement', color: '#3B82F6', icon: 'TrendingUp' },
  discipline: { label: 'Discipline', color: '#22C55E', icon: 'Target' },
  patrimony: { label: 'Patrimoine', color: '#8B5CF6', icon: 'BarChart2' },
  savings: { label: 'Epargne', color: '#059669', icon: 'PiggyBank' },
  investment: { label: 'Investissement', color: '#F59E0B', icon: 'TrendingUp' },
  forecast: { label: 'Prevision', color: '#EC4899', icon: 'Calendar' },
  opportunity: { label: 'Opportunite', color: '#22C55E', icon: 'Sparkles' },
};

const TYPE_CONFIG = {
  success: { color: '#22C55E', icon: CheckCircle },
  warning: { color: '#DC2626', icon: AlertTriangle },
  info: { color: '#3B82F6', icon: Lightbulb },
  opportunity: { color: '#F59E0B', icon: Sparkles },
};

export default function InsightsScreen() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    // Get existing insights
    const { data: savedInsights } = await getInsightsHistory(20);

    // Generate fresh insights from data
    const [txRes, netWorth] = await Promise.all([
      getTransactions(),
      calculateNetWorth(),
    ]);

    const decisionAnalysis = txRes.data ? analyzeDecisions(txRes.data) : undefined;

    // Get forecasts
    let forecastData: Forecast[] = [];
    try {
      const weekForecast = await calculateForecast('7days');
      forecastData.push(weekForecast);
    } catch {
      // Ignore forecast errors
    }

    // Generate insights
    const freshInsights = await generateInsights({
      decisionAnalysis,
      netWorth,
      forecasts: forecastData,
    });

    // Merge with saved insights, prioritizing fresh ones
    const allInsights = [...freshInsights, ...(savedInsights || [])];

    // Deduplicate by title
    const seen = new Set<string>();
    const uniqueInsights = allInsights.filter((insight) => {
      if (seen.has(insight.title)) return false;
      seen.add(insight.title);
      return true;
    });

    setInsights(uniqueInsights.slice(0, 15));
    setForecasts(forecastData);
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

  const handleDismiss = async (id?: string) => {
    if (!id) return;
    await dismissInsight(id);
    setInsights((prev) => prev.filter((i) => i.id !== id));
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const getCategoryIcon = (category: InsightCategory) => {
    const config = CATEGORY_CONFIG[category];
    switch (config.icon) {
      case 'TrendingUp': return <TrendingUp size={18} color={config.color} />;
      case 'Target': return <Target size={18} color={config.color} />;
      case 'BarChart2': return <BarChart2 size={18} color={config.color} />;
      case 'PiggyBank': return <PiggyBank size={18} color={config.color} />;
      case 'Calendar': return <Calendar size={18} color={config.color} />;
      case 'Sparkles': return <Sparkles size={18} color={config.color} />;
      default: return <Lightbulb size={18} color={config.color} />;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  const groupedInsights = insights.reduce((acc, insight) => {
    const cat = insight.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(insight);
    return acc;
  }, {} as Record<InsightCategory, Insight[]>);

  const orderedCategories: InsightCategory[] = ['opportunity', 'behavior', 'discipline', 'patrimony', 'savings', 'investment', 'forecast'];

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
        <View style={styles.headerIcon}>
          <Lightbulb size={28} color="#F59E0B" />
        </View>
        <Text style={styles.title}>Centre d'Insights</Text>
        <Text style={styles.subtitle}>Analyses et recommandations automatiques</Text>
      </View>

      {/* Forecasts Section */}
      {forecasts.length > 0 && (
        <View style={styles.forecastSection}>
          <Text style={styles.sectionTitle}>Previsions de tresorerie</Text>
          {forecasts.map((forecast) => {
            const daysText = forecast.forecast_type === '7days' ? '7 jours' :
              forecast.forecast_type === '30days' ? '30 jours' : 'fin du mois';
            const isPositive = forecast.estimated_balance >= 0;
            return (
              <View key={forecast.forecast_type} style={styles.forecastCard}>
                <View style={styles.forecastHeader}>
                  <Calendar size={18} color={isPositive ? '#22C55E' : '#DC2626'} />
                  <Text style={styles.forecastTitle}>Dans {daysText}</Text>
                </View>
                <Text style={[styles.forecastAmount, { color: isPositive ? '#22C55E' : '#DC2626' }]}>
                  {formatCurrency(Math.abs(forecast.estimated_balance))}
                  {!isPositive && ' (deficit prevu)'}
                </Text>
                <View style={styles.forecastDetails}>
                  <View style={styles.forecastDetail}>
                    <TrendingUp size={12} color="#22C55E" />
                    <Text style={styles.forecastDetailText}>+{formatCurrency(forecast.expected_income)}</Text>
                  </View>
                  <View style={styles.forecastDetail}>
                    <TrendingDown size={12} color="#DC2626" />
                    <Text style={styles.forecastDetailText}>-{formatCurrency(forecast.expected_expenses)}</Text>
                  </View>
                </View>
                <Text style={styles.forecastConfidence}>Confiance: {forecast.confidence_level}%</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Insights by Category */}
      {orderedCategories.map((category) => {
        const categoryInsights = groupedInsights[category];
        if (!categoryInsights || categoryInsights.length === 0) return null;

        const config = CATEGORY_CONFIG[category];

        return (
          <View key={category} style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              {getCategoryIcon(category)}
              <Text style={[styles.categoryTitle, { color: config.color }]}>{config.label}</Text>
              <Text style={styles.insightCount}>{categoryInsights.length}</Text>
            </View>

            {categoryInsights.map((insight) => {
              const typeConfig = TYPE_CONFIG[insight.type];
              const IconComponent = typeConfig.icon;

              return (
                <View key={insight.id || insight.title} style={[styles.insightCard, { borderLeftColor: typeConfig.color }]}>
                  <View style={[styles.insightIcon, { backgroundColor: typeConfig.color + '15' }]}>
                    <IconComponent size={18} color={typeConfig.color} />
                  </View>
                  <View style={styles.insightContent}>
                    <Text style={styles.insightTitle}>{insight.title}</Text>
                    <Text style={styles.insightMessage}>{insight.message}</Text>
                  </View>
                  {insight.id && (
                    <TouchableOpacity
                      style={styles.dismissButton}
                      onPress={() => handleDismiss(insight.id)}
                    >
                      <X size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}

      {/* Empty State */}
      {insights.length === 0 && (
        <View style={styles.emptyState}>
          <Lightbulb size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Aucun insight</Text>
          <Text style={styles.emptySubtitle}>
            Ajoutez des transactions pour generer des analyses
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
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  forecastSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  forecastCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  forecastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  forecastTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  forecastAmount: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 10,
  },
  forecastDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  forecastDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  forecastDetailText: {
    fontSize: 12,
    color: '#6B7280',
  },
  forecastConfidence: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  insightCount: {
    fontSize: 12,
    color: '#9CA3AF',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 3,
  },
  insightMessage: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  dismissButton: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});
