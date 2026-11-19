import { useMemo } from 'react';
import { Platform, StyleSheet, View, type Animated } from 'react-native';
import type { NativeStackNavigationOptions } from 'expo-router';
import { BookmarkIcon, ShareNetworkIcon } from 'phosphor-react-native';
import { useT, SdsSpacing } from '@skkuverse/shared';
import { useSemanticColors } from '@skkuverse/sds';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { NoticeCollapsedTitle } from './NoticeCollapsedTitle';

const ICON_BOOKMARK = require('../../../../assets/header-icons/bookmark-simple.png');
const ICON_BOOKMARK_FILL = require('../../../../assets/header-icons/bookmark-simple-fill.png');
const ICON_SHARE = require('../../../../assets/header-icons/share-network.png');

interface UseNoticeDetailHeaderOptionsInputs {
  tombstone: boolean;
  saved: boolean;
  onSave(): void;
  onShare(): void;
  collapsedTitle: string | null;
  titleOpacity: Animated.Value;
}

export function useNoticeDetailHeaderOptions({
  tombstone,
  saved,
  onSave,
  onShare,
  collapsedTitle,
  titleOpacity,
}: UseNoticeDetailHeaderOptionsInputs): NativeStackNavigationOptions {
  const { t } = useT();
  const color = useSemanticColors();
  // QUIRK(ios): a stable `identifier` lets iOS 26 match bar items across an assignment and animate only
  // the changed one; `label: ''` keeps the Liquid Glass capsule from flashing its title on each refresh.
  return useMemo<NativeStackNavigationOptions>(() => {
    // WHY: a tombstone hides both buttons: save would early-return on null data, and the shared link 404s.
    const headerTitle = collapsedTitle
      ? () => <NoticeCollapsedTitle title={collapsedTitle} opacity={titleOpacity} />
      : undefined;
    if (tombstone) {
      return Platform.OS === 'ios'
        ? { title: '', unstable_headerRightItems: () => [] }
        : { title: '', headerRight: () => null };
    }
    return Platform.OS === 'ios'
      ? {
          title: '',
          headerTitle,
          unstable_headerRightItems: () => [
            {
              type: 'button' as const,
              identifier: 'bookmark',
              label: '',
              icon: {
                type: 'image' as const,
                source: saved ? ICON_BOOKMARK_FILL : ICON_BOOKMARK,
                tinted: false,
              },
              sharesBackground: false,
              accessibilityLabel: saved ? t('notices.unsave') : t('notices.save'),
              onPress: onSave,
            },
            {
              type: 'button' as const,
              identifier: 'share',
              label: '',
              icon: { type: 'image' as const, source: ICON_SHARE, tinted: false },
              sharesBackground: false,
              accessibilityLabel: t('notices.share'),
              onPress: onShare,
            },
          ],
        }
      : {
          title: '',
          headerTitle,
          headerRight: () => (
            <View style={styles.headerRight}>
              <HeaderIconButton
                onPress={onSave}
                accessibilityLabel={saved ? t('notices.unsave') : t('notices.save')}
              >
                <BookmarkIcon
                  size={22}
                  color={saved ? color.fg.informative : color.fg.neutralMuted}
                  weight={saved ? 'fill' : 'regular'}
                />
              </HeaderIconButton>
              <HeaderIconButton
                onPress={onShare}
                accessibilityLabel={t('notices.share')}
              >
                <ShareNetworkIcon size={22} color={color.fg.neutralMuted} />
              </HeaderIconButton>
            </View>
          ),
        };
  }, [tombstone, saved, t, onSave, onShare, color, collapsedTitle, titleOpacity]);
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    gap: SdsSpacing.x2,
  },
});
