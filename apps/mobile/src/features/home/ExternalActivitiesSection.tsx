import { Image, Pressable, ScrollView, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { CaretRightIcon } from 'phosphor-react-native';
import { Txt } from '@skkuverse/sds';
import { SdsColors, SdsShadows } from '@skkuverse/shared';
import { handleSduiAction } from '@/sdui/action-handler';

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
    title: '스꾸 버스에서\n성균관 유니버스로',
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
  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Txt
          typography="t4"
          fontWeight="bold"
          color={SdsColors.grey900}
          numberOfLines={1}
        >
          소식
        </Txt>
        <Pressable
          style={({ pressed }) => [
            styles.viewAllBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          hitSlop={8}
          onPress={() =>
            handleSduiAction({
              actionType: 'external',
              actionValue: INSTAGRAM_URL,
            })
          }
          accessibilityRole="link"
          accessibilityLabel="스꾸버스 인스타그램 열기"
        >
          <Txt typography="t7" color={SdsColors.grey500}>
            더보기
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
});
