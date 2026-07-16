export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OwnerType = 'personal' | 'bgi' | 'aurel' | 'onkoonnect';
export type AccountType = 'cash' | 'wave' | 'orange_money' | 'moov_money' | 'bank' | 'card';
export type TransactionType = 'income' | 'expense';
export type TransactionNatureType = 'income' | 'expense' | 'transfer' | 'savings' | 'investment' | 'debt' | 'repayment' | 'adjustment';
export type DecisionReasonType = 'need' | 'investment' | 'opportunity' | 'pleasure' | 'urgency' | 'unforeseen' | 'training' | 'family' | 'business' | 'other';
export type RecurringFrequencyType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual';
export type OrganizationType = 'personal' | 'holding' | 'company' | 'subsidiary' | 'project' | 'investment';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
          default_owner: OwnerType | null;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
          default_owner?: OwnerType;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
          default_owner?: OwnerType;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          type: TransactionType;
          category: string;
          description: string;
          account: AccountType;
          owner: OwnerType;
          transaction_nature: TransactionNatureType;
          decision_reason: DecisionReasonType | null;
          is_recurring: boolean;
          recurring_frequency: RecurringFrequencyType | null;
          recurring_end_date: string | null;
          parent_transaction_id: string | null;
          date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          amount: number;
          type: TransactionType;
          category: string;
          description: string;
          account?: AccountType;
          owner?: OwnerType;
          transaction_nature?: TransactionNatureType;
          decision_reason?: DecisionReasonType | null;
          is_recurring?: boolean;
          recurring_frequency?: RecurringFrequencyType | null;
          recurring_end_date?: string | null;
          parent_transaction_id?: string | null;
          date?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount?: number;
          type?: TransactionType;
          category?: string;
          description?: string;
          account?: AccountType;
          owner?: OwnerType;
          transaction_nature?: TransactionNatureType;
          decision_reason?: DecisionReasonType | null;
          is_recurring?: boolean;
          recurring_frequency?: RecurringFrequencyType | null;
          recurring_end_date?: string | null;
          parent_transaction_id?: string | null;
          date?: string;
          created_at?: string;
        };
      };
      organizations: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          icon: string;
          currency: string;
          type: OrganizationType;
          is_default: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          color?: string;
          icon?: string;
          currency?: string;
          type?: OrganizationType;
          is_default?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string;
          icon?: string;
          currency?: string;
          type?: OrganizationType;
          is_default?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      financial_events: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string | null;
          title: string;
          description: string | null;
          event_type: string;
          amount: number;
          expected_date: string;
          is_recurring: boolean;
          recurring_frequency: string | null;
          recurring_end_date: string | null;
          is_completed: boolean;
          completed_at: string | null;
          linked_transaction_id: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          organization_id?: string | null;
          title: string;
          description?: string | null;
          event_type: string;
          amount: number;
          expected_date?: string;
          is_recurring?: boolean;
          recurring_frequency?: string | null;
          recurring_end_date?: string | null;
          is_completed?: boolean;
          completed_at?: string | null;
          linked_transaction_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          organization_id?: string | null;
          title?: string;
          description?: string | null;
          event_type?: string;
          amount?: number;
          expected_date?: string;
          is_recurring?: boolean;
          recurring_frequency?: string | null;
          recurring_end_date?: string | null;
          is_completed?: boolean;
          completed_at?: string | null;
          linked_transaction_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      financial_forecasts: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string | null;
          forecast_date: string;
          forecast_type: string;
          estimated_balance: number;
          expected_income: number;
          expected_expenses: number;
          confidence_level: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          organization_id?: string | null;
          forecast_date?: string;
          forecast_type: string;
          estimated_balance: number;
          expected_income?: number;
          expected_expenses?: number;
          confidence_level?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          organization_id?: string | null;
          forecast_date?: string;
          forecast_type?: string;
          estimated_balance?: number;
          expected_income?: number;
          expected_expenses?: number;
          confidence_level?: number | null;
          created_at?: string;
        };
      };
      insights_history: {
        Row: {
          id: string;
          user_id: string;
          insight_type: string;
          title: string;
          message: string;
          category: string;
          importance: number;
          related_data: Json;
          is_read: boolean;
          is_dismissed: boolean;
          valid_until: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          insight_type: string;
          title: string;
          message: string;
          category?: string;
          importance?: number;
          related_data?: Json;
          is_read?: boolean;
          is_dismissed?: boolean;
          valid_until?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          insight_type?: string;
          title?: string;
          message?: string;
          category?: string;
          importance?: number;
          related_data?: Json;
          is_read?: boolean;
          is_dismissed?: boolean;
          valid_until?: string | null;
          created_at?: string;
        };
      };
      savings_goals: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          target_amount: number;
          current_amount: number;
          owner: OwnerType;
          priority: number;
          color: string;
          icon: string;
          target_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          description?: string | null;
          target_amount: number;
          current_amount?: number;
          owner?: OwnerType;
          priority?: number;
          color?: string;
          icon?: string;
          target_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          target_amount?: number;
          current_amount?: number;
          owner?: OwnerType;
          priority?: number;
          color?: string;
          icon?: string;
          target_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      savings_transfers: {
        Row: {
          id: string;
          user_id: string;
          goal_id: string | null;
          source_account: AccountType;
          destination_account: string;
          amount: number;
          owner: OwnerType;
          comment: string | null;
          date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          goal_id?: string | null;
          source_account: AccountType;
          destination_account?: string;
          amount: number;
          owner?: OwnerType;
          comment?: string | null;
          date?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          goal_id?: string | null;
          source_account?: AccountType;
          destination_account?: string;
          amount?: number;
          owner?: OwnerType;
          comment?: string | null;
          date?: string;
          created_at?: string;
        };
      };
      investments: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: string;
          category: string | null;
          description: string | null;
          owner: OwnerType;
          invested_amount: number;
          current_value: number;
          generated_income: number;
          status: 'active' | 'closed';
          acquisition_date: string;
          closed_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          type?: string;
          category?: string | null;
          description?: string | null;
          owner?: OwnerType;
          invested_amount: number;
          current_value?: number;
          generated_income?: number;
          status?: 'active' | 'closed';
          acquisition_date?: string;
          closed_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: string;
          category?: string | null;
          description?: string | null;
          owner?: OwnerType;
          invested_amount?: number;
          current_value?: number;
          generated_income?: number;
          status?: 'active' | 'closed';
          acquisition_date?: string;
          closed_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      assets: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: string;
          owner: OwnerType;
          value: number;
          acquisition_date: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          type?: string;
          owner?: OwnerType;
          value: number;
          acquisition_date?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: string;
          owner?: OwnerType;
          value?: number;
          acquisition_date?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      liabilities: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: string;
          owner: OwnerType;
          amount: number;
          remaining_amount: number;
          interest_rate: number | null;
          due_date: string | null;
          creditor: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          type?: string;
          owner?: OwnerType;
          amount: number;
          remaining_amount?: number;
          interest_rate?: number | null;
          due_date?: string | null;
          creditor?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: string;
          owner?: OwnerType;
          amount?: number;
          remaining_amount?: number;
          interest_rate?: number | null;
          due_date?: string | null;
          creditor?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      financial_opportunities: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          priority: number;
          is_read: boolean;
          is_actionable: boolean;
          action_data: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          type: string;
          title: string;
          message: string;
          priority?: number;
          is_read?: boolean;
          is_actionable?: boolean;
          action_data?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          title?: string;
          message?: string;
          priority?: number;
          is_read?: boolean;
          is_actionable?: boolean;
          action_data?: Json;
          created_at?: string;
        };
      };
    };
  };
}

