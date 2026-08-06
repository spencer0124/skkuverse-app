import { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SdsColors, useT } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { logAiSummaryView } from '@/services/analytics';
import { NoticeTimeline } from './components/NoticeSchedule';
import { buildNoticeTimeline } from './utils/buildNoticeTimeline';
import type { NoticeDetailSummary } from '@skkuverse/shared';

interface Props {
  summary: NoticeDetailSummary;
  sourceId: string;
  articleNo: number;
}

interface MetaRow {
  label: string;
  value: string;
}

/**
 * 공지 상세의 요약 영역 — 결론 → 근거 → 설명 순으로 조립한다.
 *
 * **왜 이 순서인가.** 사용자가 공지 상세에서 던지는 질문은
 * "나랑 상관있나(대상) → 뭘 해야 하나(할 일) → 언제까지(D-day) → 자세히는"
 * 순인데, 원래 화면은 본문 → 일정 → 표 순이라 정확히 역순이었다. 가장 먼저
 * 답해야 할 대상·할 일이 맨 아래 표에 묻혀 있었다.
 *
 *   결론  D-day + 대상 + 해야 할 일
 *   근거  전체 일정 타임라인
 *   설명  본문 + 주최·장소 등 부가 속성
 */
export function SummaryCard({ summary, sourceId, articleNo }: Props) {
  const { t } = useT();

  // AI summary impression. Fires once per (notice, summary type) — refetch
  // with unchanged classification is a no-op. Mount itself is gated by
  // `data.summary != null` at the call site, so this always represents a
  // real user-facing AI card render.
  useEffect(() => {
    logAiSummaryView({
      sourceId,
      articleNo,
      summaryType: summary.type,
      hasOneLiner: !!summary.oneLiner?.trim(),
      hasPeriods: summary.periods.length > 0,
      hasLocations: summary.locations.length > 0,
      hasDetails: summary.details != null,
      model: summary.model,
    });
  }, [sourceId, articleNo, summary.type]); // eslint-disable-line react-hooks/exhaustive-deps

  const { entries } = useMemo(
    // periods가 그대로면 결과도 같으므로 periods만 의존성으로 둔다. 자정을
    // 넘겨 화면을 켜 둔 경우 D-day가 하루 늦게 갱신될 수 있는데, 그 대가로
    // 백그라운드 refetch마다 타임라인이 통째로 다시 그려지는 걸 막는다.
    () => buildNoticeTimeline(summary.periods),
    [summary.periods],
  );

  // 속성은 한 표로 묶어 결론 영역에 둔다.
  //
  // 한때 `target`/`action`(결론)과 `host`/`impact`/장소(부가)로 쪼개 위아래로
  // 나눠 봤지만, 같은 라벨-값 문법의 표가 화면에 두 번 나오니 "왜 여기서
  // 끊겼지"라는 질문만 생겼다. 위계는 표를 쪼개서가 아니라 **표 전체를
  // D-day 바로 아래 두는 것**으로 이미 확보된다.
  //
  // 순서는 사용자의 질문 순서를 따른다: 나랑 상관있나(대상) → 뭘 해야 하나
  // (할 일) → 어디서(장소) → 누가 주최(주최) → 그래서 뭐가 달라지나(참고).
  const details = summary.details;
  const metaRows: MetaRow[] = [];
  if (details?.target)
    metaRows.push({ label: t('notices.detailLabelTarget'), value: details.target });
  if (details?.action)
    metaRows.push({ label: t('notices.detailLabelAction'), value: details.action });
  for (const loc of summary.locations) {
    metaRows.push({
      label: t('notices.detailLabelLocation'),
      value: loc.label ? `${loc.label}: ${loc.detail}` : loc.detail,
    });
  }
  if (details?.host)
    metaRows.push({ label: t('notices.detailLabelHost'), value: details.host });
  if (details?.impact)
    metaRows.push({ label: t('notices.detailLabelImpact'), value: details.impact });

  return (
    <>
      {/* ── 확인: 누가 / 무엇을 / 언제 ──
          사용자는 공지를 '읽으러'가 아니라 '확인하러' 온다. 확인이 끝나면
          나가고, 산문은 확인이 안 될 때만 읽는다. 그래서 속성표와 일정이
          맨 위에 오고, 가장 긴 본문은 아래로 내려간다. 맥락은 이미 제목이
          준다("2026-2학기 학부생 연구학점제(URPI형)"). */}
      <MetaList rows={metaRows} />
      <NoticeTimeline entries={entries} />

      {/* ── 설명: 본문 ──
          한때 위에 구분선 + 큰 여백을 뒀지만 걷어냈다. 일정과 본문은 같은
          공지를 설명하는 연속된 정보라, 선을 그으면 "다른 섹션이 시작된다"는
          잘못된 신호가 된다. 타임라인 마지막 행의 paddingBottom(16)이 이미
          충분한 호흡을 준다. */}
      {summary.text ? (
        <Txt
          typography="st10"
          color={SdsColors.grey800}
          // 위 간격을 타임라인 유무로 나눈다. 타임라인이 있으면 마지막 행의
          // paddingBottom(16)이 이미 호흡을 주므로 4면 충분하지만, 일정이 없는
          // 공지는 표 바로 밑에 본문이 붙어 답답해진다.
          style={[styles.body, entries.length === 0 && styles.bodyAfterTable]}
          lineBreakStrategyIOS="hangul-word"
        >
          {summary.text}
        </Txt>
      ) : null}
    </>
  );
}

