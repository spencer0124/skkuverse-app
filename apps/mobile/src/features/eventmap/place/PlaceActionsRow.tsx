/**
 * The place's actions, in the summary rather than the facts card.
 *
 * They live here so the COLLAPSED card carries them: a visitor deciding whether
 * to walk over should be able to open a booth's Instagram or its guide without
 * dragging the sheet open first. The facts card answers where and when; these
 * are what you do about it.
 *
 * Every link leads with a link glyph. A grey pill with a word in it reads as a
 * tag, not a button; the glyph is what says it goes somewhere.
 *
 * A `miniapp` action leads with that mini app's logo, from the registry index,
 * so the pill says it opens inside skkuverse under that service's name rather
 * than in a bare browser. No logo, or one that fails to load, falls back to the
 * link glyph.
 *
 * Instagram leads with its logo instead, which says both where it goes and
 * that it goes somewhere, and carries a fixed call to action rather than the
 * operator's label. The logo alone read as a decoration, not something to
 * press, and the server's label is only ever "인스타그램", which the logo
 * already says.
 *
 * An Instagram with nothing beside it leaves the row for the sheet's title, as
 * `InstagramInlineButton` (`soleInstagram` decides). Every pub is exactly that,
 * and a row for one pill cost the collapsed card a row of its menu and poster.
 *
 * Both handlers dismiss the sheet before they navigate — a portal ordering
 * constraint, see `navigate.ts`.
 */

import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { InstagramLogoIcon, LinkSimpleIcon } from 'phosphor-react-native';
import {
  NAVIGABLE_ACTION_TYPES,
  parseMiniAppTarget,
  pickI18nText,
  SdsColors,
  SdsRadius,
  useMiniAppIndex,
  useSettingsStore,
  useT,
  type MarkerAction,
  type MiniAppLogo,
  type PlaceAction,
  type PlaceInstagramAction,
} from '@skkuverse/shared';
import { Txt } from '@skkuverse/sds';
import { MiniAppEmojiLogo } from '@/components/MiniAppEmojiLogo';
import { SHEET_GUTTER } from './layout';
import { useInstagramNavigate, usePlaceNavigate } from './navigate';

export function PlaceActionsRow({
  actions,
  detailActions,
  onNavigateAway,
}: {
  actions: readonly MarkerAction[];
  detailActions: readonly PlaceAction[];
  onNavigateAway?: () => void;
}) {
  const { t } = useT();
  const lang = useSettingsStore((s) => s.appLanguage);
  const openInstagram = useInstagramNavigate(onNavigateAway);
  const navigate = usePlaceNavigate(onNavigateAway);
  const { data: miniApps } = useMiniAppIndex();

  const instagram = detailActions.find((a) => a.type === 'instagram');
  const links = detailActions.filter((a) => a.type === 'link');
  const legacy = actions.filter((a) => NAVIGABLE_ACTION_TYPES.has(a.actionType));

  if (!instagram && links.length === 0 && legacy.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.scroll, styles.bleed]}
      contentContainerStyle={styles.row}
    >
      {instagram ? (
        <LinkPill
          label={t('eventmap.instagram')}
          icon={<InstagramLogoIcon size={16} color={SdsColors.grey800} />}
          onPress={() => openInstagram(instagram, pickI18nText(instagram.label, lang))}
        />
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
          icon={
            action.actionType === 'miniapp' ? (
              <MiniAppLogoIcon
                logo={
                  miniApps?.find((m) => m.id === parseMiniAppTarget(action.actionValue)?.id)
                    ?.shellLogo
                }
              />
            ) : undefined
          }
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

/**
 * A place's lone Instagram, beside its title: the logo and one short word.
 *
 * Smaller than a row pill, since it rides the title's line rather than a row
 * of its own. The logo is still what says it goes somewhere.
 */
export function InstagramInlineButton({
  action,
  onNavigateAway,
}: {
  action: PlaceInstagramAction;
  onNavigateAway?: () => void;
}) {
  const { t } = useT();
  const lang = useSettingsStore((s) => s.appLanguage);
  const openInstagram = useInstagramNavigate(onNavigateAway);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('eventmap.instagram')}
      hitSlop={8}
      onPress={() => openInstagram(action, pickI18nText(action.label, lang))}
      style={({ pressed }) => [styles.inlinePill, pressed && styles.pressed]}
    >
      <InstagramLogoIcon size={14} color={SdsColors.grey800} />
      <Txt typography="t7" fontWeight="semiBold" color={SdsColors.grey800} numberOfLines={1}>
        {t('eventmap.instagram.inline')}
      </Txt>
    </Pressable>
  );
}

const ICON_SIZE = 16;

function LinkGlyph() {
  return <LinkSimpleIcon size={ICON_SIZE} color={SdsColors.grey800} weight="bold" />;
}

/**
 * The mini app's registry logo — remote image or emoji — or the link glyph
 * when there is none to show, or the remote image fails to load.
 */
function MiniAppLogoIcon({ logo }: { logo: MiniAppLogo | null | undefined }) {
  const uri = logo?.kind === 'remote' ? logo.uri : undefined;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);

  if (logo?.kind === 'emoji') {
    return <MiniAppEmojiLogo emoji={logo.emoji} size={ICON_SIZE} />;
  }
  if (!uri || failed) return <LinkGlyph />;
  return (
    <Image
      source={{ uri }}
      style={styles.miniAppLogo}
      contentFit="cover"
      onError={() => setFailed(true)}
    />
  );
}

function LinkPill({
  label,
  icon = <LinkGlyph />,
  onPress,
}: {
  label: string;
  /** Leads the label. The link glyph, unless the destination has its own mark. */
  icon?: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.linkPill, pressed && styles.pressed]}
    >
      <View style={styles.linkPillContents}>
        {icon}
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
  linkPill: {
    height: PILL_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: SdsRadius.full,
    backgroundColor: SdsColors.grey50,
  },
  // Wide enough for the Instagram pill's full call to action; the row scrolls,
  // so the cap only stops one authored label taking it all.
  linkPillContents: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 208 },
  // Shrinks before the glyph does, so a long label ellipsises instead of
  // pushing the icon out of the pill.
  linkLabel: { flexShrink: 1 },
  miniAppLogo: { width: ICON_SIZE, height: ICON_SIZE, borderRadius: 4 },
  inlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: SdsRadius.full,
    backgroundColor: SdsColors.grey50,
  },
  pressed: { opacity: 0.72 },
});
