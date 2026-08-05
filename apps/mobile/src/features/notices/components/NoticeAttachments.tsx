import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import {
  DownloadSimpleIcon,
  FileIcon,
  FilePdfIcon,
  FilePptIcon,
  FileXlsIcon,
  FileZipIcon,
  ImageIcon,
  PaperclipIcon,
} from 'phosphor-react-native';
import { SdsColors, useT } from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import type { NoticeAttachment } from '@skkuverse/shared';
import {
  buildAttachmentUrl,
  canThumbnail,
  getAttachmentKind,
  getExtensionLabel,
  type AttachmentKind,
} from '../utils/attachment';

interface Props {
  attachments: NoticeAttachment[];
  /** 프록시 Referer로 쓰이는 공지 원문 URL. */
  sourceUrl: string;
  onPreview: (attachment: NoticeAttachment) => void;
  onDownload: (attachment: NoticeAttachment) => void;
}

/**
 * 공지 첨부파일 목록.
 *
 * 이전에는 `grey50` 카드 + "첨부파일" 헤더로 감싸 화면에서 혼자 떠 있었다.
 * 여기서는 헤더와 카드 배경을 걷어내고, 위쪽 속성표·CTA 버튼과 같은
 * `grey100/grey200` 테두리 문법을 쓰는 행 목록으로 흘려보낸다 — 첨부는 별도
 * 섹션이 아니라 "이 공지에서 열어볼 것들" 흐름의 일부다.
 *
 * 미리보기/다운로드 버튼 두 개를 나란히 두던 것도 없앴다. 행 전체가 미리보기고
 * 다운로드만 우측 아이콘 버튼으로 남긴다 — 파일 목록의 보편적 조작이고,
 * 텍스트 버튼 두 개가 파일명보다 시선을 먼저 끌던 문제도 사라진다.
 */
export function NoticeAttachments({
  attachments,
  sourceUrl,
  onPreview,
  onDownload,
}: Props) {
  if (attachments.length === 0) return null;

  return (
    <View style={styles.list}>
      {attachments.map((a) => (
        <AttachmentRow
          key={a.url}
          attachment={a}
          sourceUrl={sourceUrl}
          onPreview={onPreview}
          onDownload={onDownload}
        />
      ))}
    </View>
  );
}

function AttachmentRow({
  attachment,
  sourceUrl,
  onPreview,
  onDownload,
}: {
  attachment: NoticeAttachment;
  sourceUrl: string;
  onPreview: (a: NoticeAttachment) => void;
  onDownload: (a: NoticeAttachment) => void;
}) {
  // 썸네일은 실패할 수 있다: 프록시 허용 호스트가 아니거나(403), gnuboard
  // 세션이 만료됐거나, upstream이 이미지가 아닌 걸 내려주는 경우. 실패하면
  // 깨진 이미지 자리를 남기지 말고 종류 아이콘으로 되돌린다.
  const [thumbFailed, setThumbFailed] = useState(false);
  const { t } = useT();
  const kind = getAttachmentKind(attachment.name);
  const extLabel = getExtensionLabel(attachment.name);

  const showThumb = canThumbnail(attachment.name) && !thumbFailed;
  const handleThumbError = useCallback(() => setThumbFailed(true), []);

  return (
    <Pressable
      onPress={() => onPreview(attachment)}
      accessibilityRole="button"
      // 시각적 "첨부파일" 헤더를 없앴으므로 스크린리더에는 행마다 그 맥락을
      // 실어 준다 — 안 그러면 파일명만 읽혀 이게 뭔지 알 수 없다.
      accessibilityLabel={`${t('notices.attachments')} ${attachment.name}`}
      accessibilityHint={t('notices.preview')}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {showThumb ? (
        <Image
          source={{
            uri: buildAttachmentUrl(
              attachment.url,
              sourceUrl,
              'inline',
              attachment.name,
            ),
          }}
          style={styles.thumb}
          resizeMode="cover"
          onError={handleThumbError}
        />
      ) : (
        <KindTile kind={kind} />
      )}

      <View style={styles.body}>
        <Txt
          typography="t6"
          fontWeight="medium"
          color={SdsColors.grey900}
          numberOfLines={2}
          lineBreakStrategyIOS="hangul-word"
        >
          {attachment.name}
        </Txt>
        {extLabel ? (
          <Txt typography="t7" color={SdsColors.grey500}>
            {extLabel}
          </Txt>
        ) : null}
      </View>

      {/* 다운로드만 별도 히트 영역. hitSlop으로 44pt 터치 타깃을 확보하되
          시각적으로는 32pt 원형이라 파일명보다 앞서 보이지 않는다. */}
      <Pressable
        onPress={() => onDownload(attachment)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('notices.download')}
        style={({ pressed }) => [styles.downloadBtn, pressed && styles.pressed]}
      >
        <DownloadSimpleIcon size={17} color={SdsColors.grey600} />
      </Pressable>
    </Pressable>
  );
}

const KIND_STYLE: Record<
  AttachmentKind,
  { bg: string; fg: string; Icon: typeof FileIcon }
> = {
  image: { bg: SdsColors.blue50, fg: SdsColors.blue500, Icon: ImageIcon },
  pdf: { bg: SdsColors.red50, fg: SdsColors.red500, Icon: FilePdfIcon },
  // 한글(.hwp)·워드는 문서 = 클립 아이콘. Phosphor에 FileDoc은 있지만 워드
  // 전용 글리프라 hwp에 붙이면 오해를 부른다.
  doc: { bg: SdsColors.blue50, fg: SdsColors.blue500, Icon: PaperclipIcon },
  sheet: { bg: SdsColors.green50, fg: SdsColors.green500, Icon: FileXlsIcon },
  slide: { bg: SdsColors.orange50, fg: SdsColors.orange500, Icon: FilePptIcon },
  archive: { bg: SdsColors.grey100, fg: SdsColors.grey600, Icon: FileZipIcon },
  other: { bg: SdsColors.grey100, fg: SdsColors.grey600, Icon: FileIcon },
};

function KindTile({ kind }: { kind: AttachmentKind }) {
  const { bg, fg, Icon } = KIND_STYLE[kind];
  return (
    <View style={[styles.thumb, styles.kindTile, { backgroundColor: bg }]}>
      <Icon size={20} color={fg} />
    </View>
  );
}

const THUMB_SIZE = 44;

const styles = StyleSheet.create({
  list: {
    // 바로 위 NoticeContentRefs(본문에서 뽑은 링크·연락처)와 같은 종류의
    // 목록이라 붙여 둔다. 본문과의 간격은 SummaryCard.body의 marginBottom이
    // 이미 지고 있다.
    gap: 8,
  },
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
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 8,
    backgroundColor: SdsColors.grey100,
  },
  kindTile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 1,
  },
  downloadBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
