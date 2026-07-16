import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import {
  User,
  Mail,
  LogOut,
  ChevronRight,
  Info,
  Shield,
  HelpCircle,
  Edit3,
  RefreshCw,
  CheckCircle,
  Wifi,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const { user, profile, signOut, updateProfile } = useAuth();
  const [showEditModal, setShowEditModal] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [loading, setLoading] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, date, amount')
        .order('date', { ascending: false })
        .limit(100);

      if (error) {
        setSyncResult('Erreur de sync: ' + error.message);
      } else {
        setSyncResult(`${data.length} transactions synchronisées`);
      }
    } catch {
      setSyncResult('Erreur de connexion');
    }
    setSyncing(false);
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setTimeout(() => setSyncResult(null), 3000);
  };

  const handleSignOut = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await signOut();
    router.replace('/auth/login');
  };

  const handleUpdateProfile = async () => {
    setLoading(true);
    const result = await updateProfile({ full_name: fullName });
    setLoading(false);

    if (!result.error) {
      setShowEditModal(false);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  };

  const getInitials = (name: string | null | undefined, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mon profil</Text>
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {getInitials(profile?.full_name, user?.email || 'U')}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{profile?.full_name || 'Utilisateur'}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
        </View>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => {
            setFullName(profile?.full_name || '');
            setShowEditModal(true);
          }}
        >
          <Edit3 size={18} color="#059669" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>Membre</Text>
          <Text style={styles.statLabel}>
            depuis {new Date(profile?.created_at || Date.now()).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </Text>
        </View>
      </View>

      {/* Account Status & Sync */}
      <View style={styles.menuSection}>
        <Text style={styles.menuTitle}>Statut du compte</Text>
        <View style={styles.menuCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <CheckCircle size={20} color="#059669" />
              <View>
                <Text style={styles.statusLabel}>Connecté</Text>
                <Text style={styles.statusValue}>{user?.email}</Text>
              </View>
            </View>
          </View>
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <Shield size={20} color="#6B7280" />
              <View>
                <Text style={styles.statusLabel}>User ID</Text>
                <Text style={styles.statusValue} numberOfLines={1} ellipsizeMode="tail">
                  {user?.id?.slice(0, 8)}...
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Sync Section */}
      <View style={styles.menuSection}>
        <Text style={styles.menuTitle}>Synchronisation</Text>
        <TouchableOpacity
          style={styles.syncButton}
          onPress={handleSync}
          disabled={syncing}
        >
          <View style={styles.syncLeft}>
            {syncing ? (
              <ActivityIndicator size={20} color="#059669" />
            ) : (
              <RefreshCw size={20} color="#059669" />
            )}
            <View>
              <Text style={styles.syncLabel}>
                {syncing ? 'Synchronisation...' : 'Synchroniser les données'}
              </Text>
              <Text style={styles.syncHint}>
                Vérifie la connexion avec la base
              </Text>
            </View>
          </View>
          {!syncing && <ChevronRight size={20} color="#9CA3AF" />}
        </TouchableOpacity>
        {syncResult && (
          <View style={styles.syncResultContainer}>
            <Wifi size={16} color="#059669" />
            <Text style={styles.syncResultText}>{syncResult}</Text>
          </View>
        )}
      </View>

      {/* Menu Items */}
      <View style={styles.menuSection}>
        <Text style={styles.menuTitle}>Compte</Text>
        <View style={styles.menuCard}>
          <MenuItem
            icon={<Mail size={20} color="#6B7280" />}
            label="Email"
            value={user?.email}
          />
          <MenuItem
            icon={<Shield size={20} color="#6B7280" />}
            label="Securite"
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
          />
        </View>

        <Text style={styles.menuTitle}>Aide</Text>
        <View style={styles.menuCard}>
          <MenuItem
            icon={<HelpCircle size={20} color="#6B7280" />}
            label="Centre d'aide"
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
          />
          <MenuItem
            icon={<Info size={20} color="#6B7280" />}
            label="A propos"
            value="v1.0.0"
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
          />
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
        <LogOut size={20} color="#DC2626" />
        <Text style={styles.logoutText}>Se deconnecter</Text>
      </TouchableOpacity>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Mon Bedou v1.0.0</Text>
        <Text style={styles.footerSubtext}>Ton compagnon financier quotidien</Text>
      </View>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Modifier le profil</Text>
            <TouchableOpacity onPress={handleUpdateProfile} disabled={loading}>
              <Text style={styles.saveText}>{loading ? '...' : 'Enregistrer'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.inputLabel}>Nom complet</Text>
            <TextInput
              style={styles.input}
              placeholder="Entre ton nom"
              placeholderTextColor="#9CA3AF"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function MenuItem({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} disabled={!onPress && !value}>
      <View style={styles.menuItemLeft}>
        {icon}
        <Text style={styles.menuItemLabel}>{label}</Text>
      </View>
      <View style={styles.menuItemRight}>
        {value && <Text style={styles.menuItemValue}>{value}</Text>}
        {onPress && <ChevronRight size={18} color="#D1D5DB" />}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#6B7280',
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 16,
    padding: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  menuSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  statusValue: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  syncLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  syncLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  syncHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  syncResultContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  syncResultText: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '500',
  },
  menuTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemLabel: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuItemValue: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FEF2F2',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  footerText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#D1D5DB',
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
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  cancelText: {
    fontSize: 16,
    color: '#6B7280',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
  modalContent: {
    paddingHorizontal: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
  },
});
