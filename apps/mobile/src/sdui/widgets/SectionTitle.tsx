/**
 * SDUI Section Title — header text for a section group.
 *
 * Flutter source: sdui_section_title_widget.dart
 */

import { View, Text, StyleSheet } from 'react-native';
import { SdsColors, SdsTypo, type SduiSectionTitle as SectionTitleType } from '@skkuuniverse/shared';

interface Props {
  section: SectionTitleType;
}

export function SectionTitle({ section }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{section.title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  title: {
    fontSize: SdsTypo.sub10.fontSize,
    lineHeight: SdsTypo.sub10.lineHeight,
    fontWeight: '700',
    color: SdsColors.grey900,
  },
});
