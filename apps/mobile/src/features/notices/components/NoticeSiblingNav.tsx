import { Fragment, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CaretDownIcon, CaretUpIcon } from 'phosphor-react-native';
import { SdsColors, useT } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { logNoticesContentSelect } from '@/services/analytics';
import {
  findSiblings,
  useNoticeSiblingsStore,
  type NoticeSibling,
} from '../store/noticeSiblingsStore';

interface Props {
  sourceId: string;
  articleNo: number;
}

/**
 * 목록 기준 이전글/다음글 네비게이션.
 *
 * 게시판의 관습적 레이아웃(세로 2행: `∧ 이전글  제목` / `∨ 다음글  제목`)을
 * 따른다. 좌우 2열로 나눠 봤더니 제목이 화면 절반 폭에 갇혀 두 줄로 잘리고,
 * 오른쪽 항목은 우측 정렬이라 읽기 시작점이 들쭉날쭉했다. 세로로 쌓으면
 * 제목이 전체 폭을 쓰고 좌측 정렬이 유지된다.
 *
 * 끝에 도달하면 버튼을 감추지 않고 "이전글이 없습니다"로 남긴다 — 행이
 * 통째로 사라지면 남은 한 행이 위로 튀어 레이아웃이 흔들리고, 사용자는
 * 기능이 없는 건지 끝에 온 건지 알 수 없다.
 *
 * 이동에 `push`가 아니라 **`replace`**를 쓴다. push면 다음 글을 열 때마다
 * 상세 화면이 스택에 쌓여서, 10개를 넘겨 읽은 뒤 목록으로 돌아가려면
 * 뒤로가기를 10번 눌러야 한다. replace면 스택 깊이가 항상 1이라
 * 뒤로가기 = 목록이고, "방금 본 글"은 반대편 행이 맡는다.
 *
 * 목록을 거치지 않은 진입(딥링크·북마크·홈 미리보기·검색)에서는 스토어가
 * 비어 있어 아무것도 렌더하지 않는다 — 3개짜리 홈 미리보기에서 온 사용자에게
 * "다음글"을 보여 주면 목록 전체를 넘기는 것처럼 기대를 만들고 배신한다.
 */
export function NoticeSiblingNav({ sourceId, articleNo }: Props) {
  const router = useRouter();
  const { t } = useT();
  const items = useNoticeSiblingsStore((s) => s.items);
  const { prev, next } = findSiblings(items, sourceId, articleNo);

  const go = useCallback(
    (target: NoticeSibling, direction: 'prev' | 'next') => {
      logNoticesContentSelect({
        content_type:
          direction === 'prev' ? 'detail_sibling_prev' : 'detail_sibling_next',
        item_id: `${target.sourceId}/${target.articleNo}`,
      });
      router.replace(`/notices/${target.sourceId}/${target.articleNo}` as never);
    },
    [router],
  );

  // 목록 컨텍스트 자체가 없으면(다른 경로로 진입) 블록 전체를 숨긴다.
  // "없습니다" 두 줄만 남는 건 기능이 있는 척하는 빈 껍데기다.
  if (items.length === 0) return null;

  // 위쪽 = 다음글, 아래쪽 = 이전글.
  //
  // 화살표 방향과 목록 위치를 일치시킨 배치다. 공지 목록은 최신순이라
  // **위로 갈수록 최신**인데, "다음글"은 이 글보다 나중에 올라온 = 더 최신
  // 글이므로 목록에서 위쪽에 있다. 그래서 ∧가 다음글, ∨가 이전글이다.
  // 반대로 놓으면 화살표가 가리키는 방향과 실제 이동 방향이 어긋난다.
  const rows = [
    {
      key: 'next' as const,
      sibling: next,
      caption: t('notices.siblingNext'),
      empty: t('notices.siblingNextEmpty'),
      Icon: CaretUpIcon,
    },
    {
      key: 'prev' as const,
      sibling: prev,
      caption: t('notices.siblingPrev'),
      empty: t('notices.siblingPrevEmpty'),
      Icon: CaretDownIcon,
    },
  ];

  return (
    <View style={styles.list}>
      {rows.map((row, i) => {
        const disabled = row.sibling === null;
        return (
          <Fragment key={row.key}>
            {i > 0 ? <View style={styles.divider} /> : null}
            <Pressable
              onPress={
                row.sibling ? () => go(row.sibling!, row.key) : undefined
              }
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled }}
              accessibilityLabel={`${row.caption}: ${row.sibling?.title ?? row.empty}`}
              style={({ pressed }) => [
                styles.row,
                pressed && !disabled && styles.pressed,
              ]}
            >
              <row.Icon
                size={14}
                color={disabled ? SdsColors.grey300 : SdsColors.grey500}
              />
              <Txt
                typography="t7"
                color={disabled ? SdsColors.grey400 : SdsColors.grey600}
                style={styles.caption}
              >
                {row.caption}
              </Txt>
              <Txt
                typography="t7"
                fontWeight={disabled ? 'regular' : 'medium'}
                color={disabled ? SdsColors.grey400 : SdsColors.grey800}
                numberOfLines={1}
                style={styles.title}
                lineBreakStrategyIOS="hangul-word"
              >
                {row.sibling?.title ?? row.empty}
              </Txt>
            </Pressable>
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    // 위 광고와 딱 붙인다. 자체 상단 hairline이 이미 경계를 지므로 여백을
    // 더 주면 목록이 광고에 딸린 것처럼 떠 보인다.
    marginTop: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: SdsColors.grey200,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: SdsColors.grey200,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  caption: {
    // 캡션 폭을 고정해 두 행의 제목 시작선을 맞춘다. '이전글'과 '다음글'은
    // 글자 수가 같지만 로케일에 따라 다르므로(en: Previous/Next) 고정이 필요.
    width: 52,
    flexShrink: 0,
  },
  title: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
