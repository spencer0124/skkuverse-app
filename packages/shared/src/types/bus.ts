/**
 * Bus / transit type definitions.
 *
 * Covers: transit list, bus group config (realtime + schedule),
 * realtime polling data, smart schedule, and campus ETA.
 *
 * Flutter sources:
 *   lib/features/transit/model/mainpage_buslist_model.dart
 *   lib/features/transit/model/bus_group.dart
 *   lib/features/transit/model/realtime_data.dart
 *   lib/features/transit/model/realtime_station.dart
 *   lib/features/transit/model/smart_schedule.dart
 */

// ── Transit list (GET /ui/home/transitlist) ──

export interface BusListCard {
  label: string;
  /** Hex color without # prefix, e.g. "1A7F4B" */
  themeColor: string;
  /** 'shuttle' | 'village' | image URL */
  iconType: string;
  busTypeText: string;
  subtitle?: string;
}

export interface BusListAction {
  route: '/bus/realtime' | '/bus/schedule';
  groupId: string;
}

export interface BusListItem {
  groupId: string;
  card: BusListCard;
  action: BusListAction;
}

// ── Bus group visibility ──

export type BusGroupVisibility =
  | { type: 'always' }
  | { type: 'dateRange'; from: string; until: string };

// ── Bus group card ──

export interface BusGroupCard {
  /** Hex color without # prefix */
  themeColor: string;
  iconType: string;
  busTypeText: string;
}

// ── Realtime screen config ──

export interface TransferLine {
  line: string;
  /** Hex color without # prefix */
  color: string;
}

export interface RealtimeStation {
  index: number;
  name: string;
  subtitle?: string;
  stationNumber?: string;
  isFirstStation: boolean;
  isLastStation: boolean;
  isRotationStation: boolean;
  transferLines: TransferLine[];
}

export interface RealtimeScreenConfig {
  dataEndpoint?: string;
  /** Polling interval in seconds (default: 15) */
  refreshInterval: number;
  /** Index of last station for positioning calc (default: 10) */
  lastStationIndex: number;
  stations: RealtimeStation[];
  features: Record<string, unknown>[];
}

// ── Schedule screen config ──

export interface BusService {
  serviceId: string;
  label: string;
  endpoint: string;
}

export interface RouteBadge {
  id: string;
  label: string;
  /** Hex color without # prefix */
  color: string;
}

export interface HeroCard {
  etaEndpoint: string;
  showUntilMinutesBefore: number;
}

export interface ScheduleScreenConfig {
  services: BusService[];
  defaultServiceId?: string;
  routeBadges: RouteBadge[];
  heroCard?: HeroCard;
  features: Record<string, unknown>[];
}

// ── Bus group (GET /bus/config/{groupId}) — discriminated union ──

interface BusGroupBase {
  id: string;
  label: string;
  visibility: BusGroupVisibility;
  card: BusGroupCard;
}

export interface RealtimeBusGroup extends BusGroupBase {
  screenType: 'realtime';
  screen: RealtimeScreenConfig;
}

export interface ScheduleBusGroup extends BusGroupBase {
  screenType: 'schedule';
  screen: ScheduleScreenConfig;
}

export type BusGroup = RealtimeBusGroup | ScheduleBusGroup;

// ── Realtime data (polled from dynamic dataEndpoint) ──

export interface RealtimeMeta {
  currentTime: string;
  totalBuses: number;
}

export interface RealtimeBus {
  stationIndex: number;
  carNumber: string;
  /** Seconds since last station */
  estimatedTime: number;
}

export interface StationEta {
  stationIndex: number;
  /** Pre-formatted string, e.g. "3분후[1번째 전]" */
  eta: string;
}

export interface RealtimeData {
  meta: RealtimeMeta;
  groupId: string;
  buses: RealtimeBus[];
  stationEtas: StationEta[];
}

// ── Smart schedule (ETag-cached from service endpoint) ──

export interface ScheduleNotice {
  style: string;
  text: string;
  source: string;
}

export interface ScheduleEntry {
  index: number;
  /** "HH:MM" format */
  time: string;
  routeType: string;
  busCount: number;
  notes?: string;
}

export interface DaySchedule {
  date: string;
  /** 1=Mon through 7=Sun (matches Flutter's int dayOfWeek) */
  dayOfWeek: number;
  /** 'schedule' | 'noService' | 'hidden' */
  display: string;
  label?: string;
  notices: ScheduleNotice[];
  schedule: ScheduleEntry[];
}

export interface SmartSchedule {
  serviceId: string;
  /** 'active' | 'suspended' | 'noData' */
  status: string;
  from?: string;
  selectedDate?: string;
  days: DaySchedule[];
  resumeDate?: string;
  message?: string;
}

// ── Campus ETA ──

export interface CampusEta {
  /** Duration in milliseconds, null if unavailable */
  inja: number | null;
  /** Duration in milliseconds, null if unavailable */
  jain: number | null;
}

// ── Utility functions ──

/**
 * Normalizes hex color to `#RRGGBB` format.
 * If input already starts with `#`, returns as-is.
 * Validates hex format — returns fallback for malformed strings.
 * @param hex - Color string, e.g. "1A7F4B" or "#1A7F4B"
 * @param fallback - Fallback color if hex is empty/undefined/invalid (default: brand green)
 */
export function hexToColor(hex: string | undefined, fallback = '#1A7F4B'): string {
  if (!hex) return fallback;
  const normalized = hex.startsWith('#') ? hex : `#${hex}`;
  // Validate hex format: #RGB, #RRGGBB, or #RRGGBBAA
  if (!/^#[\dA-Fa-f]{3,8}$/.test(normalized)) return fallback;
  return normalized;
}

/**
 * Checks if a bus group is currently visible based on its visibility config.
 */
export function isBusGroupVisible(
  visibility: BusGroupVisibility,
  now: Date = new Date(),
): boolean {
  if (visibility.type === 'always') return true;
  const current = now.toISOString().slice(0, 10); // YYYY-MM-DD
  return current >= visibility.from && current <= visibility.until;
}
