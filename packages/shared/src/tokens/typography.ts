/**
 * SDS Typography Tokens — TDS 7+5 level system.
 *
 * lineHeight is absolute px (not a ratio) — matching Flutter's absolute numerators.
 * Weight override pattern: `{ ...SdsTypo.t5, fontWeight: '700' }` (idiomatic RN spread).
 *
 * Flutter source: lib/design/sds_typo.dart
 */
export interface SdsTextStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  fontWeight:
    | '100'
    | '200'
    | '300'
    | '400'
    | '500'
    | '600'
    | '700'
    | '800'
    | '900';
}

const FONT_FAMILY = 'WantedSans';

// ── Main levels (t1–t7) ──

/** 30px / 40px — hero heading */
export const t1: SdsTextStyle = {
  fontFamily: FONT_FAMILY,
  fontSize: 30,
  lineHeight: 40,
  fontWeight: '700',
};

/** 26px / 35px — large heading */
export const t2: SdsTextStyle = {
  fontFamily: FONT_FAMILY,
  fontSize: 26,
  lineHeight: 35,
  fontWeight: '700',
};

/** 22px / 31px — screen title (most common) */
export const t3: SdsTextStyle = {
  fontFamily: FONT_FAMILY,
  fontSize: 22,
  lineHeight: 31,
  fontWeight: '700',
};

/** 20px / 29px — small title, section header */
export const t4: SdsTextStyle = {
  fontFamily: FONT_FAMILY,
  fontSize: 20,
  lineHeight: 29,
  fontWeight: '700',
};

/** 17px / 25.5px — body text (default) */
export const t5: SdsTextStyle = {
  fontFamily: FONT_FAMILY,
  fontSize: 17,
  lineHeight: 25.5,
  fontWeight: '400',
};

/** 15px / 22.5px — small body */
export const t6: SdsTextStyle = {
  fontFamily: FONT_FAMILY,
  fontSize: 15,
  lineHeight: 22.5,
  fontWeight: '400',
};

/** 13px / 19.5px — caption, meta info */
export const t7: SdsTextStyle = {
  fontFamily: FONT_FAMILY,
  fontSize: 13,
  lineHeight: 19.5,
  fontWeight: '400',
};

// ── Sub levels ──

/** 24px / 33px — between t3 and t4 */
export const sub5: SdsTextStyle = {
  fontFamily: FONT_FAMILY,
  fontSize: 24,
  lineHeight: 33,
  fontWeight: '700',
};

/** 19px / 28px — between t4 and t5 */
export const sub8: SdsTextStyle = {
  fontFamily: FONT_FAMILY,
  fontSize: 19,
  lineHeight: 28,
  fontWeight: '400',
};

/** 16px / 24px — list item body, between t5 and t6 */
export const sub10: SdsTextStyle = {
  fontFamily: FONT_FAMILY,
  fontSize: 16,
  lineHeight: 24,
  fontWeight: '400',
};

/** 12px / 18px — small caption */
export const sub12: SdsTextStyle = {
  fontFamily: FONT_FAMILY,
  fontSize: 12,
  lineHeight: 18,
  fontWeight: '400',
};

/** 11px / 16.5px — smallest text (badges) */
export const sub13: SdsTextStyle = {
  fontFamily: FONT_FAMILY,
  fontSize: 11,
  lineHeight: 16.5,
  fontWeight: '600',
};

/** Grouped typography tokens for namespaced access */
export const SdsTypo = {
  t1,
  t2,
  t3,
  t4,
  t5,
  t6,
  t7,
  sub5,
  sub8,
  sub10,
  sub12,
  sub13,
} as const;
