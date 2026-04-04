/**
 * Floating info card shown when a building floor or connection is tapped.
 *
 * Displays: placename, buildingname, placeinfo, time, previous/next navigation.
 * Animates in/out with FadeInDown/FadeOutDown.
 */

import { Pressable, View, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { SdsColors, SdsSpacing } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import type { LineEntry } from '../data/AvailableLines';

interface PlaceInfoCardProps {
  info: LineEntry;
  onPreviousPress: () => void;
  onNextPress: () => void;
  onDismiss: () => void;
}

export function PlaceInfoCard({
  info,
  onPreviousPress,
  onNextPress,
  onDismiss,
}: PlaceInfoCardProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(250)}
      exiting={FadeOutDown.duration(200)}
      style={styles.container}
      accessibilityRole="alert"
      accessibilityLabel={`${info.placename}, ${info.buildingname}`}
    >
      {/* Color accent bar */}
      <View
        style={[
          styles.accentBar,
          { backgroundColor: `#${info.leftColor}` },
        ]}
      />

      <View style={styles.content}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Txt typography="t5" fontWeight="bold" color={SdsColors.grey900}>
              {info.placename}
            </Txt>
            <Txt typography="t7" fontWeight="regular" color={SdsColors.grey500}>
              {info.buildingname}
            </Txt>
          </View>
          <Pressable
            onPress={onDismiss}
            hitSlop={8}
            style={styles.closeButton}
            accessibilityLabel="닫기"
          >
            <X size={18} color={SdsColors.grey400} />
          </Pressable>
        </View>

        {/* Place info */}
        {info.placeinfo && (
          <Txt
            typography="t7"
            fontWeight="regular"
            color={SdsColors.grey700}
            style={styles.infoText}
          >
            {info.placeinfo}
          </Txt>
        )}

        {/* Time info */}
        {info.time && (
          <Txt
            typography="t7"
            fontWeight="regular"
            color={SdsColors.blue500}
            style={styles.infoText}
          >
            {info.time}
          </Txt>
        )}

        {/* Previous / Next navigation */}
        {(info.previousplace || info.afterplace) && (
          <View style={styles.navRow}>
            <Pressable
              onPress={onPreviousPress}
              disabled={!info.previousplace}
              style={[
                styles.navButton,
                !info.previousplace && styles.navButtonDisabled,
              ]}
              accessibilityLabel={
                info.previousplace
                  ? `이전: ${info.previousplace}`
                  : '이전 층 없음'
              }
            >
              <ChevronLeft
                size={16}
                color={
                  info.previousplace ? `#${info.leftColor}` : SdsColors.grey300
                }
              />
              <Txt
                typography="t7"
                fontWeight="medium"
                color={
                  info.previousplace ? SdsColors.grey700 : SdsColors.grey300
                }
                numberOfLines={1}
              >
                {info.previousplace ?? ''}
              </Txt>
            </Pressable>

            <View style={styles.navDivider} />

            <Pressable
              onPress={onNextPress}
              disabled={!info.afterplace}
              style={[
                styles.navButton,
                styles.navButtonRight,
                !info.afterplace && styles.navButtonDisabled,
              ]}
              accessibilityLabel={
                info.afterplace
                  ? `다음: ${info.afterplace}`
                  : '다음 층 없음'
              }
            >
              <Txt
                typography="t7"
                fontWeight="medium"
                color={
                  info.afterplace ? SdsColors.grey700 : SdsColors.grey300
                }
                numberOfLines={1}
              >
                {info.afterplace ?? ''}
              </Txt>
              <ChevronRight
                size={16}
                color={
                  info.afterplace ? `#${info.rightColor}` : SdsColors.grey300
                }
              />
            </Pressable>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  accentBar: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: SdsSpacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
  infoText: {
    marginTop: SdsSpacing.xs,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SdsSpacing.sm,
    paddingTop: SdsSpacing.sm,
    borderTopWidth: 1,
    borderTopColor: SdsColors.grey100,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navButtonRight: {
    justifyContent: 'flex-end',
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navDivider: {
    width: 1,
    height: 20,
    backgroundColor: SdsColors.grey200,
    marginHorizontal: SdsSpacing.xs,
  },
});
