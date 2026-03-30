/**
 * SDUI Notice — amber notification bar with action.
 *
 * Displays a megaphone emoji + title text + chevron indicator.
 * Taps dispatch via `handleSduiAction`.
 *
 * Flutter source: sdui_notice_widget.dart
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SdsColors, SdsRadius, SdsTypo, type SduiNotice as NoticeType } from '@skkuverse/shared';
import { handleSduiAction } from '../action-handler';

interface Props {
  section: NoticeType;
}

export function Notice({ section }: Props) {
  return (
    <Pressable
      style={styles.container}
      onPress={() =>
        handleSduiAction({
          actionType: section.actionType,
          actionValue: section.actionValue,
        })
      }
    >
      <Text style={styles.emoji}>{'\u{1F4E2}'}</Text>
      <View style={styles.spacer} />
      <Text style={styles.title} numberOfLines={1}>
        {section.title}
      </Text>
      <Text style={styles.chevron}>{'\u{203A}'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: SdsColors.yellow50,
    borderRadius: SdsRadius.sm,
  },
  emoji: {
    fontSize: 16,
  },
  spacer: {
    width: 10,
  },
  title: {
    flex: 1,
    fontSize: SdsTypo.t7.fontSize,
    lineHeight: SdsTypo.t7.lineHeight,
    fontWeight: '500',
    color: SdsColors.grey700,
  },
  chevron: {
    fontSize: 18,
    color: SdsColors.grey400,
    marginLeft: 4,
  },
});
