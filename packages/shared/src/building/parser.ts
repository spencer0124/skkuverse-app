/**
 * Building parsers — list, detail, and search.
 *
 * Important: Building uses GeoJSON `location.coordinates = [lng, lat]`.
 * The `_id` field maps to `skkuId`.
 *
 * Flutter source: lib/features/building/model/*.dart
 */

import type { ApiEnvelope } from '../api/types';
import type {
  Building,
  BuildingDetail,
  BuildingConnection,
  FloorInfo,
  FloorSpace,
  BuildingSearchResult,
  SpaceGroup,
  SearchSpaceItem,
  LocalizedText,
  BuildingImage,
  Accessibility,
} from '../types/building';

// ── Internal helpers ──

function parseLocalizedText(raw: unknown): LocalizedText {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    ko: (obj.ko as string) ?? '',
    en: (obj.en as string) ?? '',
  };
}

function parseBuilding(raw: Record<string, unknown>): Building {
  // GeoJSON: location.coordinates = [lng, lat]
  const location = raw.location as Record<string, unknown> | undefined;
  const coords = location?.coordinates as number[] | undefined;
  const lng = coords?.[0] ?? 0;
  const lat = coords?.[1] ?? 0;

  const imageRaw = raw.image as Record<string, unknown> | undefined;
  let image: BuildingImage | undefined;
  if (imageRaw?.url) {
    image = {
      url: imageRaw.url as string,
      filename: (imageRaw.filename as string) ?? '',
    };
  }

  const accessRaw = raw.accessibility as Record<string, unknown> | undefined;
  let accessibility: Accessibility | undefined;
  if (accessRaw) {
    accessibility = {
      elevator: (accessRaw.elevator as boolean) ?? false,
      toilet: (accessRaw.toilet as boolean) ?? false,
    };
  }

  return {
    skkuId: raw._id as number,
    buildNo: (raw.buildNo as string) ?? undefined,
    displayNo: (raw.displayNo as string) ?? undefined,
    type: (raw.type as string) ?? 'building',
    campus: (raw.campus as string) ?? 'hssc',
    campusLabel: (raw.campusLabel as string) ?? '',
    name: parseLocalizedText(raw.name),
    description: raw.description
      ? parseLocalizedText(raw.description)
      : undefined,
    lat,
    lng,
    image,
    accessibility,
    attachments: (raw.attachments as unknown[]) ?? [],
    extensions: (raw.extensions as Record<string, unknown>) ?? {},
  };
}

function parseFloorSpace(raw: Record<string, unknown>): FloorSpace {
  return {
    spaceCd: (raw.spaceCd as string) ?? '',
    name: parseLocalizedText(raw.name),
    conspaceCd: (raw.conspaceCd as string) ?? undefined,
  };
}

function parseFloorInfo(raw: Record<string, unknown>): FloorInfo {
  return {
    floor: parseLocalizedText(raw.floor),
    spaces: ((raw.spaces as unknown[]) ?? []).map((s) =>
      parseFloorSpace(s as Record<string, unknown>),
    ),
  };
}

function parseConnection(raw: Record<string, unknown>): BuildingConnection {
  return {
    targetSkkuId: raw.targetSkkuId as number,
    targetBuildNo: (raw.targetBuildNo as string) ?? undefined,
    targetDisplayNo: (raw.targetDisplayNo as string) ?? undefined,
    targetName: parseLocalizedText(raw.targetName),
    fromFloor: parseLocalizedText(raw.fromFloor),
    toFloor: parseLocalizedText(raw.toFloor),
  };
}

function parseSpaceItem(raw: Record<string, unknown>): SearchSpaceItem {
  return {
    spaceCd: (raw.spaceCd as string) ?? '',
    name: parseLocalizedText(raw.name),
    floor: parseLocalizedText(raw.floor),
  };
}

function parseSpaceGroup(raw: Record<string, unknown>): SpaceGroup {
  return {
    skkuId: (raw.skkuId as number) ?? undefined,
    buildNo: (raw.buildNo as string) ?? '',
    displayNo: (raw.displayNo as string) ?? undefined,
    campus: (raw.campus as string) ?? '',
    campusLabel: (raw.campusLabel as string) ?? '',
    buildingName: parseLocalizedText(raw.buildingName),
    items: ((raw.items as unknown[]) ?? []).map((i) =>
      parseSpaceItem(i as Record<string, unknown>),
    ),
  };
}

// ── Public parsers ──

export function parseBuildingList(
  envelope: ApiEnvelope<unknown>,
): Building[] {
  const data = envelope.data as Record<string, unknown>;
  const buildings = (data.buildings as unknown[]) ?? [];
  return buildings.map((b) => parseBuilding(b as Record<string, unknown>));
}

export function parseBuildingDetail(
  envelope: ApiEnvelope<unknown>,
): BuildingDetail {
  const data = envelope.data as Record<string, unknown>;
  return {
    building: parseBuilding(
      (data.building as Record<string, unknown>) ?? {},
    ),
    floors: ((data.floors as unknown[]) ?? []).map((f) =>
      parseFloorInfo(f as Record<string, unknown>),
    ),
    connections: ((data.connections as unknown[]) ?? []).map((c) =>
      parseConnection(c as Record<string, unknown>),
    ),
  };
}

function parseCampusCounts(raw: unknown): { hssc: number; nsc: number; total: number } {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const hssc = (obj.hssc as number) ?? 0;
  const nsc = (obj.nsc as number) ?? 0;
  return { hssc, nsc, total: (obj.total as number) ?? hssc + nsc };
}

export function parseBuildingSearchResult(
  envelope: ApiEnvelope<unknown>,
): BuildingSearchResult {
  const meta = envelope.meta as Record<string, unknown>;
  const data = envelope.data as Record<string, unknown>;
  const countsRaw = (meta.counts ?? {}) as Record<string, unknown>;
  return {
    keyword: (meta.keyword as string) ?? '',
    buildingCount: (meta.buildingCount as number) ?? 0,
    spaceCount: (meta.spaceCount as number) ?? 0,
    buildings: ((data.buildings as unknown[]) ?? []).map((b) =>
      parseBuilding(b as Record<string, unknown>),
    ),
    spaces: ((data.spaces as unknown[]) ?? []).map((s) =>
      parseSpaceGroup(s as Record<string, unknown>),
    ),
    counts: {
      building: parseCampusCounts(countsRaw.building),
      space: parseCampusCounts(countsRaw.space),
    },
  };
}
