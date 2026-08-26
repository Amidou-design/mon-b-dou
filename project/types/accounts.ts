export type AccountType =
  | 'cash'
  | 'wave'
  | 'orange_money'
  | 'moov_money'
  | 'bank'
  | 'card'
  | 'savings'
  | 'investment'
  | 'mobile_money'
  | 'other';

export type AccountProvider =
  | 'wave'
  | 'orange_money'
  | 'moov_money'
  | 'bank'
  | 'card'
  | 'cash'
  | 'other'
  | null;

export const ACCOUNT_KEYS = [
  'cash',
  'wave',
  'orange_money',
  'moov_money',
  'bank',
  'card',
  'savings',
  'investment',
  'mobile_money',
  'other',
] as const;

export type AccountKey = (typeof ACCOUNT_KEYS)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: 'Espèces',
  wave: 'Wave',
  orange_money: 'Orange Money',
  moov_money: 'Moov Money',
  bank: 'Banque',
  card: 'Carte bancaire',
  savings: 'Épargne',
  investment: 'Investissement',
  mobile_money: 'Mobile Money',
  other: 'Autre',
};

export const ACCOUNT_CONFIG: Record<AccountType, { label: string; color: string; icon: string }> = {
  cash: { label: 'Espèces', color: '#22C55E', icon: 'Wallet' },
  wave: { label: 'Wave', color: '#1B4DFF', icon: 'Smartphone' },
  orange_money: { label: 'Orange Money', color: '#FF6600', icon: 'Smartphone' },
  moov_money: { label: 'Moov Money', color: '#00A3E0', icon: 'Smartphone' },
  bank: { label: 'Banque', color: '#6366F1', icon: 'Landmark' },
  card: { label: 'Carte bancaire', color: '#EC4899', icon: 'CreditCard' },
  savings: { label: 'Épargne', color: '#059669', icon: 'PiggyBank' },
  investment: { label: 'Investissement', color: '#8B5CF6', icon: 'TrendingUp' },
  mobile_money: { label: 'Mobile Money', color: '#F59E0B', icon: 'Smartphone' },
  other: { label: 'Autre', color: '#9CA3AF', icon: 'Package' },
};

export const ACCOUNTS = ACCOUNT_CONFIG;

export const ACCOUNT_PROVIDER_CONFIG: Record<Exclude<AccountProvider, null>, { label: string; color: string }> = {
  wave: { label: 'Wave', color: '#1B4DFF' },
  orange_money: { label: 'Orange Money', color: '#FF6600' },
  moov_money: { label: 'Moov Money', color: '#00A3E0' },
  bank: { label: 'Banque', color: '#6366F1' },
  card: { label: 'Carte bancaire', color: '#EC4899' },
  cash: { label: 'Espèces', color: '#22C55E' },
  other: { label: 'Autre', color: '#9CA3AF' },
};
