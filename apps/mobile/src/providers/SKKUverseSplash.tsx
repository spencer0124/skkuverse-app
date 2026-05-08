import { useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';

interface Props {
  isReady?: boolean;
  onDismiss?: () => void;
}

export function SKKUverseSplash({ isReady = false, onDismiss }: Props) {
  useEffect(() => {
    if (!isReady) return;
    onDismiss?.();
  }, [isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={s.root}>
      <Image
        source={require('../../assets/images/splash-icon.png')}
        style={s.icon}
        resizeMode="contain"
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 160,
    height: 160,
  },
});
