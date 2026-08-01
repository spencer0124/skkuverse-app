import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SdsColors, useT } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import type { TranslationKey } from '@skkuverse/shared';

/**
 * ⚠️ MOCK UI — 서버 연동 없음.
 *
 * 공지 반응 투표(👍 🔥 😮 😢). 선택은 컴포넌트 로컬 state로만 살아 있어서
 * 화면을 벗어나면 사라지고, 집계 수치도 서버가 아니라 아래 `mockCount`가
 * 만든 값이다. 실제 연동 시 교체할 지점:
 *
 *   - `mockCount` → 서버 집계 응답
 *   - `useState<ReactionId | null>` → 서버가 내려준 내 투표 + optimistic mutation
 *
 * 투표는 **단일 선택**이다. 같은 걸 다시 누르면 취소(토글)되고, 다른 걸 누르면
 * 갈아탄다 — 4개를 동시에 누를 수 있으면 "투표"가 아니라 "반응 달기"가 된다.
 */

const REACTIONS = [
  { id: 'like', emoji: '\u{1F44D}', labelKey: 'notices.reactionLike' },
  { id: 'fire', emoji: '\u{1F525}', labelKey: 'notices.reactionFire' },
  { id: 'wow', emoji: '\u{1F62E}', labelKey: 'notices.reactionWow' },
  { id: 'sad', emoji: '\u{1F622}', labelKey: 'notices.reactionSad' },
] as const satisfies readonly {
  id: string;
  emoji: string;
  labelKey: TranslationKey;
}[];

type ReactionId = (typeof REACTIONS)[number]['id'];

/**
 * 공지·반응별로 고정된 가짜 집계값.
 *
 * `Math.random()`을 쓰지 않는 이유: 리렌더마다 숫자가 튀면 mock이라는 게
 * 대놓고 드러나고, 무엇보다 UI를 눈으로 검토하는 동안 수치가 계속 흔들려서
 * 레이아웃(자릿수 변화에 따른 폭)을 확인할 수가 없다. articleNo를 섞어
 * 공지마다는 다르고 같은 공지 안에서는 항상 같은 값이 나오게 한다.
 */
function mockCount(articleNo: number, index: number): number {
  const mixed = Math.imul(articleNo + index * 977, 2654435761);
  return (Math.abs(mixed) % 68) + 3;
}

interface Props {
  /** 결정적 mock 수치의 시드. 실제 연동 시엔 집계 조회 키가 된다. */
  articleNo: number;
}

export function NoticeReactions({ articleNo }: Props) {
  const { t } = useT();
  const [voted, setVoted] = useState<ReactionId | null>(null);

  const baseCounts = useMemo(
    () => REACTIONS.map((_, i) => mockCount(articleNo, i)),
    [articleNo],
  );

  const handlePress = useCallback((id: ReactionId) => {
    setVoted((prev) => (prev === id ? null : id));
  }, []);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {REACTIONS.map((reaction, i) => {
          const isVoted = voted === reaction.id;
          return (
            <Pressable
              key={reaction.id}
              onPress={() => handlePress(reaction.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: isVoted }}
              // 라벨 텍스트는 화면에서 뺐지만 accessibilityLabel로는 남긴다 —
              // VoiceOver에 "👍" 대신 "좋아요"로 읽히게 하려면 이 경로가 유일하다.
              accessibilityLabel={t(reaction.labelKey)}
              style={({ pressed }) => [
                styles.chip,
                isVoted && styles.chipVoted,
                pressed && styles.pressed,
              ]}
            >
              {/* 채색 이모지는 Tossface 폰트로 — Phosphor outline 아이콘과
                  의미·톤이 달라 대체 불가 (CLAUDE.md 아이콘 규칙). */}
              <Text style={styles.emoji}>{reaction.emoji}</Text>
              <Txt
                typography="t7"
                fontWeight={isVoted ? 'bold' : 'medium'}
                color={isVoted ? SdsColors.brand : SdsColors.grey600}
              >
                {baseCounts[i] + (isVoted ? 1 : 0)}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // 4개 pill의 폭 합이 화면보다 작아 좌측에 몰려 보였다. 가운데 정렬하면
    // 위아래 블록(전폭을 쓰는 버튼·광고)의 중심선과도 맞는다.
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    // 라벨을 뺀 뒤로는 4칸 균등 분할(flex:1)이 오히려 어색하다 — 이모지 하나에
    // 숫자 두 자리뿐인데 칸이 화면 1/4씩 차지하면 빈 여백만 남는다. 내용 폭에
    // 맞춘 pill을 왼쪽 정렬로 흘린다.
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 12,
    paddingRight: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SdsColors.grey200,
    backgroundColor: SdsColors.background,
  },
  chipVoted: {
    borderColor: SdsColors.brand,
    backgroundColor: SdsColors.brandLight,
  },
  pressed: {
    opacity: 0.6,
  },
  emoji: {
    fontFamily: 'TossFaceFontMac',
    fontSize: 18,
    lineHeight: 22,
  },
});
