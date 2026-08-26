import type { TransactionInsert } from '@/types/database';
import {
  ACCOUNT_CONFIG,
  ACCOUNT_KEYS,
  ACCOUNTS,
  type AccountKey,
  type AccountType,
} from '@/types/accounts';

export {
  ACCOUNT_CONFIG,
  ACCOUNT_KEYS,
  ACCOUNT_PROVIDER_CONFIG,
  ACCOUNT_TYPE_LABELS,
  ACCOUNTS,
  type AccountKey,
  type AccountType,
} from '@/types/accounts';

export interface ParsedTransaction {
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  account: AccountType;
  owner: 'personal' | 'bgi' | 'aurel' | 'onkoonnect';
  confidence: number; // 0-100, confidence level of categorization
}

// Extensible keyword library for categorization
// Each category has primary keywords and synonyms
const CATEGORY_KEYWORDS: Record<string, { keywords: string[]; synonyms: string[] }> = {
  transport: {
    keywords: ['taxi', 'bus', 'metro', 'velo', 'parking', 'uber', 'bolt'],
    synonyms: ['essence', 'carburant', 'diesel', 'gasoil', 'fuel', 'gaz', 'trafic', 'route', 'voyage'],
  },
  alimentation: {
    keywords: ['burger', 'riz', 'poulet', 'poisson', 'restaurant', 'cafe', 'pizza', 'repas', 'chawarma', 'sandwich'],
    synonyms: ['legumes', 'fruits', 'the', 'eau', 'biere', 'vin', 'salade', 'nourriture', 'dejeuner', 'diner', 'petit-dej', 'plats', 'bouffe', 'manger', 'pain', 'lait', 'oeuf', 'viande', 'porc', 'mouton'],
  },
  revenu: {
    keywords: ['salaire', 'prime', 'bonus', 'commission', 'vente', 'recu', 'paiement'],
    synonyms: ['gagne', 'gagné', 'reçu', 'revenu', 'rente', 'remboursement', 'refund', 'virement recu', 'payment', 'client', 'facture payee'],
  },
  logement: {
    keywords: ['loyer', 'appartement', 'maison'],
    synonyms: ['electricite', 'internet', 'telephone', 'gaz', 'facture', 'canal', 'abonnement', 'tv', 'eau'],
  },
  sante: {
    keywords: ['medicament', 'pharmacie', 'medecin', 'hopital', 'dentiste', 'clinique'],
    synonyms: ['sante', 'consultation', 'ordonnance', 'analyse', 'examen', 'soins', 'docteur', 'infirmier'],
  },
  shopping: {
    keywords: ['vetement', 'chaussures', 'sac', 'mode', 'supermarche', 'courses'],
    synonyms: ['habits', 'tenue', 'accessoires', 'magasin', 'boutique', 'achats'],
  },
  loisir: {
    keywords: ['cinema', 'sport', 'voyage', 'vacances', 'festival', 'concert', 'jeu', 'cadeau'],
    synonyms: ['divertissement', 'sortie', 'entertainment', 'netflix', 'spotify', 'musique', 'film', 'theatre'],
  },
  education: {
    keywords: ['education', 'livre', 'formation', 'ecole', 'universite'],
    synonyms: ['cours', 'etude', 'apprentissage', 'scolaire', 'etudiant', 'classe', 'diplome', 'certificat'],
  },
  internet: {
    keywords: ['starlink', 'wifi', 'internet', 'data', 'forfait'],
    synonyms: ['connexion', 'reseau', 'abonnement internet', 'box', 'routeur', '4g', '5g'],
  },
  telephone: {
    keywords: ['credit', 'recharge', 'appel'],
    synonyms: ['communication', 'forfait tel', 'mobile', 'sim', 'numero'],
  },
  factures: {
    keywords: ['facture', 'abonnement'],
    synonyms: ['prelevement', 'mensuel', 'facture eau', 'facture electricite', 'sde', 'sdeee', 'cee'],
  },
  autres: {
    keywords: [],
    synonyms: [],
  },
};

