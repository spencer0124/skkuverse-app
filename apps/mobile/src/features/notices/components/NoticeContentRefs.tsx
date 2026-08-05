import { useCallback, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  EnvelopeSimpleIcon,
  LinkSimpleIcon,
  PhoneIcon,
} from 'phosphor-react-native';
import { SdsColors, useT } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import type {
  ExtractedImage,
  ExtractedLink,
} from '../utils/extractContentRefs';
import { useLinkPreviews } from '../hooks/useLinkPreviews';

interface Props {
  images: ExtractedImage[];
  links: ExtractedLink[];
  emails: string[];
  phones: string[];
  /** 본문 이미지의 Referer — 학과 서버 hotlink 차단 우회용. */
  sourceUrl: string;
  onImagePress: () => void;
  /** 이메일·전화 탭 시 클립보드 복사 + 토스트. */
  onCopyContact: (value: string) => void;
}

/**
 * 본문에서 뽑아낸 것들 — 포스터 이미지 / 링크 / 연락처.
 *
 * 공지 본문의 실질은 대개 "포스터 한 장 + 신청 링크 + 문의처"다. 그게
 * 마크다운 시트 뒤에 숨어 있으면 사용자는 본문을 열어 스크롤해야 한다.
 * 여기서 요약 영역으로 끌어올려, 본문을 열지 않고도 행동할 수 있게 한다.
 */
export function NoticeContentRefs({
  images,
  links,
  emails,
  phones,
  sourceUrl,
  onImagePress,
  onCopyContact,
}: Props) {
  const { t } = useT();
  const hasAny =
    images.length > 0 || links.length > 0 || emails.length > 0 || phones.length > 0;
  if (!hasAny) return null;

  return (
    <View style={styles.wrap}>
      {images.map((img) => (
        <BodyImage
          key={img.url}
          image={img}
          sourceUrl={sourceUrl}
          onPress={onImagePress}
        />
      ))}
      {links.length > 0 ? <LinkList links={links} /> : null}
      {/* 연락처도 링크·첨부와 같은 행 양식. 처음엔 pill로 따로 뒀는데, 같은
          "본문에서 뽑아낸 것"인데 형태가 다르면 다른 종류로 읽힌다. 세 블록이
          한 문법을 쓰면 위아래로 그냥 이어진 하나의 목록이 된다. */}
      {phones.map((p) => (
        <RefRow
          key={p}
          Icon={PhoneIcon}
          title={p}
          subtitle={t('notices.refPhone')}
          onPress={() => onCopyContact(p)}
        />
      ))}
      {emails.map((e) => (
        <RefRow
          key={e}
          Icon={EnvelopeSimpleIcon}
          title={e}
          subtitle={t('notices.refEmail')}
          onPress={() => onCopyContact(e)}
        />
      ))}
    </View>
  );
}

/**
 * 링크·연락처 공통 행.
 *
 * 썸네일 자리(44×44)를 아이콘 타일이나 이미지 중 하나가 채우고, 오른쪽에
 * 제목 + 부제가 붙는다. `NoticeAttachments`의 행과 같은 치수·간격이라
 * 두 목록이 나란히 놓여도 한 덩어리로 읽힌다.
 */
function RefRow({
  Icon,
  title,
  subtitle,
  onPress,
  thumbnailUrl,
  onThumbnailError,
  // 브랜드 그린 타일. `brand`/`brandLight`는 토큰에서 짝으로 정의된 전경/배경
  // 쌍이라 blue500/blue50 자리에 그대로 대응된다. `colorSeeds.primary`
  // (#1f3d2e)를 쓰지 않는 이유는 그 값이 너무 어두워 연한 타일 위에서
  // "초록 아이콘"이 아니라 "검정 아이콘"으로 읽히기 때문 — primary는
  // NoticeRow의 텍스트 강조처럼 흰 배경 위 액센트용이다.
  tint = SdsColors.brand,
  tintBg = SdsColors.brandLight,
}: {
  Icon: typeof LinkSimpleIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
  thumbnailUrl?: string | null;
  onThumbnailError?: () => void;
  tint?: string;
  tintBg?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${subtitle} ${title}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {thumbnailUrl ? (
        <Image
          source={{ uri: thumbnailUrl }}
          style={styles.thumb}
          resizeMode="cover"
          onError={onThumbnailError}
        />
      ) : (
        <View style={[styles.thumb, styles.tile, { backgroundColor: tintBg }]}>
          <Icon size={18} color={tint} />
        </View>
      )}
      <View style={styles.rowBody}>
        <Txt
          typography="t6"
          fontWeight="medium"
          color={SdsColors.grey900}
          numberOfLines={2}
          lineBreakStrategyIOS="hangul-word"
        >
          {title}
        </Txt>
        <Txt typography="t7" color={SdsColors.grey500} numberOfLines={1}>
          {subtitle}
        </Txt>
      </View>
    </Pressable>
  );
}

