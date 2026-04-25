import { Pressable, StyleSheet, View } from 'react-native';
import { CheckIcon } from 'phosphor-react-native';
import { Txt } from '@skkuverse/sds';
import { SdsColors } from '@skkuverse/shared';

interface Props {
  name: string;
  location: string;
  selected: boolean;
  onPress: () => void;
}

export function CampusCard({ name, location, selected, onPress }: Props) {
  return (
    <Pressable
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${name}, ${location}`}
    >
      <View>
        <Txt
          typography="t5"
          fontWeight="bold"
          color={selected ? SdsColors.green500 : SdsColors.grey900}
        >
          {name}
        </Txt>
        <Txt typography="t7" color={SdsColors.grey400} style={styles.location}>
          {location}
        </Txt>
      </View>
      {selected && (
        <View style={styles.checkCircle}>
          <CheckIcon size={12} color="#FFFFFF" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: SdsColors.grey200,
    borderRadius: 18,
    padding: 22,
    marginBottom: 12,
  },
  cardSelected: {
    backgroundColor: SdsColors.green50,
    borderColor: SdsColors.green500,
  },
  location: {
    marginTop: 3,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: SdsColors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
