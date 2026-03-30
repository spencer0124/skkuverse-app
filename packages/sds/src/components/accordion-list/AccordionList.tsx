/**
 * AccordionList — generic expandable section list.
 *
 * Each section has an animated badge header with title/subtitle,
 * and an expandable child list with "show more" truncation.
 *
 * Compound component:
 *   AccordionList        — renders a list of accordion sections
 *   AccordionList.Tile   — single accordion section (can be used standalone)
 *
 * Usage:
 *   <AccordionList
 *     sections={[
 *       { title: '1층', badge: '1F', items: [...] },
 *       { title: '카페', badge: 'C', items: [...] },
 *     ]}
 *     expandedIndex={expandedIndex}
 *     onToggle={setExpandedIndex}
 *     renderItem={(item) => <MyRow item={item} />}
 *     keyExtractor={(item) => item.id}
 *   />
 */
import React, { useCallback, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { SdsColors } from '@skkuverse/shared';
import { useAdaptive } from '../../core';
import { Txt } from '../txt';

// ── Types ──

export interface AccordionSection<T = unknown> {
  /** Section header title */
  title: string;
  /** Subtitle shown below title. Defaults to `${items.length}개` if omitted. */
  subtitle?: string;
  /** Short text for the left badge. Defaults to first char of title. */
  badge?: string;
  /** Child items in this section */
  items: T[];
}

export interface AccordionListProps<T = unknown> {
  /** Array of sections */
  sections: AccordionSection<T>[];
  /** Currently expanded section index (null = all collapsed) */
  expandedIndex: number | null;
  /** Called when a section header is tapped */
  onToggle: (index: number | null) => void;
  /** Render each child item */
  renderItem: (item: T, index: number, highlighted: boolean) => ReactNode;
  /** Unique key for each item (used for React keys & highlight matching) */
  keyExtractor: (item: T) => string;
  /** Key to highlight (compared against keyExtractor results) */
  highlightKey?: string | null;
  /** Max visible items before "show more". @default 5 */
  maxVisible?: number;
  /** Map of section index → whether all items are shown */
  showAllMap?: Record<number, boolean>;
  /** Called when "show more" is tapped */
  onShowAll?: (sectionIndex: number) => void;
  /** Custom "show more" label. @default (n) => `+ ${n}개 더보기` */
  showMoreLabel?: (remaining: number) => string;
  /** Right slot for each section header */
  renderRight?: (section: AccordionSection<T>, index: number) => ReactNode;
}

// ── AccordionBadge (40×40 animated badge) ──

function AccordionBadge({ text, expanded }: { text: string; expanded: boolean }) {
  const progress = useSharedValue(expanded ? 1 : 0);
  progress.value = withTiming(expanded ? 1 : 0, { duration: 200 });

  const animatedBg = useAnimatedStyle(() => ({
    backgroundColor:
      progress.value > 0.5 ? SdsColors.grey900 : SdsColors.grey100,
  }));

  return (
    <Animated.View style={[styles.badge, animatedBg]}>
      <Txt
        typography="t7"
        fontWeight="bold"
        color={expanded ? '#FFFFFF' : SdsColors.grey600}
      >
        {text}
      </Txt>
    </Animated.View>
  );
}

// ── AccordionTile (single section) ──

export interface AccordionTileProps<T = unknown> {
  section: AccordionSection<T>;
  index: number;
  isFirst: boolean;
  expanded: boolean;
  onToggle: () => void;
  renderItem: (item: T, index: number, highlighted: boolean) => ReactNode;
  keyExtractor: (item: T) => string;
  highlightKey?: string | null;
  maxVisible: number;
  showAll?: boolean;
  onShowAll?: () => void;
  showMoreLabel: (remaining: number) => string;
  renderRight?: ReactNode;
}

function AccordionTile<T>({
  section,
  isFirst,
  expanded,
  onToggle,
  renderItem,
  keyExtractor,
  highlightKey,
  maxVisible,
  showAll = false,
  onShowAll,
  showMoreLabel,
  renderRight,
}: AccordionTileProps<T>) {
  const adaptive = useAdaptive();
  const underlayOpacity = useSharedValue(0);
  const underlayAnim = useAnimatedStyle(() => ({
    opacity: underlayOpacity.value,
  }));

  const { items } = section;
  const badgeText = section.badge ?? section.title.charAt(0);
  const subtitle = section.subtitle ?? `${items.length}개`;
  const visibleItems = showAll ? items : items.slice(0, maxVisible);
  const remaining = items.length - maxVisible;

  return (
    <View>
      {/* Divider (skip first) */}
      {!isFirst && (
        <View style={styles.dividerContainer}>
          <View style={[styles.divider, { backgroundColor: adaptive.grey50 }]} />
        </View>
      )}

      {/* Header row */}
      <Pressable
        onPress={onToggle}
        onPressIn={() => {
          underlayOpacity.value = withTiming(1, { duration: 50 });
        }}
        onPressOut={() => {
          underlayOpacity.value = withTiming(0, { duration: 200 });
        }}
        style={styles.tilePress}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: adaptive.grey50 },
            underlayAnim,
          ]}
        />
        <View style={styles.tileContent}>
          <AccordionBadge text={badgeText} expanded={expanded} />
          <View style={styles.tileTexts}>
            <Txt typography="t5" fontWeight="regular">
              {section.title}
            </Txt>
            <Txt typography="t7" fontWeight="regular" color={SdsColors.grey500}>
              {subtitle}
            </Txt>
          </View>
          {renderRight != null && (
            <View style={styles.tileRight}>{renderRight}</View>
          )}
        </View>
      </Pressable>

      {/* Expanded item list */}
      {expanded && items.length > 0 && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(100)}
          style={styles.itemListContainer}
        >
          {visibleItems.map((item, i) => {
            const key = keyExtractor(item);
            const highlighted = highlightKey != null && key === highlightKey;
            return (
              <React.Fragment key={key}>
                {renderItem(item, i, highlighted)}
              </React.Fragment>
            );
          })}

          {/* Show more */}
          {!showAll && remaining > 0 && (
            <Pressable onPress={onShowAll} style={styles.showMoreButton}>
              <Txt typography="st12" fontWeight="semiBold" color={SdsColors.blue500}>
                {showMoreLabel(remaining)}
              </Txt>
            </Pressable>
          )}
        </Animated.View>
      )}
    </View>
  );
}

