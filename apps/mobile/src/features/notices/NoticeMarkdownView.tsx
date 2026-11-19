/**
 * QUIRK(react-native-marked): `<img>` is overridden because SKKU's image server 404s a request with no
 * Referer, and neither RN's `<Image>` nor the renderer's `Image.getSize` sends one.
 */

import { Fragment, isValidElement, type ReactNode, useEffect, useMemo, useState } from 'react';
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
import {
  Renderer,
  useMarkdown,
  type MarkedStyles,
  type RendererInterface,
} from 'react-native-marked';
import { SdsRadius, SdsSpacing, SdsTypeScale, SdsTypo, wantedSans, type SemanticColors } from '@skkuverse/shared';
import { Pressable, Skeleton, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { logNoticesContentSelect } from '@/platform/analytics';
import { openExternalUrl } from '@/platform/handoff';
import { markdownLinkAction, type MarkdownLinkAction } from './markdown-link.rules';

interface Props {
  markdown: string | null;
  /** WHY: sent as the image fetches' Referer. */
  sourceUrl?: string | null;
  onCopyText?: (text: string) => void;
}

/**
 * CONTRACT(skkuverse-crawler): skkuverse-crawler/py/src/skkuverse_crawler/shared/html_to_markdown.py prefixes
 * an image's alt with `{WxH}`, `{wN}` or `{hN}`; content-refs.rules' parseDimHint reads it too, so change both.
 */
function parseDimHint(alt?: string): {
  width?: number;
  height?: number;
  cleanAlt: string;
} {
  if (!alt) return { cleanAlt: '' };
  const full = alt.match(/^\{(\d+)x(\d+)\}\s?(.*)/s);
  if (full) return { width: +full[1], height: +full[2], cleanAlt: full[3] };
  const wOnly = alt.match(/^\{w(\d+)\}\s?(.*)/s);
  if (wOnly) return { width: +wOnly[1], cleanAlt: wOnly[2] };
  const hOnly = alt.match(/^\{h(\d+)\}\s?(.*)/s);
  if (hOnly) return { height: +hOnly[1], cleanAlt: hOnly[2] };
  return { cleanAlt: alt };
}

interface RefererImageProps {
  uri: string;
  alt?: string;
  containerWidth: number;
  referer?: string;
  hintWidth?: number;
  hintHeight?: number;
}

function RefererImage({
  uri,
  alt,
  containerWidth,
  referer,
  hintWidth,
  hintHeight,
}: RefererImageProps) {
  const styles = useStyles();
  const headers = useMemo<Record<string, string>>(() => {
    const h: Record<string, string> = {};
    if (referer) h.Referer = referer;
    return h;
  }, [referer]);
  // WHY: a result stamped with another request reads as "nothing yet", so a new uri or referer starts
  // clean in the same render, with no effect resetting state behind it.
  const request = `${referer ?? ''}\n${uri}`;
  const [measured, setMeasured] = useState<{ request: string; w: number; h: number } | null>(
    null,
  );
  const [loadedRequest, setLoadedRequest] = useState<string | null>(null);
  const [failedRequest, setFailedRequest] = useState<string | null>(null);
  const size = measured?.request === request ? { w: measured.w, h: measured.h } : null;
  const loaded = loadedRequest === request;
  const failed = failedRequest === request;

  useEffect(() => {
    let cancelled = false;

    Image.getSizeWithHeaders(
      uri,
      headers,
      (w, h) => {
        if (!cancelled) setMeasured({ request, w, h });
      },
      () => {
        if (!cancelled) setFailedRequest(request);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [uri, headers, request]);

  if (failed) {
    return (
      <View style={styles.imageFallback}>
        <Txt typography="t3" color="neutralSubtle">
          {alt ? alt : '이미지를 불러올 수 없어요'}
        </Txt>
      </View>
    );
  }

  // WHY: the hint reserves the exact area before the size fetch returns.
  const dimSource = size ?? (hintWidth && hintHeight ? { w: hintWidth, h: hintHeight } : null);

  if (!dimSource) {
    return (
      <View style={[styles.imagePlaceholder, { width: containerWidth }]} />
    );
  }

  const aspect = dimSource.h / dimSource.w;
  const renderedWidth = Math.min(dimSource.w, containerWidth);
  const renderedHeight = renderedWidth * aspect;

  return (
    <View style={{ width: renderedWidth, height: renderedHeight, marginVertical: SdsSpacing.x2 }}>
      {size ? (
        <Image
          source={{ uri, headers }}
          accessibilityLabel={alt}
          resizeMode="contain"
          onLoad={() => setLoadedRequest(request)}
          onError={() => setFailedRequest(request)}
          style={{ width: renderedWidth, height: renderedHeight }}
        />
      ) : null}
      {!loaded ? (
        <View style={StyleSheet.absoluteFill}>
          <Skeleton.Animate>
            <Skeleton
              width={renderedWidth}
              height={renderedHeight}
              borderRadius={SdsRadius.r2}
            />
          </Skeleton.Animate>
        </View>
      ) : null}
    </View>
  );
}

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
    const { width, height, cleanAlt } = parseDimHint(alt);
    return (
      <RefererImage
        key={`img-${uri}`}
        uri={uri}
        alt={cleanAlt}
        containerWidth={this.containerWidth}
        referer={this.referer}
        hintWidth={width}
        hintHeight={height}
      />
    );
  }

  override link(
    children: string | ReactNode[],
    href: string,
    styles?: TextStyle,
    _title?: string,
  ) {
    const action = markdownLinkAction(href);
    return (
      // eslint-disable-next-line sds/no-rn-text -- a markdown node: react-native-marked hands it its style from the markdown sheet (SdsTypo steps), which a Txt would lay t7 under
      <Text
        selectable
        accessibilityRole={action.kind === 'open' ? 'link' : undefined}
        key={this.getKey()}
        onPress={() => this.follow(action)}
        style={styles}
      >
        {children}
      </Text>
    );
  }

  /** WHY: the library's own linked image opens any scheme through `Linking`, so it takes the same action as a text link. */
  override linkImage(
    href: string,
    imageUrl: string,
    alt?: string,
    style?: ImageStyle,
    title?: string,
  ) {
    const action = markdownLinkAction(href);
    return (
      <Pressable
        key={this.getKey()}
        bg="transparent"
        accessibilityRole={action.kind === 'open' ? 'link' : undefined}
        onPress={() => this.follow(action)}
      >
        {this.image(imageUrl, alt, style, title)}
      </Pressable>
    );
  }

  private follow(action: MarkdownLinkAction) {
    if (action.kind === 'open') {
      logNoticesContentSelect({ content_type: 'detail_markdown_link', item_id: action.url });
      // WHY: the external browser, not the in-app shell: this renders inside a sheet, and a router.push
      // from there lands behind the sheet, so nothing seems to happen.
      void openExternalUrl(action.url);
      return;
    }
    logNoticesContentSelect({ content_type: 'detail_markdown_contact', item_id: action.contact });
    this.onCopyText(action.value);
  }

  // QUIRK(react-native): a Text cannot hold the image's animated skeleton, so a paragraph with an image is a View.
  override paragraph(children: ReactNode[], styles?: ViewStyle) {
    const hasImage = children.some(
      (child) => isValidElement(child) && (child.type === RefererImage || child.type === Pressable),
    );
    if (hasImage) {
      return (
        <View key={this.getKey()} style={styles}>
          {children}
        </View>
      );
    }
    return (
      // eslint-disable-next-line sds/no-rn-text -- a markdown node: react-native-marked hands it its style from the markdown sheet (SdsTypo steps), which a Txt would lay t7 under
      <Text selectable key={this.getKey()} style={styles as TextStyle}>
        {children}
      </Text>
    );
  }
}

/** QUIRK(react-native-marked): it takes a plain style object, so the styles are built from roles, not createThemedStyles. */
function markdownStylesFor(color: SemanticColors): MarkedStyles {
  const headingBase: TextStyle = {
    color: color.fg.neutral,
    ...wantedSans('700'),
  };
  return {
    text: {
      ...SdsTypo.t6Regular,
      color: color.fg.neutral,
    },
    paragraph: {
      marginVertical: SdsSpacing.x1_5,
    },
    h1: { ...headingBase, ...SdsTypeScale.t10, marginTop: SdsSpacing.x3_5, marginBottom: SdsSpacing.x2 },
    h2: { ...headingBase, ...SdsTypeScale.t9, marginTop: SdsSpacing.x3, marginBottom: SdsSpacing.x1_5 },
    h3: { ...headingBase, ...SdsTypeScale.t8, marginTop: SdsSpacing.x2_5, marginBottom: SdsSpacing.x1 },
    h4: { ...headingBase, ...SdsTypeScale.t6, marginTop: SdsSpacing.x2, marginBottom: SdsSpacing.x1 },
    h5: { ...headingBase, ...SdsTypeScale.t5, marginTop: SdsSpacing.x2, marginBottom: SdsSpacing.x1 },
    h6: { ...headingBase, ...SdsTypeScale.t4, marginTop: SdsSpacing.x2, marginBottom: SdsSpacing.x1 },
    link: {
      color: color.fg.informative,
      textDecorationLine: 'underline',
    },
    strong: { ...wantedSans('700') },
    em: { fontStyle: 'italic' },
    strikethrough: { textDecorationLine: 'line-through' },
    li: { marginVertical: SdsSpacing.x0_5 },
    table: {
      borderWidth: 1,
      borderColor: color.stroke.neutralMuted,
      marginVertical: SdsSpacing.x2,
    },
    tableRow: {
      borderBottomWidth: 0.5,
      borderColor: color.stroke.neutralMuted,
    },
    tableCell: {
      padding: SdsSpacing.x1_5,
      borderRightWidth: 0.5,
      borderColor: color.stroke.neutralMuted,
    },
    // QUIRK(react-native-marked): 8.3 spreads this over the surrounding text style, not under it, so the step is restated.
    codespan: {
      ...SdsTypeScale.t6,
      // eslint-disable-next-line sds/no-font-family-literal -- a code span needs a monospace face, and SDS has no mono token yet
      fontFamily: 'Courier',
      backgroundColor: color.bg.neutralMuted,
      color: color.fg.neutral,
    },
    code: {
      backgroundColor: color.bg.neutralMuted,
      padding: SdsSpacing.x2,
      marginVertical: SdsSpacing.x1_5,
      borderRadius: SdsRadius.r1_5,
    },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: color.stroke.neutralMuted,
      paddingLeft: SdsSpacing.x2_5,
      marginVertical: SdsSpacing.x1_5,
    },
  };
}

export function NoticeMarkdownView({ markdown, sourceUrl, onCopyText }: Props) {
  const { width } = useWindowDimensions();
  // WHY: NoticeBodyScreen pads the body 20 on each side; a wider image overflows it.
  const contentWidth = width - 40;
  const noop = useMemo(() => () => {}, []);

  const renderer = useMemo(
    () => new NoticeRenderer(contentWidth, sourceUrl ?? undefined, onCopyText ?? noop),
    [contentWidth, sourceUrl, onCopyText, noop],
  );

  const color = useSemanticColors();
  const markdownStyles = useMemo(() => markdownStylesFor(color), [color]);
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

const useStyles = createThemedStyles(({ color }) => ({
  imagePlaceholder: {
    height: 1,
    marginVertical: SdsSpacing.x1,
  },
  imageFallback: {
    paddingVertical: SdsSpacing.x3,
    paddingHorizontal: SdsSpacing.x3_5,
    marginVertical: SdsSpacing.x2,
    backgroundColor: color.bg.neutralMuted,
    borderRadius: SdsRadius.r2,
    alignItems: 'center',
  },
}));
