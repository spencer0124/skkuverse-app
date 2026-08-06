import { StyleSheet, View } from 'react-native';
import { SdsColors, useT } from '@skkuverse/shared';
import { Txt, colorSeeds } from '@skkuverse/sds';
import type { TimelineEntry } from '../utils/buildNoticeTimeline';

// SDS seed에서 가져온다. `#1f3d2e` 리터럴은 이미 레포에 14곳 하드코딩돼
// 있고(NoticeRow.tsx:74-78 주석 참고) 15번째를 만들지 않는다.
const ACCENT = colorSeeds.primary;

/**
 * 단계 타임라인.
 *
 * 한때 위에 `D-22 · 지원 마감` 헤드라인을 따로 뒀지만 제거했다 — 타임라인이
 * 이미 같은 사실(가장 가까운 마감이 언제인지)을 초록 강조로 보여주고 있어서,
 * 헤드라인은 같은 정보를 한 번 더 큰 글씨로 반복하는 것에 가까웠다.
 *
 * 섹션 제목("일정")도 붙이지 않는다. 날짜 목록은 자기가 일정임을 스스로
 * 설명하고, 제목은 세로 공간만 먹으며 위계를 하나 더 만든다.
 *
 * 지난 단계는 접지 않는다. 접기 토글은 "뭔가 숨겨져 있다"는 인지 부담을
 * 만드는데, 회색으로 낮추는 것만으로 이미 시선에서 빠진다.
 */
export function NoticeTimeline({ entries }: { entries: TimelineEntry[] }) {
  const { t } = useT();

  if (entries.length === 0) return null;

  return (
    <View style={styles.timeline}>
      {entries.map((entry, i) => (
        <ScheduleRow
          key={`${entry.label ?? 'period'}-${i}`}
          entry={entry}
          fallbackLabel={t('notices.period')}
          isLast={i === entries.length - 1}
        />
      ))}
    </View>
  );
}

function ScheduleRow({
  entry,
  fallbackLabel,
  isLast,
}: {
  entry: TimelineEntry;
  fallbackLabel: string;
  isLast: boolean;
}) {
  const isPast = entry.status === 'past';
  const { isHighlighted } = entry;

  const labelColor = isHighlighted
    ? ACCENT
    : isPast
      ? SdsColors.grey400
      : SdsColors.grey900;
  const rangeColor = isHighlighted
    ? ACCENT
    : isPast
      ? SdsColors.grey400
      : SdsColors.grey600;

  return (
    <View style={styles.row}>
      {/* 좌측 레일: 점 + 세로선. 선을 마지막 행에서 끊어야 타임라인이
          "여기서 끝난다"로 읽힌다 — 계속 그으면 잘린 것처럼 보인다. */}
      <View style={styles.rail}>
        <View
          style={[
            styles.dot,
            isPast && styles.dotPast,
            isHighlighted && styles.dotHighlighted,
          ]}
        />
        {!isLast ? <View style={styles.railLine} /> : null}
      </View>

      <View style={styles.rowBody}>
        <Txt
          typography="t6"
          fontWeight={isHighlighted ? 'semibold' : 'medium'}
          color={labelColor}
          // 라벨에도 hangul-word를 건다. 없으면 "지도교수 승인"이 좁은 폭에서
          // "지도교수 승 / 인"처럼 단어 중간에서 끊긴다 (기존 표의 실제 증상).
          lineBreakStrategyIOS="hangul-word"
        >
          {entry.label ?? fallbackLabel}
        </Txt>
        <Txt
          typography="t7"
          fontWeight={isHighlighted ? 'semibold' : 'regular'}
          color={rangeColor}
        >
          {entry.range}
        </Txt>
      </View>
    </View>
  );
}

const DOT_SIZE = 7;
const RAIL_WIDTH = 18;

const styles = StyleSheet.create({
  timeline: {
    marginTop: 24,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  rail: {
    width: RAIL_WIDTH,
    alignItems: 'center',
    // 점을 첫 줄 텍스트의 시각적 중심에 맞춘다. t6 lineHeight 22.5의 절반에서
    // 점 반지름을 뺀 값 — 행 높이가 라벨 줄 수에 따라 변해도 점은 첫 줄에 고정.
    paddingTop: 8,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: SdsColors.grey300,
  },
  dotPast: {
    backgroundColor: SdsColors.grey200,
  },
  dotHighlighted: {
    backgroundColor: ACCENT,
    // 색만으로는 색각 이상에서 구분이 안 된다. 크기까지 키워 두 번째 단서를 준다.
    transform: [{ scale: 1.45 }],
  },
  railLine: {
    flex: 1,
    width: 1.5,
    marginTop: 4,
    marginBottom: -4,
    backgroundColor: SdsColors.grey200,
  },
  rowBody: {
    flex: 1,
    paddingBottom: 16,
    gap: 1,
  },
});
