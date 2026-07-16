import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { getTransactions, deleteTransaction } from '@/services/transactionService';
import type { Transaction } from '@/services/transactionService';
import {
  formatCurrency,
  formatRelativeDate,
  getCategoryInfo,
  getAccountInfo,
  getOwnerInfo,
  CATEGORIES,
  CATEGORY_KEYS,
  OWNER_KEYS,
  OWNERS,
} from '@/services/parserService';
import type { OwnerKey } from '@/services/parserService';
import { Search, Filter, Trash2, X, TrendingUp, TrendingDown, User, Building2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

type FilterType = 'all' | 'income' | 'expense';
type CategoryFilter = string | null;
type OwnerFilter = OwnerKey | 'all';

export default function HistoryScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterCategory, setFilterCategory] = useState<CategoryFilter>(null);
  const [filterOwner, setFilterOwner] = useState<OwnerFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [deleteModal, setDeleteModal] = useState<Transaction | null>(null);

  const loadTransactions = useCallback(async () => {
    const { data } = await getTransactions();
    if (data) {
      setTransactions(data);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    let filtered = transactions;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.description.toLowerCase().includes(query) ||
          t.category.toLowerCase().includes(query)
      );
    }

    if (filterType !== 'all') {
      filtered = filtered.filter((t) => t.type === filterType);
    }

    if (filterCategory) {
      filtered = filtered.filter((t) => t.category === filterCategory);
    }

    if (filterOwner !== 'all') {
      filtered = filtered.filter((t) => t.owner === filterOwner);
    }

    setFilteredTransactions(filtered);
  }, [transactions, searchQuery, filterType, filterCategory, filterOwner]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTransactions();
  }, [loadTransactions]);

  const handleDelete = async () => {
    if (!deleteModal) return;

    const { error } = await deleteTransaction(deleteModal.id);
    if (!error) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setTransactions((prev) => prev.filter((t) => t.id !== deleteModal.id));
    }

    setDeleteModal(null);
  };

  const clearFilters = () => {
    setFilterType('all');
    setFilterCategory(null);
    setFilterOwner('all');
    setSearchQuery('');
  };

  const groupByDate = (data: Transaction[]) => {
    const groups: { [key: string]: Transaction[] } = {};
    data.forEach((t) => {
      const date = new Date(t.date).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(t);
    });
    return groups;
  };

  const groupedTransactions = groupByDate(filteredTransactions);
  const sortedDates = Object.keys(groupedTransactions).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  const renderTransaction = (transaction: Transaction) => (
    <View key={transaction.id} style={styles.transactionItem}>
      <View style={styles.transactionLeft}>
        <View
          style={[
            styles.transactionIcon,
            {
              backgroundColor: transaction.type === 'income' ? '#D1FAE5' : '#FEE2E2',
            },
          ]}
        >
          {transaction.type === 'income' ? (
            <TrendingUp size={18} color="#059669" />
          ) : (
            <TrendingDown size={18} color="#DC2626" />
          )}
        </View>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionDescription}>{transaction.description}</Text>
          <View style={styles.transactionMeta}>
            <View
              style={[
                styles.categoryBadge,
                { backgroundColor: getCategoryInfo(transaction.category).color + '20' },
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  { color: getCategoryInfo(transaction.category).color },
                ]}
              >
                {getCategoryInfo(transaction.category).label}
              </Text>
            </View>
            <View style={styles.ownerBadgeSmall}>
              {transaction.owner === 'personal' ? (
                <User size={10} color={getOwnerInfo(transaction.owner).color} />
              ) : (
                <Building2 size={10} color={getOwnerInfo(transaction.owner).color} />
              )}
              <Text style={[styles.ownerTextSmall, { color: getOwnerInfo(transaction.owner).color }]}>
                {getOwnerInfo(transaction.owner).label}
              </Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.transactionRight}>
        <Text
          style={[
            styles.transactionAmount,
            { color: transaction.type === 'income' ? '#059669' : '#DC2626' },
          ]}
        >
          {transaction.type === 'income' ? '+' : '-'}{' '}
          {formatCurrency(Number(transaction.amount))}
        </Text>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            setDeleteModal(transaction);
          }}
        >
          <Trash2 size={14} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDateGroup = (date: string) => (
    <View key={date} style={styles.dateGroup}>
      <Text style={styles.dateHeader}>{formatRelativeDate(date)}</Text>
      {groupedTransactions[date].map(renderTransaction)}
    </View>
  );

  const totalIncome = filteredTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = filteredTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Historique</Text>
        <Text style={styles.subtitle}>
          {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Search size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity
          style={[
            styles.filterButton,
            (filterType !== 'all' || filterCategory || filterOwner !== 'all') && styles.filterActive,
          ]}
          onPress={() => setShowFilters(true)}
        >
          <Filter size={18} color={filterType !== 'all' || filterCategory || filterOwner !== 'all' ? '#059669' : '#6B7280'} />
        </TouchableOpacity>
      </View>

      {(filterType !== 'all' || filterCategory || filterOwner !== 'all') && (
        <View style={styles.filterPills}>
          {filterType !== 'all' && (
            <View style={styles.filterPill}>
              <Text style={styles.filterPillText}>
                {filterType === 'income' ? 'Revenus' : 'Dépenses'}
              </Text>
              <TouchableOpacity onPress={() => setFilterType('all')}>
                <X size={12} color="#059669" />
              </TouchableOpacity>
            </View>
          )}
          {filterCategory && (
            <View style={styles.filterPill}>
              <Text style={styles.filterPillText}>
                {getCategoryInfo(filterCategory).label}
              </Text>
              <TouchableOpacity onPress={() => setFilterCategory(null)}>
                <X size={12} color="#059669" />
              </TouchableOpacity>
            </View>
          )}
          {filterOwner !== 'all' && (
            <View style={styles.filterPill}>
              <Text style={styles.filterPillText}>
                {getOwnerInfo(filterOwner).label}
              </Text>
              <TouchableOpacity onPress={() => setFilterOwner('all')}>
                <X size={12} color="#059669" />
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity onPress={clearFilters}>
            <Text style={styles.clearText}>Effacer</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Revenus</Text>
          <Text style={[styles.summaryAmount, { color: '#059669' }]}>
            +{formatCurrency(totalIncome)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Dépenses</Text>
          <Text style={[styles.summaryAmount, { color: '#DC2626' }]}>
            -{formatCurrency(totalExpense)}
          </Text>
        </View>
      </View>

      <FlatList
        data={sortedDates}
        renderItem={({ item }) => renderDateGroup(item)}
        keyExtractor={(item) => item}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#059669']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>Aucune transaction</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || filterType !== 'all' || filterCategory || filterOwner !== 'all'
                ? 'Aucun résultat avec ces filtres'
                : 'Ajoute ta première transaction'}
            </Text>
          </View>
        }
      />

      <Modal
        visible={showFilters}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filtres</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <X size={24} color="#111827" />
            </TouchableOpacity>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Type</Text>
            <View style={styles.filterOptions}>
              {[
                { value: 'all', label: 'Tous' },
                { value: 'income', label: 'Revenus' },
                { value: 'expense', label: 'Dépenses' },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.filterOption,
                    filterType === option.value && styles.filterOptionActive,
                  ]}
                  onPress={() => setFilterType(option.value as FilterType)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      filterType === option.value && styles.filterOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Espace</Text>
            <View style={styles.filterOptions}>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  filterOwner === 'all' && styles.filterOptionActive,
                ]}
                onPress={() => setFilterOwner('all')}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    filterOwner === 'all' && styles.filterOptionTextActive,
                  ]}
                >
                  Tous
                </Text>
              </TouchableOpacity>
              {OWNER_KEYS.map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.filterOption,
                    filterOwner === key && styles.filterOptionActive,
                  ]}
                  onPress={() => setFilterOwner(key)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      filterOwner === key && styles.filterOptionTextActive,
                    ]}
                  >
                    {OWNERS[key].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Catégorie</Text>
            <View style={styles.filterOptions}>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  !filterCategory && styles.filterOptionActive,
                ]}
                onPress={() => setFilterCategory(null)}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    !filterCategory && styles.filterOptionTextActive,
                  ]}
                >
                  Toutes
                </Text>
              </TouchableOpacity>
              {CATEGORY_KEYS.map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.filterOption,
                    filterCategory === key && styles.filterOptionActive,
                  ]}
                  onPress={() => setFilterCategory(key)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      filterCategory === key && styles.filterOptionTextActive,
                    ]}
                  >
                    {CATEGORIES[key].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={styles.applyButton}
            onPress={() => setShowFilters(false)}
          >
            <Text style={styles.applyButtonText}>Appliquer</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal
        visible={!!deleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModal(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setDeleteModal(null)}>
          <View style={styles.deleteModal}>
            <View style={styles.deleteModalIcon}>
              <Trash2 size={32} color="#DC2626" />
            </View>
            <Text style={styles.deleteModalTitle}>Supprimer cette transaction?</Text>
            <Text style={styles.deleteModalSubtitle}>
              Cette action est irréversible
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setDeleteModal(null)}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleDelete}>
                <Text style={styles.confirmButtonText}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
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
  searchSection: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#111827',
  },
  filterButton: {
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterActive: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  filterPills: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#059669',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  filterPillText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  clearText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500',
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: '600',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  dateGroup: {
    marginBottom: 24,
  },
  dateHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  transactionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '500',
  },
  ownerBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ownerTextSmall: {
    fontSize: 10,
    fontWeight: '500',
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 6,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
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
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  filterSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterOptionActive: {
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  filterOptionTextActive: {
    color: '#059669',
    fontWeight: '600',
  },
  applyButton: {
    backgroundColor: '#059669',
    marginHorizontal: 20,
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 40,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    alignItems: 'center',
  },
  deleteModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  deleteModalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
