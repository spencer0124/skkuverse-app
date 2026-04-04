/**
 * Building detail header — thumbnail + name + campus · displayNo + accessibility.
 *
 * Layout: [60×60 rounded thumbnail] [name + subtitle]
 *         [accessibility badges row]
 *
 * Flutter source: lib/features/building/ui/building_detail_sheet.dart
 */

import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import {
  SdsColors,
  SdsSpacing,
  type Building,
  getLocalizedText,
  useSettingsStore,
  useT,
} from '@skkuverse/shared';
import { Badge, Txt } from '@skkuverse/sds';
import { Building2, ArrowUpDown, Accessibility } from 'lucide-react-native';

interface BuildingHeaderProps {
  building: Building;
  onClose?: () => void;
}

export function BuildingHeader({ building }: BuildingHeaderProps) {
  const lang = useSettingsStore((s) => s.appLanguage);
  const { t } = useT();
  const name = getLocalizedText(building.name, lang);

  const subtitleParts: string[] = [building.campusLabel];
  if (building.displayNo) subtitleParts.push(`${t('building.buildingNo')} ${building.displayNo}`);
  const subtitle = subtitleParts.join(' · ');

  return (
    <View style={styles.container}>
      {/* ── Thumbnail + Name row ── */}
      <View style={styles.topRow}>
        {building.image ? (
          <Image
            source={{
              uri: building.image.url,
              headers: { Referer: 'https://www.skku.edu/' },
            }}
            style={styles.thumbnail}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
            <Building2 size={24} color={SdsColors.grey400} />
          </View>
        )}

        <View style={styles.nameBlock}>
          <Txt
            typography="t3"
            fontWeight="bold"
            color={SdsColors.grey900}
            numberOfLines={2}
          >
            {name}
          </Txt>
          <Txt
            typography="t7"
            fontWeight="regular"
            color={SdsColors.grey500}
            style={styles.subtitle}
          >
            {subtitle}
          </Txt>
        </View>
      </View>

      {/* ── Accessibility tags ── */}
      {building.accessibility &&
        (building.accessibility.elevator || building.accessibility.toilet) && (
          <View style={styles.accessRow}>
            {building.accessibility.elevator && (
              <View style={styles.accessBadge}>
                <ArrowUpDown size={14} color={SdsColors.grey600} />
                <Txt typography="t7" fontWeight="regular" color={SdsColors.grey600}>
                  {t('building.elevator')}
                </Txt>
              </View>
            )}
            {building.accessibility.toilet && (
              <View style={styles.accessBadge}>
                <Accessibility size={14} color={SdsColors.grey600} />
                <Txt typography="t7" fontWeight="regular" color={SdsColors.grey600}>
                  {t('building.accessibleRestroom')}
                </Txt>
              </View>
            )}
          </View>
        )}
    </View>
  );
}

const THUMB_SIZE = 60;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SdsSpacing.xl,
    paddingTop: SdsSpacing.base,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.base,
  },
  thumbnail: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 14,
    backgroundColor: SdsColors.grey100,
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameBlock: {
    flex: 1,
  },
  subtitle: {
    marginTop: 2,
  },
  accessRow: {
    flexDirection: 'row',
    gap: SdsSpacing.sm,
    marginTop: SdsSpacing.md,
  },
  accessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SdsColors.grey200,
    backgroundColor: SdsColors.background,
  },
});
