import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { PlayCircleIcon } from 'phosphor-react-native';
import { VIDEOS, type VideoMeta } from './videos';

export function VideoGalleryScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const featuredHeight = width * (9 / 16);

  const goToPlayer = (video: VideoMeta) => {
    router.push({
      pathname: '/video-player' as never,
      params: { videoId: video.id, title: video.title },
    });
  };

  const [featured, ...rest] = VIDEOS;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Featured card */}
      <Pressable
        onPress={() => goToPlayer(featured)}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <View style={[styles.featuredCard, { height: featuredHeight }]}>
          <Image
            source={{ uri: featured.thumbnailUrl }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
          />
          <View style={styles.featuredOverlay}>
            <View style={styles.playBtn}>
              <PlayCircleIcon size={18} color="#fff" weight="fill" />
              <Text style={styles.playBtnText}>재생</Text>
            </View>
            <Text style={styles.featuredTitle} numberOfLines={2}>
              {featured.title}
            </Text>
          </View>
        </View>
      </Pressable>

      {/* More section */}
      {rest.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>더 보기</Text>
          {rest.map(video => (
            <Pressable
              key={video.id}
              style={({ pressed }) => [styles.listRow, { opacity: pressed ? 0.7 : 1 }]}
              onPress={() => goToPlayer(video)}
            >
              <Image
                source={{ uri: video.thumbnailUrl }}
                style={styles.listThumb}
                contentFit="cover"
              />
              <View style={styles.listMeta}>
                <Text style={styles.listTitle} numberOfLines={2}>
                  {video.title}
                </Text>
              </View>
              <PlayCircleIcon size={22} color="rgba(255,255,255,0.6)" weight="fill" />
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#141414',
  },
  content: {
    paddingBottom: 48,
  },

  /* Featured */
  featuredCard: {
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: '#222',
  },
  featuredOverlay: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    gap: 10,
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#E50914',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 5,
    gap: 6,
  },
  playBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  featuredTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
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
