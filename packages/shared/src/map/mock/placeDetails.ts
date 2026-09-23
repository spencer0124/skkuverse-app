/**
 * Mock place details, until the server can serve them.
 *
 * **Development builds only.** The keys are the real seed slugs
 * (`eskara-2026-*`), and the 2026 content will be authored under the same slug
 * scheme — so if this table reached a release or the beta channel, the real
 * festival's pins would open 2025's text. `usePlaceDetail` is the only reader,
 * and it consults this table under `__DEV__` alone.
 *
 * The text is adapted from the 2025 ESKARA archive
 * (`26eskara/archive/notion/2025-eskara/`). Bank accounts, depositor names and
 * sign-up form links in the originals are deliberately left out. Images are
 * placeholders: the archived Notion image URLs are signed and expire.
 *
 * The set is chosen to cover every block composition the sheet has, not to be
 * complete:
 *
 * | id | blocks |
 * | --- | --- |
 * | `bar-01` | text · table(입장료) · table(menu) · image · notice |
 * | `nightbar-03` | text · table · table · image |
 * | `bar-07` | text · table with no prices |
 * | `daybooth-07` | text · list(3) · image — plus a link action |
 * | `daybooth-02a` | text · list(2), no image: the short-summary case |
 * | `daybooth-04a` | text · list(3, one without a description) · image |
 * | `promo-01` | image(logo) · text · list(1) |
 * | `truck-01` | table only — no text, so the body opens on a table |
 * | `goods-shop` | table · text(구매 방법) · notice · image |
 * | `medical` | text only — nothing for the highlight to lift |
 * | `barrierfree` | text ×2, the council's 신청 방법 / 이동 동선 shape |
 * | `toilet-bioeng` | deliberately absent: the head alone |
 */

import type { I18nText } from '../../types/map';
import type { PlaceBlock, PlaceDetail, PlaceListItem, PlaceTableRow } from '../../types/placeDetail';

/** Korean-only text, with English falling back to it the way the server does. */
const ko = (s: string): I18nText => ({ ko: s, en: s });
const tr = (koText: string, en: string, zh?: string): I18nText =>
  zh === undefined ? { ko: koText, en } : { ko: koText, en, zh };

const photo = (seed: string, n: number) => `https://picsum.photos/seed/${seed}-${n}/640/480`;

const INSTAGRAM = 'https://www.instagram.com/';

// ── Block builders ────────────────────────────────────────────────────────

const text = (id: string, body: string, title?: I18nText): PlaceBlock => ({
  type: 'text',
  id,
  title: title ?? null,
  body: ko(body),
});

const list = (id: string, title: I18nText | null, items: PlaceListItem[]): PlaceBlock => ({
  type: 'list',
  id,
  title,
  items,
});

const li = (emoji: string, title: string, description: string | null): PlaceListItem => ({
  emoji,
  title: ko(title),
  description: description === null ? null : ko(description),
});

const table = (id: string, title: I18nText | null, rows: PlaceTableRow[]): PlaceBlock => ({
  type: 'table',
  id,
  title,
  rows,
});

/** `won(5000)` → `5,000원`. Ops writes the formatted cell; this mirrors it. */
const won = (n: number) => `${n.toLocaleString('en-US')}원`;
const row = (label: string, value: string): PlaceTableRow => ({ label: ko(label), value: ko(value) });

const image = (id: string, url: string, caption?: string): PlaceBlock => ({
  type: 'image',
  id,
  title: null,
  url,
  caption: caption === undefined ? null : ko(caption),
});

const notice = (id: string, items: string[], title?: I18nText): PlaceBlock => ({
  type: 'notice',
  id,
  title: title ?? null,
  items: items.map(ko),
});

const instagram = (placeId: string) =>
  ({
    type: 'instagram',
    id: `${placeId}-instagram`,
    label: tr('인스타', 'Instagram', 'Instagram'),
    profileUrl: INSTAGRAM,
    postUrl: null,
  }) as const;

function place(placeId: string, detail: Partial<PlaceDetail> & Pick<PlaceDetail, 'kind'>): PlaceDetail {
  return {
    placeId,
    org: null,
    isUnion: false,
    locationLabel: null,
    actions: [instagram(placeId)],
    blocks: [],
    ...detail,
  };
}

