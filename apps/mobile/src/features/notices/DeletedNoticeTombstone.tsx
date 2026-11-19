/**
 * WHY: a saved notice that 404s shows its cached fields and a remove action, not a dead end; other 404s
 * stay plain, as the server's notices API decided.
 */

import { View } from 'react-native';
import { TrashIcon } from 'phosphor-react-native';
import {
  useT,
  type BookmarkEntry, SdsRadius, SdsSpacing,
} from '@skkuverse/shared';
import { Button, Callout, Txt, createThemedStyles, useSemanticColors } from '@skkuverse/sds';
import { formatDisplayDate } from './notice-date.rules';

interface Props {
  entry: BookmarkEntry;
  onRemove: () => void;
  isRemoving: boolean;
}

export function DeletedNoticeTombstone({ entry, onRemove, isRemoving }: Props) {
  const color = useSemanticColors();
  const styles = useStyles();
  const { t } = useT();

  return (
    <View style={styles.container}>
      <Callout
        title={t('notices.deletedTombstoneTitle')}
        description={t('notices.deletedTombstoneDescription')}
      />

      <View style={styles.cachedCard}>
        <Txt typography="t9" fontWeight="bold" color="neutral">
          {entry.title}
        </Txt>
        <View style={styles.metaRow}>
          <Txt typography="t5" color="neutralSubtle">
            {formatDisplayDate(entry.date)}
          </Txt>
          {entry.department ? (
            <>
              <Dot />
              <Txt typography="t5" color="neutralSubtle">
                {entry.department}
              </Txt>
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          tone="critical"
          size="medium"
          display="block"
          loading={isRemoving}
          disabled={isRemoving}
          onPress={onRemove}
          leftAccessory={
            <TrashIcon size={18} color={color.fg.onCriticalSolid} weight="regular" />
          }
        >
          {t('notices.deletedRemoveCta')}
        </Button>
      </View>
    </View>
  );
}

function Dot() {
  const styles = useStyles();
  return <View style={styles.dot} />;
}

const useStyles = createThemedStyles(({ color }) => ({
  container: {
    flex: 1,
    paddingHorizontal: SdsSpacing.gutter,
    paddingTop: SdsSpacing.x5,
    paddingBottom: SdsSpacing.x6,
    gap: SdsSpacing.x4,
  },
  cachedCard: {
    backgroundColor: color.bg.layerDefault,
    borderWidth: 1,
    borderColor: color.stroke.neutralMuted,
    borderRadius: SdsRadius.r3,
    padding: SdsSpacing.x4,
    gap: SdsSpacing.x2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SdsSpacing.x1_5,
  },
  dot: {
    width: 2,
    height: 2,
    borderRadius: SdsRadius.full,
    backgroundColor: color.stroke.control,
  },
  actions: {
    marginTop: 'auto',
  },
}));
