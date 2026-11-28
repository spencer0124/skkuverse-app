import { View } from 'react-native';
import { useT, SdsSpacing, type TranslationKey } from '@skkuverse/shared';
import { Txt, createThemedStyles } from '@skkuverse/sds';
import { toNoticeAudienceRows, type NoticeAudienceRow } from '../notice-audience.rules';
import type { NoticeAudience, NoticeAudienceLevel, NoticeAudienceStatus } from '../notice-audience.types';

const ROW_KEYS = {
  level: 'notices.audience.level',
  status: 'notices.audience.status',
  excludedStatus: 'notices.audience.excludedStatus',
} as const satisfies Record<NoticeAudienceRow['kind'], TranslationKey>;

const CODE_KEYS = {
  undergrad: 'notices.audience.undergrad',
  grad: 'notices.audience.grad',
  enrolled: 'notices.audience.enrolled',
  leave: 'notices.audience.leave',
  expected_graduate: 'notices.audience.expectedGraduate',
  completed: 'notices.audience.completed',
  research_registered: 'notices.audience.researchRegistered',
  alumni: 'notices.audience.alumni',
} as const satisfies Record<NoticeAudienceLevel | NoticeAudienceStatus, TranslationKey>;

interface Props {
  audience: NoticeAudience;
}

export function NoticeAudienceTable({ audience }: Props) {
  const styles = useStyles();
  const { t } = useT();

  return (
    <View style={styles.table}>
      {toNoticeAudienceRows(audience).map((row) => (
        <View key={row.kind} style={styles.row}>
          <Txt typography="t6" color="neutralSubtle" style={styles.label}>
            {t(ROW_KEYS[row.kind])}
          </Txt>
          <Txt typography="t6" color="neutral" lineBreakStrategyIOS="hangul-word" style={styles.value}>
            {row.codes.map((code: NoticeAudienceLevel | NoticeAudienceStatus) => t(CODE_KEYS[code])).join(t('notices.audience.separator'))}
          </Txt>
        </View>
      ))}
    </View>
  );
}

const useStyles = createThemedStyles(() => ({
  table: {
    paddingHorizontal: SdsSpacing.gutter,
    paddingVertical: SdsSpacing.x6,
    gap: SdsSpacing.x2,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    minWidth: SdsSpacing.x16,
    paddingRight: SdsSpacing.x3,
  },
  value: {
    flex: 1,
  },
}));
