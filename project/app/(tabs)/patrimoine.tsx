import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { formatCurrency } from '@/services/parserService';
import {
  calculateNetWorth,
  getInvestments,
  addInvestment,
  updateInvestment,
  deleteInvestment,
  getFinancialOpportunities,
  getAssets,
  addAsset,
  deleteAsset,
  getLiabilities,
  addLiability,
  deleteLiability,
  INVESTMENT_TYPES,
  ASSET_TYPES,
  LIABILITY_TYPES,
} from '@/services/wealthService';
import type {
  NetWorthData,
  Investment,
  InvestmentInsert,
  Asset,
  AssetInsert,
  Liability,
  LiabilityInsert,
  FinancialOpportunity,
} from '@/types/database';
import type { OwnerKey } from '@/services/parserService';
import { OWNERS, OWNER_KEYS } from '@/services/parserService';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  X,
  Building2,
  User,
  Trash2,
  Lightbulb,
  Wallet,
  Target,
  BarChart2,
  PiggyBank,
  CheckCircle,
  AlertCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

type InvestmentTypeKey = keyof typeof INVESTMENT_TYPES;
type AssetTypeKey = keyof typeof ASSET_TYPES;
type LiabilityTypeKey = keyof typeof LIABILITY_TYPES;

export default function PatrimoineScreen() {
  const [netWorth, setNetWorth] = useState<NetWorthData | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [opportunities, setOpportunities] = useState<FinancialOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showLiabilityModal, setShowLiabilityModal] = useState(false);
  const [showInvestmentModal, setShowInvestmentModal] = useState(false);

  // Asset form
  const [assetName, setAssetName] = useState('');
  const [assetValue, setAssetValue] = useState('');
  const [assetType, setAssetType] = useState<AssetTypeKey>('other');
  const [assetOwner, setAssetOwner] = useState<OwnerKey>('personal');

  // Liability form
  const [liabilityName, setLiabilityName] = useState('');
  const [liabilityAmount, setLiabilityAmount] = useState('');
  const [liabilityRemaining, setLiabilityRemaining] = useState('');
  const [liabilityType, setLiabilityType] = useState<LiabilityTypeKey>('debt');
  const [liabilityOwner, setLiabilityOwner] = useState<OwnerKey>('personal');

  // Investment form
  const [investmentName, setInvestmentName] = useState('');
  const [investmentAmount, setInvestmentAmount] = useState('');
  const [investmentCurrentValue, setInvestmentCurrentValue] = useState('');
  const [investmentType, setInvestmentType] = useState<InvestmentTypeKey>('other');
  const [investmentOwner, setInvestmentOwner] = useState<OwnerKey>('personal');

  const loadData = useCallback(async () => {
    const [nw, inv, ast, lia, opp] = await Promise.all([
      calculateNetWorth(),
      getInvestments(),
      getAssets(),
      getLiabilities(),
      getFinancialOpportunities(),
    ]);

    setNetWorth(nw);
    setInvestments(inv.data || []);
    setAssets(ast.data || []);
    setLiabilities(lia.data || []);
    setOpportunities(opp.data || []);

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

  const handleAddAsset = async () => {
    if (!assetName || !assetValue) return;

    const { data } = await addAsset({
      name: assetName,
      value: parseFloat(assetValue),
      type: assetType,
      owner: assetOwner,
    });

    if (data) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      loadData();
      setShowAssetModal(false);
      setAssetName('');
      setAssetValue('');
    }
  };

  const handleAddLiability = async () => {
    if (!liabilityName || !liabilityAmount) return;

    const { data } = await addLiability({
      name: liabilityName,
      amount: parseFloat(liabilityAmount),
      remaining_amount: parseFloat(liabilityRemaining || liabilityAmount),
      type: liabilityType,
      owner: liabilityOwner,
    });

    if (data) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      loadData();
      setShowLiabilityModal(false);
      setLiabilityName('');
      setLiabilityAmount('');
      setLiabilityRemaining('');
    }
  };

  const handleAddInvestment = async () => {
    if (!investmentName || !investmentAmount) return;

    const { data } = await addInvestment({
      name: investmentName,
      invested_amount: parseFloat(investmentAmount),
      current_value: parseFloat(investmentCurrentValue || investmentAmount),
      type: investmentType,
      owner: investmentOwner,
    });

    if (data) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      loadData();
      setShowInvestmentModal(false);
      setInvestmentName('');
      setInvestmentAmount('');
      setInvestmentCurrentValue('');
    }
  };

  const handleDeleteAsset = async (id: string) => {
    await deleteAsset(id);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    loadData();
  };

  const handleDeleteLiability = async (id: string) => {
    await deleteLiability(id);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    loadData();
  };

  const handleDeleteInvestment = async (id: string) => {
    await deleteInvestment(id);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    loadData();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  const activeInvestments = investments.filter((i) => i.status === 'active');

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
        <Text style={styles.title}>Patrimoine</Text>
        <Text style={styles.subtitle}>Vision complete de tes actifs et passifs</Text>
      </View>

      {/* Net Worth Card */}
      <View style={styles.netWorthCard}>
        <Text style={styles.netWorthLabel}>Patrimoine Net</Text>
        <Text
          style={[
            styles.netWorthAmount,
            { color: (netWorth?.netWorth || 0) >= 0 ? '#059669' : '#DC2626' },
          ]}
        >
          {formatCurrency(Math.abs(netWorth?.netWorth || 0))}
          {(netWorth?.netWorth || 0) < 0 && ' (déficit)'}
        </Text>
        <View style={styles.netWorthBreakdown}>
          <View style={styles.netWorthItem}>
            <TrendingUp size={16} color="#059669" />
            <Text style={styles.netWorthItemLabel}>Actifs</Text>
            <Text style={styles.netWorthItemValue}>{formatCurrency(netWorth?.totalAssets || 0)}</Text>
          </View>
          <View style={styles.netWorthDivider} />
          <View style={styles.netWorthItem}>
            <TrendingDown size={16} color="#DC2626" />
            <Text style={styles.netWorthItemLabel}>Passifs</Text>
            <Text style={styles.netWorthItemValue}>{formatCurrency(netWorth?.totalLiabilities || 0)}</Text>
          </View>
        </View>
      </View>

      {/* Financial Opportunities */}
      {opportunities.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Opportunites</Text>
          {opportunities.slice(0, 3).map((opp) => (
            <View key={opp.id} style={styles.opportunityCard}>
              <View style={styles.opportunityIcon}>
                <Lightbulb size={18} color="#F59E0B" />
              </View>
              <View style={styles.opportunityContent}>
                <Text style={styles.opportunityTitle}>{opp.title}</Text>
                <Text style={styles.opportunityMessage}>{opp.message}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* KPIs */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <PiggyBank size={20} color="#059669" />
          <Text style={styles.kpiLabel}>Epargne totale</Text>
          <Text style={styles.kpiValue}>{formatCurrency(netWorth?.savingsTotal || 0)}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Target size={20} color="#8B5CF6" />
          <Text style={styles.kpiLabel}>Capital investi</Text>
          <Text style={styles.kpiValue}>{formatCurrency(netWorth?.investmentCapital || 0)}</Text>
        </View>
        <View style={styles.kpiCard}>
          <TrendingUp size={20} color="#22C55E" />
          <Text style={styles.kpiLabel}>Valeur actuelle</Text>
          <Text style={styles.kpiValue}>{formatCurrency(netWorth?.investmentValue || 0)}</Text>
        </View>
        <View style={styles.kpiCard}>
          <BarChart2 size={20} color="#3B82F6" />
          <Text style={styles.kpiLabel}>Rendement</Text>
          <Text style={[styles.kpiValue, { color: (netWorth?.investmentPerformance || 0) >= 0 ? '#22C55E' : '#DC2626' }]}>
            {(netWorth?.investmentPerformance || 0).toFixed(1)}%
          </Text>
        </View>
      </View>

      {/* Investments Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Investissements</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowInvestmentModal(true)}>
            <Plus size={18} color="#059669" />
          </TouchableOpacity>
        </View>

        {activeInvestments.length === 0 ? (
          <View style={styles.emptyState}>
            <BarChart2 size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Aucun investissement</Text>
            <Text style={styles.emptySubtitle}>Ajoute ton premier investissement</Text>
          </View>
        ) : (
          activeInvestments.map((investment) => {
            const perf = ((Number(investment.current_value) - Number(investment.invested_amount)) / Number(investment.invested_amount)) * 100;
            const typeInfo = INVESTMENT_TYPES[investment.type as InvestmentTypeKey] || INVESTMENT_TYPES.other;
            const ownerInfo = OWNERS[investment.owner as OwnerKey];

            return (
              <View key={investment.id} style={styles.investmentCard}>
                <View style={styles.investmentHeader}>
                  <View style={styles.investmentInfo}>
                    <View style={[styles.investmentIcon, { backgroundColor: typeInfo.color + '20' }]}>
                      <TrendingUp size={18} color={typeInfo.color} />
                    </View>
                    <View>
                      <Text style={styles.investmentName}>{investment.name}</Text>
                      <View style={styles.investmentMeta}>
                        <Text style={styles.investmentType}>{typeInfo.label}</Text>
                        {investment.owner === 'personal' ? (
                          <User size={10} color={ownerInfo.color} />
                        ) : (
                          <Building2 size={10} color={ownerInfo.color} />
                        )}
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteInvestment(investment.id)}>
                    <Trash2 size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
                <View style={styles.investmentStats}>
                  <View style={styles.investStat}>
                    <Text style={styles.investStatLabel}>Investi</Text>
                    <Text style={styles.investStatValue}>{formatCurrency(Number(investment.invested_amount))}</Text>
                  </View>
                  <View style={styles.investStat}>
                    <Text style={styles.investStatLabel}>Valeur</Text>
                    <Text style={styles.investStatValue}>{formatCurrency(Number(investment.current_value))}</Text>
                  </View>
                  <View style={styles.investStat}>
                    <Text style={styles.investStatLabel}>Performance</Text>
                    <Text style={[styles.investStatValue, { color: perf >= 0 ? '#22C55E' : '#DC2626' }]}>
                      {perf >= 0 ? '+' : ''}{perf.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Assets Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Actifs</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAssetModal(true)}>
            <Plus size={18} color="#059669" />
          </TouchableOpacity>
        </View>

        {assets.length === 0 ? (
          <View style={styles.emptyState}>
            <Wallet size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Aucun actif enregistre</Text>
          </View>
        ) : (
          assets.map((asset) => {
            const typeInfo = ASSET_TYPES[asset.type as AssetTypeKey] || ASSET_TYPES.other;
            return (
              <View key={asset.id} style={styles.assetItem}>
                <View style={styles.assetLeft}>
                  <Wallet size={16} color={typeInfo.color} />
                  <View>
                    <Text style={styles.assetName}>{asset.name}</Text>
                    <Text style={styles.assetType}>{typeInfo.label}</Text>
                  </View>
                </View>
                <View style={styles.assetRight}>
                  <Text style={styles.assetValue}>{formatCurrency(Number(asset.value))}</Text>
                  <TouchableOpacity onPress={() => handleDeleteAsset(asset.id)}>
                    <Trash2 size={14} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Liabilities Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Passifs</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowLiabilityModal(true)}>
            <Plus size={18} color="#DC2626" />
          </TouchableOpacity>
        </View>

        {liabilities.length === 0 ? (
          <View style={styles.emptyState}>
            <CheckCircle size={48} color="#22C55E" />
            <Text style={styles.emptyTitle}>Aucun passif</Text>
            <Text style={styles.emptySubtitle}>Tu n'as pas de dettes enregistrees</Text>
          </View>
        ) : (
          liabilities.map((liability) => {
            const typeInfo = LIABILITY_TYPES[liability.type as LiabilityTypeKey] || LIABILITY_TYPES.other;
            const remaining = Number(liability.remaining_amount);
            const original = Number(liability.amount);
            const paidPercentage = ((original - remaining) / original) * 100;

            return (
              <View key={liability.id} style={styles.liabilityCard}>
                <View style={styles.liabilityHeader}>
                  <View style={styles.liabilityInfo}>
                    <Text style={styles.liabilityName}>{liability.name}</Text>
                    <Text style={styles.liabilityType}>{typeInfo.label}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteLiability(liability.id)}>
                    <Trash2 size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
                <View style={styles.liabilityStats}>
                  <Text style={styles.liabilityRemaining}>{formatCurrency(remaining)}</Text>
                  <Text style={styles.liabilityOriginal}>sur {formatCurrency(original)}</Text>
                </View>
                {paidPercentage > 0 && (
                  <View style={styles.repaymentBar}>
                    <View style={[styles.repaymentFill, { width: `${paidPercentage}%` }]} />
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>

      {/* Add Investment Modal */}
      <Modal
        visible={showInvestmentModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowInvestmentModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowInvestmentModal(false)}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nouvel investissement</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Nom</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: Pisciculture Abidjan"
                placeholderTextColor="#9CA3AF"
                value={investmentName}
                onChangeText={setInvestmentName}
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Type</Text>
              <View style={styles.typeSelector}>
                {(Object.keys(INVESTMENT_TYPES) as InvestmentTypeKey[]).slice(0, 7).map((key) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.typeChip, investmentType === key && { borderColor: INVESTMENT_TYPES[key].color, backgroundColor: INVESTMENT_TYPES[key].color + '15' }]}
                    onPress={() => setInvestmentType(key)}
                  >
                    <Text style={[styles.typeChipText, investmentType === key && { color: INVESTMENT_TYPES[key].color }]}>
                      {INVESTMENT_TYPES[key].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Montant investi (FCFA)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: 500000"
                placeholderTextColor="#9CA3AF"
                value={investmentAmount}
                onChangeText={setInvestmentAmount}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Valeur actuelle (FCFA)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: 580000"
                placeholderTextColor="#9CA3AF"
                value={investmentCurrentValue}
                onChangeText={setInvestmentCurrentValue}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Espace</Text>
              <View style={styles.ownerSelector}>
                {OWNER_KEYS.map((key) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.ownerChip, investmentOwner === key && { borderColor: OWNERS[key].color, backgroundColor: OWNERS[key].color + '15' }]}
                    onPress={() => setInvestmentOwner(key)}
                  >
                    {key === 'personal' ? (
                      <User size={12} color={investmentOwner === key ? OWNERS[key].color : '#6B7280'} />
                    ) : (
                      <Building2 size={12} color={investmentOwner === key ? OWNERS[key].color : '#6B7280'} />
                    )}
                    <Text style={[styles.ownerChipText, investmentOwner === key && { color: OWNERS[key].color }]}>
                      {OWNERS[key].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleAddInvestment}>
              <Text style={styles.saveButtonText}>Ajouter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Asset Modal */}
      <Modal
        visible={showAssetModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAssetModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAssetModal(false)}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nouvel actif</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Nom</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: Terrains Yamoussoukro"
                placeholderTextColor="#9CA3AF"
                value={assetName}
                onChangeText={setAssetName}
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Valeur (FCFA)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: 5000000"
                placeholderTextColor="#9CA3AF"
                value={assetValue}
                onChangeText={setAssetValue}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Type</Text>
              <View style={styles.typeSelector}>
                {(Object.keys(ASSET_TYPES) as AssetTypeKey[]).slice(0, 8).map((key) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.typeChip, assetType === key && { borderColor: ASSET_TYPES[key].color, backgroundColor: ASSET_TYPES[key].color + '15' }]}
                    onPress={() => setAssetType(key)}
                  >
                    <Text style={[styles.typeChipText, assetType === key && { color: ASSET_TYPES[key].color }]}>
                      {ASSET_TYPES[key].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleAddAsset}>
              <Text style={styles.saveButtonText}>Ajouter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Liability Modal */}
      <Modal
        visible={showLiabilityModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLiabilityModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowLiabilityModal(false)}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nouveau passif</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Nom</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: Pret Bancaire"
                placeholderTextColor="#9CA3AF"
                value={liabilityName}
                onChangeText={setLiabilityName}
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Montant initial (FCFA)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: 2000000"
                placeholderTextColor="#9CA3AF"
                value={liabilityAmount}
                onChangeText={setLiabilityAmount}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Montant restant (FCFA)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: 1500000"
                placeholderTextColor="#9CA3AF"
                value={liabilityRemaining}
                onChangeText={setLiabilityRemaining}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Type</Text>
              <View style={styles.typeSelector}>
                {(Object.keys(LIABILITY_TYPES) as LiabilityTypeKey[]).map((key) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.typeChip, liabilityType === key && { borderColor: LIABILITY_TYPES[key].color, backgroundColor: LIABILITY_TYPES[key].color + '15' }]}
                    onPress={() => setLiabilityType(key)}
                  >
                    <Text style={[styles.typeChipText, liabilityType === key && { color: LIABILITY_TYPES[key].color }]}>
                      {LIABILITY_TYPES[key].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={[styles.saveButton, { backgroundColor: '#DC2626' }]} onPress={handleAddLiability}>
              <Text style={styles.saveButtonText}>Ajouter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  netWorthCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  netWorthLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  netWorthAmount: {
    fontSize: 40,
    fontWeight: '700',
    marginBottom: 20,
  },
  netWorthBreakdown: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  netWorthItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  netWorthDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 20,
  },
  netWorthItemLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  netWorthItemValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  kpiCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  kpiLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  opportunityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  opportunityIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FDE68A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  opportunityContent: {
    flex: 1,
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
  investmentCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  investmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  investmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  investmentIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  investmentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  investmentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  investmentType: {
    fontSize: 12,
    color: '#6B7280',
  },
  investmentStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
  },
  investStat: {
    alignItems: 'center',
  },
  investStatLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  investStatValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  deleteButton: {
    padding: 8,
  },
  assetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  assetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  assetName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  assetType: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  assetRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  assetValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  liabilityCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  liabilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  liabilityInfo: {
    flex: 1,
  },
  liabilityName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  liabilityType: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  liabilityStats: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  liabilityRemaining: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DC2626',
  },
  liabilityOriginal: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  repaymentBar: {
    height: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  repaymentFill: {
    height: 6,
    backgroundColor: '#22C55E',
    borderRadius: 3,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: 60,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalContent: {
    padding: 20,
  },
  formField: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#111827',
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  typeChipText: {
    fontSize: 12,
    color: '#374151',
  },
  ownerSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ownerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ownerChipText: {
    fontSize: 12,
    color: '#6B7280',
  },
  saveButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
