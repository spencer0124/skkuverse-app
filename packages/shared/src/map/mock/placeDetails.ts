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
 * The set is chosen to cover every branch the sheet has, not to be complete:
 *
 * | id | case |
 * | --- | --- |
 * | `bar-01` | richest pub — entry fees, reservations, grouped menu, gallery |
 * | `nightbar-03` | pub with priced menu lines |
 * | `bar-07` | pub whose menu has no prices |
 * | `daybooth-07` | joint booth with intro, image and contents |
 * | `daybooth-02a` | plain booth with the council mockup's two contents |
 * | `daybooth-04a` | booth with contents and a prize notice |
 * | `promo-01` | promotion booth — logo and one-line intro |
 * | `truck-01` | food truck — signature menu only |
 * | `goods-shop` | goods — items, pickup notices, payment methods |
 * | `medical` | facility with notices only (one tab, no bar) |
 * | `barrierfree` | facility with notices only |
 * | `toilet-bioeng` | deliberately absent: the base skeleton |
 */

import type { I18nText } from '../../types/map';
import type { PlaceDetail, PlaceMenuItem } from '../../types/placeDetail';

/** Korean-only text, with English falling back to it the way the server does. */
const ko = (s: string): I18nText => ({ ko: s, en: s });
const tr = (koText: string, en: string, zh?: string): I18nText =>
  zh === undefined ? { ko: koText, en } : { ko: koText, en, zh };

const item = (name: string, price: number | null, note?: string): PlaceMenuItem => ({
  name: ko(name),
  price,
  note: note === undefined ? null : ko(note),
});

const photo = (seed: string, n: number) => `https://picsum.photos/seed/${seed}-${n}/640/480`;

const INSTAGRAM = 'https://www.instagram.com/';

function place(placeId: string, detail: Partial<PlaceDetail> & Pick<PlaceDetail, 'kind'>): PlaceDetail {
  return {
    placeId,
    org: null,
    isUnion: false,
    locationLabel: null,
    intro: null,
    logoUrl: null,
    images: [],
    contents: [],
    menu: [],
    entryFees: [],
    notices: [],
    paymentMethods: [],
    instagramUrl: null,
    ...detail,
  };
}

