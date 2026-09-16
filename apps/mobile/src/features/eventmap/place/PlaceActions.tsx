/**
 * The place sheet's button row.
 *
 * Pills in one horizontal line, the way Naver lays out 출발 · 도착 · 공유: the
 * server's `actions` in authored order, then an Instagram pill when the detail
 * carries a link the actions do not already cover. A row that outgrows the card
 * scrolls sideways rather than wrapping, so the summary keeps one height for the
 * fold to be measured against.
 *
 * Only navigable actions become buttons. `content` is prose and is drawn in the
 * home tab instead; `miniapp` and `unknown` render nothing, because a button
 * that does nothing is worse than a missing button.
 */

import React, { useCallback } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useBottomSheetModal } from '@gorhom/bottom-sheet';
import { InstagramLogoIcon } from 'phosphor-react-native';
import {
  pickI18nText,
  SdsColors,
  SdsRadius,
  useSettingsStore,
  useT,
  type ActionType,
  type MarkerAction,
} from '@skkuverse/shared';
import { Button, ThemeProvider } from '@skkuverse/sds';
import { handleSduiAction } from '@/sdui/action-handler';
import { SHEET_GUTTER } from './layout';

/** SDS's primary seed is the app icon's dark green; the map's accent is `brand`. */
const BRAND_THEME = { color: { primary: SdsColors.brand } };

const NAVIGABLE: ReadonlySet<ActionType> = new Set(['route', 'webview', 'external']);

interface PlaceActionsProps {
  actions: readonly MarkerAction[];
  instagramUrl: string | null;
  onNavigateAway?: () => void;
}

export function PlaceActions({ actions, instagramUrl, onNavigateAway }: PlaceActionsProps) {
  const { t } = useT();
  const lang = useSettingsStore((s) => s.appLanguage);

  const buttons = actions.filter((a) => NAVIGABLE.has(a.actionType));
  const showInstagram =
    instagramUrl !== null && !buttons.some((a) => a.actionValue === instagramUrl);

  if (buttons.length === 0 && !showInstagram) return null;

  return (
    <ThemeProvider token={BRAND_THEME}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.row}
      >
        {buttons.map((action) => (
          <ActionPill
            key={action.id}
            label={pickI18nText(action.label, lang)}
            actionType={action.actionType}
            actionValue={action.actionValue}
            primary={action.style === 'primary'}
            onNavigateAway={onNavigateAway}
          />
        ))}
        {showInstagram ? (
          <ActionPill
            label={t('eventmap.info.instagram')}
            actionType="external"
            actionValue={instagramUrl}
            primary={false}
            icon={<InstagramLogoIcon size={16} color={SdsColors.grey900} />}
            onNavigateAway={onNavigateAway}
          />
        ) : null}
      </ScrollView>
    </ThemeProvider>
  );
}

interface ActionPillProps {
  label: string;
  actionType: ActionType;
  actionValue: string;
  primary: boolean;
  icon?: React.ReactNode;
  onNavigateAway?: () => void;
}

function ActionPill({ label, actionType, actionValue, primary, icon, onNavigateAway }: ActionPillProps) {
  const navigate = usePlaceNavigate(onNavigateAway);
  const onPress = useCallback(
    () => navigate({ actionType, actionValue, title: label }),
    [navigate, actionType, actionValue, label],
  );

  return (
    <Button
      size="medium"
      style={primary ? 'fill' : 'weak'}
      color={primary ? undefined : SdsColors.grey900}
      containerStyle={styles.pill}
      leftAccessory={icon}
      onPress={onPress}
    >
      {label}
    </Button>
  );
}

/**
 * Leave the sheet for a link, and come back to it.
 *
 * Shared by the button row and the info tab's link rows, which are the same
 * trip from two places.
 */
export function usePlaceNavigate(onNavigateAway?: () => void) {
  // `dismiss()` with no key closes the top-most modal in the provider's queue,
  // which is this sheet whenever one of its own controls is being pressed.
  const { dismiss } = useBottomSheetModal();

  return useCallback(
    ({ actionType, actionValue, title }: { actionType: ActionType; actionValue: string; title: string }) => {
      // Close BEFORE navigating. A BottomSheetModal does not live in the screen
      // that rendered it: @gorhom/portal mounts the host as a SIBLING THAT
      // FOLLOWS `children` inside BottomSheetModalProvider, which in
      // app/_layout.tsx wraps the root <Stack>. So the sheet is outside the
      // navigator and painted after it — a pushed webview slides in UNDERNEATH
      // and the destination arrives with its bottom half eaten. Nothing about
      // the push can fix that from the other side; the sheet has to go first.
      //
      // Same reason BuildingDetailSheet dismisses before pushing /map/hssc, and
      // the reason NoticeDetailScreen's 원본 공지 보기 hands off to the system
      // browser instead of pushing.
      //
      // The sheet COMES BACK, though — that is what `onNavigateAway` buys. The
      // dismiss below is byte-for-byte the user's own, so the screen has to be
      // told in advance that this one is a round trip: it then keeps
      // `selectedPlaceId` instead of nulling it, and re-presents on focus.
      // `external` opens the in-app webview too, so it takes the same trip.
      onNavigateAway?.();
      dismiss();
      handleSduiAction({
        actionType,
        actionValue,
        // The control's own label titles the webview, so the user lands on a
        // screen named after what they tapped.
        webviewTitle: title,
      });
    },
    [dismiss, onNavigateAway],
  );
}

const styles = StyleSheet.create({
  // Full-bleed so a scrolled row runs to the card's edge instead of being
  // clipped at the gutter; the padding puts the first pill back on it.
  bleed: { marginHorizontal: -SHEET_GUTTER, flexGrow: 0 },
  row: { paddingHorizontal: SHEET_GUTTER, gap: 8 },
  pill: { borderRadius: SdsRadius.full, paddingHorizontal: 18 },
});
