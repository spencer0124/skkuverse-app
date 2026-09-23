/**
 * The place's actions, in the summary rather than the facts card.
 *
 * They live here so the COLLAPSED card carries them: a visitor deciding whether
 * to walk over should be able to open a booth's Instagram or its guide without
 * dragging the sheet open first. The facts card answers where and when; these
 * are what you do about it.
 *
 * Instagram is the logo alone. It is the one destination every kind of place
 * has, the mark is more legible at a glance than the word, and dropping the
 * label leaves room for the authored links beside it.
 *
 * Every other link leads with a link glyph. A grey pill with a word in it reads
 * as a tag, not a button; the glyph is what says it goes somewhere.
 *
 * Both handlers dismiss the sheet before they navigate — a portal ordering
 * constraint, see `navigate.ts`.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { InstagramLogoIcon, LinkSimpleIcon } from 'phosphor-react-native';
import {
  pickI18nText,
  SdsColors,
  SdsRadius,
  useSettingsStore,
  type ActionType,
  type MarkerAction,
  type PlaceAction,
} from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { SHEET_GUTTER } from './layout';
import { useInstagramNavigate, usePlaceNavigate } from './navigate';

/** Actions that go somewhere. `content` is prose and `miniapp` does nothing. */
const NAVIGABLE: ReadonlySet<ActionType> = new Set(['route', 'webview', 'external']);

export function PlaceActionsRow({
  actions,
  detailActions,
  onNavigateAway,
}: {
  actions: readonly MarkerAction[];
  detailActions: readonly PlaceAction[];
  onNavigateAway?: () => void;
}) {
  const lang = useSettingsStore((s) => s.appLanguage);
  const openInstagram = useInstagramNavigate(onNavigateAway);
  const navigate = usePlaceNavigate(onNavigateAway);

  const instagram = detailActions.find((a) => a.type === 'instagram');
  const links = detailActions.filter((a) => a.type === 'link');
  const legacy = actions.filter((a) => NAVIGABLE.has(a.actionType));

  if (!instagram && links.length === 0 && legacy.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.scroll, styles.bleed]}
      contentContainerStyle={styles.row}
    >
      {instagram ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={pickI18nText(instagram.label, lang)}
          onPress={() => openInstagram(instagram, pickI18nText(instagram.label, lang))}
          style={({ pressed }) => [styles.iconPill, pressed && styles.pressed]}
        >
          <InstagramLogoIcon size={20} color={SdsColors.grey800} />
        </Pressable>
      ) : null}

      {links.map((action) => (
        <LinkPill
          key={action.id}
          label={pickI18nText(action.label, lang)}
          onPress={() =>
            navigate({
              actionType: 'external',
              actionValue: action.url,
              title: pickI18nText(action.label, lang),
            })
          }
        />
      ))}

      {legacy.map((action) => (
        <LinkPill
          key={`legacy-${action.id}`}
          label={pickI18nText(action.label, lang)}
          onPress={() =>
            navigate({
              actionType: action.actionType,
              actionValue: action.actionValue,
              title: pickI18nText(action.label, lang),
            })
          }
        />
      ))}
    </ScrollView>
  );
}

function LinkPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.linkPill, pressed && styles.pressed]}
    >
      <View style={styles.linkPillContents}>
        <LinkSimpleIcon size={16} color={SdsColors.grey800} weight="bold" />
        <Txt
          typography="t7"
          fontWeight="semiBold"
          color={SdsColors.grey800}
          numberOfLines={1}
          style={styles.linkLabel}
        >
          {label}
        </Txt>
      </View>
    </Pressable>
  );
}

const PILL_HEIGHT = 36;

const styles = StyleSheet.create({
  // A horizontal ScrollView otherwise claims the summary's spare height.
  scroll: { flexGrow: 0 },
  bleed: { marginHorizontal: -SHEET_GUTTER },
  row: { paddingHorizontal: SHEET_GUTTER, gap: 8, alignItems: 'center' },
  iconPill: {
    width: PILL_HEIGHT,
    height: PILL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SdsRadius.full,
    backgroundColor: SdsColors.grey50,
  },
  linkPill: {
    height: PILL_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: SdsRadius.full,
    backgroundColor: SdsColors.grey50,
  },
  linkPillContents: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 176 },
  // Shrinks before the glyph does, so a long label ellipsises instead of
  // pushing the icon out of the pill.
  linkLabel: { flexShrink: 1 },
  pressed: { opacity: 0.72 },
});
