/**
 * Bus schedule screen — timetable with segmented control and week navigation.
 *
 * Flow:
 * 1. useBusConfig(groupId) → BusGroup (screenType 'schedule')
 * 2. useState for selectedServiceIndex (default from config.screen.defaultServiceId)
 * 3. useSmartSchedule(currentService.endpoint) → SmartSchedule
 * 4. groupDaysByWeek(schedule.days) → WeekGroup[] for week navigation
 * 5. useCampusEta(!!config.screen.heroCard) → CampusEta (conditional)
 * 6. useMinuteTicker() — re-render every minute for live ETA
 *
 * Design source: shuttle-v3.html
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useBusConfig,
  useSmartSchedule,
  useCampusEta,
  SdsColors,
} from '@skkuuniverse/shared';
import { SegmentedControl } from '@skkuuniverse/sds';
import { NavigationBar } from '@/features/bus/realtime/NavigationBar';
import { InfoBanner } from '@/features/bus/schedule/InfoBanner';
import { WeekHeader } from '@/features/bus/schedule/WeekHeader';
import { DayGrid } from '@/features/bus/schedule/DayGrid';
import { SectionCard } from '@/features/bus/schedule/SectionCard';
import { HeroCard } from '@/features/bus/schedule/HeroCard';
import { ScheduleList } from '@/features/bus/schedule/ScheduleList';
import { NoticeBar } from '@/features/bus/schedule/NoticeBar';
import { SuspendedCard, NoDataCard, NoServiceCard, ErrorCard } from '@/features/bus/schedule/StatusCards';
import { ScheduleSkeleton } from '@/features/bus/schedule/ScheduleSkeleton';
import { useMinuteTicker } from '@/features/bus/hooks/useMinuteTicker';
import { getHeroBus, hasMultipleRouteTypes } from '@/features/bus/schedule/utils';
import { groupDaysByWeek, findWeekAndDayIndex } from '@/features/bus/schedule/weekUtils';
import { devRewriteInfoUrl } from '@/utils/dev-webview';

/** Extract info feature URL from config features array */
function getInfoUrl(features: Record<string, unknown>[]): string | undefined {
  const info = features.find((f) => f.type === 'info');
  return info?.url as string | undefined;
}

