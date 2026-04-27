/**
 * Tombstone view shown when the detail screen 404s for a notice that the
 * user previously bookmarked. Renders cached display fields from the
 * BookmarkEntry — the only place we still have the title/department/date
 * after the server has soft-deleted the notice (server doc §3.15: server
 * returns plain 404, no tombstone payload).
 *
 * Shape decision (vs a pure error screen): a bookmark is a user-asserted
 * "I want to remember this", and silently dead-ending on it betrays that
 * intent. Showing the cached fields plus a "remove from saved" CTA gives
 * the user one final glance + an explicit choice instead of erasing the
 * data automatically. Aligns with the same product principle Pocket /
 * Apple Reading List / Twitter Bookmarks use for dead links.
 *
 * Why this isn't the universal tombstone for every 404: the server team
 * explicitly chose the simple-404 path for non-bookmark traffic
 * (notices-api-architecture.md §3.15). This component scopes the
 * tombstone to the bookmark population only, where the UX cost of a
 * dead-end actually exists.
 */

import { StyleSheet, View } from 'react-native';
import { TrashIcon } from 'phosphor-react-native';
import {
  SdsColors,
  useT,
  type BookmarkEntry,
} from '@skkuverse/shared';
import { Button, Txt } from '@skkuverse/sds';
import { formatDisplayDate } from './utils/formatDisplayDate';

interface Props {
  entry: BookmarkEntry;
  onRemove: () => void;
  isRemoving: boolean;
}

export function DeletedNoticeTombstone({ entry, onRemove, isRemoving }: Props) {
  const { t } = useT();

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Txt typography="t5" fontWeight="bold" color={SdsColors.grey900}>
          {t('notices.deletedTombstoneTitle')}
        </Txt>
        <Txt typography="t6" color={SdsColors.grey600} style={styles.bannerBody}>
          {t('notices.deletedTombstoneDescription')}
        </Txt>
      </View>

      <View style={styles.cachedCard}>
        <Txt typography="t4" fontWeight="bold" color={SdsColors.grey900}>
          {entry.title}
        </Txt>
        <View style={styles.metaRow}>
          <Txt typography="t6" color={SdsColors.grey500}>
            {formatDisplayDate(entry.date)}
          </Txt>
          {entry.department ? (
            <>
              <Dot />
              <Txt typography="t6" color={SdsColors.grey500}>
                {entry.department}
              </Txt>
            </>
          ) : null}
        </View>
        {entry.summaryOneLiner ? (
          <Txt
            typography="t6"
            color={SdsColors.grey700}
            style={styles.summary}
          >
            {entry.summaryOneLiner}
          </Txt>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Button
          type="danger"
          size="large"
          display="block"
          loading={isRemoving}
          disabled={isRemoving}
          onPress={onRemove}
          leftAccessory={
            <TrashIcon size={18} color={SdsColors.background} weight="regular" />
          }
        >
          {t('notices.deletedRemoveCta')}
        </Button>
      </View>
    </View>
  );
}

function Dot() {
  return <View style={styles.dot} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
    gap: 16,
  },
  banner: {
    backgroundColor: SdsColors.grey50,
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  bannerBody: {
    lineHeight: 20,
  },
  cachedCard: {
    backgroundColor: SdsColors.background,
    borderWidth: 1,
    borderColor: SdsColors.grey200,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: SdsColors.grey400,
  },
  summary: {
    marginTop: 4,
    lineHeight: 20,
  },
  actions: {
    marginTop: 'auto',
  },
});
