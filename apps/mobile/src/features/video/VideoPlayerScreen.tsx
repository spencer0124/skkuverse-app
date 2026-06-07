import { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import YoutubePlayer, { type YoutubeIframeRef } from 'react-native-youtube-iframe';
import { useFocusEffect, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeftIcon, PlayIcon, PauseIcon, SpeakerSlashIcon } from 'phosphor-react-native';
import { useVideoControls } from './useVideoControls';

interface Props {
  videoId: string;
  title: string;
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function VideoPlayerScreen({ videoId, title }: Props) {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Landscape: longer side is width. Contained 16:9 in whatever screen space we have.
  const fitW = height * (16 / 9);
  const videoW = fitW <= width ? fitW : width;
  const videoH = fitW <= width ? height : width * (9 / 16);

  const playerRef = useRef<YoutubeIframeRef | null>(null);
  // iOS WKWebView blocks programmatic autoplay WITH audio (no user gesture), but
  // always permits muted inline autoplay. So we start muted and not-yet-playing,
  // then kick play one frame after the player is ready (see onReady) so the mute
  // command lands before playVideo(). First tap turns the sound on.
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [barWidth, setBarWidth] = useState(1);

  const { visible, show, toggle } = useVideoControls(isPlaying);
  const opacity = useRef(new Animated.Value(1)).current;

  // Lock to landscape on focus, restore portrait on blur
  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      return () => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      };
    }, []),
  );

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  // Poll current time every 500ms
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const t = await playerRef.current?.getCurrentTime();
        if (t != null) setCurrentTime(t);
      } catch {
        // player not ready
      }
    }, 500);
    return () => clearInterval(id);
  }, []);

  const onReady = useCallback(async () => {
    try {
      const d = await playerRef.current?.getDuration();
      if (d) setDuration(d);
    } catch {
      // ignore
    }
    // Kick off (muted) autoplay one frame later so the mute command — applied on
    // this player-ready commit — is delivered before playVideo(). Flipping play
    // on the same commit would emit an unmuted play that iOS silently blocks.
    requestAnimationFrame(() => setIsPlaying(true));
  }, []);

  const onStateChange = useCallback((state: string) => {
    if (state === 'playing') setIsPlaying(true);
    else if (state === 'paused' || state === 'ended') setIsPlaying(false);
  }, []);

  const handleBack = useCallback(() => {
    // Restore portrait before navigating so the transition doesn't glitch
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).finally(() => {
      router.back();
    });
  }, [router]);

  const handleSeek = useCallback(
    (locationX: number) => {
      if (duration <= 0 || barWidth <= 1) return;
      const fraction = Math.max(0, Math.min(1, locationX / barWidth));
      const t = fraction * duration;
      playerRef.current?.seekTo(t, true);
      setCurrentTime(t);
    },
    [barWidth, duration],
  );

  const progress = duration > 0 ? currentTime / duration : 0;
  const fillWidth = Math.max(0, barWidth * progress);

  // Safe-area left inset covers the notch/camera island on the left in landscape
  const safeLeft = Math.max(insets.left, 16);
  const safeRight = Math.max(insets.right, 16);

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      {/* Full-screen centred video */}
      <View style={styles.videoCenter}>
        <YoutubePlayer
          ref={playerRef}
          videoId={videoId}
          play={isPlaying}
          mute={muted}
          height={videoH}
          width={videoW}
          controls={false}
          webViewStyle={{ opacity: 0.99 }}
          onReady={onReady}
          onChangeState={onStateChange}
          onError={(e: string) => console.warn('[youtube] player error code:', e)}
          initialPlayerParams={{ modestbranding: true, rel: false }}
        />
      </View>

      {/* Full-screen touch + controls overlay */}
      {/* Tap interceptor sits below controls layer, covers entire screen */}
      <Pressable
        style={StyleSheet.absoluteFillObject}
        onPress={() => {
          // First tap turns the sound on (video keeps playing). Once unmuted,
          // taps just toggle the controls as before.
          if (muted) {
            setMuted(false);
            show();
            return;
          }
          toggle();
        }}
      />

      <Animated.View
        style={[StyleSheet.absoluteFillObject, styles.controlsLayer, { opacity }]}
        pointerEvents={visible ? 'box-none' : 'none'}
      >
        {/* Top bar */}
        <View style={[styles.topBar, { paddingLeft: safeLeft, paddingRight: safeRight }]} pointerEvents="box-none">
          <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
            <ArrowLeftIcon size={22} color="#fff" weight="bold" />
          </Pressable>
          <Text style={styles.titleText} numberOfLines={1}>
            {title}
          </Text>
        </View>

        {/* Center play/pause */}
        <View style={styles.center} pointerEvents="box-none">
          <Pressable
            hitSlop={16}
            onPress={() => {
              setIsPlaying(p => !p);
              show();
            }}
          >
            {isPlaying ? (
              <PauseIcon size={56} color="#fff" weight="fill" />
            ) : (
              <PlayIcon size={56} color="#fff" weight="fill" />
            )}
          </Pressable>
        </View>

        {/* Bottom bar */}
        <View style={[styles.bottomBar, { paddingLeft: safeLeft, paddingRight: safeRight }]} pointerEvents="box-none">
          <View
            style={styles.seekWrapper}
            onLayout={e => setBarWidth(e.nativeEvent.layout.width)}
          >
            <View style={styles.seekTrack} pointerEvents="none">
              <View style={[styles.seekFill, { width: fillWidth }]} />
              {barWidth > 1 && (
                <View style={[styles.seekThumb, { left: Math.max(0, fillWidth - 6) }]} />
              )}
            </View>
            <Pressable
              style={StyleSheet.absoluteFillObject}
              onPress={e => handleSeek(e.nativeEvent.locationX)}
            />
          </View>
          <Text style={styles.timeText}>
            {fmt(currentTime)} / {fmt(duration)}
          </Text>
        </View>
      </Animated.View>

      {/* Muted-autoplay hint — stays visible (independent of the auto-hiding
          controls) until the first tap turns the sound on. pointerEvents=none so
          the tap falls through to the full-screen unmute interceptor below. */}
      {muted && (
        <View style={styles.muteHintWrap} pointerEvents="none">
          <View style={styles.mutePill}>
            <SpeakerSlashIcon size={15} color="#fff" weight="fill" />
            <Text style={styles.mutePillText}>탭하여 소리 켜기</Text>
          </View>
        </View>
      )}
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
  videoCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlsLayer: {
    justifyContent: 'space-between',
  },

  /* Top */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: 10,
  },
  backBtn: {
    padding: 2,
  },
  titleText: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  /* Center */
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Bottom */
  bottomBar: {
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: 8,
  },
  seekWrapper: {
    height: 20,
    justifyContent: 'center',
  },
  seekTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  seekFill: {
    height: 3,
    backgroundColor: '#E50914',
    borderRadius: 2,
  },
  seekThumb: {
    position: 'absolute',
    top: -4.5,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E50914',
  },
  timeText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
  },

  /* Muted hint */
  muteHintWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 72,
    alignItems: 'center',
  },
  mutePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  mutePillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
