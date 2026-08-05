import { Pressable, StyleSheet } from 'react-native';
import { CaretDownIcon } from 'phosphor-react-native';
import { SdsColors, useT } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';

/**
 * 본문 시트 진입점.
 *
 * 처음에는 `──── 공지 원문 보기 ∨ ────` 처럼 hairline 사이에 흐린 캡션을 끼운
 * 형태였는데, 실제 화면에서 **거의 보이지 않았다.** 원인은 분명하다 — 얇은 선과
 * grey600 13px 텍스트는 둘 다 "구분자" 신호라서, 합쳐 놓으면 누를 수 있는
 * 것으로 읽히지 않는다. 경계와 버튼을 한 요소에 겸하게 한 게 실수였다.
 *
 * 그래서 면(surface)을 가진 버튼으로 바꿨다. 토스가 "전체 보기" 류에 쓰는
 * 형태 — 옅은 회색 면 + 가운데 정렬 + 중간 굵기 텍스트 + 아래 방향 캐럿.
 * 테두리 대신 면을 쓰는 이유는 이 화면의 테두리가 이미 "링크·첨부 행"에
 * 배정돼 있어서, 같은 문법을 쓰면 또 하나의 링크처럼 보이기 때문이다.
 */
export function NoticeBodyDivider({ onPress }: { onPress: () => void }) {
  const { t } = useT();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('notices.viewSource')}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Txt typography="t6" fontWeight="semibold" color={SdsColors.grey800}>
        {t('notices.viewSource')}
      </Txt>
      <CaretDownIcon size={13} color={SdsColors.grey600} weight="bold" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    // 위(첨부·링크 목록)로는 딱 붙인다 — 같은 공지를 다루는 것들이라
    // 이어져 보여야 한다. 아래(광고)로는 12를 줘서 ScrollView의 gap 8과
    // 합쳐 20이 되게 한다. 본문↔첨부 간격(SummaryCard.body marginBottom
    // 12 + gap 8)과 같은 값이라 화면 전체가 한 리듬으로 읽힌다.
    marginTop: 0,
    marginBottom: 12,
    paddingVertical: 13,
    borderRadius: 12,
    // grey50은 흰 배경에서 거의 구분이 안 됐다. grey100(#F2F4F6)이 이 앱의
    // greyBackground와 같은 값이라 "눌리는 면"으로 확실히 읽힌다.
    backgroundColor: SdsColors.grey100,
  },
  pressed: {
    opacity: 0.6,
  },
});