const DETAILS: PlaceDetail[] = [
  place('eskara-2026-bar-01', {
    kind: 'pub',
    org: ko('경영대학 · 정보통신대학 학생회'),
    isUnion: true,
    locationLabel: ko('주점존 A-1'),
    blocks: [
      notice('bar-01-notice', [
        '사전 예약제로 운영해요. 1타임 18:00–19:30 · 2타임 19:40–21:10 · 3타임 21:20–22:50',
        '1타임을 사전 예약하면 1인당 2,000원 할인돼요.',
      ]),
      table('bar-01-menu', tr('메인 (무한리필)', 'Main (refills)'), [
        row('쿠파의 용암 떡볶이', '무한리필'),
        row('슈퍼스타 튀김 세트', '무한리필'),
        row('요시 알 주먹밥', '무한리필'),
        row('받아라! 파이어마리오 볼', '무한리필'),
        row('꿈틀! 밟아봐 굼바', '무한리필'),
        row('음료수', won(2000)),
        row('라면', won(2000)),
      ]),
      text(
        'bar-01-intro',
        '[포브스 선정] 쿠파가 탐내는 안주 1위\n' +
          '쿠파도 탐낼 안주, 피치공주도 반할 이벤트\n' +
          '쿠파가 피치공주를 데려간다? 하지만 괜찮다, 이 집 안주는 맛있으니까.\n' +
          '여기 아니면 어디 간단 마리오 빨리 오란 마리오',
      ),
      image('bar-01-photo', photo('bar-01', 1), '메뉴판'),
      table('bar-01-entry', tr('입장료', 'Entry'), [
        row('경영대학 · 정보통신대학 원전공생', won(16000)),
        row('그 외 성균인', won(18000)),
        row('외부인', won(20000)),
      ]),
      notice('bar-01-pay', ['입장료에 무한리필 메뉴가 포함돼요. 음료와 라면은 따로 구매해요.', '계좌이체와 현금으로 결제할 수 있어요.']),
    ],
  }),

  place('eskara-2026-nightbar-03', {
    kind: 'pub',
    org: ko('공과대학 · 건설환경공학부 학생회'),
    locationLabel: ko('야간주점존 3번'),
    blocks: [
      notice('nightbar-03-notice', [
        '입장료와 안주 가격은 따로예요.',
        '사전 예약하면 입장료가 1인당 2,000–5,000원 저렴해요.',
      ]),
      table('nightbar-03-menu', tr('메인', 'Main'), [
        row('원숭이 볶음밥', won(12000)),
        row('닭강정', won(13000)),
        row('오뎅탕', won(11000)),
        row('불파게티', won(9000)),
        row('바나나 브륄레', won(7000)),
        row('화채', won(7000)),
        row('바나나칩과 견과류', '기본 제공'),
      ]),
      text('nightbar-03-intro', '"2025년, 드디어 원숭이들이 캠퍼스로 상륙했다"'),
      image('nightbar-03-photo', photo('nightbar-03', 1)),
      table('nightbar-03-entry', tr('입장료', 'Entry'), [
        row('공과대학 원전공생', won(15000)),
        row('성균인', won(17000)),
        row('외부인', won(25000)),
      ]),
    ],
  }),

  place('eskara-2026-bar-07', {
    kind: 'pub',
    org: ko('약학대학 학생회'),
    locationLabel: ko('주점존 B-3'),
    blocks: [
      notice('bar-07-notice', ['총 13테이블이고, 사전 예약은 선착순이에요.', '현장 입장은 ¥200이 추가돼요.']),
      table('bar-07-menu', tr('메인', 'Main'), [
        row('오코노미야키', '¥1,200'),
        row('오뎅 나베', '¥900'),
        row('유즈폰즈 가라아게', '¥1,400'),
        row('에다마메', '무한 제공'),
        row('김부각', '무한 제공'),
      ]),
      text('bar-07-intro', '약대가 말아주는 단짠단짠 일본 감성 주점\n이날의 환율: ¥1,000 = 10,000원'),
    ],
  }),

  place('eskara-2026-daybooth-07', {
    kind: 'booth',
    org: ko('학생단체협의체'),
    isUnion: true,
    locationLabel: ko('주간부스존 7번'),
    actions: [
      instagram('eskara-2026-daybooth-07'),
      { type: 'link', id: 'type-s-guide', label: ko('미션 안내'), url: 'https://www.skku.edu/' },
    ],
    blocks: [
      notice('daybooth-07-notice', ['혼자 와도 부스 요원과 함께 작전을 수행할 수 있어요.']),
      list('daybooth-07-contents', null, [
        li('🕵️', '요원 심리테스트', '나와 친구의 성격을 꿰뚫는 테스트를 통과하면 작전이 시작돼요.'),
        li('🏅', '특급 요원 뱃지', '테스트를 끝까지 마치면 뱃지를 받고 공식 요원으로 기록돼요.'),
        li('🎯', '비밀 작전 암호 해독', '동료와 함께 암호를 풀고 마지막 작전까지 완수해 보세요.'),
      ]),
      text(
        'daybooth-07-intro',
        '당신은 선택받은 요원이다. 이곳은 학생들을 잠입·훈련시키는, 캠퍼스 속 가장 은밀한 비밀 기지. ' +
          '인간 이하의 대접과 강도 높은 검증을 견뎌낸 자만이 비밀요원의 칭호를 얻을 수 있다.',
      ),
      image('daybooth-07-photo', photo('daybooth-07', 1)),
    ],
  }),

  place('eskara-2026-daybooth-02a', {
    kind: 'booth',
    org: ko('킹각응원소'),
    locationLabel: ko('주간부스존 2번'),
    blocks: [
      list('daybooth-02a-contents', null, [
        li('👟', '야호~ 저기 신발이 간다', '신발을 가장 멀리 던지는 사람이 이기는 게임'),
        li('🎲', '명륜이가 좋아하는 랜덤 게임', '운영진이 고른 게임을 하나 하고, 이기면 도장을 받을 수 있는 게임'),
      ]),
      text('daybooth-02a-intro', '명륜 vs 율전, 자존심을 건 캠퍼스 대결! 실시간 순위와 특별 상품으로 더 뜨겁게'),
    ],
  }),

  place('eskara-2026-daybooth-04a', {
    kind: 'booth',
    org: ko('화학과 학생회 × BK21 연구단'),
    locationLabel: ko('주간부스존 4번'),
    blocks: [
      notice('daybooth-04a-notice', ['탈출에 성공하면 텀블러 등 상품을 받을 수 있어요.']),
      list('daybooth-04a-contents', null, [
        li('🧪', '분자 모형의 달인', '제한 시간 안에 분자 모형을 완성해요.'),
        li('🥼', '실험복 챌린지', null),
        li('🌈', 'pH 컬러 게임', '색깔만 보고 산성과 염기성을 맞혀요.'),
      ]),
      text('daybooth-04a-intro', '눈 떠 보니 실험실에 갇혀 버린 나. 현실에선 화포자였지만 에스카라에선 화학 천재?'),
      image('daybooth-04a-photo', photo('daybooth-04a', 1)),
    ],
  }),

  place('eskara-2026-promo-01', {
    kind: 'promo',
    org: ko('빗썸'),
    locationLabel: ko('프로모션 구역 102번 부스'),
    blocks: [
      list('promo-01-contents', null, [
        li('🎡', '룰렛 이벤트', '앱 설치 인증 후 룰렛을 돌려 경품을 받아요.'),
      ]),
      image('promo-01-logo', photo('promo-01-logo', 1)),
      text('promo-01-intro', '부스에 방문해 이벤트에 참여하고 경품을 받아 가세요.'),
    ],
  }),

  place('eskara-2026-truck-01', {
    kind: 'foodTruck',
    locationLabel: ko('푸드트럭존 1번'),
    blocks: [
      table('truck-01-menu', null, [
        row('닭꼬치', won(5000)),
        row('치즈닭꼬치', won(6000)),
        row('콜라', won(2000)),
      ]),
      image('truck-01-photo', photo('truck-01', 1)),
      text('truck-01-pay', '카드와 계좌이체로 결제할 수 있어요.', tr('결제 방법', 'Payment')),
    ],
  }),

  place('eskara-2026-goods-shop', {
    kind: 'goods',
    org: ko('총학생회'),
    locationLabel: ko('대운동장 구령대 방면'),
    blocks: [
      notice('goods-shop-notice', [
        '프리오더 상품은 같은 자리에서 받을 수 있어요.',
        '수령할 때 학생증이나 주문 내역을 보여 주세요.',
      ]),
      table('goods-shop-items', tr('현장 판매', 'On-site'), [
        row('ESKARA 티셔츠', won(15000)),
        row('응원 타월', won(8000)),
        row('키링', won(5000)),
      ]),
      text('goods-shop-pay', '카드와 계좌이체, 현금으로 살 수 있어요.', tr('구매 방법', 'Payment')),
      image('goods-shop-photo', photo('goods-shop', 1)),
    ],
  }),

  place('eskara-2026-medical', {
    kind: 'facility',
    locationLabel: ko('대운동장 본부석 옆'),
    blocks: [
      notice('medical-notice', [
        '다치거나 몸이 안 좋으면 바로 방문해 주세요.',
        '응급 상황에는 가까운 스태프에게 알려 주세요.',
      ]),
      text('medical-use', '행사 시간 내내 상주하고, 간단한 처치와 휴식 공간을 제공해요.', tr('이용 안내', 'How to use')),
    ],
  }),

  place('eskara-2026-barrierfree', {
    kind: 'facility',
    locationLabel: ko('대운동장 남측 입구'),
    blocks: [
      notice('barrierfree-notice', [
        '휠체어 이용자와 동반 1인이 이용할 수 있어요.',
        '공연 관람 구역까지 경사로로 이동할 수 있어요.',
      ]),
      text('barrierfree-apply', '현장 스태프에게 말씀해 주시면 바로 안내해 드려요.', tr('신청 방법', 'How to apply')),
      text('barrierfree-route', '남측 입구에서 경사로를 따라 관람 구역까지 턱 없이 이어져요.', tr('이동 동선', 'Route')),
    ],
  }),
];

export const MOCK_PLACE_DETAILS: Readonly<Record<string, PlaceDetail>> = Object.freeze(
  Object.fromEntries(DETAILS.map((d) => [d.placeId, d])),
);
