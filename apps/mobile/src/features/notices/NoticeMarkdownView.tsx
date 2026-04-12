/**
 * NoticeMarkdownView — GFM body renderer for notice detail.
 *
 * Uses `react-native-marked` (pure JS, marked.js under the hood), but
 * overrides `<img>` with a custom renderer because:
 *
 *   1. SKKU's image server (`www.skku.edu/_attach/...`) requires a `Referer`
 *      header — it returns HTTP 404 to hot-link requests. React Native's
 *      default `<Image>` does not send Referer.
 *   2. The default renderer's image component uses `Image.getSize`, which
 *      drops headers.
 *
 * Crawler produces GFM with absolute URLs baked into `![alt](url)`, so no
 * client-side URL rewriting is needed. Links open in the external browser
 * via the library's default `Linking.openURL` handler — no override needed.
 */

import { Fragment, type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Image,
  type ImageStyle,
  StyleSheet,
  Text,
  type TextStyle,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {
  Renderer,
  useMarkdown,
  type MarkedStyles,
  type RendererInterface,
} from 'react-native-marked';
import { SdsColors } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';

interface Props {
  markdown: string | null;
  /** Full notice page URL — used as the `Referer` header for image fetches. */
  sourceUrl?: string | null;
  /** Called when the user taps a non-web link (email, phone, etc.) with the extracted value. */
  onCopyText?: (text: string) => void;
}

const inAppBrowserOptions: WebBrowser.WebBrowserOpenOptions = {
  presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  controlsColor: '#1A8A5C',
  toolbarColor: '#ffffff',
  dismissButtonStyle: 'close',
  showTitle: true,
  enableBarCollapsing: true,
};

// ── Custom image with Referer header ─────────────────────────────

interface RefererImageProps {
  uri: string;
  alt?: string;
  containerWidth: number;
  referer?: string;
}

/**
 * Renders a remote image with an explicit Referer header. Pre-fetches
 * dimensions via `Image.getSizeWithHeaders` so we can preserve aspect
 * ratio and avoid 0×0 placeholder bugs.
 */
function RefererImage({
  uri,
  alt,
  containerWidth,
  referer,
}: RefererImageProps) {
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
    return (
      <View style={[styles.imagePlaceholder, { width: containerWidth }]} />
    );
  }

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

// ── Custom Renderer subclass ─────────────────────────────────────

class NoticeRenderer extends Renderer implements RendererInterface {
  private readonly containerWidth: number;
  private readonly referer: string | undefined;
  private readonly onCopyText: (text: string) => void;

  constructor(
    containerWidth: number,
    referer: string | undefined,
    onCopyText: (text: string) => void,
  ) {
    super();
    this.containerWidth = containerWidth;
    this.referer = referer;
    this.onCopyText = onCopyText;
  }

  override image(
    uri: string,
    alt?: string,
    _style?: ImageStyle,
    _title?: string,
  ) {
    return (
      <RefererImage
        key={`img-${uri}`}
        uri={uri}
        alt={alt}
        containerWidth={this.containerWidth}
        referer={this.referer}
      />
    );
  }

  override link(
    children: string | ReactNode[],
    href: string,
    styles?: TextStyle,
    title?: string,
  ) {
    // Web links → open in-app browser (SFSafariViewController / Chrome Custom Tabs)
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return (
        <Text
          selectable
          accessibilityRole="link"
          key={this.getKey()}
          onPress={() => void WebBrowser.openBrowserAsync(href, inAppBrowserOptions)}
          style={styles}
        >
          {children}
        </Text>
      );
    }

    // mailto:, tel:, etc. → copy the extracted value
    const value = href.startsWith('mailto:')
      ? href.slice(7)
      : href.startsWith('tel:')
        ? href.slice(4)
        : href;

    return (
      <Text
        selectable
        key={this.getKey()}
        onPress={() => this.onCopyText(value)}
        style={styles}
      >
        {children}
      </Text>
    );
  }

  override paragraph(children: ReactNode[], styles?: ViewStyle) {
    return (
      <Text selectable key={this.getKey()} style={styles as TextStyle}>
        {children}
      </Text>
    );
  }
}

// ── Styles ───────────────────────────────────────────────────────

const headingBase: TextStyle = {
  color: SdsColors.grey900,
  fontWeight: 'bold',
};

const markdownStyles: MarkedStyles = {
  text: {
    fontSize: 17,
    lineHeight: 30,
    color: SdsColors.grey800,
  },
  paragraph: {
    marginVertical: 6,
  },
  h1: { ...headingBase, fontSize: 22, marginTop: 14, marginBottom: 8 },
  h2: { ...headingBase, fontSize: 20, marginTop: 12, marginBottom: 6 },
  h3: { ...headingBase, fontSize: 18, marginTop: 10, marginBottom: 4 },
  h4: { ...headingBase, fontSize: 16, marginTop: 8, marginBottom: 4 },
  h5: { ...headingBase, fontSize: 15, marginTop: 8, marginBottom: 4 },
  h6: { ...headingBase, fontSize: 14, marginTop: 8, marginBottom: 4 },
  link: {
    color: SdsColors.blue500,
    textDecorationLine: 'underline',
  },
  strong: { fontWeight: 'bold', lineHeight: 30 },
  em: { fontStyle: 'italic' },
  strikethrough: { textDecorationLine: 'line-through' },
  li: { marginVertical: 2 },
  table: {
    borderWidth: 1,
    borderColor: SdsColors.grey200,
    marginVertical: 8,
  },
  tableRow: {
    borderBottomWidth: 0.5,
    borderColor: SdsColors.grey200,
  },
  tableCell: {
    padding: 6,
    borderRightWidth: 0.5,
    borderColor: SdsColors.grey200,
  },
  codespan: {
    fontFamily: 'Courier',
    backgroundColor: SdsColors.grey50,
    color: SdsColors.grey800,
  },
  code: {
    backgroundColor: SdsColors.grey50,
    padding: 8,
    marginVertical: 6,
    borderRadius: 6,
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: SdsColors.grey200,
    paddingLeft: 10,
    marginVertical: 6,
  },
};

// ── Component ────────────────────────────────────────────────────

export function NoticeMarkdownView({ markdown, sourceUrl, onCopyText }: Props) {
  const { width } = useWindowDimensions();
  const contentWidth = width - 40;
  const noop = useMemo(() => () => {}, []);

  const renderer = useMemo(
    () => new NoticeRenderer(contentWidth, sourceUrl ?? undefined, onCopyText ?? noop),
    [contentWidth, sourceUrl, onCopyText, noop],
  );

  const elements = useMarkdown(markdown ?? '', { renderer, styles: markdownStyles });

  if (!markdown || markdown.trim() === '') return null;

  return (
    <View>
      {elements.map((element, index) => (
        <Fragment key={index}>{element}</Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
