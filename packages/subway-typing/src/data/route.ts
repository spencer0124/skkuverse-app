/**
 * 혜화 → 성균관대, the way a student actually rides it: Line 4 south through
 * 사당 and the Gwacheon line to 금정, then one change to Line 1 for the last
 * four stops. 사당 is a Line 2 interchange but not a change on this trip.
 *
 * `name` is what the player types. 총신대입구 is signed 총신대입구(이수); the
 * 이수 goes in `sub` and is only shown, because nobody should have to find
 * parentheses on a phone keyboard.
 */

export type LineId = '4' | '1';

export const LINES: Record<LineId, { name: string; color: string }> = {
  '4': { name: '4호선', color: '#00A5DE' },
  '1': { name: '1호선', color: '#0052A4' },
};

export interface Station {
  name: string;
  /** Shown small beside the name — the alternative name in the signage. */
  sub?: string;
  /** The line the train is on when it pulls in here. */
  line: LineId;
  /** Change here, onto this line. */
  transferTo?: LineId;
}

const line4 = [
  '혜화',
  '동대문',
  '동대문역사문화공원',
  '충무로',
  '명동',
  '회현',
  '서울역',
  '숙대입구',
  '삼각지',
  '신용산',
  '이촌',
  '동작',
  '총신대입구',
  '사당',
  '남태령',
  '선바위',
  '경마공원',
  '대공원',
  '과천',
  '정부과천청사',
  '인덕원',
  '평촌',
  '범계',
  '금정',
];

const line1 = ['군포', '당정', '의왕', '성균관대'];

export const ROUTE: Station[] = [
  ...line4.map((name): Station => {
    if (name === '총신대입구') return { name, sub: '이수', line: '4' };
    if (name === '금정') return { name, line: '4', transferTo: '1' };
    return { name, line: '4' };
  }),
  ...line1.map((name): Station => ({ name, line: '1' })),
];

/**
 * Stations to type: all of them. The train waits short of 혜화, so the run
 * begins by pulling into the first station like every other.
 */
export const STOP_COUNT = ROUTE.length;
