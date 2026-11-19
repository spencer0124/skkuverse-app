import { forwardRef, useMemo } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowSquareOutIcon } from 'phosphor-react-native';
import { useT, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Pressable, Sheet, Txt, type SheetRef, useSemanticColors, createThemedStyles } from '@skkuverse/sds';
import { NoticeMarkdownView } from '../NoticeMarkdownView';

interface Props {
  markdown: string | null;
  sourceUrl?: string | null;
  onCopyText?: (text: string) => void;
  onOpenOriginal?: () => void;
  onClose: () => void;
}

/**
 * WHY: the one action is a fixed footer, where the reader is after the last line; BottomSheetFooter moves
 * with the sheet and the keyboard. `paddingHorizontal: 20` matches NoticeMarkdownView's `width - 40` image width.
 */
export const NoticeSourceSheet = forwardRef<SheetRef, Props>(
  function NoticeSourceSheet(
    { markdown, sourceUrl, onCopyText, onOpenOriginal, onClose },
    ref,
  ) {
    const styles = useStyles();
    const color = useSemanticColors();
    const { t } = useT();
    const insets = useSafeAreaInsets();

    const footer = useMemo(
      () => (
        <View
          style={[
            styles.footer,
            // WHY: a device with no home indicator (insets.bottom 0) still gets a minimum margin.
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          {sourceUrl && onOpenOriginal ? (
            <Pressable
              onPress={onOpenOriginal}
              accessibilityRole="button"
              accessibilityLabel={t('notices.openInBrowser')}
              bg="neutralWeak"
              style={styles.button}
            >
              <Txt
                typography="t5"
                fontWeight="semibold"
                color="neutral"
              >
                {t('notices.openInBrowser')}
              </Txt>
              <ArrowSquareOutIcon size={14} color={color.fg.neutralSubtle} />
            </Pressable>
          ) : null}
          {/* WHY: after a long notice the thumb is at the bottom, so it closes there without scrolling back up. */}
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            // WHY: one step lower contrast than the primary action, so the eye goes there first.
            bg="neutralMuted"
            style={[styles.button, styles.closeButton]}
          >
            <Txt typography="t5" fontWeight="semibold" color="neutralSubtle">
              {t('common.close')}
            </Txt>
          </Pressable>
        </View>
      ),
      [sourceUrl, onOpenOriginal, onClose, insets.bottom, t, color, styles],
    );

    return (
      <Sheet ref={ref} position={{ kind: 'stuck', detent: 'large' }} footer={footer}>
        <Sheet.ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: FOOTER_HEIGHT + Math.max(insets.bottom, 12) },
          ]}
        >
          <NoticeMarkdownView markdown={markdown} sourceUrl={sourceUrl} onCopyText={onCopyText} />
        </Sheet.ScrollView>
      </Sheet>
    );
  },
);

/** EVIDENCE: one button is 49 (13 * 2 padding plus t5's 22.5 line), so two plus the gap and top padding of 8 each. */
const FOOTER_HEIGHT = 49 * 2 + 8 + 8;

const useStyles = createThemedStyles(({ color }) => ({
  content: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x1,
  },
  footer: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x2,
    gap: SdsSpacing.x2,
    backgroundColor: color.bg.layerFloating,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SdsSpacing.x1_5,
    paddingVertical: SdsSpacing.x3,
    borderRadius: SdsRadius.r3,
  },
  closeButton: {
    overflow: 'hidden',
  },
}));
