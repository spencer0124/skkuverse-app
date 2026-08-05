/**
 * 검색 범위로 쓸 공지 카테고리를 고르는 시트.
 *
 * 검색 화면은 원래 "들어온 탭"에 갇혀 있었다 — 학과 탭에서 검색을 열면 학과
 * 안에서만 찾을 수 있고, 학사 공지를 찾으려면 뒤로 가서 탭을 바꾸고 다시
 * 검색을 열어야 했다. 이 시트가 그 왕복을 없앤다.
 *
 * 각 행에 소스 이름을 부제로 붙이는 이유: "학과"라는 라벨만으로는 **어느**
 * 학과인지 알 수 없다. picker 탭의 의미는 사용자의 선택에 따라 달라지므로,
 * 실제로 검색될 대상을 그 자리에서 보여준다.
 *
 * 탭을 바꿔도 `noticesUiStore.activeTabKey`는 건드리지 않는다 — 검색 범위를
 * 옮긴 것이 뒤로 갔을 때 보게 될 탭까지 바꿔버리면 안 된다.
 */

import { forwardRef, useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { CheckIcon } from 'phosphor-react-native';
import {
  SdsColors,
  SdsSpacing,
  resolvePickerSelection,
  useT,
  type NoticeTab,
} from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';

/** Sentinel for the "everything I follow" row. Not a real tab key. */
export const ALL_SCOPE_KEY = '__all__';

interface Props {
  tabs: NoticeTab[];
  /** A tab key, or `ALL_SCOPE_KEY`. */
  selectedKey: string;
  pickerSelections: Record<string, string[] | undefined>;
  /** Receives a tab key or `ALL_SCOPE_KEY`. */
  onSelect: (key: string) => void;
  /**
   * False when the followed-source union exceeds the `GET /notices` contract
   * (`NOTICE_MULTI_SOURCE_LIMIT`), which would 400. The 전체 row is hidden
   * rather than offered as an option that errors — and it degrades on its own
   * if a future notice tab pushes the union past the cap.
   */
  canSelectAll: boolean;
}

/** 이 탭이 실제로 어떤 소스를 검색하게 되는지 — 라벨만으로는 안 보이는 부분. */
function describeTab(
  tab: NoticeTab,
  pickerSelections: Record<string, string[] | undefined>,
): string {
  if (tab.tabMode === 'fixed' && tab.fixed) return tab.fixed.name;
  if (tab.tabMode === 'picker' && tab.picker) {
    const ids = new Set(resolvePickerSelection(tab, pickerSelections[tab.key]));
    return tab.picker.sources
      .filter((s) => ids.has(s.id))
      .map((s) => s.name)
      .join(', ');
  }
  return '';
}

function ScopeRow({
  label,
  subtitle,
  selected,
  onPress,
}: {
  label: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowText}>
        <Txt
          typography="t6"
          fontWeight={selected ? 'semibold' : 'regular'}
          color={selected ? SdsColors.grey900 : SdsColors.grey700}
        >
          {label}
        </Txt>
        {subtitle ? (
          <Txt typography="t7" color={SdsColors.grey500} numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {selected ? (
        <CheckIcon size={18} color={SdsColors.grey900} weight="bold" />
      ) : null}
    </Pressable>
  );
}

export const NoticesSearchScopeSheet = forwardRef<BottomSheetModal, Props>(
  function NoticesSearchScopeSheet(
    { tabs, selectedKey, pickerSelections, onSelect, canSelectAll },
    ref,
  ) {
    const { t } = useT();
    const insets = useSafeAreaInsets();

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          pressBehavior="close"
        />
      ),
      [],
    );

    return (
      <BottomSheetModal
        ref={ref}
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.handleIndicator}
      >
        <BottomSheetView
          style={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, SdsSpacing.base) },
          ]}
        >
          <Txt
            typography="t5"
            fontWeight="bold"
            color={SdsColors.grey900}
            style={styles.title}
          >
            {t('notices.search.scope.sheetTitle')}
          </Txt>

          {/* 전체 leads: it is the widest scope and the one a natural-language
              question usually wants, since the asker does not know which tab
              holds the answer. */}
          {canSelectAll && (
            <ScopeRow
              label={t('notices.search.scope.all')}
              subtitle={t('notices.search.scope.allSubtitle')}
              selected={selectedKey === ALL_SCOPE_KEY}
              onPress={() => onSelect(ALL_SCOPE_KEY)}
            />
          )}

          {tabs.map((tab) => (
            <ScopeRow
              key={tab.key}
              label={tab.label}
              subtitle={describeTab(tab, pickerSelections)}
              selected={tab.key === selectedKey}
              onPress={() => onSelect(tab.key)}
            />
          ))}
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  handleIndicator: {
    backgroundColor: SdsColors.grey300,
  },
  content: {
    paddingHorizontal: SdsSpacing.base,
    paddingTop: SdsSpacing.sm,
  },
  title: {
    paddingHorizontal: 4,
    paddingBottom: SdsSpacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SdsSpacing.md,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  rowText: {
    flexShrink: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.55,
  },
});
