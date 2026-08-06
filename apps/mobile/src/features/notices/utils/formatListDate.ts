/**
 * 공지 게시일을 리스트 셀 표기로 변환 — "MM/DD" (zero-padded).
 *
 * 당일 항목은 시각만 노출하려 했으나 **게시 시각을 담은 필드가 파이프라인
 * 어디에도 없다**: 크롤러가 원본 게시판에서 얻는 값이 이미 날짜뿐이고
 * (`modules/notices/models.py` — `date: str  # YYYY-MM-DD`), 시각을 가진
 * 유일한 필드 `crawledAt`은 게시 시각이 아니라 우리가 크롤한 시각이라
 * 게시 시각으로 쓰면 틀린 값을 보여준다. 그래서 당일/과거를 구분하지 않고
 * 전부 날짜로 통일한다. 당일 시각 표기가 필요해지면 백엔드가 원본 게시
 * 시각을 새 필드로 노출하는 것이 선행 조건.
 *
 * 상대 표기("어제", "2일 전")를 쓰던 formatRelativeDate를 대체한다 —
 * 날짜 그루핑 섹션 헤더가 이미 "최근 7일" 같은 상대 맥락을 주므로
 * 셀에서까지 상대 표기를 반복할 이유가 없었다.
 *
 * 파싱 불가 입력은 빈 문자열 → 호출부가 해당 세그먼트를 생략한다.
 */
export function formatListDate(date: string): string {
  const parts = date.split('-');
  if (parts.length < 3) return '';
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return '';
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}