// ── Main AccordionList ──

function defaultShowMoreLabel(remaining: number) {
  return `+ ${remaining}개 더보기`;
}

function AccordionListInner<T>({
  sections,
  expandedIndex,
  onToggle,
  renderItem,
  keyExtractor,
  highlightKey,
  maxVisible = 5,
  showAllMap = {},
  onShowAll,
  showMoreLabel = defaultShowMoreLabel,
  renderRight,
}: AccordionListProps<T>) {
  const handleToggle = useCallback(
    (index: number) => {
      onToggle(expandedIndex === index ? null : index);
    },
    [expandedIndex, onToggle],
  );

  if (sections.length === 0) return null;

  return (
    <View>
      {sections.map((section, i) => (
        <AccordionTile<T>
          key={`section-${i}`}
          section={section}
          index={i}
          isFirst={i === 0}
          expanded={expandedIndex === i}
          onToggle={() => handleToggle(i)}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          highlightKey={highlightKey}
          maxVisible={maxVisible}
          showAll={showAllMap[i] ?? false}
          onShowAll={onShowAll ? () => onShowAll(i) : undefined}
          showMoreLabel={showMoreLabel}
          renderRight={renderRight?.(section, i)}
        />
      ))}
    </View>
  );
}

// ── Compound export ──

export const AccordionList = Object.assign(AccordionListInner, {
  Tile: AccordionTile,
});

// ── Styles ──

const styles = StyleSheet.create({
  badge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tilePress: {
    overflow: 'hidden',
  },
  tileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  tileTexts: {
    flex: 1,
    marginLeft: 16,
    gap: 2,
  },
  tileRight: {
    marginLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerContainer: {
    paddingLeft: 76, // 20 (hPad) + 40 (badge) + 16 (gap)
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  itemListContainer: {
    paddingLeft: 76,
    paddingRight: 20,
    paddingBottom: 12,
  },
  showMoreButton: {
    paddingTop: 10,
  },
});