const DETAILS: PlaceDetail[] = [
  place('eskara-2026-bar-01', {
    kind: 'pub',
    org: ko('경영대학 · 정보통신대학 학생회'),
    isUnion: true,
    locationLabel: ko('주점존 A-1'),
    intro: ko(
      '[포브스 선정] 쿠파가 탐내는 안주 1위\n' +
        '쿠파도 탐낼 안주, 피치공주도 반할 이벤트\n' +
        '쿠파가 피치공주를 데려간다? 하지만 괜찮다, 이 집 안주는 맛있으니까.\n' +
        '여기 아니면 어디 간단 마리오 빨리 오란 마리오',
    ),
    images: [photo('bar-01', 1), photo('bar-01', 2), photo('bar-01', 3), photo('bar-01', 4)],
    entryFees: [
      { label: ko('경영대학 · 정보통신대학 원전공생'), price: 16000 },
      { label: ko('그 외 성균인'), price: 18000 },
      { label: ko('외부인'), price: 20000 },
    ],
    menu: [
      {
        title: tr('메인 (무한리필)', 'Main (refills)'),
        items: [item('쿠파의 용암 떡볶이', null), item('슈퍼스타 튀김 세트', null), item('요시 알 주먹밥', null)],
      },
      {
        title: tr('서브 (무한리필)', 'Sides (refills)'),
        items: [item('받아라! 파이어마리오 볼', null), item('꿈틀! 밟아봐 굼바', null)],
      },
      {
        title: tr('추가 구매', 'Extras'),
        items: [item('음료수', 2000), item('라면', 2000)],
      },
    ],
    notices: [
      ko('사전 예약제로 운영해요. 1타임 18:00–19:30 · 2타임 19:40–21:10 · 3타임 21:20–22:50'),
      ko('1타임을 사전 예약하면 1인당 2,000원 할인돼요.'),
      ko('입장료에 무한리필 메뉴가 포함돼요. 음료와 라면은 따로 구매해요.'),
    ],
    paymentMethods: [ko('계좌이체'), ko('현금')],
    instagramUrl: INSTAGRAM,
  }),

  place('eskara-2026-nightbar-03', {
    kind: 'pub',
    org: ko('공과대학 · 건설환경공학부 학생회'),
    locationLabel: ko('야간주점존 3번'),
    intro: ko('"2025년, 드디어 원숭이들이 캠퍼스로 상륙했다"'),
    images: [photo('nightbar-03', 1), photo('nightbar-03', 2)],
    entryFees: [
      { label: ko('공과대학 원전공생'), price: 15000 },
      { label: ko('성균인'), price: 17000 },
      { label: ko('외부인'), price: 25000 },
    ],
    menu: [
      { title: tr('기본 제공', 'On the house'), items: [item('바나나칩과 견과류', null)] },
      {
        title: tr('메인', 'Main'),
        items: [
          item('원숭이 볶음밥', 12000),
          item('닭강정', 13000),
          item('오뎅탕', 11000),
          item('불파게티', 9000),
        ],
      },
      { title: tr('서브', 'Sides'), items: [item('바나나 브륄레', 7000), item('화채', 7000)] },
    ],
    notices: [
      ko('입장료와 안주 가격은 따로예요.'),
      ko('사전 예약하면 입장료가 1인당 2,000–5,000원 저렴해요.'),
    ],
    instagramUrl: INSTAGRAM,
  }),

  place('eskara-2026-bar-07', {
    kind: 'pub',
    org: ko('약학대학 학생회'),
    locationLabel: ko('주점존 B-3'),
    intro: ko('약대가 말아주는 단짠단짠 일본 감성 주점\n이날의 환율: ¥1,000 = 10,000원'),
    menu: [
      { title: tr('무한 제공', 'Unlimited'), items: [item('에다마메', null), item('김부각', null)] },
      {
        title: tr('메인', 'Main'),
        items: [
          item('오코노미야키', null, '¥1,200'),
          item('오뎅 나베', null, '¥900'),
          item('유즈폰즈 가라아게', null, '¥1,400'),
        ],
      },
    ],
    notices: [ko('총 13테이블이고, 사전 예약은 선착순이에요.'), ko('현장 입장은 ¥200이 추가돼요.')],
  }),

  place('eskara-2026-daybooth-07', {
    kind: 'booth',
    org: ko('학생단체협의체'),
    isUnion: true,
    locationLabel: ko('주간부스존 7번'),
    intro: ko(
      '당신은 선택받은 요원이다. 이곳은 학생들을 잠입·훈련시키는, 캠퍼스 속 가장 은밀한 비밀 기지. ' +
        '인간 이하의 대접과 강도 높은 검증을 견뎌낸 자만이 비밀요원의 칭호를 얻을 수 있다.',
    ),
    images: [photo('daybooth-07', 1)],
    contents: [
      {
        title: ko('요원 심리테스트'),
        description: ko('나와 친구의 성격을 꿰뚫는 테스트를 통과하면 작전이 시작돼요.'),
      },
      {
        title: ko('특급 요원 뱃지'),
        description: ko('테스트를 끝까지 마치면 뱃지를 받고 공식 요원으로 기록돼요.'),
      },
    ],
    notices: [ko('혼자 와도 부스 요원과 함께 작전을 수행할 수 있어요.')],
    instagramUrl: INSTAGRAM,
  }),

  place('eskara-2026-daybooth-02a', {
    kind: 'booth',
    org: ko('킹각응원소'),
    locationLabel: ko('주간부스존 2번'),
    intro: ko('명륜 vs 율전, 자존심을 건 캠퍼스 대결! 실시간 순위와 특별 상품으로 더 뜨겁게'),
    contents: [
      { title: ko('야호~ 저기 신발이 간다'), description: ko('신발을 가장 멀리 던지는 사람이 이기는 게임') },
      {
        title: ko('명륜이가 좋아하는 랜덤 게임'),
        description: ko('운영진이 고른 게임을 하나 하고, 이기면 도장을 받을 수 있는 게임'),
      },
    ],
  }),

  place('eskara-2026-daybooth-04a', {
    kind: 'booth',
    org: ko('화학과 학생회 × BK21 연구단'),
    locationLabel: ko('주간부스존 4번'),
    intro: ko('눈 떠 보니 실험실에 갇혀 버린 나. 현실에선 화포자였지만 에스카라에선 화학 천재?'),
    images: [photo('daybooth-04a', 1), photo('daybooth-04a', 2)],
    contents: [
      { title: ko('분자 모형의 달인'), description: ko('제한 시간 안에 분자 모형을 완성해요.') },
      { title: ko('실험복 챌린지'), description: null },
      { title: ko('pH 컬러 게임'), description: ko('색깔만 보고 산성과 염기성을 맞혀요.') },
    ],
    notices: [ko('탈출에 성공하면 텀블러 등 상품을 받을 수 있어요.')],
    instagramUrl: INSTAGRAM,
  }),

  place('eskara-2026-promo-01', {
    kind: 'promo',
    org: ko('빗썸'),
    locationLabel: ko('프로모션 구역 102번 부스'),
    intro: ko('부스에 방문해 이벤트에 참여하고 경품을 받아 가세요.'),
    logoUrl: photo('promo-01-logo', 1),
    contents: [{ title: ko('룰렛 이벤트'), description: ko('앱 설치 인증 후 룰렛을 돌려 경품을 받아요.') }],
  }),

  place('eskara-2026-truck-01', {
    kind: 'foodTruck',
    locationLabel: ko('푸드트럭존 1번'),
    images: [photo('truck-01', 1)],
    menu: [{ title: null, items: [item('닭꼬치', 5000), item('치즈닭꼬치', 6000), item('콜라', 2000)] }],
    paymentMethods: [ko('카드'), ko('계좌이체')],
    instagramUrl: INSTAGRAM,
  }),

  place('eskara-2026-goods-shop', {
    kind: 'goods',
    org: ko('총학생회'),
    locationLabel: ko('대운동장 구령대 방면'),
    images: [photo('goods-shop', 1), photo('goods-shop', 2)],
    menu: [
      {
        title: tr('현장 판매', 'On-site'),
        items: [item('ESKARA 티셔츠', 15000), item('응원 타월', 8000), item('키링', 5000)],
      },
    ],
    notices: [
      ko('프리오더 상품은 같은 자리에서 받을 수 있어요.'),
      ko('수령할 때 학생증이나 주문 내역을 보여 주세요.'),
    ],
    paymentMethods: [ko('카드'), ko('계좌이체'), ko('현금')],
    instagramUrl: INSTAGRAM,
  }),

  place('eskara-2026-medical', {
    kind: 'facility',
    locationLabel: ko('대운동장 본부석 옆'),
    notices: [
      ko('다치거나 몸이 안 좋으면 바로 방문해 주세요.'),
      ko('응급 상황에는 가까운 스태프에게 알려 주세요.'),
    ],
  }),

  place('eskara-2026-barrierfree', {
    kind: 'facility',
    locationLabel: ko('대운동장 남측 입구'),
    notices: [
      ko('휠체어 이용자와 동반 1인이 이용할 수 있어요.'),
      ko('공연 관람 구역까지 경사로로 이동할 수 있어요.'),
    ],
  }),
];

export const MOCK_PLACE_DETAILS: Readonly<Record<string, PlaceDetail>> = Object.freeze(
  Object.fromEntries(DETAILS.map((d) => [d.placeId, d])),
);
