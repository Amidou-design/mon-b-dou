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
  getSavingsGoals,
  addSavingsGoal,
  updateSavingsGoal,
  deleteSavingsGoal,
  getSavingsTransfers,
  addSavingsTransfer,
} from '@/services/wealthService';
import type { SavingsGoal, SavingsTransfer } from '@/types/database';
import type { OwnerKey } from '@/services/parserService';
import { OWNERS, OWNER_KEYS } from '@/services/parserService';
import { ACCOUNT_CONFIG as ACCOUNTS, ACCOUNT_KEYS } from '@/types/accounts';
import {
  PiggyBank,
  Plus,
  Target,
  TrendingUp,
  Wallet,
  X,
  Building2,
  User,
  ArrowRight,
  Trash2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export default function SavingsScreen() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [transfers, setTransfers] = useState<SavingsTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Goal form
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalOwner, setGoalOwner] = useState<OwnerKey>('personal');
  const [goalPriority, setGoalPriority] = useState(1);

  // Transfer form
  const [transferAmount, setTransferAmount] = useState('');
  const [transferSource, setTransferSource] = useState<typeof ACCOUNT_KEYS[number]>('cash');
  const [transferGoalId, setTransferGoalId] = useState<string>('');
  const [transferOwner, setTransferOwner] = useState<OwnerKey>('personal');
  const [transferComment, setTransferComment] = useState('');

  const [totalSavings, setTotalSavings] = useState(0);

  const loadData = useCallback(async () => {
    const [goalsRes, transfersRes] = await Promise.all([
      getSavingsGoals(),
      getSavingsTransfers(),
    ]);

    if (goalsRes.data) setGoals(goalsRes.data);
    if (transfersRes.data) {
      setTransfers(transfersRes.data);
      const total = transfersRes.data.reduce((sum, t) => sum + Number(t.amount), 0);
      setTotalSavings(total);
    }

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

  const handleAddGoal = async () => {
    if (!goalName || !goalTarget) return;

    const { data } = await addSavingsGoal({
      name: goalName,
      target_amount: parseFloat(goalTarget),
      owner: goalOwner,
      priority: goalPriority,
    });

    if (data) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setGoals((prev) => [...prev, data]);
      setShowGoalModal(false);
      setGoalName('');
      setGoalTarget('');
      setGoalPriority(1);
    }
  };

  const handleAddTransfer = async () => {
    if (!transferAmount || !transferGoalId) return;

    const { data } = await addSavingsTransfer({
      amount: parseFloat(transferAmount),
      source_account: transferSource,
      goal_id: transferGoalId,
      owner: transferOwner,
      comment: transferComment || null,
    });

    if (data) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      // Refresh data
      loadData();
      setShowTransferModal(false);
      setTransferAmount('');
      setTransferComment('');
    }
  };

  const handleDeleteGoal = async (id: string) => {
    await deleteSavingsGoal(id);
    setGoals((prev) => prev.filter((g) => g.id !== id));
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return '#22C55E';
    if (progress >= 80) return '#F59E0B';
    return '#3B82F6';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

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
          <PiggyBank size={32} color="#059669" />
        </View>
        <Text style={styles.title}>Epargne</Text>
        <Text style={styles.subtitle}>Construis ton patrimoine</Text>
      </View>

      {/* Total Savings Card */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Epargne</Text>
        <Text style={styles.totalAmount}>{formatCurrency(totalSavings)}</Text>
        <View style={styles.totalFooter}>
          <Text style={styles.totalSubtext}>Vers {goals.length} objectif{goals.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => setShowTransferModal(true)}>
          <Plus size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Ajouter a l'epargne</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButtonSecondary} onPress={() => setShowGoalModal(true)}>
          <Target size={20} color="#059669" />
          <Text style={styles.actionButtonSecondaryText}>Nouvel objectif</Text>
        </TouchableOpacity>
      </View>

      {/* Goals Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Objectifs d'epargne</Text>

        {goals.length === 0 ? (
          <View style={styles.emptyState}>
            <Target size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Aucun objectif</Text>
            <Text style={styles.emptySubtitle}>Cree ton premier objectif d'epargne</Text>
          </View>
        ) : (
          goals.map((goal) => {
            const progress = (Number(goal.current_amount) / Number(goal.target_amount)) * 100;
            const remaining = Number(goal.target_amount) - Number(goal.current_amount);
            const progressColor = getProgressColor(progress);
            const ownerInfo = OWNERS[goal.owner as OwnerKey];

            return (
              <View key={goal.id} style={styles.goalCard}>
                <View style={styles.goalHeader}>
                  <View style={styles.goalInfo}>
                    <View style={[styles.goalIcon, { backgroundColor: progressColor + '20' }]}>
                      <Target size={20} color={progressColor} />
                    </View>
                    <View>
                      <Text style={styles.goalName}>{goal.name}</Text>
                      <View style={styles.goalOwnerRow}>
                        {goal.owner === 'personal' ? (
                          <User size={12} color={ownerInfo.color} />
                        ) : (
                          <Building2 size={12} color={ownerInfo.color} />
                        )}
                        <Text style={[styles.goalOwnerText, { color: ownerInfo.color }]}>
                          {ownerInfo.label}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteGoal(goal.id)}
                  >
                    <Trash2 size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                <View style={styles.goalProgress}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.min(progress, 100)}%`, backgroundColor: progressColor },
                      ]}
                    />
                  </View>
                  <View style={styles.progressLabels}>
                    <Text style={styles.progressCurrent}>{formatCurrency(Number(goal.current_amount))}</Text>
                    <Text style={styles.progressTarget}>{formatCurrency(Number(goal.target_amount))}</Text>
                  </View>
                </View>

                <View style={styles.goalStats}>
                  <View style={styles.goalStat}>
                    <Text style={styles.goalStatLabel}>Progression</Text>
                    <Text style={[styles.goalStatValue, { color: progressColor }]}>
                      {progress.toFixed(0)}%
                    </Text>
                  </View>
                  <View style={styles.goalStat}>
                    <Text style={styles.goalStatLabel}>Restant</Text>
                    <Text style={styles.goalStatValue}>{formatCurrency(Math.max(0, remaining))}</Text>
                  </View>
                  <View style={styles.goalStat}>
                    <Text style={styles.goalStatLabel}>Priorite</Text>
                    <Text style={styles.goalStatValue}>P{goal.priority}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Recent Transfers */}
      {transfers.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transferts recents</Text>
          {transfers.slice(0, 5).map((transfer) => {
            const sourceInfo = ACCOUNTS[transfer.source_account as typeof ACCOUNT_KEYS[number]];
            const ownerInfo = OWNERS[transfer.owner as OwnerKey];

            return (
              <View key={transfer.id} style={styles.transferItem}>
                <View style={styles.transferLeft}>
                  <View style={styles.transferIcon}>
                    <ArrowRight size={16} color="#059669" />
                  </View>
                  <View>
                    <Text style={styles.transferAmountText}>{formatCurrency(Number(transfer.amount))}</Text>
                    <View style={styles.transferMeta}>
                      <Wallet size={12} color={sourceInfo.color} />
                      <Text style={styles.transferSource}>{sourceInfo.label}</Text>
                      {transfer.goal_id && (
                        <Text style={styles.transferGoal}>
                          vers un objectif
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
                <View style={[styles.transferOwner, { backgroundColor: ownerInfo.color + '15' }]}>
                  {transfer.owner === 'personal' ? (
                    <User size={12} color={ownerInfo.color} />
                  ) : (
                    <Building2 size={12} color={ownerInfo.color} />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Add Goal Modal */}
      <Modal
        visible={showGoalModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowGoalModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowGoalModal(false)}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nouvel objectif</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Nom de l'objectif</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: Fonds d'urgence"
                placeholderTextColor="#9CA3AF"
                value={goalName}
                onChangeText={setGoalName}
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Montant cible (FCFA)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: 2000000"
                placeholderTextColor="#9CA3AF"
                value={goalTarget}
                onChangeText={setGoalTarget}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Espace</Text>
              <View style={styles.ownerSelector}>
                {OWNER_KEYS.map((key) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.ownerChip,
                      goalOwner === key && { borderColor: OWNERS[key].color, backgroundColor: OWNERS[key].color + '15' },
                    ]}
                    onPress={() => setGoalOwner(key)}
                  >
                    {key === 'personal' ? (
                      <User size={14} color={goalOwner === key ? OWNERS[key].color : '#6B7280'} />
                    ) : (
                      <Building2 size={14} color={goalOwner === key ? OWNERS[key].color : '#6B7280'} />
                    )}
                    <Text style={[styles.ownerChipText, goalOwner === key && { color: OWNERS[key].color }]}>
                      {OWNERS[key].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Priorite (1-10)</Text>
              <View style={styles.prioritySelector}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.priorityChip, goalPriority === p && styles.priorityChipActive]}
                    onPress={() => setGoalPriority(p)}
                  >
                    <Text style={[styles.priorityChipText, goalPriority === p && styles.priorityChipTextActive]}>
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleAddGoal}>
              <Text style={styles.saveButtonText}>Creer l'objectif</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Transfer Modal */}
      <Modal
        visible={showTransferModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTransferModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowTransferModal(false)}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Transferer vers l'epargne</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Montant (FCFA)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: 50000"
                placeholderTextColor="#9CA3AF"
                value={transferAmount}
                onChangeText={setTransferAmount}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Compte source</Text>
              <View style={styles.accountSelector}>
                {ACCOUNT_KEYS.map((key) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.accountChip,
                      transferSource === key && { borderColor: ACCOUNTS[key].color, backgroundColor: ACCOUNTS[key].color + '15' },
                    ]}
                    onPress={() => setTransferSource(key)}
                  >
                    <Wallet size={14} color={transferSource === key ? ACCOUNTS[key].color : '#6B7280'} />
                    <Text style={[styles.accountChipText, transferSource === key && { color: ACCOUNTS[key].color }]}>
                      {ACCOUNTS[key].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Objectif (optionnel)</Text>
              <View style={styles.goalSelector}>
                <TouchableOpacity
                  style={[styles.goalOption, !transferGoalId && styles.goalOptionActive]}
                  onPress={() => setTransferGoalId('')}
                >
                  <Text style={[styles.goalOptionText, !transferGoalId && styles.goalOptionTextActive]}>
                    Epargne generale
                  </Text>
                </TouchableOpacity>
                {goals.map((goal) => (
                  <TouchableOpacity
                    key={goal.id}
                    style={[styles.goalOption, transferGoalId === goal.id && styles.goalOptionActive]}
                    onPress={() => setTransferGoalId(goal.id)}
                  >
                    <Text style={[styles.goalOptionText, transferGoalId === goal.id && styles.goalOptionTextActive]}>
                      {goal.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Espace</Text>
              <View style={styles.ownerSelector}>
                {OWNER_KEYS.map((key) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.ownerChip,
                      transferOwner === key && { borderColor: OWNERS[key].color, backgroundColor: OWNERS[key].color + '15' },
                    ]}
                    onPress={() => setTransferOwner(key)}
                  >
                    {key === 'personal' ? (
                      <User size={14} color={transferOwner === key ? OWNERS[key].color : '#6B7280'} />
                    ) : (
                      <Building2 size={14} color={transferOwner === key ? OWNERS[key].color : '#6B7280'} />
                    )}
                    <Text style={[styles.ownerChipText, transferOwner === key && { color: OWNERS[key].color }]}>
                      {OWNERS[key].label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Commentaire (optionnel)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: Depot mensuel"
                placeholderTextColor="#9CA3AF"
                value={transferComment}
                onChangeText={setTransferComment}
              />
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleAddTransfer}>
              <Text style={styles.saveButtonText}>Transferer</Text>
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
    alignItems: 'center',
    marginBottom: 24,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
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
  totalCard: {
    backgroundColor: '#059669',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 14,
    color: '#D1FAE5',
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  totalFooter: {
    backgroundColor: '#065F46',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  totalSubtext: {
    fontSize: 12,
    color: '#D1FAE5',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 14,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  actionButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#059669',
    borderRadius: 12,
    paddingVertical: 14,
  },
  actionButtonSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
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
  goalCard: {
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
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  goalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  goalIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  goalOwnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  goalOwnerText: {
    fontSize: 12,
    fontWeight: '500',
  },
  deleteButton: {
    padding: 8,
  },
  goalProgress: {
    marginBottom: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressCurrent: {
    fontSize: 12,
    color: '#6B7280',
  },
  progressTarget: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  goalStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
  },
  goalStat: {
    alignItems: 'center',
  },
  goalStatLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  goalStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  transferItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  transferLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  transferIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transferAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  transferMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  transferSource: {
    fontSize: 12,
    color: '#6B7280',
  },
  transferGoal: {
    fontSize: 12,
    color: '#059669',
  },
  transferOwner: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 13,
    color: '#6B7280',
  },
  accountSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  accountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  accountChipText: {
    fontSize: 12,
    color: '#6B7280',
  },
  goalSelector: {
    gap: 8,
  },
  goalOption: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  goalOptionActive: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  goalOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  goalOptionTextActive: {
    color: '#059669',
    fontWeight: '500',
  },
  prioritySelector: {
    flexDirection: 'row',
    gap: 6,
  },
  priorityChip: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityChipActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  priorityChipText: {
    fontSize: 12,
    color: '#374151',
  },
  priorityChipTextActive: {
    color: '#fff',
    fontWeight: '600',
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
