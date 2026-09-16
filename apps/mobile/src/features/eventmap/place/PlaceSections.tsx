/**
 * The blocks below the place sheet's tab bar.
 *
 * Which of these a place gets, and under which tab, is `buildPlaceTabs`'
 * decision (`packages/shared/src/map/placeDetail.ts`). Each block here assumes
 * it has something to draw — an empty one is never mounted — and each is built
 * from SDS list primitives with `ListRow`'s own inset turned off, since the
 * sheet's scroll content already carries the gutter.
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, View, type NativeSyntheticEvent, type TextLayoutEventData } from 'react-native';
import { Image } from 'expo-image';
import {
  ClockIcon,
  CreditCardIcon,
  InstagramLogoIcon,
  MapPinIcon,
  UsersThreeIcon,
} from 'phosphor-react-native';
import {
  groupThousands,
  pickI18nText,
  SdsColors,
  SdsRadius,
  SdsSpacing,
  useSettingsStore,
  useT,
  type I18nText,
  type MarkerAction,
  type PlaceContent,
  type PlaceDetail,
  type PlaceEntryFee,
  type PlaceMenuGroup,
  type PlaceMenuItem,
  type TimeWindow,
} from '@skkuverse/shared';
import { Badge, Border, ListRow, TextButton, Txt } from '@skkuverse/sds';
import { SectionTitle } from './layout';
import { usePlaceNavigate } from './PlaceActions';
import { formatHoursLines } from './placeFormat';

const ICON_SIZE = 20;
const ICON_COLOR = SdsColors.grey500;

// ── 소개 ──────────────────────────────────────────────────────────────────

/** Lines the intro shows before 더보기. */
const INTRO_LINES = 4;

