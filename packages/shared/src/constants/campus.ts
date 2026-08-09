/**
 * The campus closed set.
 *
 * Deliberately dependency-free and NOT in `store/settings.ts`, even though the
 * settings store is where it used to live. Parsers need it, parsers are pure and
 * run under vitest, and importing it from the store pulled zustand →
 * react-native-mmkv → react-native into them — which vitest cannot parse
 * (react-native ships Flow). A domain constant belongs below the stores, not
 * inside one.
 *
 * The type is derived from the array so the runtime allowlist and the compile-time
 * union cannot disagree.
 */
export const CAMPUSES = ['hssc', 'nsc'] as const;

/** HSSC = 인문사회과학캠퍼스, NSC = 자연과학캠퍼스 */
export type Campus = (typeof CAMPUSES)[number];
