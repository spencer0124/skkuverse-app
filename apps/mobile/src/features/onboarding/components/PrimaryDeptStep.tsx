import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SearchField, Txt } from '@skkuverse/sds';
import { SdsColors, type Campus, useT } from '@skkuverse/shared';
import { MOCK_DEPARTMENTS } from '../data/mock-departments';
import { DeptRow } from './DeptRow';

interface Props {
  campus: Campus;
  selectedId: string | null;
  onSelect: (deptId: string) => void;
}

export function PrimaryDeptStep({ campus, selectedId, onSelect }: Props) {
  const { t } = useT();
  const [query, setQuery] = useState('');

  const departments = useMemo(() => {
    const filtered = MOCK_DEPARTMENTS.filter(
      (d) => d.campus === campus || d.campus === 'both',
    );
    if (!query.trim()) return filtered;
    return filtered.filter((d) => d.name.includes(query.trim()));
  }, [campus, query]);

  return (
    <View style={styles.container}>
      <Txt typography="t2" fontWeight="bold" color={SdsColors.grey900} style={styles.title}>
        {t('onboarding.primaryDeptTitle')}
      </Txt>
      <Txt typography="t6" color={SdsColors.grey500} style={styles.subtitle}>
        {t('onboarding.primaryDeptSubtitle')}
      </Txt>
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
        renderItem={({ item }) => (
          <DeptRow
            name={item.name}
            selected={item.id === selectedId}
            variant="radio"
            onPress={() => onSelect(item.id)}
          />
        )}
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
  search: {
    marginBottom: 12,
  },
  list: {
    flex: 1,
    marginHorizontal: -4,
  },
});