export function IntroSection({ intro, logoUrl }: Pick<PlaceDetail, 'intro' | 'logoUrl'>) {
  const { t } = useT();
  const lang = useSettingsStore((s) => s.appLanguage);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const text = intro ? pickI18nText(intro, lang) : null;

  // Measured on an unclamped copy, because a clamped `Text` reports only the
  // lines it drew and could never say it was cut.
  const onMeasure = useCallback((e: NativeSyntheticEvent<TextLayoutEventData>) => {
    setOverflows(e.nativeEvent.lines.length > INTRO_LINES);
  }, []);

  return (
    <View>
      <SectionTitle>{t('eventmap.section.intro')}</SectionTitle>
      <View style={styles.introRow}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={styles.logo} contentFit="cover" accessibilityIgnoresInvertColors />
        ) : null}
        {text ? (
          <View style={styles.introText}>
            <Txt typography="t6" color={SdsColors.grey800} onTextLayout={onMeasure} style={styles.measure}>
              {text}
            </Txt>
            <Txt typography="t6" color={SdsColors.grey800} numberOfLines={expanded ? undefined : INTRO_LINES}>
              {text}
            </Txt>
            {overflows ? (
              <TextButton
                typography="t7"
                fontWeight="semiBold"
                color={SdsColors.grey600}
                onPress={() => setExpanded((v) => !v)}
                style={styles.moreButton}
              >
                {t(expanded ? 'eventmap.less' : 'eventmap.more')}
              </TextButton>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ── 대표 콘텐츠 ────────────────────────────────────────────────────────────

export function ContentsSection({ contents }: { contents: readonly PlaceContent[] }) {
  const { t } = useT();
  const lang = useSettingsStore((s) => s.appLanguage);
  return (
    <View>
      <SectionTitle>{t('eventmap.section.contents')}</SectionTitle>
      {contents.map((content, i) => (
        <ListRow
          key={`${content.title.ko}-${i}`}
          horizontalPadding={0}
          verticalPadding="extraSmall"
          leftAlignment="top"
          left={
            <Badge size="small" color={SdsColors.brand} backgroundColor={SdsColors.brandLight}>
              {String(i + 1)}
            </Badge>
          }
          contents={
            content.description ? (
              <ListRow.Texts
                type="2RowTypeA"
                top={pickI18nText(content.title, lang)}
                topProps={{ typography: 't6', fontWeight: 'semiBold' }}
                bottom={pickI18nText(content.description, lang)}
                bottomProps={{ typography: 't7' }}
              />
            ) : (
              <ListRow.Texts
                type="1RowTypeA"
                top={pickI18nText(content.title, lang)}
                topProps={{ typography: 't6', fontWeight: 'semiBold' }}
              />
            )
          }
        />
      ))}
    </View>
  );
}

// ── 이용 안내 ──────────────────────────────────────────────────────────────

export function NoticesSection({ notices }: { notices: readonly I18nText[] }) {
  const { t } = useT();
  const lang = useSettingsStore((s) => s.appLanguage);
  return (
    <View>
      <SectionTitle>{t('eventmap.section.notices')}</SectionTitle>
      <View style={styles.bullets}>
        {notices.map((notice, i) => (
          <View key={`${notice.ko}-${i}`} style={styles.bulletRow}>
            <Txt typography="t6" color={SdsColors.grey500}>
              •
            </Txt>
            <Txt typography="t6" color={SdsColors.grey800} style={styles.bulletText}>
              {pickI18nText(notice, lang)}
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

/** The server's own `content` actions, each under its own label. */
export function ProseSection({ actions }: { actions: readonly MarkerAction[] }) {
  const lang = useSettingsStore((s) => s.appLanguage);
  return (
    <View>
      {actions.map((action) => (
        <View key={action.id}>
          <SectionTitle>{pickI18nText(action.label, lang)}</SectionTitle>
          <Txt typography="t6" color={SdsColors.grey800}>
            {action.actionValue}
          </Txt>
        </View>
      ))}
    </View>
  );
}

// ── 메뉴 ──────────────────────────────────────────────────────────────────

export function MenuSection({
  entryFees,
  menu,
}: {
  entryFees: readonly PlaceEntryFee[];
  menu: readonly PlaceMenuGroup[];
}) {
  const { t, tpl } = useT();
  const lang = useSettingsStore((s) => s.appLanguage);
  const groups = menu.filter((g) => g.items.length > 0);

  return (
    <View>
      {entryFees.length > 0 ? (
        <View>
          <SectionTitle>{t('eventmap.section.entryFee')}</SectionTitle>
          {entryFees.map((fee, i) => (
            <PriceRow
              key={`${fee.label.ko}-${i}`}
              name={pickI18nText(fee.label, lang)}
              note={null}
              price={tpl('eventmap.price', groupThousands(fee.price))}
            />
          ))}
        </View>
      ) : null}

      {groups.map((group, gi) => (
        <View key={`${group.title?.ko ?? ''}-${gi}`}>
          <SectionTitle>{group.title ? pickI18nText(group.title, lang) : t('eventmap.tab.menu')}</SectionTitle>
          {group.items.map((item, i) => (
            <React.Fragment key={`${item.name.ko}-${i}`}>
              {i > 0 ? <Border type="full" /> : null}
              <MenuRow item={item} />
            </React.Fragment>
          ))}
        </View>
      ))}

      <Txt typography="t7" color={SdsColors.grey500} style={styles.disclaimer}>
        {t('eventmap.menu.disclaimer')}
      </Txt>
    </View>
  );
}

function MenuRow({ item }: { item: PlaceMenuItem }) {
  const { tpl } = useT();
  const lang = useSettingsStore((s) => s.appLanguage);
  return (
    <PriceRow
      name={pickI18nText(item.name, lang)}
      note={item.note ? pickI18nText(item.note, lang) : null}
      price={item.price !== null ? tpl('eventmap.price', groupThousands(item.price)) : null}
    />
  );
}

function PriceRow({ name, note, price }: { name: string; note: string | null; price: string | null }) {
  return (
    <ListRow
      horizontalPadding={0}
      // Between ListRow's 8 and 16: a price list is scanned, and 16 spread a
      // seven-line menu over most of the sheet.
      containerStyle={styles.priceRow}
      contents={
        note ? (
          <ListRow.Texts
            type="2RowTypeA"
            top={name}
            topProps={{ typography: 't6' }}
            bottom={note}
            bottomProps={{ typography: 't7' }}
          />
        ) : (
          <ListRow.Texts type="1RowTypeC" top={name} topProps={{ color: SdsColors.grey900 }} />
        )
      }
      right={
        price !== null ? (
          <Txt typography="t6" fontWeight="semiBold" color={SdsColors.grey900}>
            {price}
          </Txt>
        ) : undefined
      }
    />
  );
}

// ── 정보 ──────────────────────────────────────────────────────────────────

interface InfoSectionProps {
  detail: PlaceDetail;
  hours: readonly TimeWindow[];
  onNavigateAway?: () => void;
}

export function InfoSection({ detail, hours, onNavigateAway }: InfoSectionProps) {
  const { t } = useT();
  const lang = useSettingsStore((s) => s.appLanguage);
  const navigate = usePlaceNavigate(onNavigateAway);
  const instagramUrl = detail.instagramUrl;

  const hourLines = hours.length > 0 ? formatHoursLines(hours, lang) : [t('eventmap.hours.always')];

  return (
    <View style={styles.info}>
      <InfoRow icon={<ClockIcon size={ICON_SIZE} color={ICON_COLOR} />} label={t('eventmap.info.hours')}>
        {hourLines.join('\n')}
      </InfoRow>
      {detail.locationLabel ? (
        <InfoRow icon={<MapPinIcon size={ICON_SIZE} color={ICON_COLOR} />} label={t('eventmap.info.location')}>
          {pickI18nText(detail.locationLabel, lang)}
        </InfoRow>
      ) : null}
      {detail.org ? (
        <InfoRow icon={<UsersThreeIcon size={ICON_SIZE} color={ICON_COLOR} />} label={t('eventmap.info.org')}>
          {pickI18nText(detail.org, lang)}
        </InfoRow>
      ) : null}
      {detail.paymentMethods.length > 0 ? (
        <InfoRow
          icon={<CreditCardIcon size={ICON_SIZE} color={ICON_COLOR} />}
          label={t('eventmap.info.payment')}
        >
          {detail.paymentMethods.map((m) => pickI18nText(m, lang)).join(' · ')}
        </InfoRow>
      ) : null}
      {instagramUrl ? (
        <InfoRow
          icon={<InstagramLogoIcon size={ICON_SIZE} color={ICON_COLOR} />}
          label={t('eventmap.info.instagram')}
          onPress={() =>
            navigate({
              actionType: 'external',
              actionValue: instagramUrl,
              title: t('eventmap.info.instagram'),
            })
          }
        >
          {instagramUrl.replace(/^https?:\/\/(www\.)?/, '')}
        </InfoRow>
      ) : null}
    </View>
  );
}

function InfoRow({
  icon,
  label,
  children,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  children: string;
  onPress?: () => void;
}) {
  return (
    <ListRow
      horizontalPadding={0}
      verticalPadding="small"
      leftAlignment="top"
      left={<View style={styles.infoIcon}>{icon}</View>}
      contents={
        <ListRow.Texts
          type="2RowTypeC"
          top={label}
          topProps={{ typography: 't7' }}
          bottom={children}
          bottomProps={{ typography: 't6', color: SdsColors.grey900 }}
        />
      }
      withArrow={onPress !== undefined}
      onPress={onPress}
      accessibilityRole={onPress ? 'link' : undefined}
    />
  );
}

const styles = StyleSheet.create({
  introRow: { flexDirection: 'row', gap: SdsSpacing.md },
  logo: {
    width: 56,
    height: 56,
    borderRadius: SdsRadius.md,
    backgroundColor: SdsColors.grey100,
  },
  introText: { flex: 1 },
  // Laid out for its line count only; never seen, never hit-tested.
  measure: { position: 'absolute', left: 0, right: 0, opacity: 0 },
  moreButton: { marginTop: SdsSpacing.xs },
  bullets: { gap: SdsSpacing.sm },
  bulletRow: { flexDirection: 'row', gap: SdsSpacing.sm },
  bulletText: { flex: 1 },
  priceRow: { paddingVertical: SdsSpacing.md },
  disclaimer: { marginTop: SdsSpacing.base },
  info: { paddingTop: SdsSpacing.sm },
  infoIcon: { paddingTop: 2, marginRight: SdsSpacing.xs },
});