const INCOME_KEYWORDS = [
  'salaire', 'prime', 'bonus', 'commission', 'vente',
  'gagne', 'gagné', 'reçu', 'recu', 'revenu', 'rente',
  'remboursement', 'refund', 'paiement recu', 'virement recu',
  'client', 'facture', 'reglement', 'encaissement',
];

const ACCOUNT_KEYWORDS: Record<string, AccountType> = {
  wave: 'wave',
  'wave money': 'wave',
  orange: 'orange_money',
  'orange money': 'orange_money',
  om: 'orange_money',
  moov: 'moov_money',
  'moov money': 'moov_money',
  mtn: 'moov_money',
  cash: 'cash',
  espece: 'cash',
  especes: 'cash',
  liquide: 'cash',
  banque: 'bank',
  bank: 'bank',
  compte: 'bank',
  virement: 'bank',
  carte: 'card',
  'carte bancaire': 'card',
  cb: 'card',
  visa: 'card',
  mastercard: 'card',
  epargne: 'savings',
  'livret': 'savings',
  investissement: 'investment',
  'mobile money': 'mobile_money',
  'money mobile': 'mobile_money',
  mobile: 'mobile_money',
  other: 'other',
  autre: 'other',
};

const OWNER_KEYWORDS: Record<string, 'personal' | 'bgi' | 'aurel' | 'onkoonnect'> = {
  personnel: 'personal',
  perso: 'personal',
  personal: 'personal',
  bgi: 'bgi',
  aurel: 'aurel',
  onkoonnect: 'onkoonnect',
  onkoon: 'onkoonnect',
  entreprise: 'bgi',
  business: 'bgi',
};

export const CATEGORY_KEYS = [
  'transport',
  'alimentation',
  'revenu',
  'logement',
  'sante',
  'shopping',
  'loisir',
  'education',
  'internet',
  'telephone',
  'factures',
  'autres',
] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export const CATEGORIES: Record<CategoryKey, { label: string; icon: string; color: string }> = {
  transport: { label: 'Transport', icon: 'Car', color: '#3B82F6' },
  alimentation: { label: 'Alimentation', icon: 'UtensilsCrossed', color: '#10B981' },
  revenu: { label: 'Revenu', icon: 'TrendingUp', color: '#22C55E' },
  logement: { label: 'Logement', icon: 'Home', color: '#8B5CF6' },
  sante: { label: 'Sante', icon: 'Heart', color: '#EF4444' },
  shopping: { label: 'Shopping', icon: 'ShoppingBag', color: '#F59E0B' },
  loisir: { label: 'Loisir', icon: 'Gamepad2', color: '#EC4899' },
  education: { label: 'Education', icon: 'GraduationCap', color: '#06B6D4' },
  internet: { label: 'Internet', icon: 'Wifi', color: '#6366F1' },
  telephone: { label: 'Telephone', icon: 'Phone', color: '#14B8A6' },
  factures: { label: 'Factures', icon: 'Receipt', color: '#F97316' },
  autres: { label: 'Autres', icon: 'MoreHorizontal', color: '#6B7280' },
};

export const OWNER_KEYS = ['personal', 'bgi', 'aurel', 'onkoonnect'] as const;
export type OwnerKey = (typeof OWNER_KEYS)[number];

export const OWNERS: Record<OwnerKey, { label: string; color: string }> = {
  personal: { label: 'Personnel', color: '#3B82F6' },
  bgi: { label: 'BGI', color: '#8B5CF6' },
  aurel: { label: 'AUREL', color: '#F59E0B' },
  onkoonnect: { label: 'ON\'KOONNECT', color: '#10B981' },
};

