import type { ComponentType } from 'react';
import { Image, ScrollView, View } from 'react-native';
import {
  EnvelopeSimpleIcon,
  FileTextIcon,
  LinkSimpleIcon,
  PaperclipIcon,
  PhoneIcon,
  type IconProps,
} from 'phosphor-react-native';
import { useT, SdsRadius, SdsSpacing } from '@skkuverse/shared';
import { ListHeader, ListRow, Pressable, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { sortFormsFirst } from '../notice-brief.rules';
import type { NoticeBriefAttachment, NoticeBriefLink, NoticeBriefPoster, NoticeBriefRefs } from '../notice-brief.types';

interface Props {
  refs: NoticeBriefRefs;
  posters: NoticeBriefPoster[];
  sourceUrl: string;
  onPosterPress: () => void;
  onAttachmentPress: (attachment: NoticeBriefAttachment) => void;
  onLinkPress: (link: NoticeBriefLink) => void;
  onPhonePress: (phone: string) => void;
  onEmailPress: (email: string) => void;
}

const POSTER_HEIGHT = 168;
const POSTER_FALLBACK_RATIO = 3 / 4;

export function NoticeRefsSection({
  refs,
  posters,
  sourceUrl,
  onPosterPress,
  onAttachmentPress,
  onLinkPress,
  onPhonePress,
  onEmailPress,
}: Props) {
  const styles = useStyles();
  const { t } = useT();

  return (
    <View style={styles.wrap}>
      <ListHeader
        style={styles.header}
        title={
          <ListHeader.TitleParagraph typography="t9" fontWeight="bold">
            {t('notices.brief.refsTitle')}
          </ListHeader.TitleParagraph>
        }
      />
      {posters.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.posters}>
          {posters.map((poster) => (
            <Pressable
              key={poster.url}
              onPress={onPosterPress}
              accessibilityRole="imagebutton"
              accessibilityLabel={t('notices.brief.poster')}
              bg="neutralWeak"
              style={[
                styles.poster,
                { width: POSTER_HEIGHT * posterRatio(poster) },
              ]}
            >
              {/* WHY: sent as Referer, which department servers check to block hotlinking. */}
              <Image
                source={{ uri: poster.url, headers: { Referer: sourceUrl } }}
                style={styles.posterImage}
                resizeMode="cover"
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {sortFormsFirst(refs.attachments).map((attachment) => (
        <RefRow
          key={attachment.url}
          Icon={attachment.isForm ? FileTextIcon : PaperclipIcon}
          title={attachment.name}
          kind={attachment.isForm ? t('notices.brief.form') : t('notices.attachments')}
          onPress={() => onAttachmentPress(attachment)}
        />
      ))}
      {refs.links.map((link) => (
        <RefRow
          key={link.url}
          Icon={LinkSimpleIcon}
          title={link.label ?? link.domain}
          kind={link.label ? link.domain : t('notices.brief.link')}
          onPress={() => onLinkPress(link)}
        />
      ))}
      {refs.phones.map((phone) => (
        <RefRow key={phone} Icon={PhoneIcon} title={phone} kind={t('notices.refPhone')} onPress={() => onPhonePress(phone)} />
      ))}
      {refs.emails.map((email) => (
        <RefRow
          key={email}
          Icon={EnvelopeSimpleIcon}
          title={email}
          kind={t('notices.refEmail')}
          onPress={() => onEmailPress(email)}
        />
      ))}
    </View>
  );
}

function posterRatio(poster: NoticeBriefPoster): number {
  return poster.width && poster.height ? poster.width / poster.height : POSTER_FALLBACK_RATIO;
}

function RefRow({
  Icon,
  title,
  kind,
  onPress,
}: {
  Icon: ComponentType<IconProps>;
  title: string;
  kind: string;
  onPress: () => void;
}) {
  const color = useSemanticColors();
  return (
    <ListRow
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${kind} ${title}`}
      verticalPadding="small"
      left={<Icon size={22} color={color.fg.neutralSubtle} />}
      contents={
        <ListRow.Texts layout="2RowTypeA" top={title} topProps={{ numberOfLines: 2 }} bottom={kind} />
      }
      withArrow
    />
  );
}

const useStyles = createThemedStyles(() => ({
  wrap: {
    paddingBottom: SdsSpacing.x4,
  },
  header: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x8,
    paddingBottom: SdsSpacing.x2,
  },
  posters: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingBottom: SdsSpacing.x3,
    gap: SdsSpacing.x2,
  },
  poster: {
    height: POSTER_HEIGHT,
    borderRadius: SdsRadius.r3,
    overflow: 'hidden',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
}));
