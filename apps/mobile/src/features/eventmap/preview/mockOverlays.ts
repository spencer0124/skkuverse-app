/**
 * Festival pins for the place-sheet preview, shaped like `/map/overlays/event`.
 *
 * Development only. Production's `/map/config` serves no festival layers while
 * the activation window is shut, so there is nothing on the campus map to tap;
 * this gives the sheet something to open without opening a server window.
 *
 * Titles, subtitles, fields and actions mirror the server's seed
 * (skkuverse-server `scripts/data/eskara-2026-places.json`), and the ids are the
 * seed's, so `usePlaceDetail` resolves the same mock detail it would for a real
 * pin. Hours are built around the moment the preview was opened, so every
 * opening state can be shown on any day.
 */

import type { MapOverlay, MarkerAction, MarkerField, TimeWindow } from '@skkuverse/shared';

export type PreviewClock = 'open' | 'upcoming' | 'closed';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const PREVIEW_LAYER_LABELS: Readonly<Record<string, string>> = {
  eskara26_bar: '주점',
  eskara26_booth: '부스',
  eskara26_food: '먹거리',
  eskara26_facility: '편의시설',
};

const text = (ko: string) => ({ ko, en: ko });

function windowsFor(clock: PreviewClock, now: number, days: 1 | 2): TimeWindow[] {
  const hour = Math.floor(now / HOUR) * HOUR;
  // Day one is the day the preview is looked at, so an open or upcoming place
  // is on 1일차 and a closed one has had both of its days.
  const [start, end] =
    clock === 'open' ? [hour - 2 * HOUR, hour + 4 * HOUR]
    : clock === 'upcoming' ? [hour + 1 * HOUR, hour + 7 * HOUR]
    : [hour - DAY - 8 * HOUR, hour - DAY - 2 * HOUR];
  const first = { startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString() };
  if (days === 1) return [first];
  return [first, { startAt: new Date(start + DAY).toISOString(), endAt: new Date(end + DAY).toISOString() }];
}

interface Seed {
  id: string;
  layer: keyof typeof PREVIEW_LAYER_LABELS;
  title: string;
  subtitle?: string;
  days: 0 | 1 | 2;
  fields?: MarkerField[];
  actions?: MarkerAction[];
  /** What the preview list says this entry demonstrates. */
  note: string;
}

const SEEDS: Seed[] = [
  {
    id: 'eskara-2026-bar-01',
    layer: 'eskara26_bar',
    title: '슈퍼 정통 X 경영 브라더스',
    subtitle: '연합 주점',
    days: 2,
    fields: [{ label: { ko: '메뉴', en: 'Menu', zh: '菜单' }, value: text('골뱅이소면 · 감자튀김 · 하이볼') }],
    actions: [
      {
        id: 'entry',
        label: text('입장 안내'),
        actionType: 'webview',
        actionValue: 'https://webview.skkuverse.com/eskara/entry',
        style: 'primary',
      },
    ],
    note: '주점 · 모든 블록',
  },
  { id: 'eskara-2026-nightbar-03', layer: 'eskara26_bar', title: '우끼끼친', subtitle: '1일차 야간주점', days: 1, note: '주점 · 가격 있는 메뉴' },
  { id: 'eskara-2026-bar-07', layer: 'eskara26_bar', title: '이자카藥 (IZAKAYAK)', subtitle: '단일 주점', days: 2, note: '주점 · 가격 없는 메뉴' },
  { id: 'eskara-2026-daybooth-07', layer: 'eskara26_booth', title: '[ESKARA 정복 미션] 코드네임: TYPE-S', days: 2, note: '부스 · 연합 · 이미지' },
  { id: 'eskara-2026-daybooth-02a', layer: 'eskara26_booth', title: '캠퍼스는 다르지만 응원은 하고싶어', days: 1, note: '부스 · 총학 목업 그대로' },
  { id: 'eskara-2026-daybooth-04a', layer: 'eskara26_booth', title: '실험실 탈출', days: 2, note: '부스 · 콘텐츠 3개' },
  {
    id: 'eskara-2026-daybooth-01',
    layer: 'eskara26_booth',
    title: 'ESKARA 부스전 운영 본부',
    subtitle: '도장판 교환 · 리워드',
    days: 2,
    actions: [
      {
        id: 'reward',
        label: text('리워드 안내'),
        actionType: 'content',
        actionValue: '부스 체험 후 도장을 모아 오세요.\n\n도장 4개 — 추첨 볼 1개\n도장 5개 — 추첨 볼 1개 + ESKARA 한정판 키링',
        style: 'secondary',
      },
    ],
    note: '상세 없음 · 서버 본문만',
  },
  {
    id: 'eskara-2026-promo-01',
    layer: 'eskara26_booth',
    title: '프로모션 부스 (북측)',
    days: 2,
    actions: [
      { id: 'sponsor', label: text('후원사 안내'), actionType: 'external', actionValue: 'https://www.skku.edu/', style: 'secondary' },
    ],
    note: '프로모션 · 로고',
  },
  { id: 'eskara-2026-truck-01', layer: 'eskara26_food', title: '인사이더', subtitle: '푸드트럭 1', days: 2, note: '푸드트럭 · 홈 탭 없음' },
  {
    id: 'eskara-2026-goods-shop',
    layer: 'eskara26_booth',
    title: '총학생회 굿즈샵',
    days: 2,
    actions: [
      { id: 'goods', label: text('굿즈 안내'), actionType: 'webview', actionValue: 'https://webview.skkuverse.com/eskara/goods', style: 'primary' },
    ],
    note: '굿즈샵 · 결제 수단',
  },
  { id: 'eskara-2026-medical', layer: 'eskara26_facility', title: '의무실 / 응급 부스', days: 0, note: '편의시설 · 탭 1개' },
  { id: 'eskara-2026-toilet-bioeng', layer: 'eskara26_facility', title: '화장실 (생명공학관)', days: 0, note: '화장실 · 기본 뼈대' },
];

export interface PreviewPlace {
  overlay: MapOverlay;
  note: string;
}

export function previewPlaces(clock: PreviewClock, now: number): PreviewPlace[] {
  return SEEDS.map((seed, i) => ({
    note: seed.note,
    overlay: {
      kind: 'marker',
      id: seed.id,
      layerId: seed.layer,
      campus: 'nsc',
      text: text(seed.title),
      subtitle: seed.subtitle ? text(seed.subtitle) : null,
      hours: seed.days === 0 ? [] : windowsFor(clock, now, seed.days),
      fields: seed.fields ?? [],
      actions: seed.actions ?? [],
      order: i,
      tap: { kind: 'event', placeId: seed.id },
      lat: 37.295,
      lng: 126.971,
      pinPriority: 0,
    },
  }));
}
