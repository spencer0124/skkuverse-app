import { forwardRef, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowSquareOutIcon } from 'phosphor-react-native';
import { SdsColors, useT } from '@skkuverse/shared';
import { Sheet, Txt, type SheetRef } from '@skkuverse/sds';
import { NoticeMarkdownView } from '../NoticeMarkdownView';

interface Props {
  markdown: string | null;
  /** 이미지 fetch의 Referer 헤더로 쓰인다 — NoticeMarkdownView JSDoc 참고. */
  sourceUrl?: string | null;
  onCopyText?: (text: string) => void;
  onOpenOriginal?: () => void;
  onClose: () => void;
}

/**
 * 공지 본문(GFM) 전문 시트.
 *
 * 헤더에 제목("공지 원문")과 액션 두 개를 얹었다가 전부 걷어냈다. 시트를
 * 연 사람은 이미 무엇을 열었는지 알고 있어서 제목은 첫 화면의 본문 몇 줄을
 * 밀어낼 뿐이었고, '주소 복사'는 공유 버튼(헤더)과 역할이 겹쳤다.
 *
 * 남은 액션 하나는 **하단 고정**이다. 스크롤 상단에 두면 본문을 끝까지 읽고
 * "그래서 원본은?" 하는 시점에 다시 위로 올라가야 한다. `BottomSheetFooter`를
 * 쓰는 이유는 절대 위치 View와 달리 시트 애니메이션·키보드에 맞춰 위치가
 * 함께 움직이기 때문이다.
 *
 * `paddingHorizontal: 20`은 임의값이 아니다 — `NoticeMarkdownView`가 이미지
 * 폭을 `useWindowDimensions().width - 40`으로 직접 계산한다(상세 화면
 * ScrollView의 좌우 20 패딩을 전제한 상수). 다른 패딩을 쓰면 이미지가
 * 컨테이너 밖으로 삐져나간다.
 */
export const NoticeSourceSheet = forwardRef<SheetRef, Props>(
  function NoticeSourceSheet(
    { markdown, sourceUrl, onCopyText, onOpenOriginal, onClose },
    ref,
  ) {
    const { t } = useT();
    const insets = useSafeAreaInsets();

    const footer = useMemo(
      () => (
        <View
          style={[
            styles.footer,
            // 홈 인디케이터를 피한다. 기기에 인디케이터가 없으면(insets
            // .bottom === 0) 최소 여백을 직접 준다.
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          {sourceUrl && onOpenOriginal ? (
            <Pressable
              onPress={onOpenOriginal}
              accessibilityRole="button"
              accessibilityLabel={t('notices.openInBrowser')}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.pressed,
              ]}
            >
              <Txt
                typography="t6"
                fontWeight="semibold"
                color={SdsColors.grey800}
              >
                {t('notices.openInBrowser')}
              </Txt>
              <ArrowSquareOutIcon size={14} color={SdsColors.grey600} />
            </Pressable>
          ) : null}
          {/* 닫기. 시트는 아래로 쓸어내려도 닫히지만, 본문이 긴 공지에서
              끝까지 읽고 나면 손가락이 하단에 있다 — 거기서 바로 닫을 수
              있어야 위로 다시 올라갈 일이 없다. 스크림 탭도 마찬가지로
              살아 있다. */}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            style={({ pressed }) => [
              styles.button,
              styles.closeButton,
              pressed && styles.pressed,
            ]}
          >
            <Txt typography="t6" fontWeight="semibold" color={SdsColors.grey600}>
              {t('common.close')}
            </Txt>
          </Pressable>
        </View>
      ),
      [sourceUrl, onOpenOriginal, onClose, insets.bottom, t],
    );

    return (
      <Sheet
        ref={ref}
        position={{ kind: 'stuck', detent: 'large' }}
        footer={footer}
      >
        <Sheet.ScrollView
          contentContainerStyle={[
            styles.content,
            // 고정 푸터가 마지막 본문을 가리지 않도록 그만큼 비워 둔다.
            { paddingBottom: FOOTER_HEIGHT + Math.max(insets.bottom, 12) },
          ]}
        >
          <NoticeMarkdownView
            markdown={markdown}
            sourceUrl={sourceUrl}
            onCopyText={onCopyText}
          />
        </Sheet.ScrollView>
      </Sheet>
    );
  },
);

/**
 * 푸터가 가리는 높이. 버튼 하나 ≈ 49(paddingVertical 13*2 + t6 lineHeight
 * 22.5)이고 두 개 + 사이 gap 8 + 상단 패딩 8. 본문이 이 뒤로 숨지 않도록
 * ScrollView의 paddingBottom에 더한다.
 */
const FOOTER_HEIGHT = 49 * 2 + 8 + 8;

const styles = StyleSheet.create({
  handleIndicator: {
    backgroundColor: SdsColors.grey300,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 8,
    backgroundColor: SdsColors.background,
  },
  // 상세 화면의 '자세히 보기'와 같은 형태. 두 버튼 모두 "이 공지를 더 보는"
  // 동작이라 같은 문법을 쓰는 게 맞다.
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: SdsColors.grey100,
  },
  closeButton: {
    // 주 액션(외부 열기)보다 한 단계 낮은 대비. 면은 유지해 터치 대상임은
    // 분명히 하되, 시선은 위 버튼이 먼저 가져가게 한다.
    backgroundColor: SdsColors.grey50,
  },
  pressed: {
    opacity: 0.6,
  },
});
