import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Platform,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlayIcon, PlayCircleIcon, CaretRightIcon, ArrowLeftIcon } from 'phosphor-react-native';
import YoutubePlayer, { getYoutubeMeta } from 'react-native-youtube-iframe';
import { EPISODES, TRAILERS, SHOW, type VideoItem } from './videos';

// Progressive blur via stacked bands (bottom-anchored): each band blurs the poster
// behind it at increasing intensity → sharp up top, ramping to full blur at the photo's
// bottom. `bottom` is a fraction of heroHeight from the hero's bottom edge.
const BLUR_BANDS = [
  { bottom: 0.0, intensity: 92 },
  { bottom: 0.11, intensity: 70 },
  { bottom: 0.22, intensity: 52 },
  { bottom: 0.33, intensity: 38 },
  { bottom: 0.44, intensity: 25 },
  { bottom: 0.55, intensity: 14 },
  { bottom: 0.66, intensity: 6 },
];

export function VideoGalleryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const heroHeight = Math.min(width * 1.15, height * 0.62);
  const cardWidth = Math.min(width * 0.72, 300);

  // iOS embedded player → native fullscreen. Android → dedicated landscape screen.
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [play, setPlay] = useState(false);
  const inFullscreen = useRef(false);
  const [descExpanded, setDescExpanded] = useState(false);

  // YouTube titles for the cards (oEmbed, no API key).
  const [titles, setTitles] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    [...EPISODES, ...TRAILERS].forEach(v => {
      getYoutubeMeta(v.id)
        .then(meta => {
          if (!cancelled) setTitles(t => ({ ...t, [v.id]: meta.title }));
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const playVideo = useCallback(
    (video: VideoItem) => {
      if (Platform.OS === 'android') {
        router.push({ pathname: '/video-player' as never, params: { videoId: video.id } });
        return;
      }
      if (video.id === activeVideoId) {
        setPlay(false);
        requestAnimationFrame(() => setPlay(true));
      } else {
        setPlay(false);
        setActiveVideoId(video.id);
      }
    },
    [activeVideoId, router],
  );

  const onReady = useCallback(() => {
    requestAnimationFrame(() => setPlay(true));
  }, []);

  // Orientation is driven only by 'playing'/'paused'/'ended' — NOT 'buffering', which
  // YouTube also fires during inline loading (before iOS presents fullscreen) and would
  // rotate the gallery prematurely. Lock landscape once when playback (→ fullscreen)
  // actually starts; restore portrait when it pauses/ends (the only available exit cue).
  const onChangeState = useCallback((state: string) => {
    if (state === 'playing' && !inFullscreen.current) {
      inFullscreen.current = true;
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } else if ((state === 'paused' || state === 'ended') && inFullscreen.current) {
      inFullscreen.current = false;
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      setPlay(false);
    }
  }, []);

  const renderCard = (video: VideoItem) => (
    <Pressable
      key={video.id}
      style={({ pressed }) => [{ width: cardWidth, opacity: pressed ? 0.7 : 1 }]}
      onPress={() => playVideo(video)}
    >
      <View style={styles.cardThumbWrap}>
        <Image source={{ uri: video.thumbnailUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        <View style={styles.cardPlay} pointerEvents="none">
          <PlayCircleIcon size={44} color="rgba(255,255,255,0.95)" weight="fill" />
        </View>
      </View>
      <Text style={styles.cardLabel} numberOfLines={1}>
        {video.label}
      </Text>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {titles[video.id] ?? ''}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.root}>
      {/* iOS: hidden full-screen player behind everything, promotes to native fullscreen */}
      {Platform.OS === 'ios' && activeVideoId && (
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

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[styles.hero, { height: heroHeight }]}>
          <Image source={SHOW.hero} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          {/* Progressive blur — stacked bands of increasing intensity (each blurs the
              poster behind it; MaskedView+BlurView doesn't backdrop-blur on iOS). */}
          {BLUR_BANDS.map((b, i) => (
            <BlurView
              key={i}
              intensity={b.intensity}
              tint="default"
              experimentalBlurMethod="dimezisBlurView"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: heroHeight * b.bottom,
                height: heroHeight * 0.13,
              }}
            />
          ))}
          {/* smooth dark gradient for title legibility */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.85)']}
            locations={[0.4, 0.72, 1]}
            style={[styles.scrim, { height: heroHeight }]}
          />
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{SHOW.title}</Text>
            <Text style={styles.heroSubtitle}>{SHOW.subtitle}</Text>
            <Pressable style={styles.heroPlayBtn} onPress={() => playVideo(EPISODES[0])}>
              <PlayIcon size={18} color="#000" weight="fill" />
              <Text style={styles.heroPlayText}>재생</Text>
            </Pressable>
          </View>
        </View>

        {/* Description */}
        <Pressable style={styles.descWrap} onPress={() => setDescExpanded(e => !e)}>
          <Text style={styles.description} numberOfLines={descExpanded ? undefined : 3}>
            {SHOW.description}
          </Text>
          <Text style={styles.moreBtn}>{descExpanded ? '접기' : '더 보기'}</Text>
        </Pressable>

        {/* Episodes */}
        <Text style={styles.sectionLabel}>에피소드</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
        >
          {EPISODES.map(renderCard)}
        </ScrollView>

        {/* Trailers */}
        <Text style={styles.sectionLabel}>예고편</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
        >
          {TRAILERS.map(renderCard)}
        </ScrollView>

        {/* Staff */}
        <Text style={styles.sectionLabel}>출연진 및 제작진</Text>
        <View style={styles.staffBox}>
          {SHOW.staff.map(s => (
            <View key={s.role} style={styles.staffRow}>
              <Text style={styles.staffRole}>{s.role}</Text>
              <Text style={styles.staffNames}>{s.names}</Text>
            </View>
          ))}
        </View>

        {/* Channel */}
        <Pressable
          style={({ pressed }) => [styles.channelRow, { opacity: pressed ? 0.6 : 1 }]}
          onPress={() => Linking.openURL(SHOW.channelUrl)}
        >
          <Text style={styles.channelName}>{SHOW.channelName}</Text>
          <CaretRightIcon size={18} color="rgba(255,255,255,0.5)" weight="bold" />
        </Pressable>
      </ScrollView>

      {/* Fixed floating back button (native header is hidden for the immersive hero) */}
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        style={[styles.backBtn, { top: insets.top + 6 }]}
      >
        <ArrowLeftIcon size={22} color="#fff" weight="bold" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#141414' },
  scroll: { flex: 1, backgroundColor: '#141414' },
  content: { paddingBottom: 56 },

  /* Hero */
  hero: { width: '100%', justifyContent: 'flex-end', backgroundColor: '#222' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  heroContent: { paddingHorizontal: 20, paddingBottom: 18, gap: 8 },
  heroTitle: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  heroSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' },
  heroPlayBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
  },
  heroPlayText: { color: '#000', fontSize: 16, fontWeight: '700' },

  descWrap: { paddingHorizontal: 20, paddingTop: 18 },
  description: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 20,
  },
  moreBtn: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },

  /* Sections */
  sectionLabel: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 14,
  },
  rail: { paddingHorizontal: 20, gap: 12 },

  /* Card */
  cardThumbWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPlay: { alignItems: 'center', justifyContent: 'center' },
  cardLabel: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 8 },
  cardTitle: { color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 18, marginTop: 2 },

  /* Staff */
  staffBox: { paddingHorizontal: 20, gap: 10 },
  staffRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  staffRole: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    width: 44,
  },
  staffNames: { color: '#fff', fontSize: 14, lineHeight: 20, flex: 1 },

  /* Floating back button */
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Channel */
  channelRow: {
    marginTop: 28,
    marginHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  channelName: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
