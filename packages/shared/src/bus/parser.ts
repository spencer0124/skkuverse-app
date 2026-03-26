/**
 * Bus response parsers — JSON → typed bus models.
 *
 * Follows the SDUI parser pattern (receives ApiEnvelope<unknown>, returns typed data).
 * Each parser handles one endpoint's response shape.
 *
 * Flutter sources:
 *   lib/features/transit/model/mainpage_buslist_model.dart
 *   lib/features/transit/model/bus_group.dart
 *   lib/features/transit/model/realtime_data.dart
 *   lib/features/transit/model/smart_schedule.dart
 */

import type { ApiEnvelope } from '../api/types';
import type {
  BusListItem,
  BusListCard,
  BusListAction,
  BusGroup,
  BusGroupVisibility,
  BusGroupCard,
  RealtimeScreenConfig,
  ScheduleScreenConfig,
  RealtimeStation,
  TransferLine,
  BusService,
  RouteBadge,
  HeroCard,
  RealtimeData,
  RealtimeMeta,
  RealtimeBus,
  StationEta,
  SmartSchedule,
  DaySchedule,
  ScheduleEntry,
  ScheduleNotice,
  CampusEta,
} from '../types/bus';

// ── Helpers ──

type Raw = Record<string, unknown>;

// ── Transit list parser ──

function parseBusListCard(raw: Raw): BusListCard {
  return {
    label: raw.label as string,
    themeColor: raw.themeColor as string,
    iconType: raw.iconType as string,
    busTypeText: raw.busTypeText as string,
    ...(raw.subtitle != null && { subtitle: raw.subtitle as string }),
  };
}

function parseBusListAction(raw: Raw): BusListAction {
  return {
    route: raw.route as '/bus/realtime' | '/bus/schedule',
    groupId: raw.groupId as string,
  };
}

/**
 * Parses transit list from `GET /ui/home/transitlist`.
 * `envelope.data` is an array of bus list items.
 */
export function parseTransitList(envelope: ApiEnvelope<unknown>): BusListItem[] {
  const items = envelope.data as Raw[];
  return items.map((item) => ({
    groupId: item.groupId as string,
    card: parseBusListCard(item.card as Raw),
    action: parseBusListAction(item.action as Raw),
  }));
}

// ── Bus group config parser ──

function parseVisibility(raw: Raw): BusGroupVisibility {
  if (raw.type === 'dateRange') {
    return {
      type: 'dateRange',
      from: raw.from as string,
      until: raw.until as string,
    };
  }
  return { type: 'always' };
}

function parseBusGroupCard(raw: Raw): BusGroupCard {
  return {
    themeColor: raw.themeColor as string,
    iconType: raw.iconType as string,
    busTypeText: raw.busTypeText as string,
  };
}

function parseTransferLine(raw: Raw): TransferLine {
  return {
    line: raw.line as string,
    color: raw.color as string,
  };
}

function parseRealtimeStation(raw: Raw): RealtimeStation {
  return {
    index: raw.index as number,
    name: raw.name as string,
    ...(raw.subtitle != null && { subtitle: raw.subtitle as string }),
    ...(raw.stationNumber != null && {
      stationNumber: raw.stationNumber as string,
    }),
    isFirstStation: (raw.isFirstStation as boolean) ?? false,
    isLastStation: (raw.isLastStation as boolean) ?? false,
    isRotationStation: (raw.isRotationStation as boolean) ?? false,
    transferLines: ((raw.transferLines as Raw[]) ?? []).map(parseTransferLine),
  };
}

function parseRealtimeScreenConfig(raw: Raw): RealtimeScreenConfig {
  return {
    ...(raw.dataEndpoint != null && {
      dataEndpoint: raw.dataEndpoint as string,
    }),
    refreshInterval: (raw.refreshInterval as number) ?? 15,
    lastStationIndex: (raw.lastStationIndex as number) ?? 10,
    stations: ((raw.stations as Raw[]) ?? []).map(parseRealtimeStation),
    features: (raw.features as Record<string, unknown>[]) ?? [],
  };
}

function parseBusService(raw: Raw): BusService {
  return {
    serviceId: raw.serviceId as string,
    label: raw.label as string,
    endpoint: raw.endpoint as string,
  };
}

function parseRouteBadge(raw: Raw): RouteBadge {
  return {
    id: raw.id as string,
    label: raw.label as string,
    color: raw.color as string,
  };
}

function parseHeroCard(raw: Raw): HeroCard {
  return {
    etaEndpoint: raw.etaEndpoint as string,
    showUntilMinutesBefore: raw.showUntilMinutesBefore as number,
  };
}

