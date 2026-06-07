import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import * as ScreenOrientation from 'expo-screen-orientation';
import { PlayCircleIcon } from 'phosphor-react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { VIDEOS, type VideoMeta } from './videos';

export function VideoGalleryScreen() {
  const { width, height } = useWindowDimensions();
  const bannerHeight = width * (9 / 16);

  // Embedded player: mounting it (with allowsInlineMediaPlayback:false) and starting
  // playback promotes the video straight to iOS native fullscreen — no separate screen.
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [play, setPlay] = useState(false);
  const inFullscreen = useRef(false);

  const playVideo = useCallback(
    (video: VideoMeta) => {
      if (video.id === activeVideoId) {
        // already mounted → re-fire play (toggle so the prop change registers)
        setPlay(false);
        requestAnimationFrame(() => setPlay(true));
      } else {
        // different video → remount via key change; onReady kicks play
        setPlay(false);
        setActiveVideoId(video.id);
      }
    },
    [activeVideoId],
  );

  const onReady = useCallback(() => {
    requestAnimationFrame(() => setPlay(true));
  }, []);

  // react-native-webview emits no fullscreen event, so infer it from player state:
  // iOS auto-pauses when the user taps the native fullscreen Done button. Lock landscape
  // when playback (→ fullscreen) starts; restore portrait when it pauses/ends.
  const onChangeState = useCallback((state: string) => {
    if ((state === 'playing' || state === 'buffering') && !inFullscreen.current) {
      inFullscreen.current = true;
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } else if ((state === 'paused' || state === 'ended') && inFullscreen.current) {
      inFullscreen.current = false;
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      setPlay(false);
    }
  }, []);

  const banner = VIDEOS[0];

  return (
    <View style={styles.root}>
      {/* Hidden full-screen player behind the opaque gallery. It stays invisible until
          a play promotes it to iOS native fullscreen. */}
      {activeVideoId && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <YoutubePlayer
            key={activeVideoId}
            videoId={activeVideoId}
            play={play}
            mute={false}
            height={height}
            width={width}
            controls={true}
            webViewStyle={{ opacity: 0.99 }}
            onReady={onReady}
            onChangeState={onChangeState}
            onError={(e: string) => console.warn('[youtube] player error code:', e)}
            initialPlayerParams={{ rel: false, iv_load_policy: 3 }}
            webViewProps={{ allowsInlineMediaPlayback: false }}
          />
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Decorative banner */}
        <View style={[styles.banner, { height: bannerHeight }]}>
          {banner && (
            <Image
              source={{ uri: banner.thumbnailUrl }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
            />
          )}
          <View style={styles.bannerOverlay}>
            <Text style={styles.bannerTitle}>SUBS 성균관대학교 방송국</Text>
          </View>
        </View>

        {/* Video list */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>영상</Text>
          {VIDEOS.map(video => (
            <Pressable
              key={video.id}
              style={({ pressed }) => [styles.listRow, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => playVideo(video)}
            >
              <Image source={{ uri: video.thumbnailUrl }} style={styles.listThumb} contentFit="cover" />
              <View style={styles.listMeta}>
                <Text style={styles.listTitle} numberOfLines={2}>
                  {video.title}
                </Text>
              </View>
              <PlayCircleIcon size={28} color="#fff" weight="fill" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#141414',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#141414',
  },
  content: {
    paddingBottom: 48,
  },

  /* Banner */
  banner: {
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: '#222',
  },
  bannerOverlay: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  /* Section */
  section: {
    paddingTop: 24,
  },
  sectionLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 12,
  },

  /* List row */
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  listThumb: {
    width: 124,
    height: 70,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  listMeta: {
    flex: 1,
  },
  listTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
});