function findCategoryMatch(text: string): { category: string; confidence: number } {
  let bestMatch = { category: 'autres', confidence: 0 };

  for (const [category, data] of Object.entries(CATEGORY_KEYWORDS)) {
    // Check primary keywords (higher confidence)
    for (const keyword of data.keywords) {
      if (text.includes(keyword)) {
        return { category, confidence: 95 };
      }
    }

    // Check synonyms (lower confidence)
    for (const synonym of data.synonyms) {
      if (text.includes(synonym)) {
        if (bestMatch.confidence < 80) {
          bestMatch = { category, confidence: 75 };
        }
      }
    }
  }

  return bestMatch;
}

export function parseTransaction(input: string): ParsedTransaction | null {
  const text = input.toLowerCase().trim();

  if (!text) return null;

  // Extract amount
  const amountMatch = text.match(/\d+([.,]\d+)?/);
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[0].replace(',', '.'));
  if (isNaN(amount) || amount <= 0) return null;

  // Determine type (income or expense)
  let type: 'income' | 'expense' = 'expense';
  let typeConfidence = 90;
  for (const keyword of INCOME_KEYWORDS) {
    if (text.includes(keyword)) {
      type = 'income';
      typeConfidence = 100;
      break;
    }
  }

  // Determine category with confidence
  const categoryMatch = findCategoryMatch(text);
  let category = categoryMatch.category;
  let categoryConfidence = categoryMatch.confidence;

  // For income, override category to 'revenu' with high confidence
  if (type === 'income') {
    category = 'revenu';
    categoryConfidence = 100;
  }

  // Determine account
  let account: AccountType = 'cash';
  let accountConfidence = 100;
  for (const [keyword, acc] of Object.entries(ACCOUNT_KEYWORDS)) {
    if (text.includes(keyword)) {
      account = acc;
      accountConfidence = 100;
      break;
    }
  }

  // Determine owner
  let owner: 'personal' | 'bgi' | 'aurel' | 'onkoonnect' = 'personal';
  let ownerConfidence = 70; // Default assumption
  for (const [keyword, own] of Object.entries(OWNER_KEYWORDS)) {
    if (text.includes(keyword)) {
      owner = own;
      ownerConfidence = 100;
      break;
    }
  }

  // Overall confidence (weighted average)
  const overallConfidence = Math.round(
    (typeConfidence * 0.3 + categoryConfidence * 0.4 + accountConfidence * 0.1 + ownerConfidence * 0.2)
  );

  // Generate clean description (remove numbers and keywords)
  let description = input
    .replace(/\d+([.,]\d+)?/g, '')
    .replace(/(wave|orange|moov|cash|orange money|moov money|wave money|om|mtn|banque|bank|carte|personnel|perso|bgi|aurel|onkoonnect)/gi, '')
    .trim();

  // If description is empty or too short, generate one
  if (description.length < 2) {
    description = type === 'income' ? 'Revenu' : 'Depense';
  }

  return {
    amount,
    type,
    category,
    description,
    account,
    owner,
    confidence: overallConfidence,
  };
}

export function createTransactionFromParsed(
  parsed: ParsedTransaction
): TransactionInsert {
  return {
    amount: parsed.amount,
    type: parsed.type,
    category: parsed.category,
    description: parsed.description,
    account: parsed.account,
    owner: parsed.owner,
    transaction_nature: parsed.type,
    date: new Date().toISOString(),
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' FCFA';
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaines`;
  if (diffDays < 365) return `Il y a ${Math.floor(diffDays / 30)} mois`;
  return `Il y a ${Math.floor(diffDays / 365)} ans`;
}

export function getCategoryInfo(category: string) {
  return CATEGORIES[category as CategoryKey] || CATEGORIES.autres;
}

export function getAccountInfo(account: string) {
  return ACCOUNTS[account as AccountKey] || ACCOUNT_CONFIG.cash;
}

export function getOwnerInfo(owner: string) {
  return OWNERS[owner as OwnerKey] || OWNERS.personal;
}
