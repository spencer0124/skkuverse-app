import type { ComponentType } from 'react';
import { View } from 'react-native';
import {
  EnvelopeSimpleIcon,
  FileTextIcon,
  LinkSimpleIcon,
  PaperclipIcon,
  PhoneIcon,
  type IconProps,
} from 'phosphor-react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { ListRow, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { sortFormsFirst } from '../notice-brief.rules';
import type { NoticeBriefAttachment, NoticeBriefLink, NoticeBriefRefs } from '../notice-brief.types';

interface Props {
  refs: NoticeBriefRefs;
  onAttachmentPress: (attachment: NoticeBriefAttachment) => void;
  onLinkPress: (link: NoticeBriefLink) => void;
  onPhonePress: (phone: string) => void;
  onEmailPress: (email: string) => void;
}

export function NoticeRefsSection({
  refs,
  onAttachmentPress,
  onLinkPress,
  onPhonePress,
  onEmailPress,
}: Props) {
  const styles = useStyles();
  const { t } = useT();

  return (
    <View style={styles.wrap}>
      {sortFormsFirst(refs.attachments).map((attachment) => (
        <RefRow
          key={attachment.url}
          Icon={attachment.isForm ? FileTextIcon : PaperclipIcon}
          title={attachment.name}
          subtitle={attachment.isForm ? t('notices.brief.form') : t('notices.attachments')}
          onPress={() => onAttachmentPress(attachment)}
        />
      ))}
      {refs.links.map((link) => (
        <RefRow
          key={link.url}
          Icon={LinkSimpleIcon}
          title={link.title ?? link.domain}
          subtitle={link.title ? (link.siteName ?? link.domain) : t('notices.brief.link')}
          onPress={() => onLinkPress(link)}
        />
      ))}
      {refs.phones.map((phone) => (
        <RefRow
          key={phone.number}
          Icon={PhoneIcon}
          title={phone.label ?? phone.number}
          subtitle={phone.label ? phone.number : t('notices.refPhone')}
          onPress={() => onPhonePress(phone.number)}
        />
      ))}
      {refs.emails.map((email) => (
        <RefRow
          key={email.address}
          Icon={EnvelopeSimpleIcon}
          title={email.label ?? email.address}
          subtitle={email.label ? email.address : t('notices.refEmail')}
          onPress={() => onEmailPress(email.address)}
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
      verticalPadding="small"
      left={<Icon size={22} color={color.fg.neutralSubtle} />}
      contents={
        <ListRow.Texts layout="2RowTypeA" top={title} topProps={{ numberOfLines: 2 }} bottom={subtitle} />
      }
      withArrow
    />
  );
}

const useStyles = createThemedStyles(() => ({
  wrap: {
    paddingTop: SdsSpacing.x4,
    paddingBottom: SdsSpacing.x4,
  },
}));