/**
 * 라벨-값 목록.
 *
 * 테두리 카드와 행 사이 divider를 걷어냈다. 이 화면의 규칙은 "테두리는 누를
 * 수 있는 것에만" — 읽기만 하는 표에 테두리를 두르면 첨부파일 행·액션
 * 리스트와 같은 문법이 되어 눌러야 할 것처럼 보인다.
 */
function MetaList({ rows }: { rows: MetaRow[] }) {
  if (rows.length === 0) return null;

  return (
    <View style={styles.metaList}>
      {rows.map((row, i) => (
        <View key={`${row.label}-${i}`} style={styles.metaRow}>
          <Txt
            typography="t7"
            color={SdsColors.grey500}
            style={styles.metaLabel}
            // 라벨에도 hangul-word가 필요하다. 없으면 좁은 고정폭에서
            // "해야 할 일"이 단어 중간에서 끊긴다.
            lineBreakStrategyIOS="hangul-word"
          >
            {row.label}
          </Txt>
          <Txt
            typography="t7"
            color={SdsColors.grey800}
            style={styles.metaValue}
            lineBreakStrategyIOS="hangul-word"
          >
            {row.value}
          </Txt>
        </View>
      ))}
    </View>
  );
}

// `buildDetailRows`는 제거됨 — target/action과 host/impact를 서로 다른
// 위치에 배치하게 되면서 "details를 한 배열로 평탄화"하는 헬퍼 자체가
// 목적을 잃었다. 분기는 호출부에서 직접 한다.
//
// `formatPeriod`도 제거됨 — 기간 표기는 `utils/buildNoticeTimeline.ts`의
// `formatPeriodRange`가 담당한다. 그쪽은 올해 날짜의 연도를 생략하고
// 과거/진행중/예정 상태까지 함께 계산한다.

const styles = StyleSheet.create({
  body: {
    // 타임라인 마지막 행이 paddingBottom 16을 이미 갖고 있어 실효 간격은 ~20.
    marginTop: 4,
    // 아래로는 본문에서 뽑은 것들(이미지·링크·연락처)이나 첨부가 붙는다.
    // 산문에서 목록으로 넘어가는 전환이라 위쪽보다 넉넉히 띄운다.
    marginBottom: 12,
    // st10(16px) 기본 lineHeight는 24. 분량이 긴 블록이라 한 단계 더 띄워
    // 줄 사이 호흡을 준다.
    lineHeight: 26,
  },
  bodyAfterTable: {
    // 타임라인이 없어 표 바로 아래에 본문이 오는 경우.
    marginTop: 20,
  },
  metaList: {
    marginTop: 20,
    gap: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    // 테두리·divider가 사라졌으니 padding도 필요 없다. 행 간격은 부모의
    // gap이 진다 — 좌우 padding이 남아 있으면 위 본문·아래 첨부와
    // 좌측 정렬이 어긋난다.
  },
  metaLabel: {
    // 60 → 76. 날짜 행이 타임라인으로 빠져 여기 남는 라벨은 '장소'·'대상'·
    // '해야 할 일'·'주최'·'참고'뿐이라 76이면 대부분 한 줄에 들어간다.
    // 넘치더라도 위 lineBreakStrategyIOS 덕에 어절 단위로만 접힌다.
    width: 76,
    flexShrink: 0,
    marginRight: 12,
  },
  metaValue: {
    flex: 1,
  },
});
