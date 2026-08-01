import { useState, useCallback } from 'react';
import { View, Pressable, StyleSheet, useWindowDimensions, StatusBar } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeftIcon } from 'phosphor-react-native';

interface Props {
  videoId: string;
}

/**
 * Dedicated landscape player — used on Android (app-level fullscreen). Android WebView
 * has no "play → native fullscreen" (that's iOS-only), so we lock landscape, fill the
 * screen with the inline player, hide the status bar, and autoplay. YouTube's own
 * controls (incl. its ⛶) are visible.
 */
export function VideoPlayerScreen({ videoId }: Props) {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Fit a 16:9 video into the landscape screen.
  const fitW = height * (16 / 9);
  const videoW = fitW <= width ? fitW : width;
  const videoH = fitW <= width ? height : width * (9 / 16);

  const [isPlaying, setIsPlaying] = useState(false);

  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      return () => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      };
    }, []),
  );

  const onReady = useCallback(() => {
    requestAnimationFrame(() => setIsPlaying(true));
  }, []);

  const handleBack = useCallback(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).finally(() => {
      router.back();
    });
  }, [router]);

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      <View style={styles.center}>
        <YoutubePlayer
          videoId={videoId}
          play={isPlaying}
          mute={false}
          height={videoH}
          width={videoW}
          controls={true}
          webViewStyle={{ opacity: 0.99 }}
          onReady={onReady}
          onError={(e: string) => console.warn('[youtube] player error code:', e)}
          initialPlayerParams={{ rel: false, iv_load_policy: 3 }}
          forceAndroidAutoplay
        />
      </View>

      <Pressable
        onPress={handleBack}
        hitSlop={12}
        style={[styles.backBtn, { top: Math.max(insets.top, 10), left: Math.max(insets.left, 10) }]}
      >
        <ArrowLeftIcon size={24} color="#fff" weight="bold" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtn: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
