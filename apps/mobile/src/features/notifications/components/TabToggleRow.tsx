import { StyleSheet, Switch, Text, View } from 'react-native';
import { Txt } from '@skkuverse/sds';
import { SdsColors, type NoticeTab } from '@skkuverse/shared';

// 9탭 key → Tossface 이모지 매핑.
// CLAUDE.md tabsContract 의 9개 key 와 일치 (dept/academic/scholarship/career/
// recruitment/event/library/dorm/general). server 가 새 탭 추가 시 fallback 으로
// 📌 가 표시되므로 즉시 깨지진 않지만 동기화 필요.
export const TAB_EMOJI: Record<string, string> = {
  dept: '🎓',
  academic: '📖',
  scholarship: '💰',
  career: '💼',
  recruitment: '📣',
  event: '🎉',
  library: '📚',
  dorm: '🛏️',
  general: '📌',
};

interface TabToggleRowProps {
  tab: NoticeTab;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled: boolean;
}

export function TabToggleRow({ tab, checked, onChange, disabled }: TabToggleRowProps) {
  const emoji = TAB_EMOJI[tab.key] ?? '📌';
  return (
    <View style={styles.tabRow}>
      <View style={styles.badge}>
        <Text style={styles.badgeEmoji}>{emoji}</Text>
      </View>
      <View style={styles.tabTitleWrap}>
        <Txt
          typography="t5"
          fontWeight="regular"
          color={SdsColors.grey900}
          style={styles.tabTitleText}
        >
          {tab.label}
        </Txt>
      </View>
      <View style={styles.switchWrap}>
        <Switch
          value={checked}
          onValueChange={onChange}
          disabled={disabled}
          trackColor={{ true: SdsColors.brand, false: undefined }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: SdsColors.grey100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmoji: {
    fontFamily: 'TossFaceFontMac',
    fontSize: 22,
    lineHeight: 28,
  },
  tabTitleWrap: {
    flex: 1,
    marginLeft: 16,
    // Fixed envelope matching the badge (40) and switchWrap so all three
    // share an identical vertical container under alignItems:'center'.
    height: 40,
    justifyContent: 'center',
  },
  tabTitleText: {
    // RN iOS Text+Switch baseline mismatch is structural: alignItems:'center'
    // centers layout boxes, not glyphs. Direct lineHeight collapse triggers
    // RN bug facebook/react-native#29507 (leading removed only from above
    // when lineHeight <= fontSize), so we keep t5's default 25.5 lineHeight
    // and instead let verticalAlign:'middle' (RN 0.74+) center the glyph
    // within its line-box. Combined with the fixed-height tabTitleWrap +
    // switchWrap envelopes, the row's alignItems:'center' lines up the
    // glyph center with the Switch's visual center.
    verticalAlign: 'middle',
  },
  switchWrap: {
    // Mirrors tabTitleWrap's vertical envelope so the row's alignItems:
    // 'center' lines up Switch and label at the same Y, removing the
    // single-line baseline drift that 2-row master ListRow happens to
    // avoid by accident (Switch sits between two text lines).
    height: 40,
    justifyContent: 'center',
  },
});
