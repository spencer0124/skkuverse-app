/**
 * Service tabs — horizontal tab bar switching between bus services.
 *
 * Flutter source: bus_campus_screen.dart (service selector)
 */

import { Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SdsColors, SdsTypo, SdsRadius, type BusService } from '@skkuuniverse/shared';

interface ServiceTabsProps {
  services: BusService[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function ServiceTabs({ services, selectedIndex, onSelect }: ServiceTabsProps) {
  if (services.length <= 1) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {services.map((service, index) => {
        const isSelected = index === selectedIndex;
        return (
          <Pressable
            key={service.serviceId}
            style={[styles.tab, isSelected && styles.tabSelected]}
            onPress={() => onSelect(index)}
          >
            <Text style={[styles.tabText, isSelected && styles.tabTextSelected]}>
              {service.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: SdsRadius.full,
    backgroundColor: SdsColors.grey100,
  },
  tabSelected: {
    backgroundColor: SdsColors.grey900,
  },
  tabText: {
    fontSize: SdsTypo.t7.fontSize,
    lineHeight: SdsTypo.t7.lineHeight,
    fontWeight: '600',
    color: SdsColors.grey600,
  },
  tabTextSelected: {
    color: SdsColors.background,
  },
});
