import { useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { SearchField, Toast, Txt } from '@skkuverse/sds';
import {
  SdsColors,
  isUnsupportedSource,
  recommendCollegeMates,
  useT,
  type Campus,
  type TabSource,
} from '@skkuverse/shared';
import { MAX_INTEREST_DEPTS } from '../types';
import { DeptRow } from './DeptRow';
import { logOnboardingStep } from '@/services/analytics';

interface Props {
  campus: Campus;
  // null when the user tapped "내 학과가 없어요" on the previous step.
  primaryDeptId: string | null;
  sources: TabSource[];
  selectedIds: string[];
  onToggle: (deptId: string) => void;
}

interface DeptSection {
  title: string;
  data: TabSource[];
}

export function InterestDeptStep({
  campus,
  primaryDeptId,
  sources: sourceDepartments,
  selectedIds,
  onToggle,
}: Props) {
  const { t } = useT();
  const [query, setQuery] = useState('');
  const [toastText, setToastText] = useState<string | null>(null);
  const atMax = selectedIds.length >= MAX_INTEREST_DEPTS;

  const primaryDept = primaryDeptId
    ? sourceDepartments.find((d) => d.id === primaryDeptId)
    : undefined;

  // Step 1: campus filter + drop primary + search.
  const candidates = useMemo(() => {
    const filtered = sourceDepartments.filter(
      (d) =>
        d.id !== primaryDeptId &&
        (d.campus === campus || d.campus === 'both' || d.campus == null),
    );
    if (!query.trim()) return filtered;
    return filtered.filter((d) => d.name.includes(query.trim()));
  }, [campus, primaryDeptId, sourceDepartments, query]);

  // Step 2: split into "same college" + "others" buckets relative to primary.
  const sections: DeptSection[] = useMemo(() => {
    const { recommended, others } = recommendCollegeMates(primaryDept ?? null, candidates);
    const out: DeptSection[] = [];
    if (recommended.length > 0) {
      out.push({ title: t('onboarding.interestDept.recommendedSection'), data: recommended });
    }
    out.push({
      title: recommended.length > 0 ? t('onboarding.interestDept.othersSection') : '',
      data: others,
    });
    return out;
  }, [primaryDept, candidates, t]);

  const handleRowPress = (item: TabSource) => {
    if (isUnsupportedSource(item)) {
      setToastText(t('onboarding.unsupportedDept.toast'));
      return;
    }
    logOnboardingStep({
      step: 'interest_dept',
      action: 'toggle_interest_dept',
      detail: item.id,
    });
    onToggle(item.id);
  };

  return (
    <View style={styles.container}>
      <Txt typography="t2" fontWeight="bold" color={SdsColors.grey900} style={styles.title}>
        {t('onboarding.interestDeptTitle')}
      </Txt>
      <Txt typography="t6" color={SdsColors.grey500} style={styles.subtitle}>
        {t('onboarding.interestDeptSubtitle')}
      </Txt>

      {primaryDept && (
        <View style={styles.pinnedCard}>
          <Txt typography="t6" fontWeight="semiBold" color="#1f3d2e">
            {primaryDept.name}
          </Txt>
          <View style={styles.pinnedTag}>
            <Txt typography="t7" fontWeight="bold" color="#1f3d2e">
              {t('onboarding.primaryTag')}
            </Txt>
          </View>
        </View>
      )}

      <SearchField
        placeholder={t('onboarding.deptSearchPlaceholder')}
        value={query}
        onChangeText={setQuery}
        hasClearButton
        style={styles.search}
      />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isSelected = selectedIds.includes(item.id);
          const unsupported = !item.noticeAvailable;
          return (
            <DeptRow
              name={item.name}
              selected={isSelected}
              // atMax-block applies only to crawlable items (an unsupported tap
              // routes to a toast, not selection, so the cap is irrelevant).
              disabled={!unsupported && atMax && !isSelected}
              unsupported={unsupported}
              variant="checkbox"
              onPress={() => handleRowPress(item)}
            />
          );
        }}
        renderSectionHeader={({ section }) =>
          section.title ? (
            <Txt
              typography="t7"
              fontWeight="semiBold"
              color={SdsColors.grey500}
              style={styles.sectionHeader}
            >
              {section.title}
            </Txt>
          ) : null
        }
        stickySectionHeadersEnabled={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />
      <Toast
        open={toastText !== null}
        text={toastText ?? ''}
        onClose={() => setToastText(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    marginTop: 8,
    marginBottom: 14,
  },
  subtitle: {
    marginBottom: 24,
  },
  pinnedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SdsColors.green50,
    borderRadius: 12,
    padding: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
    gap: 8,
  },
  pinnedTag: {
    // rgba(31, 61, 46, 0.12) — deepgreen #1f3d2e at 12% alpha
    backgroundColor: 'rgba(31, 61, 46, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  search: {
    marginBottom: 12,
  },
  list: {
    flex: 1,
    marginHorizontal: -4,
  },
  sectionHeader: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 6,
  },
});
