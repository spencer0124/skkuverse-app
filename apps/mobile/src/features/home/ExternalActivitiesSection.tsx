import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { CaretRightIcon, ImageIcon } from 'phosphor-react-native';
import { Txt } from '@skkuverse/sds';
import { SdsColors, SdsShadows } from '@skkuverse/shared';

interface ActivityCardData {
  id: string;
  title: string;
  meta: string;
}

// Mock data — replace with `useExternalActivities()` React Query hook
// once the backend endpoint exists. Card visual is decoupled from data
// source so the swap is a one-line change.
const MOCK_ACTIVITIES: ActivityCardData[] = [
  {
    id: 'mock-1',
    title: '2026 AI보안\n기술개발 교육과정',
    meta: '광고 · 과기정통부',
  },
  {
    id: 'mock-2',
    title: 'LS드사클 22기\n대학생 멘토 모집',
    meta: '광고 · ㈜LS · 초록우산',
  },
  {
    id: 'mock-3',
    title: '2026년\n궁동청소년 봉사',
    meta: '궁동청소년문화의집',
  },
  {
    id: 'mock-4',
    title: '글로벌 인턴십\n프로그램 2026',
    meta: '광고 · 교내',
  },
];

const CARD_WIDTH = 156;
const CARD_IMAGE_HEIGHT = 156;

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
          대외활동
        </Txt>
        <Pressable
          style={({ pressed }) => [
            styles.viewAllBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="대외활동 더보기"
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
            <View style={styles.imagePlaceholder}>
              <ImageIcon size={32} color={SdsColors.grey300} weight="regular" />
            </View>
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
              <Txt
                typography="t7"
                color={SdsColors.grey400}
                numberOfLines={1}
                style={styles.cardMeta}
              >
                {item.meta}
              </Txt>
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
  imagePlaceholder: {
    width: '100%',
    height: CARD_IMAGE_HEIGHT,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  cardTitle: {
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  cardMeta: {
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: -0.1,
  },
});
