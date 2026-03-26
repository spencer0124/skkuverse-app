/**
 * Bus schedule screen — timetable with service tabs and day selector.
 *
 * Flow:
 * 1. useBusConfig(groupId) → BusGroup (screenType 'schedule')
 * 2. useState for selectedServiceIndex (default from config.screen.defaultServiceId)
 * 3. useSmartSchedule(currentService.endpoint) → SmartSchedule
 * 4. useCampusEta(!!config.screen.heroCard) → CampusEta (conditional)
 * 5. useMinuteTicker() — re-render every minute for live ETA
 *
 * Flutter source: lib/features/transit/ui/bus_campus_screen.dart
 */

import { useState, useMemo, useEffect } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  useBusConfig,
  useSmartSchedule,
  useCampusEta,
  SdsColors,
} from '@skkuuniverse/shared';
import { NavigationBar } from '@/features/bus/realtime/NavigationBar';
import { ServiceTabs } from '@/features/bus/schedule/ServiceTabs';
import { DaySelector } from '@/features/bus/schedule/DaySelector';
import { HeroCard } from '@/features/bus/schedule/HeroCard';
import { ScheduleList } from '@/features/bus/schedule/ScheduleList';
import { NoticeBar } from '@/features/bus/schedule/NoticeBar';
import { SuspendedCard, NoDataCard, NoServiceCard, ErrorCard } from '@/features/bus/schedule/StatusCards';
import { ScheduleSkeleton } from '@/features/bus/schedule/ScheduleSkeleton';
import { useMinuteTicker } from '@/features/bus/hooks/useMinuteTicker';
import { getHeroBus, hasMultipleRouteTypes } from '@/features/bus/schedule/utils';

export default function ScheduleScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { data: config, isLoading: configLoading } = useBusConfig(groupId);

  // Extract schedule config
  const isSchedule = config?.screenType === 'schedule';
  const screenConfig = isSchedule ? config.screen : undefined;

  // Service tab state — default to config's defaultServiceId
  const defaultIndex = useMemo(() => {
    if (!screenConfig?.defaultServiceId || !screenConfig.services) return 0;
    const idx = screenConfig.services.findIndex(
      (s) => s.serviceId === screenConfig.defaultServiceId,
    );
    return idx >= 0 ? idx : 0;
  }, [screenConfig?.defaultServiceId, screenConfig?.services]);

  const [selectedServiceIndex, setSelectedServiceIndex] = useState(defaultIndex);
  const currentService = screenConfig?.services[selectedServiceIndex];

  // Smart schedule data
  const { data: schedule } = useSmartSchedule(currentService?.endpoint);

  // Campus ETA (conditional — only if heroCard exists)
  useCampusEta(!!screenConfig?.heroCard);

  // Minute ticker for live ETA updates
  useMinuteTicker();

  // Day selector state — default to server's selectedDate, fallback to 0
  const initialDayIndex = useMemo(() => {
    if (!schedule?.selectedDate || !schedule.days.length) return 0;
    const idx = schedule.days.findIndex((d) => d.date === schedule.selectedDate);
    return idx >= 0 ? idx : 0;
  }, [schedule?.selectedDate, schedule?.days]);

  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const selectedDay = schedule?.days[selectedDayIndex];

  // Sync with server's selectedDate when schedule loads
  useEffect(() => {
    setSelectedDayIndex(initialDayIndex);
  }, [initialDayIndex]);
  const todayDate = new Date().toISOString().slice(0, 10);
  const isToday = selectedDay?.date === todayDate;

  // Hero bus (next departure)
  const heroBus = useMemo(() => {
    if (!selectedDay?.schedule || selectedDay.display !== 'schedule') return undefined;
    return getHeroBus(
      selectedDay.schedule,
      isToday,
      screenConfig?.heroCard?.showUntilMinutesBefore ?? 0,
    );
  }, [selectedDay, isToday, screenConfig?.heroCard?.showUntilMinutesBefore]);

  // Loading state
  if (configLoading || !config) {
    return (
      <View style={styles.container}>
        <NavigationBar title="" />
        <ScheduleSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavigationBar title={config.label} />

      <ScrollView style={styles.scrollView}>
        {/* Service tabs */}
        {screenConfig && (
          <ServiceTabs
            services={screenConfig.services}
            selectedIndex={selectedServiceIndex}
            onSelect={setSelectedServiceIndex}
          />
        )}

        {/* Schedule content based on status */}
        {!schedule ? (
          <ScheduleSkeleton />
        ) : schedule.status === 'suspended' ? (
          <SuspendedCard resumeDate={schedule.resumeDate} message={schedule.message} />
        ) : schedule.status === 'noData' ? (
          <NoDataCard />
        ) : schedule.status === 'active' ? (
          <>
            {/* Day selector */}
            <DaySelector
              days={schedule.days}
              selectedIndex={selectedDayIndex}
              onSelect={setSelectedDayIndex}
              todayDate={todayDate}
            />

            {/* Day content */}
            {selectedDay?.display === 'noService' ? (
              <NoServiceCard label={selectedDay.label} />
            ) : selectedDay?.display === 'schedule' ? (
              <>
                {/* Day notices */}
                {selectedDay.notices.map((notice, i) => (
                  <NoticeBar key={i} notice={notice} />
                ))}

                {/* Hero card — always shown when day has schedule */}
                {screenConfig?.heroCard && (
                  <HeroCard
                    entry={heroBus}
                    routeBadges={screenConfig.routeBadges}
                    showBadge={hasMultipleRouteTypes(selectedDay.schedule)}
                    isToday={isToday}
                  />
                )}

                {/* Schedule list */}
                <ScheduleList
                  entries={selectedDay.schedule}
                  routeBadges={screenConfig?.routeBadges ?? []}
                  isToday={isToday}
                  nextEntryIndex={heroBus?.index}
                />
              </>
            ) : null}
          </>
        ) : (
          <ErrorCard />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  scrollView: {
    flex: 1,
  },
});