function parseScheduleScreenConfig(raw: Raw): ScheduleScreenConfig {
  return {
    services: ((raw.services as Raw[]) ?? []).map(parseBusService),
    ...(raw.defaultServiceId != null && {
      defaultServiceId: raw.defaultServiceId as string,
    }),
    routeBadges: ((raw.routeBadges as Raw[]) ?? []).map(parseRouteBadge),
    ...(raw.heroCard != null && {
      heroCard: parseHeroCard(raw.heroCard as Raw),
    }),
    features: (raw.features as Record<string, unknown>[]) ?? [],
  };
}

/**
 * Parses bus group config from `GET /bus/config/{groupId}`.
 * Switches on `screenType` to build the correct discriminated union variant.
 */
export function parseBusGroup(envelope: ApiEnvelope<unknown>): BusGroup {
  const data = envelope.data as Raw;
  const screenType = data.screenType as string;
  const screenRaw = data.screen as Raw;

  const base = {
    id: data.id as string,
    label: data.label as string,
    visibility: parseVisibility((data.visibility as Raw) ?? { type: 'always' }),
    card: parseBusGroupCard((data.card as Raw) ?? {}),
  };

  if (screenType === 'schedule') {
    return {
      ...base,
      screenType: 'schedule',
      screen: parseScheduleScreenConfig(screenRaw),
    };
  }

  // Default to realtime
  return {
    ...base,
    screenType: 'realtime',
    screen: parseRealtimeScreenConfig(screenRaw),
  };
}

// ── Realtime data parser ──

/**
 * Parses realtime bus data from polled `dataEndpoint`.
 * Flutter's `RealtimeData.fromJson` reads from the full envelope
 * (`json['meta']` + `json['data']`).
 */
export function parseRealtimeData(envelope: ApiEnvelope<unknown>): RealtimeData {
  const meta = envelope.meta as unknown as Raw;
  const data = envelope.data as Raw;

  const parsedMeta: RealtimeMeta = {
    currentTime: (meta.currentTime as string) ?? '',
    totalBuses: (meta.totalBuses as number) ?? 0,
  };

  return {
    meta: parsedMeta,
    groupId: data.groupId as string,
    buses: ((data.buses as Raw[]) ?? []).map(
      (bus): RealtimeBus => ({
        stationIndex: bus.stationIndex as number,
        carNumber: bus.carNumber as string,
        estimatedTime: (bus.estimatedTime as number) ?? 0,
      }),
    ),
    stationEtas: ((data.stationEtas as Raw[]) ?? []).map(
      (eta): StationEta => ({
        stationIndex: eta.stationIndex as number,
        eta: eta.eta as string,
      }),
    ),
  };
}

// ── Smart schedule parser ──

function parseScheduleNotice(raw: Raw): ScheduleNotice {
  return {
    style: raw.style as string,
    text: raw.text as string,
    source: raw.source as string,
  };
}

function parseScheduleEntry(raw: Raw): ScheduleEntry {
  return {
    index: raw.index as number,
    time: raw.time as string,
    routeType: raw.routeType as string,
    busCount: (raw.busCount as number) ?? 1,
    ...(raw.notes != null && { notes: raw.notes as string }),
  };
}

function parseDaySchedule(raw: Raw): DaySchedule {
  return {
    date: raw.date as string,
    dayOfWeek: raw.dayOfWeek as number,
    display: raw.display as string,
    ...(raw.label != null && { label: raw.label as string }),
    notices: ((raw.notices as Raw[]) ?? []).map(parseScheduleNotice),
    schedule: ((raw.schedule as Raw[]) ?? []).map(parseScheduleEntry),
  };
}

/**
 * Parses smart schedule from service endpoint.
 * Flutter's `SmartSchedule.fromJson` reads `json['data']` —
 * for v2 envelope, this means `envelope.data`.
 */
export function parseSmartSchedule(envelope: ApiEnvelope<unknown>): SmartSchedule {
  const data = envelope.data as Raw;

  return {
    serviceId: data.serviceId as string,
    status: data.status as string,
    ...(data.from != null && { from: data.from as string }),
    ...(data.selectedDate != null && {
      selectedDate: data.selectedDate as string,
    }),
    days: ((data.days as Raw[]) ?? []).map(parseDaySchedule),
    ...(data.resumeDate != null && { resumeDate: data.resumeDate as string }),
    ...(data.message != null && { message: data.message as string }),
  };
}

// ── Campus ETA parser ──

/**
 * Parses campus ETA from `GET /bus/campus/eta`.
 * `envelope.data.inja.duration` and `envelope.data.jain.duration` in milliseconds.
 */
export function parseCampusEta(envelope: ApiEnvelope<unknown>): CampusEta {
  const data = envelope.data as Raw;
  const inja = data.inja as Raw | null;
  const jain = data.jain as Raw | null;

  return {
    inja: inja != null ? ((inja.duration as number) ?? null) : null,
    jain: jain != null ? ((jain.duration as number) ?? null) : null,
  };
}