// Export types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type TransactionDB = Database['public']['Tables']['transactions']['Row'];
export type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];
export type TransactionUpdate = Database['public']['Tables']['transactions']['Update'];

export type SavingsGoal = Database['public']['Tables']['savings_goals']['Row'];
export type SavingsGoalInsert = Database['public']['Tables']['savings_goals']['Insert'];
export type SavingsGoalUpdate = Database['public']['Tables']['savings_goals']['Update'];

export type SavingsTransfer = Database['public']['Tables']['savings_transfers']['Row'];
export type SavingsTransferInsert = Database['public']['Tables']['savings_transfers']['Insert'];

export type Investment = Database['public']['Tables']['investments']['Row'];
export type InvestmentInsert = Database['public']['Tables']['investments']['Insert'];
export type InvestmentUpdate = Database['public']['Tables']['investments']['Update'];

export type Asset = Database['public']['Tables']['assets']['Row'];
export type AssetInsert = Database['public']['Tables']['assets']['Insert'];
export type AssetUpdate = Database['public']['Tables']['assets']['Update'];

export type Liability = Database['public']['Tables']['liabilities']['Row'];
export type LiabilityInsert = Database['public']['Tables']['liabilities']['Insert'];
export type LiabilityUpdate = Database['public']['Tables']['liabilities']['Update'];

export type FinancialOpportunity = Database['public']['Tables']['financial_opportunities']['Row'];
export type FinancialOpportunityInsert = Database['public']['Tables']['financial_opportunities']['Insert'];

export type Organization = Database['public']['Tables']['organizations']['Row'];
export type OrganizationInsert = Database['public']['Tables']['organizations']['Insert'];

export type FinancialEventDB = Database['public']['Tables']['financial_events']['Row'];
export type FinancialEventInsert = Database['public']['Tables']['financial_events']['Insert'];

export type FinancialForecast = Database['public']['Tables']['financial_forecasts']['Row'];
export type FinancialForecastInsert = Database['public']['Tables']['financial_forecasts']['Insert'];

export type InsightHistory = Database['public']['Tables']['insights_history']['Row'];
export type InsightHistoryInsert = Database['public']['Tables']['insights_history']['Insert'];

// Net Worth Data (computed, not from DB)
export interface NetWorthData {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  assetsByType: { type: string; amount: number; percentage: number }[];
  liabilitiesByType: { type: string; amount: number; percentage: number }[];
  savingsTotal: number;
  investmentCapital: number;
  investmentValue: number;
  investmentIncome: number;
  investmentPerformance: number;
}
