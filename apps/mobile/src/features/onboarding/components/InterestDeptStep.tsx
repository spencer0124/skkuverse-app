import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SearchField, Txt } from '@skkuverse/sds';
import { SdsColors, type Campus, useT } from '@skkuverse/shared';
import { MOCK_DEPARTMENTS } from '../data/mock-departments';
import { MAX_INTEREST_DEPTS } from '../types';
import { DeptRow } from './DeptRow';

interface Props {
  campus: Campus;
  primaryDeptId: string;
  selectedIds: string[];
  onToggle: (deptId: string) => void;
}

export function InterestDeptStep({ campus, primaryDeptId, selectedIds, onToggle }: Props) {
  const { t } = useT();
  const [query, setQuery] = useState('');
  const atMax = selectedIds.length >= MAX_INTEREST_DEPTS;

  const primaryDept = MOCK_DEPARTMENTS.find((d) => d.id === primaryDeptId);

  const departments = useMemo(() => {
    const filtered = MOCK_DEPARTMENTS.filter(
      (d) =>
        d.id !== primaryDeptId &&
        (d.campus === campus || d.campus === 'both'),
    );
    if (!query.trim()) return filtered;
    return filtered.filter((d) => d.name.includes(query.trim()));
  }, [campus, primaryDeptId, query]);

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
          <Txt typography="t6" fontWeight="semiBold" color={SdsColors.green500}>
            {primaryDept.name}
          </Txt>
          <View style={styles.pinnedTag}>
            <Txt typography="t7" fontWeight="bold" color={SdsColors.green500}>
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
      <FlatList
        data={departments}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => {
          const isSelected = selectedIds.includes(item.id);
          return (
            <DeptRow
              name={item.name}
              selected={isSelected}
              disabled={atMax && !isSelected}
              variant="checkbox"
              onPress={() => onToggle(item.id)}
            />
          );
        }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.list}
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
    backgroundColor: 'rgba(27, 94, 63, 0.12)',
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
});