export default function ScheduleScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const { data: config, isLoading: configLoading } = useBusConfig(groupId);

  // Extract schedule config
  const isSchedule = config?.screenType === 'schedule';
  const screenConfig = isSchedule ? config.screen : undefined;

  // Info button — opens webview with feature info URL
  const serverInfoUrl = screenConfig ? getInfoUrl(screenConfig.features) : undefined;
  const infoUrl = devRewriteInfoUrl(serverInfoUrl, '#/bus/campus/info');
  const handleInfoPress = useCallback(() => {
    if (!infoUrl || !config) return;
    router.push({
      pathname: '/webview',
      params: {
        title: config.label,
        color: config.card.themeColor,
        url: infoUrl,
      },
    } as never);
  }, [infoUrl, config, router]);

  // Service state — default to config's defaultServiceId
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
  const { data: schedule, isError: scheduleError, refetch: refetchSchedule } = useSmartSchedule(currentService?.endpoint);

  // Campus ETA (conditional — only if heroCard exists)
  useCampusEta(!!screenConfig?.heroCard);

  // Minute ticker for live ETA updates
  const tick = useMinuteTicker();

  // --- Week-based day navigation ---
  const weeks = useMemo(() => {
    if (!schedule?.days.length) return [];
    return groupDaysByWeek(schedule.days);
  }, [schedule?.days]);

  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [selectedDayInWeekIndex, setSelectedDayInWeekIndex] = useState(0);

  // Sync with server's selectedDate when schedule loads or changes
  useEffect(() => {
    if (!schedule?.days.length || weeks.length === 0) return;
    const serverIndex = schedule.selectedDate
      ? schedule.days.findIndex((d) => d.date === schedule.selectedDate)
      : 0;
    const flatIndex = serverIndex >= 0 ? serverIndex : 0;
    const { weekIndex, dayInWeekIndex } = findWeekAndDayIndex(weeks, flatIndex);
    setCurrentWeekIndex(weekIndex);
    setSelectedDayInWeekIndex(dayInWeekIndex);
  }, [schedule?.selectedDate, schedule?.days, weeks]);

  const currentWeek = weeks[currentWeekIndex];
  const selectedDayIndex = currentWeek
    ? currentWeek.startIndex + selectedDayInWeekIndex
    : 0;
  const selectedDay = schedule?.days[selectedDayIndex];
  const todayDate = new Date().toISOString().slice(0, 10);
  const isToday = selectedDay?.date === todayDate;

  // Week navigation
  const handleWeekChange = useCallback((direction: -1 | 1) => {
    const newIndex = currentWeekIndex + direction;
    if (newIndex < 0 || newIndex >= weeks.length) return;
    setCurrentWeekIndex(newIndex);
    setSelectedDayInWeekIndex(0);
  }, [currentWeekIndex, weeks.length]);

  // Banner state — first notice promoted to top-level dismissable banner
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const bannerNotice = selectedDay?.notices?.[0];

  useEffect(() => {
    setBannerDismissed(false);
  }, [selectedDayIndex]);

  // Hero bus (next departure)
  const heroBus = useMemo(() => {
    if (!selectedDay?.schedule || selectedDay.display !== 'schedule') return undefined;
    return getHeroBus(
      selectedDay.schedule,
      isToday,
      screenConfig?.heroCard?.showUntilMinutesBefore ?? 0,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- tick forces re-computation every minute
  }, [selectedDay, isToday, screenConfig?.heroCard?.showUntilMinutesBefore, tick]);

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
      <NavigationBar title={config.label} onInfoPress={infoUrl ? handleInfoPress : undefined} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
        {/* Banner section */}
        {bannerNotice && !bannerDismissed && (
          <SectionCard style={styles.bannerSection}>
            <InfoBanner
              text={bannerNotice.text}
              onDismiss={() => setBannerDismissed(true)}
            />
          </SectionCard>
        )}

        {/* Controls section */}
        <SectionCard style={styles.controlsSection}>
          {/* SegmentedControl for service selection */}
          {screenConfig && screenConfig.services.length > 1 && (
            <SegmentedControl
              value={currentService?.serviceId ?? ''}
              onValueChange={(value) => {
                const idx = screenConfig.services.findIndex((s) => s.serviceId === value);
                if (idx >= 0) setSelectedServiceIndex(idx);
              }}
            >
              {screenConfig.services.map((service) => (
                <SegmentedControl.Item key={service.serviceId} value={service.serviceId}>
                  {service.label}
                </SegmentedControl.Item>
              ))}
            </SegmentedControl>
          )}

          {/* Week header + Day grid (only when active schedule loaded) */}
          {schedule?.status === 'active' && currentWeek && (
            <>
              <DayGrid
                days={currentWeek.days}
                selectedIndex={selectedDayInWeekIndex}
                onSelect={setSelectedDayInWeekIndex}
              />
            </>
          )}
        </SectionCard>

        {/* Timetable section — status dependent */}
        {scheduleError && !schedule ? (
          <SectionCard style={styles.timetableSection}>
            <ErrorCard onRetry={() => refetchSchedule()} />
          </SectionCard>
        ) : !schedule ? (
          <SectionCard style={styles.timetableSection}>
            <ScheduleSkeleton />
          </SectionCard>
        ) : schedule.status === 'suspended' ? (
          <SectionCard style={styles.timetableSection}>
            <SuspendedCard resumeDate={schedule.resumeDate} message={schedule.message} />
          </SectionCard>
        ) : schedule.status === 'noData' ? (
          <SectionCard style={styles.timetableSection}>
            <NoDataCard />
          </SectionCard>
        ) : schedule.status === 'active' ? (
          <SectionCard style={styles.timetableSection}>
            {selectedDay?.display === 'noService' ? (
              <NoServiceCard label={selectedDay.label} />
            ) : selectedDay?.display === 'schedule' ? (
              <>
                {/* Day notices — skip first (shown as banner) */}
                {selectedDay.notices.slice(1).map((notice, i) => (
                  <NoticeBar key={i} notice={notice} />
                ))}

                {/* Hero card */}
                {screenConfig?.heroCard && (
                  <HeroCard
                    entry={heroBus}
                    routeBadges={screenConfig.routeBadges}
                    showBadge={hasMultipleRouteTypes(selectedDay.schedule)}
                    isToday={isToday}
                    serviceLabel={currentService?.label}
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
          </SectionCard>
        ) : (
          <SectionCard style={styles.timetableSection}>
            <ErrorCard onRetry={() => refetchSchedule()} />
          </SectionCard>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.grey50,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: 8,
    paddingBottom: 20,
  },
  bannerSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  controlsSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
  },
  timetableSection: {
    // Child components (HeroCard, ScheduleList) manage their own marginHorizontal
  },
});
