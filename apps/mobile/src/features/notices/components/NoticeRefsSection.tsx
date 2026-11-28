import type { ComponentType } from 'react';
import { View } from 'react-native';
import { EnvelopeSimpleIcon, LinkSimpleIcon, PaperclipIcon, PhoneIcon, type IconProps } from 'phosphor-react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { ListRow, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import type { NoticeBriefAttachment, NoticeBriefRefs } from '../notice-brief.types';
import type { NoticeRefLink } from '../notice-refs.types';

interface Props {
  refs: NoticeBriefRefs;
  onAttachmentPress: (attachment: NoticeBriefAttachment) => void;
  onLinkPress: (link: NoticeRefLink) => void;
  onPhonePress: (phone: string) => void;
  onEmailPress: (email: string) => void;
}

export function NoticeRefsSection({ refs, onAttachmentPress, onLinkPress, onPhonePress, onEmailPress }: Props) {
  const styles = useStyles();
  const { t } = useT();

  return (
    <View style={styles.wrap}>
      {refs.attachments.map((attachment) => (
        <RefRow
          key={attachment.url}
          Icon={PaperclipIcon}
          title={attachment.name}
          subtitle={t('notices.attachments')}
          onPress={() => onAttachmentPress(attachment)}
        />
      ))}
      {refs.links.map((link) => (
        <RefRow
          key={link.url}
          Icon={LinkSimpleIcon}
          title={link.domain}
          subtitle={t('notices.brief.link')}
          onPress={() => onLinkPress(link)}
        />
      ))}
      {refs.phones.map((phone) => (
        <RefRow
          key={phone.value}
          Icon={PhoneIcon}
          title={phone.value}
          subtitle={t('notices.refPhone')}
          onPress={() => onPhonePress(phone.value)}
        />
      ))}
      {refs.emails.map((email) => (
        <RefRow
          key={email.value}
          Icon={EnvelopeSimpleIcon}
          title={email.value}
          subtitle={t('notices.refEmail')}
          onPress={() => onEmailPress(email.value)}
        />
      ))}
    </View>
  );
}

function RefRow({
  Icon,
  title,
  subtitle,
  onPress,
}: {
  Icon: ComponentType<IconProps>;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const color = useSemanticColors();
  return (
    <ListRow
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${subtitle} ${title}`}
      verticalPadding="xsmall"
      left={<Icon size={ICON_SIZE} color={color.fg.neutralSubtle} />}
      contents={
        <ListRow.Texts
          layout="2RowTypeA"
          top={title}
          topProps={{ numberOfLines: 2, typography: 't6' }}
          bottom={subtitle}
          bottomProps={{ typography: 't4' }}
        />
      }
      withArrow
    />
  );
}

const ICON_SIZE = 18;

const useStyles = createThemedStyles(() => ({
  wrap: {
    paddingTop: SdsSpacing.x4,
    paddingBottom: SdsSpacing.x4,
  },
}));
