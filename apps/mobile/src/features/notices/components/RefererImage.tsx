import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { Skeleton, Txt, createThemedStyles } from '@skkuverse/sds';

interface RefererImageProps {
  uri: string;
  alt?: string;
  containerWidth: number;
  referer?: string;
  hintWidth?: number;
  hintHeight?: number;
}

export function RefererImage({
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
