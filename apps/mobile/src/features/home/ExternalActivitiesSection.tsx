import { useCallback, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CaretRightIcon, XIcon } from 'phosphor-react-native';
import { Txt } from '@skkuverse/sds';
import { SdsColors, SdsShadows, useT } from '@skkuverse/shared';
import { handleSduiAction } from '@/sdui/action-handler';
import { logHomeContentSelect } from '@/services/analytics';

const INSTAGRAM_URL = 'https://www.instagram.com/skkuverse.app';

interface ActivityCardData {
  id: string;
  title: string;
  /** Optional subtitle line below the title (e.g. "광고 · 과기정통부"). When
   *  omitted the card renders title only — visual height shrinks accordingly. */
  meta?: string;
  image: ImageSourcePropType;
}

// Launch story — 3 cards introducing the SKKU Verse rebrand. Replace with
// `useExternalActivities()` React Query hook once the backend endpoint exists.
const MOCK_ACTIVITIES: ActivityCardData[] = [
  {
    id: 'rebrand-name',
    title: '스꾸버스 →\n성균관 유니버스',
    image: require('../../../assets/images/news/bus-to-verse.png'),
  },
  {
    id: 'rebrand-logo',
    title: '은행잎을 담은\n새로운 로고',
    image: require('../../../assets/images/news/ginkgo-logo.png'),
  },
  {
    id: 'rebrand-meaning',
    title: 'Universe,\n그 이상의 의미',
    image: require('../../../assets/images/news/universe-meaning.png'),
  },
];

const CARD_WIDTH = 140;
// Image area in portrait 3:4 (width:height) — taller-than-wide tile matches
// the reference (에브리타임 대외활동) where photo dominates the card.
const CARD_IMAGE_HEIGHT = (CARD_WIDTH * 4) / 3; // 140 × 4/3 ≈ 187

export function ExternalActivitiesSection() {
  const { t } = useT();
  const [previewImage, setPreviewImage] = useState<ImageSourcePropType | null>(null);
  const lastPreviewIdRef = useRef<string>('');
  const insets = useSafeAreaInsets();

  const openPreview = useCallback((item: ActivityCardData) => {
    lastPreviewIdRef.current = item.id;
    logHomeContentSelect({ content_type: 'news_card', item_id: item.id });
    setPreviewImage(item.image);
  }, []);

  const closePreview = useCallback(() => {
    const id = lastPreviewIdRef.current;
    if (id) {
      logHomeContentSelect({ content_type: 'news_modal_close', item_id: id });
      // Clear so duplicate close paths (X tap + backdrop tap + onRequestClose
      // racing during fade) don't re-log the same id.
      lastPreviewIdRef.current = '';
    }
    setPreviewImage(null);
  }, []);

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Txt
          typography="t4"
          fontWeight="bold"
          color={SdsColors.grey900}
          numberOfLines={1}
        >
          {t('home.news.title')}
        </Txt>
        <Pressable
          style={({ pressed }) => [
            styles.viewAllBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          hitSlop={8}
          onPress={() => {
            logHomeContentSelect({ content_type: 'news_more', item_id: 'instagram' });
            handleSduiAction({
              actionType: 'external',
              actionValue: INSTAGRAM_URL,
            });
          }}
          accessibilityRole="link"
          accessibilityLabel={t('home.news.instagramOpen')}
        >
          <Txt typography="t7" color={SdsColors.grey500}>
            {t('common.viewAll')}
          </Txt>
          <CaretRightIcon size={12} color={SdsColors.grey400} />
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardsRow}
        decelerationRate="fast"
      >
        {MOCK_ACTIVITIES.map((item) => (
          <Pressable
            key={item.id}
            style={({ pressed }) => [
              styles.card,
              { opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => openPreview(item)}
            accessibilityRole="button"
            accessibilityLabel={item.title.replace(/\n/g, ' ')}
          >
            <Image source={item.image} style={styles.cardImage} resizeMode="cover" />
            <View style={styles.cardBody}>
              <Txt
                typography="t5"
                fontWeight="bold"
                color={SdsColors.grey900}
                numberOfLines={2}
                style={styles.cardTitle}
              >
                {item.title}
              </Txt>
              {item.meta ? (
                <Txt
                  typography="t7"
                  color={SdsColors.grey400}
                  numberOfLines={1}
                  style={styles.cardMeta}
                >
                  {item.meta}
                </Txt>
              ) : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <Modal
        visible={previewImage !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closePreview}
      >
        <Pressable
          style={styles.previewBackdrop}
          onPress={closePreview}
          accessibilityRole="button"
          accessibilityLabel={t('home.news.imageClose')}
        >
          {previewImage ? (
            <Image
              source={previewImage}
              style={styles.previewImage}
              resizeMode="contain"
            />
          ) : null}
        </Pressable>
        <Pressable
          style={[styles.previewClose, { top: insets.top + 12 }]}
          onPress={closePreview}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <XIcon size={24} color="#fff" weight="bold" />
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  cardsRow: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    boxShadow: SdsShadows.card.boxShadow,
    ...SdsShadows.card.legacy,
  },
  cardImage: {
    width: '100%',
    height: CARD_IMAGE_HEIGHT,
    backgroundColor: '#f5f5f5',
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    lineHeight: 17,
    letterSpacing: -0.2,
  },
  cardMeta: {
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: -0.1,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewClose: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
