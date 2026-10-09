import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Easing,
  Modal,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  parseTransaction,
  createTransactionFromParsed,
  formatCurrency,
  getCategoryInfo,
  getAccountInfo,
  getOwnerInfo,
  CATEGORIES,
  CATEGORY_KEYS,
  OWNERS,
  OWNER_KEYS,
} from '@/services/parserService';
import { ACCOUNT_CONFIG as ACCOUNTS, ACCOUNT_KEYS } from '@/types/accounts';
import type { ParsedTransaction } from '@/services/parserService';
import { addTransaction } from '@/services/transactionService';
import { getActiveAccounts } from '@/services/accountService';
import type { Account } from '@/types/database';
import {
  ArrowRight,
  Sparkles,
  CheckCircle,
  AlertCircle,
  X,
  ChevronDown,
  Building2,
  User,
  Wallet,
} from 'lucide-react-native';

const SUGGESTIONS = [
  'Taxi 2500',
  'Burger 3500',
  'Salaire 250000 BGI',
  'Courses 15000',
  'Carburant 8000',
  'Loyer 50000',
  'Medicament 5000 pharmacie',
  'Essence 15000 Wave',
  'Internet Starlink 25000',
];

const HIGH_CONFIDENCE_THRESHOLD = 85;

export default function AddTransactionScreen() {
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<ParsedTransaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [editedParsed, setEditedParsed] = useState<ParsedTransaction | null>(null);
  const [realAccounts, setRealAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 300);

    Animated.timing(opacityAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();

    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadAccounts = async () => {
      let timeout: ReturnType<typeof setTimeout> | null = null;

      try {
        const result = await Promise.race([
          getActiveAccounts(),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(
              () => reject(new Error('Le chargement des comptes a expiré. Réessaie.')),
              15000
            );
          }),
        ]);

        if (!isMounted) return;
        if (result.error) {
          setAccountsError(result.error);
          setRealAccounts([]);
        } else {
          setRealAccounts(result.data || []);
          setAccountsError(null);
        }
      } catch (loadError) {
        if (isMounted) {
          setAccountsError(
            loadError instanceof Error
              ? loadError.message
              : 'Impossible de charger les comptes. Réessaie.'
          );
          setRealAccounts([]);
        }
      } finally {
        if (timeout) clearTimeout(timeout);
        if (isMounted) setAccountsLoading(false);
      }
    };

    loadAccounts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const result = parseTransaction(input);
    setParsed(result);
  }, [input]);

  const handleSave = async (transactionData?: ParsedTransaction) => {
    const dataToSave = transactionData || parsed;
    if (!dataToSave) {
      setError('Entre une dépense valide (ex: Taxi 2500)');
      return;
    }

    // Show confirmation modal if confidence is low
    if (dataToSave.confidence < HIGH_CONFIDENCE_THRESHOLD && !transactionData) {
      setEditedParsed({ ...dataToSave });
      setShowConfirmModal(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      const transaction = createTransactionFromParsed(dataToSave);
      const result = await addTransaction(transaction);

      if (result.error) {
        setError(result.error);
        return;
      }
      if (!result.data) {
        setError('La transaction n’a pas été confirmée par le serveur. Réessaie.');
        return;
      }

      setSuccess(true);
      setShowConfirmModal(false);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      successTimeoutRef.current = setTimeout(() => {
        setInput('');
        setParsed(null);
        setEditedParsed(null);
        setError(null);
        setSuccess(false);
        inputRef.current?.focus();
      }, 1200);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Impossible d’enregistrer la transaction. Réessaie.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionPress = (suggestion: string) => {
    setInput(suggestion);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const selectAccount = (
    transaction: ParsedTransaction,
    accountId: string | null
  ): ParsedTransaction => {
    const selectedAccount = realAccounts.find((account) => account.id === accountId);

    return {
      ...transaction,
      account_id: selectedAccount?.id ?? null,
      account: selectedAccount?.account_type ?? transaction.account,
    };
  };

  const renderAccountSelector = (
    transaction: ParsedTransaction,
    onSelect: (transaction: ParsedTransaction) => void
  ) => (
    <View style={styles.accountSelectorContainer}>
      <Text style={styles.selectorLabel}>Compte utilisé:</Text>
      {accountsLoading && <Text style={styles.accountStatusText}>Chargement des comptes...</Text>}
      {accountsError && <Text style={styles.accountStatusError}>{accountsError}</Text>}
      {!accountsLoading && realAccounts.length > 0 && (
        <View style={styles.confirmOptions}>
          {realAccounts.map((account) => (
            <TouchableOpacity
              key={account.id}
              style={[
                styles.confirmOptionSmall,
                transaction.account_id === account.id && {
                  backgroundColor: ACCOUNTS[account.account_type].color + '20',
                  borderColor: ACCOUNTS[account.account_type].color,
                },
              ]}
              onPress={() => onSelect(selectAccount(transaction, account.id))}
            >
              <Text
                style={[
                  styles.confirmOptionSmallText,
                  transaction.account_id === account.id && {
                    color: ACCOUNTS[account.account_type].color,
                  },
                ]}
              >
                {account.name}
              </Text>
              <Text style={styles.accountTypeText}>{ACCOUNTS[account.account_type].label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <Text style={styles.accountFallbackLabel}>Fallback legacy</Text>
      <View style={styles.confirmOptions}>
        {ACCOUNT_KEYS.map((key) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.confirmOptionSmall,
              !transaction.account_id && transaction.account === key && {
                backgroundColor: ACCOUNTS[key].color + '20',
                borderColor: ACCOUNTS[key].color,
              },
            ]}
            onPress={() => onSelect({ ...transaction, account_id: null, account: key })}
          >
            <Text
              style={[
                styles.confirmOptionSmallText,
                !transaction.account_id && transaction.account === key && { color: ACCOUNTS[key].color },
              ]}
            >
              {ACCOUNTS[key].label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (success) {
    return (
      <View style={styles.successContainer}>
        <Animated.View style={{ opacity: opacityAnim }}>
          <CheckCircle size={80} color="#059669" />
        </Animated.View>
        <Text style={styles.successTitle}>Ajouté avec succès!</Text>
        <Text style={styles.successSubtitle}>{parsed?.description}</Text>
      </View>
    );
  }

  const renderOwnerSelector = (
    selectedOwner: string,
    onSelect: (owner: typeof OWNER_KEYS[number]) => void
  ) => (
    <View style={styles.selectorContainer}>
      <Text style={styles.selectorLabel}>Cette opération appartient à:</Text>
      <View style={styles.ownerSelector}>
        {OWNER_KEYS.map((key) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.ownerChip,
              selectedOwner === key && { borderColor: OWNERS[key].color, backgroundColor: OWNERS[key].color + '15' },
            ]}
            onPress={() => onSelect(key)}
          >
            {key === 'personal' ? (
              <User size={14} color={selectedOwner === key ? OWNERS[key].color : '#6B7280'} />
            ) : (
              <Building2 size={14} color={selectedOwner === key ? OWNERS[key].color : '#6B7280'} />
            )}
            <Text
              style={[
                styles.ownerChipText,
                selectedOwner === key && { color: OWNERS[key].color, fontWeight: '600' },
              ]}
            >
              {OWNERS[key].label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Sparkles size={32} color="#059669" />
          <Text style={styles.title}>Que s'est-il passé?</Text>
          <Text style={styles.subtitle}>
            Décris ta dépense ou ton revenu en langage naturel
          </Text>
        </View>

        <View style={styles.inputSection}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Ex: Taxi 2500"
            placeholderTextColor="#9CA3AF"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={200}
          />

          {error && (
            <View style={styles.errorContainer}>
              <AlertCircle size={16} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </View>

        {parsed && (
          <Animated.View style={[styles.previewCard, { opacity: opacityAnim }]}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewTitle}>Aperçu de la transaction</Text>
              {parsed.confidence < HIGH_CONFIDENCE_THRESHOLD && (
                <View style={styles.lowConfidenceBadge}>
                  <AlertCircle size={12} color="#F59E0B" />
                  <Text style={styles.lowConfidenceText}>Vérification requise</Text>
                </View>
              )}
              {parsed.confidence >= HIGH_CONFIDENCE_THRESHOLD && (
                <View style={styles.highConfidenceBadge}>
                  <CheckCircle size={12} color="#22C55E" />
                  <Text style={styles.highConfidenceText}>Auto</Text>
                </View>
              )}
            </View>

            <View style={styles.previewContent}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Montant</Text>
                <Text style={[styles.previewValue, styles.amountValue]}>
                  {formatCurrency(parsed.amount)}
                </Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Type</Text>
                <View
                  style={[
                    styles.typeBadge,
                    { backgroundColor: parsed.type === 'income' ? '#D1FAE5' : '#FEE2E2' },
                  ]}
                >
                  <Text
                    style={[
                      styles.typeText,
                      { color: parsed.type === 'income' ? '#059669' : '#DC2626' },
                    ]}
                  >
                    {parsed.type === 'income' ? 'Revenu' : 'Dépense'}
                  </Text>
                </View>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Catégorie</Text>
                <View style={styles.categoryBadge}>
                  <View
                    style={[
                      styles.categoryDot,
                      { backgroundColor: getCategoryInfo(parsed.category).color },
                    ]}
                  />
                  <Text style={styles.categoryText}>
                    {getCategoryInfo(parsed.category).label}
                  </Text>
                </View>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Compte</Text>
                <View style={styles.accountBadge}>
                  <Wallet size={12} color={getAccountInfo(parsed.account).color} />
                  <Text style={styles.accountText}>
                    {realAccounts.find((account) => account.id === parsed.account_id)?.name || getAccountInfo(parsed.account).label}
                  </Text>
                </View>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Espace</Text>
                <View style={styles.ownerBadge}>
                  {parsed.owner === 'personal' ? (
                    <User size={12} color={getOwnerInfo(parsed.owner).color} />
                  ) : (
                    <Building2 size={12} color={getOwnerInfo(parsed.owner).color} />
                  )}
                  <Text style={[styles.ownerText, { color: getOwnerInfo(parsed.owner).color }]}>
                    {getOwnerInfo(parsed.owner).label}
                  </Text>
                </View>
              </View>

              {parsed.description && (
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Description</Text>
                  <Text style={styles.descriptionText}>{parsed.description}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={styles.editDetailsButton}
              onPress={() => {
                setEditedParsed({ ...parsed });
                setShowConfirmModal(true);
              }}
            >
              <Text style={styles.editDetailsButtonText}>
                Modifier type, catégorie, compte ou espace
              </Text>
            </TouchableOpacity>
              {renderAccountSelector(parsed, setParsed)}
          </Animated.View>
        )}

        <View style={styles.suggestionsSection}>
          <Text style={styles.suggestionsTitle}>Suggestions rapides</Text>
          <View style={styles.suggestionsGrid}>
            {SUGGESTIONS.map((suggestion) => (
              <TouchableOpacity
                key={suggestion}
                style={styles.suggestionChip}
                onPress={() => handleSuggestionPress(suggestion)}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              (!parsed || loading) && styles.saveButtonDisabled,
            ]}
            onPress={() => handleSave()}
            disabled={!parsed || loading}
          >
            <Text style={styles.saveButtonText}>
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </Text>
            <ArrowRight size={20} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowConfirmModal(false)}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Confirmer la transaction</Text>
            <View style={{ width: 24 }} />
          </View>

          {editedParsed && (
            <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
              <View style={styles.confirmSection}>
                <Text style={styles.confirmLabel}>Montant</Text>
                <Text style={styles.confirmAmount}>{formatCurrency(editedParsed.amount)}</Text>
              </View>

              <View style={styles.confirmSection}>
                <Text style={styles.confirmLabel}>Type</Text>
                <View style={styles.confirmOptions}>
                  <TouchableOpacity
                    style={[
                      styles.confirmOption,
                      editedParsed.type === 'expense' && styles.confirmOptionActive,
                    ]}
                    onPress={() => setEditedParsed({ ...editedParsed, type: 'expense' })}
                  >
                    <Text style={[styles.confirmOptionText, editedParsed.type === 'expense' && styles.confirmOptionTextActive]}>
                      Dépense
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.confirmOption,
                      editedParsed.type === 'income' && styles.confirmOptionActive,
                    ]}
                    onPress={() => setEditedParsed({ ...editedParsed, type: 'income' })}
                  >
                    <Text style={[styles.confirmOptionText, editedParsed.type === 'income' && styles.confirmOptionTextActive]}>
                      Revenu
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.confirmSection}>
                <Text style={styles.confirmLabel}>Catégorie</Text>
                <View style={styles.confirmOptions}>
                  {CATEGORY_KEYS.slice(0, 6).map((key) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.confirmOptionSmall,
                        editedParsed.category === key && { backgroundColor: CATEGORIES[key].color + '20', borderColor: CATEGORIES[key].color },
                      ]}
                      onPress={() => setEditedParsed({ ...editedParsed, category: key })}
                    >
                      <Text style={[styles.confirmOptionSmallText, editedParsed.category === key && { color: CATEGORIES[key].color }]}>
                        {CATEGORIES[key].label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.confirmOptions}>
                  {CATEGORY_KEYS.slice(6).map((key) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.confirmOptionSmall,
                        editedParsed.category === key && { backgroundColor: CATEGORIES[key].color + '20', borderColor: CATEGORIES[key].color },
                      ]}
                      onPress={() => setEditedParsed({ ...editedParsed, category: key })}
                    >
                      <Text style={[styles.confirmOptionSmallText, editedParsed.category === key && { color: CATEGORIES[key].color }]}>
                        {CATEGORIES[key].label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.confirmSection}>
                {renderAccountSelector(editedParsed, setEditedParsed)}
              </View>

              {renderOwnerSelector(editedParsed.owner, (owner) =>
                setEditedParsed({ ...editedParsed, owner })
              )}

              {error && (
                <View style={styles.errorContainer}>
                  <AlertCircle size={16} color="#DC2626" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => handleSave(editedParsed)}
              >
                <Text style={styles.confirmButtonText}>Confirmer et enregistrer</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  inputSection: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 20,
    fontSize: 18,
    color: '#111827',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    flex: 1,
  },
  previewCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lowConfidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  lowConfidenceText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '500',
  },
  highConfidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  highConfidenceText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '500',
  },
  previewContent: {
    gap: 12,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  amountValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#059669',
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  accountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  accountText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  accountSelectorContainer: {
    marginTop: 8,
    gap: 8,
  },
  accountStatusText: {
    fontSize: 13,
    color: '#6B7280',
  },
  accountStatusError: {
    fontSize: 13,
    color: '#DC2626',
  },
  accountTypeText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  accountFallbackLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  editDetailsButton: {
    alignSelf: 'flex-start',
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 8,
  },
  editDetailsButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  ownerText: {
    fontSize: 13,
    fontWeight: '500',
  },
  descriptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    textAlign: 'right',
    maxWidth: 180,
  },
  suggestionsSection: {
    marginBottom: 24,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  suggestionText: {
    fontSize: 13,
    color: '#374151',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    borderRadius: 16,
    height: 56,
    gap: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 24,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  confirmSection: {
    marginBottom: 20,
  },
  confirmLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  confirmAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#059669',
  },
  confirmOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  confirmOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  confirmOptionActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  confirmOptionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  confirmOptionTextActive: {
    color: '#fff',
  },
  confirmOptionSmall: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  confirmOptionSmallText: {
    fontSize: 13,
    color: '#374151',
  },
  selectorContainer: {
    marginBottom: 20,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
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
  confirmButton: {
    backgroundColor: '#059669',
    borderRadius: 16,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
