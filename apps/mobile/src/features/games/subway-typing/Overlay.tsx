import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SdsColors, useT } from '@skkuverse/shared';
import { CHROME_HEIGHT, TITLE_HEIGHT, formatTime } from '@skkuverse/subway-typing';
import type { StageProps } from '../registry';
import { StageTitle } from '../host/stage/StageTitle';

/**
 * The title over the page's title screen, in the room the page leaves for it
 * (`CHROME_HEIGHT` and `TITLE_HEIGHT`, shared with the page). Nothing else:
 * the page draws its own start button, because only a tap inside the page can
 * raise the keyboard, and a typing run has no pause and no controls to teach.
 */
export function SubwayTypingOverlay({ phase, hi }: StageProps) {
  const { t, tpl } = useT();
  const insets = useSafeAreaInsets();
  if (phase !== 'ready') return null;
  return (
    <View pointerEvents="none" style={[styles.title, { top: insets.top + CHROME_HEIGHT, height: TITLE_HEIGHT }]}>
      <StageTitle
        title={t('game.subwayTyping.stageTitle')}
        sub={t('game.subwayTyping.sub')}
        best={hi > 0 ? tpl('game.best', formatTime(hi)) : undefined}
        ink={SdsColors.grey900}
        softInk={SdsColors.grey600}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { position: 'absolute', left: 0, right: 0, justifyContent: 'center', paddingHorizontal: 24 },
});
