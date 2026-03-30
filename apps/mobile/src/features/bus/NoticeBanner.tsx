/**
 * Notice banner — megaphone icon + text + optional link chevron.
 *
 * Displayed above the bus list on the transit tab. Fetches from ad placements API.
 * Tappable when linkUrl is present — opens external URL via Linking.
 *
 * Flutter source: lib/features/transit/ui/transit_tab.dart (notice banner section)
 */

import { Text, Pressable, Linking, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SdsColors, SdsTypo, SdsRadius, type NoticePlacement } from '@skkuverse/shared';

interface NoticeBannerProps {
  notice: NoticePlacement;
}

export function NoticeBanner({ notice }: NoticeBannerProps) {
  const hasLink = notice.linkUrl.length > 0;

  const handlePress = async () => {
    if (!hasLink) return;
    try {
      await Linking.openURL(notice.linkUrl);
    } catch {
      // silently fail — same as Flutter's canLaunchUrl check
    }
  };

  return (
    <Pressable
      style={styles.container}
      onPress={hasLink ? handlePress : undefined}
      disabled={!hasLink}
    >
      <MaterialIcons name="campaign" size={16} color={SdsColors.grey500} />
      <Text style={styles.text} numberOfLines={1}>
        {notice.text}
      </Text>
      {hasLink && (
        <MaterialIcons name="chevron-right" size={16} color={SdsColors.grey400} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: SdsColors.grey50,
    borderRadius: SdsRadius.md,
    gap: 10,
  },
  text: {
    flex: 1,
    fontSize: SdsTypo.t7.fontSize,
    lineHeight: SdsTypo.t7.lineHeight,
    fontWeight: '500',
    color: SdsColors.grey600,
  },
});
