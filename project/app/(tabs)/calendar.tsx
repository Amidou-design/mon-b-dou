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
  getCalendarMonth,
  addFinancialEvent,
  deleteFinancialEvent,
  getEventTypeConfig,
  EVENT_TYPE_CONFIG,
  type FinancialEvent,
  type EventType as EventDbType,
} from '@/services/calendarEngine';
import type { CalendarMonth, CalendarDay, EventFrequency } from '@/services/calendarEngine';
import {
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  BarChart2,
  ArrowRight,
  Repeat,
  Trash2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const MONTHS = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'
];

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export default function CalendarScreen() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<CalendarMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState<FinancialEvent[]>([]);

  // Form
  const [eventTitle, setEventTitle] = useState('');
  const [eventAmount, setEventAmount] = useState('');
  const [eventType, setEventType] = useState<EventDbType>('expense');
  const [eventIsRecurring, setEventIsRecurring] = useState(false);
  const [eventFrequency, setEventFrequency] = useState<EventFrequency>('monthly');

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const loadData = useCallback(async () => {
    const data = await getCalendarMonth(currentYear, currentMonth);
    setCalendarData(data);
    setLoading(false);
    setRefreshing(false);
  }, [currentYear, currentMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayPress = (day: CalendarDay) => {
    setSelectedDate(day.date);
    setSelectedDayEvents(day.events);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleAddEvent = async () => {
    if (!eventTitle || !eventAmount || !selectedDate) return;

    await addFinancialEvent({
      title: eventTitle,
      event_type: eventType,
      amount: parseFloat(eventAmount),
      expected_date: selectedDate.toISOString(),
      is_recurring: eventIsRecurring,
      recurring_frequency: eventIsRecurring ? eventFrequency : null,
    });

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    loadData();
    setShowAddModal(false);
    setEventTitle('');
    setEventAmount('');
    setEventIsRecurring(false);
  };

  const handleDeleteEvent = async (id: string) => {
    await deleteFinancialEvent(id.split('-')[0]); // Remove date suffix for recurring instances
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    loadData();
    setSelectedDayEvents((prev) => prev.filter((e) => e.id !== id));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Calendrier financier</Text>
        <Text style={styles.subtitle}>Anticipez vos flux financiers</Text>
      </View>

      {/* Month Navigation */}
      <View style={styles.monthNavigation}>
        <TouchableOpacity style={styles.navButton} onPress={goToPreviousMonth}>
          <ChevronLeft size={24} color="#374151" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.monthSelector} onPress={goToToday}>
          <Text style={styles.monthText}>
            {MONTHS[currentMonth]} {currentYear}
          </Text>
          <Text style={styles.todayText}>Aujourd'hui</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButton} onPress={goToNextMonth}>
          <ChevronRight size={24} color="#374151" />
        </TouchableOpacity>
      </View>

      {/* Month Summary */}
      {calendarData && (
        <View style={styles.monthSummary}>
          <View style={styles.summaryItem}>
            <TrendingUp size={16} color="#22C55E" />
            <Text style={styles.summaryLabel}>Revenus prevus</Text>
            <Text style={[styles.summaryValue, { color: '#22C55E' }]}>
              +{formatCurrency(calendarData.totalIncome)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <TrendingDown size={16} color="#DC2626" />
            <Text style={styles.summaryLabel}>Depenses prevues</Text>
            <Text style={[styles.summaryValue, { color: '#DC2626' }]}>
              -{formatCurrency(calendarData.totalExpenses)}
            </Text>
          </View>
        </View>
      )}

      {/* Calendar Grid */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#059669']} />
        }
      >
        {/* Day Headers */}
        <View style={styles.dayHeaders}>
          {DAYS.map((day) => (
            <View key={day} style={styles.dayHeader}>
              <Text style={styles.dayHeaderText}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar Weeks */}
        {calendarData?.weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.weekRow}>
            {week.days.map((day, dayIndex) => (
              <TouchableOpacity
                key={dayIndex}
                style={[
                  styles.dayCell,
                  day.isToday && styles.todayCell,
                  selectedDate?.toDateString() === day.date.toDateString() && styles.selectedCell,
                ]}
                onPress={() => handleDayPress(day)}
              >
                <Text style={[
                  styles.dayNumber,
                  day.isToday && styles.todayNumber,
                  day.isPast && styles.pastDay,
                ]}>
                  {day.date.getDate()}
                </Text>
                {day.events.length > 0 && (
                  <>
                    <View style={styles.eventDots}>
                      {day.events.slice(0, 3).map((event, i) => (
                        <View
                          key={i}
                          style={[
                            styles.eventDot,
                            { backgroundColor: getEventTypeConfig(event.event_type as EventDbType).color },
                          ]}
                        />
                      ))}
                    </View>
                    <Text style={styles.dayAmount}>
                      {formatCurrency(Math.abs(day.totalAmount))}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* Selected Day Details */}
        {selectedDayEvents.length > 0 && (
          <View style={styles.selectedDaySection}>
            <Text style={styles.selectedDayTitle}>
              Evenements du {selectedDate?.toLocaleDateString('fr-FR')}
            </Text>
            {selectedDayEvents.map((event) => {
              const config = getEventTypeConfig(event.event_type as EventDbType);
              return (
                <View key={event.id} style={styles.eventCard}>
                  <View style={[styles.eventIndicator, { backgroundColor: config.color }]} />
                  <View style={styles.eventContent}>
                    <View style={styles.eventHeader}>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                      {event.is_recurring && (
                        <Repeat size={14} color="#6B7280" />
                      )}
                    </View>
                    <Text style={styles.eventAmount}>
                      {event.event_type === 'income' ? '+' : '-'} {formatCurrency(Number(event.amount))}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteEventButton}
                    onPress={() => handleDeleteEvent(event.id)}
                  >
                    <Trash2 size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Add Event Button */}
      <TouchableOpacity
        style={styles.addEventButton}
        onPress={() => {
          setSelectedDate(selectedDate || new Date());
          setShowAddModal(true);
        }}
      >
        <Plus size={24} color="#fff" />
      </TouchableOpacity>

      {/* Add Event Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Nouvel evenement</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>Titre</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: Loyer"
                placeholderTextColor="#9CA3AF"
                value={eventTitle}
                onChangeText={setEventTitle}
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Montant (FCFA)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: 50000"
                placeholderTextColor="#9CA3AF"
                value={eventAmount}
                onChangeText={setEventAmount}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.formLabel}>Type</Text>
              <View style={styles.typeSelector}>
                {(Object.keys(EVENT_TYPE_CONFIG) as EventDbType[]).map((key) => {
                  const config = EVENT_TYPE_CONFIG[key];
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.typeChip,
                        eventType === key && { borderColor: config.color, backgroundColor: config.color + '15' },
                      ]}
                      onPress={() => setEventType(key)}
                    >
                      <Text style={[styles.typeChipText, eventType === key && { color: config.color }]}>
                        {config.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.formField}>
              <TouchableOpacity
                style={styles.recurringToggle}
                onPress={() => setEventIsRecurring(!eventIsRecurring)}
              >
                <Repeat size={20} color={eventIsRecurring ? '#059669' : '#9CA3AF'} />
                <Text style={[styles.recurringText, eventIsRecurring && { color: '#059669' }]}>
                  Operation recurrente
                </Text>
              </TouchableOpacity>

              {eventIsRecurring && (
                <View style={styles.frequencySelector}>
                  {['monthly', 'weekly', 'quarterly', 'annual'].map((freq) => (
                    <TouchableOpacity
                      key={freq}
                      style={[
                        styles.freqChip,
                        eventFrequency === freq && styles.freqChipActive,
                      ]}
                      onPress={() => setEventFrequency(freq as EventFrequency)}
                    >
                      <Text style={[styles.freqChipText, eventFrequency === freq && styles.freqChipTextActive]}>
                        {freq === 'monthly' ? 'Mensuel' : freq === 'weekly' ? 'Hebdo' : freq === 'quarterly' ? 'Trimestre' : 'Annuel'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleAddEvent}>
              <Text style={styles.saveButtonText}>Ajouter</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
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
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  monthSelector: {
    alignItems: 'center',
  },
  monthText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  todayText: {
    fontSize: 11,
    color: '#059669',
    marginTop: 2,
  },
  monthSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E5E7EB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  dayHeaders: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayHeaderText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    margin: 1,
    padding: 4,
    alignItems: 'center',
  },
  todayCell: {
    borderWidth: 2,
    borderColor: '#059669',
  },
  selectedCell: {
    backgroundColor: '#ECFDF5',
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111827',
  },
  todayNumber: {
    color: '#059669',
    fontWeight: '700',
  },
  pastDay: {
    color: '#9CA3AF',
  },
  eventDots: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dayAmount: {
    fontSize: 8,
    color: '#6B7280',
    marginTop: 1,
  },
  selectedDaySection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  selectedDayTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 8,
    padding: 12,
  },
  eventIndicator: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    marginRight: 12,
  },
  eventContent: {
    flex: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  eventAmount: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  deleteEventButton: {
    padding: 8,
  },
  addEventButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typeChipText: {
    fontSize: 13,
    color: '#374151',
  },
  recurringToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
  },
  recurringText: {
    fontSize: 14,
    color: '#374151',
  },
  frequencySelector: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  freqChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  freqChipActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  freqChipText: {
    fontSize: 12,
    color: '#374151',
  },
  freqChipTextActive: {
    color: '#fff',
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
