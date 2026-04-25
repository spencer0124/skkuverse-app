import { View, StyleSheet } from 'react-native';
import { SdsColors, SdsRadius } from '@skkuverse/shared';
import { Skeleton } from '@skkuverse/sds';

export function NoticeListSkeleton() {
  return (
    <Skeleton.Animate>
      <View style={styles.container}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={styles.row}>
            <Skeleton width={48} height={18} borderRadius={6} />
            <Skeleton width="90%" height={18} borderRadius={SdsRadius.xs} />
            <Skeleton width="60%" height={14} borderRadius={SdsRadius.xs} />
          </View>
        ))}
      </View>
    </Skeleton.Animate>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SdsColors.background,
  },
  row: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: SdsColors.grey100,
  },
});
