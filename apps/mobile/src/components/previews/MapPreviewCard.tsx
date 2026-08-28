import { StyleSheet, Text, View } from 'react-native';
import { MagnifyingGlassIcon } from 'phosphor-react-native';

import { previewBrand, previewCard } from './styles';

/**
 * Mock building-search card for the first-launch intro's campus-map page.
 *
 * Shows the search → building detail path (BuildingDetailSheet), because
 * "which building, which floor" is the question the map actually answers.
 * Hardcoded Korean by the same reasoning as NoticePreviewCard.
 */
const AMENITIES = ['엘리베이터', '장애인 화장실'];
const FLOORS = [
  { floor: '2층', rooms: '강의실 8곳' },
  { floor: '3층', rooms: '강의실 6곳' },
];

export function MapPreviewCard() {
  return (
    <View style={styles.card}>
      <View style={styles.searchBar}>
        <MagnifyingGlassIcon size={12} color={previewBrand.muted} weight="bold" />
        <Text style={styles.searchText}>경영관</Text>
      </View>

      <View style={styles.headerRow}>
        <Text style={styles.buildingName}>경영관</Text>
        <View style={styles.codeBadge}>
          <Text style={styles.codeBadgeText}>33동</Text>
        </View>
      </View>

      <View style={styles.amenityRow}>
        {AMENITIES.map((amenity) => (
          <View key={amenity} style={styles.amenity}>
            <Text style={styles.amenityText}>{amenity}</Text>
          </View>
        ))}
      </View>

      <View style={styles.floorRows}>
        {FLOORS.map(({ floor, rooms }) => (
          <View key={floor} style={styles.floorRow}>
            <Text style={styles.floorLabel}>{floor}</Text>
            <Text style={styles.floorValue}>{rooms}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: previewCard,
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f4f4f4',
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 14,
  },
  searchText: {
    fontSize: 11,
    color: previewBrand.body,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  buildingName: {
    fontSize: 14,
    fontWeight: '600',
    color: previewBrand.ink,
  },
  codeBadge: {
    backgroundColor: previewBrand.greenTint,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 5,
  },
  codeBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: previewBrand.green,
  },
  amenityRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  amenity: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: previewBrand.border,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  amenityText: {
    fontSize: 10,
    color: previewBrand.body,
  },
  floorRows: {
    gap: 6,
  },
  floorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  floorLabel: {
    fontSize: 11,
    color: previewBrand.muted,
    minWidth: 56,
    lineHeight: 15,
  },
  floorValue: {
    fontSize: 11,
    color: previewBrand.body,
    lineHeight: 15,
  },
});
