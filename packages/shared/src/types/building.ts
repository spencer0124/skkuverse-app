/**
 * Building types — list, detail, search, and navigation payload.
 *
 * Flutter source: lib/features/building/model/*.dart
 */

// ── Localized text ──

export interface LocalizedText {
  ko: string;
  en: string;
}

/** Returns localized text based on language, falls back to Korean. */
export function getLocalizedText(
  text: LocalizedText | undefined,
  lang: string,
): string {
  if (!text) return '';
  return lang === 'en' ? text.en || text.ko : text.ko;
}

// ── Building image ──

export interface BuildingImage {
  url: string;
  filename: string;
}

// ── Accessibility ──

export interface Accessibility {
  elevator: boolean;
  toilet: boolean;
}

// ── Building (used across list, search, detail) ──

export interface Building {
  skkuId: number;
  buildNo?: string;
  displayNo?: string;
  type: string; // "building" | "facility"
  campus: string; // "hssc" | "nsc"
  campusLabel: string;
  name: LocalizedText;
  description?: LocalizedText;
  lat: number;
  lng: number;
  image?: BuildingImage;
  accessibility?: Accessibility;
  attachments: unknown[];
  extensions: Record<string, unknown>;
}

// ── Floor & space detail ──

export interface FloorSpace {
  spaceCd: string;
  name: LocalizedText;
  conspaceCd?: string;
}

export interface FloorInfo {
  floor: LocalizedText;
  spaces: FloorSpace[];
}

// ── Building connections ──

export interface BuildingConnection {
  targetSkkuId: number;
  targetBuildNo?: string;
  targetDisplayNo?: string;
  targetName: LocalizedText;
  fromFloor: LocalizedText;
  toFloor: LocalizedText;
}

// ── Full building detail from GET /building/{skkuId} ──

export interface BuildingDetail {
  building: Building;
  floors: FloorInfo[];
  connections: BuildingConnection[];
}

// ── Search types ──

export interface SearchSpaceItem {
  spaceCd: string;
  name: LocalizedText;
  floor: LocalizedText;
}

export interface SpaceGroup {
  skkuId?: number;
  buildNo: string;
  displayNo?: string;
  campus: string;
  campusLabel: string;
  buildingName: LocalizedText;
  items: SearchSpaceItem[];
}

export interface BuildingSearchResult {
  keyword: string;
  buildingCount: number;
  spaceCount: number;
  buildings: Building[];
  spaces: SpaceGroup[];
}

// ── Floor badge ──

/** Convert floor name to short badge code: "1층" → "1F", "지하 2층" → "B2", "B1" → "B1" */
export function floorBadge(name: string): string {
  const krBasement = name.match(/지하\s*(\d+)/);
  if (krBasement) return `B${krBasement[1]}`;
  const enBasement = name.match(/^B(\d+)$/i);
  if (enBasement) return `B${enBasement[1]}`;
  const num = name.match(/(\d+)/);
  if (num) return `${num[1]}F`;
  return name.length > 3 ? name.substring(0, 3) : name;
}

// ── Navigation payload (search → map camera) ──

export interface BuildingNavPayload {
  skkuId: number;
  lat: number;
  lng: number;
  campus: string;
  highlightFloor?: string;
  highlightSpaceCd?: string;
}
