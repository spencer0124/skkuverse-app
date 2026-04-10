/**
 * NoticeHtmlView — HTML body renderer for notice detail.
 *
 * Uses `react-native-render-html` for the markup, but overrides `<img>`
 * with a custom renderer because:
 *
 *   1. SKKU's image server (`www.skku.edu/_attach/...`) requires a `Referer`
 *      header — it returns HTTP 404 to hot-link requests. iOS RCTImageLoader
 *      does not send Referer by default.
 *   2. The default `react-native-render-html` image renderer races on
 *      `Image.getSize` for remote images on RN 0.81 / new arch and shows
 *      the alt-text placeholder instead of the image.
 *
 * Crawler now bakes absolute URLs into `content`, so we no longer need
 * client-side URL rewriting.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Linking,
  useWindowDimensions,
  View,
  StyleSheet,
} from 'react-native';
import RenderHtml, {
  defaultSystemFonts,
  type CustomBlockRenderer,
  type MixedStyleDeclaration,
} from 'react-native-render-html';
import { SdsColors } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';

interface Props {
  html: string | null;
  fallbackText: string | null;
  /** Full notice page URL — used as the `Referer` header for image fetches. */
  sourceUrl?: string | null;
}

const baseStyle: MixedStyleDeclaration = {
  fontSize: 16,
  lineHeight: 26,
  color: SdsColors.grey800,
};

const tagsStyles: Record<string, MixedStyleDeclaration> = {
  a: { color: SdsColors.blue500, textDecorationLine: 'underline' },
  p: { marginVertical: 6 },
  h1: { fontSize: 22, fontWeight: 'bold', marginTop: 14, marginBottom: 8 },
  h2: { fontSize: 20, fontWeight: 'bold', marginTop: 12, marginBottom: 6 },
  h3: { fontSize: 18, fontWeight: 'bold', marginTop: 10, marginBottom: 4 },
  li: { marginVertical: 2 },
  table: { borderWidth: 1, borderColor: SdsColors.grey200 },
  td: { padding: 6, borderWidth: 0.5, borderColor: SdsColors.grey200 },
  th: { padding: 6, borderWidth: 0.5, borderColor: SdsColors.grey200, fontWeight: 'bold' },
};

const systemFonts = [...defaultSystemFonts];

const renderersProps = {
  a: {
    onPress: (_: unknown, href: string) => {
      void Linking.openURL(href).catch(() => {});
    },
  },
};

// ── Custom <img> renderer ─────────────────────────────────────

interface RefererImageProps {
  uri: string;
  alt?: string;
  containerWidth: number;
  referer?: string;
}

/**
 * Renders a remote image with an explicit Referer header. Pre-fetches
 * dimensions via `Image.getSizeWithHeaders` so we can preserve aspect
 * ratio and avoid the 0×0 placeholder bug in `react-native-render-html`.
 */
function RefererImage({ uri, alt, containerWidth, referer }: RefererImageProps) {
  const headers = useMemo<Record<string, string>>(() => {
    const h: Record<string, string> = {};
    if (referer) h.Referer = referer;
    return h;
  }, [referer]);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSize(null);
    setFailed(false);

    Image.getSizeWithHeaders(
      uri,
      headers,
      (w, h) => {
        if (!cancelled) setSize({ w, h });
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [uri, headers]);

  if (failed) {
    return (
      <View style={styles.imageFallback}>
        <Txt typography="t7" color={SdsColors.grey500}>
          {alt ? alt : '이미지를 불러올 수 없어요'}
        </Txt>
      </View>
    );
  }

  if (!size) {
    // Reserve a small slot during dimension fetch to prevent layout jank.
    return <View style={[styles.imagePlaceholder, { width: containerWidth }]} />;
  }

  // Clamp width to container, scale height proportionally.
  const aspect = size.h / size.w;
  const renderedWidth = Math.min(size.w, containerWidth);
  const renderedHeight = renderedWidth * aspect;

  return (
    <Image
      source={{ uri, headers }}
      accessibilityLabel={alt}
      resizeMode="contain"
      style={{
        width: renderedWidth,
        height: renderedHeight,
        marginVertical: 8,
      }}
    />
  );
}

function makeImgRenderer(
  containerWidth: number,
  referer: string | undefined,
): CustomBlockRenderer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Renderer: any = ({ tnode }: { tnode: { attributes: Record<string, string | undefined> } }) => {
    const src = tnode.attributes.src;
    const alt = tnode.attributes.alt;
    if (!src) return null;
    return (
      <RefererImage
        uri={src}
        alt={alt}
        containerWidth={containerWidth}
        referer={referer}
      />
    );
  };
  return Renderer as CustomBlockRenderer;
}

// ── Component ─────────────────────────────────────────────────

export function NoticeHtmlView({ html, fallbackText, sourceUrl }: Props) {
  const { width } = useWindowDimensions();
  const contentWidth = width - 40;

  const renderers = useMemo(
    () => ({ img: makeImgRenderer(contentWidth, sourceUrl ?? undefined) }),
    [contentWidth, sourceUrl],
  );

  const source = useMemo(() => ({ html: html ?? '' }), [html]);

  if (!html || html.trim() === '') {
    return (
      <View style={styles.fallback}>
        <Txt typography="t6" color={SdsColors.grey700}>
          {fallbackText ?? ''}
        </Txt>
      </View>
    );
  }

  return (
    <RenderHtml
      contentWidth={contentWidth}
      source={source}
      baseStyle={baseStyle}
      tagsStyles={tagsStyles}
      renderers={renderers}
      renderersProps={renderersProps}
      systemFonts={systemFonts}
      enableExperimentalMarginCollapsing
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    paddingVertical: 8,
  },
  imagePlaceholder: {
    height: 1,
    marginVertical: 4,
  },
  imageFallback: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginVertical: 8,
    backgroundColor: SdsColors.grey50,
    borderRadius: 8,
    alignItems: 'center',
  },
});