// ── 본문 이미지 ──

/**
 * 이미지 한 장을 폭 전체로.
 *
 * 크롤러가 alt에 심은 `{WxH}` 힌트로 **로드 전에 비율을 확정**한다(실측
 * 20장 중 18장에 힌트가 있다). 그래서 자리를 미리 정확히 잡아 레이아웃
 * 시프트가 0이다. 힌트가 없는 나머지는 4:3으로 잡았다가 로드 후 실측으로
 * 교정한다.
 *
 * 높이 상한이 필수다 — 실제 공지에 `5244x43450`(세로 8배) 짜리 통짜 스캔
 * 포스터가 있었다. 비율대로 그리면 한 장이 화면 40개 분량을 먹는다.
 */
function BodyImage({
  image,
  sourceUrl,
  onPress,
}: {
  image: ExtractedImage;
  sourceUrl: string;
  onPress: () => void;
}) {
  const { width: screenW } = useWindowDimensions();
  const contentWidth = screenW - 40; // scroll의 좌우 패딩 20
  const hintRatio =
    image.width && image.height ? image.height / image.width : null;
  const [ratio, setRatio] = useState<number | null>(hintRatio);
  const [failed, setFailed] = useState(false);

  const handleLoad = useCallback(
    (e: { nativeEvent: { source: { width: number; height: number } } }) => {
      const { width, height } = e.nativeEvent.source;
      if (width > 0 && height > 0) setRatio(height / width);
    },
    [],
  );

  if (failed) return null;

  const MAX_HEIGHT = 520;
  const naturalHeight = contentWidth * (ratio ?? 0.75);
  const height = Math.min(naturalHeight, MAX_HEIGHT);
  // 상한에 걸려 잘렸다는 걸 알려야 사용자가 "더 있나?"를 안다.
  const isClipped = naturalHeight > MAX_HEIGHT + 1;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={image.alt || undefined}
      style={({ pressed }) => [styles.imageWrap, pressed && styles.pressed]}
    >
      <Image
        source={{ uri: image.url, headers: { Referer: sourceUrl } }}
        style={{ width: contentWidth, height }}
        resizeMode={isClipped ? 'cover' : 'contain'}
        onLoad={handleLoad}
        onError={() => setFailed(true)}
      />
      {isClipped ? (
        <View style={styles.clipHint}>
          <Txt typography="st13" fontWeight="semibold" color="#fff">
            전체 보기
          </Txt>
        </View>
      ) : null}
    </Pressable>
  );
}

// ── 링크 ──

function LinkList({ links }: { links: ExtractedLink[] }) {
  const previews = useLinkPreviews(links.map((l) => l.url));

  return (
    <>
      {links.map((link, i) => (
        <LinkRow key={link.url} link={link} preview={previews[i]?.data ?? null} />
      ))}
    </>
  );
}

function LinkRow({
  link,
  preview,
}: {
  link: ExtractedLink;
  preview: { title: string | null; imageUrl: string | null } | null;
}) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const handleThumbError = useCallback(() => setThumbFailed(true), []);

  // 제목 우선순위: 마크다운 링크 텍스트 → OG 제목 → 도메인.
  // 링크 텍스트를 OG보다 앞에 두는 이유는 그게 **이 공지가 붙인 이름**이라
  // 맥락에 더 맞기 때문이다("공모전 상세 내용 확인하기" vs 사이트 제목).
  // 실측상 링크 텍스트가 있는 경우는 17개 중 3개뿐이라 대개 OG가 이긴다.
  const title = link.text ?? preview?.title ?? link.domain;

  return (
    <RefRow
      Icon={LinkSimpleIcon}
      title={title}
      subtitle={link.domain}
      thumbnailUrl={thumbFailed ? null : preview?.imageUrl}
      onThumbnailError={handleThumbError}
      onPress={() => void Linking.openURL(link.url)}
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    // 위쪽 여백은 본문(SummaryCard.body)의 marginBottom이 진다 — 본문이
    // 없는 공지에서도 간격이 유지되도록 양쪽에 나눠 걸지 않는다.
    gap: 8,
  },
  imageWrap: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: SdsColors.grey100,
  },
  clipHint: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: SdsColors.greyOpacity800,
  },
  // NoticeAttachments의 행과 같은 치수·간격. 두 목록이 위아래로 붙어 있어
  // 값이 어긋나면 바로 티가 난다 — 바꿀 때 함께 맞출 것.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SdsColors.grey200,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: SdsColors.grey100,
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
