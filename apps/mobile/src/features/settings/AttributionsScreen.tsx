import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Txt } from '@skkuverse/sds';
import { SdsColors, SdsSpacing, useT, type TranslationKey } from '@skkuverse/shared';

interface AttributionEntry {
  nameKey: TranslationKey;
  url: string;
  providerKey: TranslationKey;
  descKey: TranslationKey;
}

const ENTRIES: AttributionEntry[] = [
  {
    nameKey: 'campus.hsscMap',
    url: 'https://www.skku.edu',
    providerKey: 'attribution.skku',
    descKey: 'attribution.officialData',
  },
  {
    nameKey: 'campus.nscMap',
    url: 'https://www.skku.edu',
    providerKey: 'attribution.skku',
    descKey: 'attribution.officialData',
  },
  {
    nameKey: 'attribution.shuttle',
    url: 'https://www.skku.edu',
    providerKey: 'attribution.skku',
    descKey: 'attribution.officialTransit',
  },
];

const inAppBrowserOptions: WebBrowser.WebBrowserOpenOptions = {
  presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  controlsColor: '#1A8A5C',
  toolbarColor: '#ffffff',
  dismissButtonStyle: 'close',
  showTitle: true,
  enableBarCollapsing: true,
};

export function AttributionsScreen() {
  const { t } = useT();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Txt typography="t6" color={SdsColors.grey600}>
          {t('attribution.notice')}
        </Txt>
        <View style={styles.divider} />
      </View>
      {ENTRIES.map((entry) => (
        <AttributionRow key={entry.nameKey} entry={entry} />
      ))}
    </ScrollView>
  );
}

function AttributionRow({ entry }: { entry: AttributionEntry }) {
  const { t } = useT();

  return (
    <View style={styles.row}>
      <Txt typography="t4" fontWeight="bold" color={SdsColors.grey900}>
        {t(entry.nameKey)}
      </Txt>
      <Pressable onPress={() => void WebBrowser.openBrowserAsync(entry.url, inAppBrowserOptions)}>
        <Txt typography="t6" color={SdsColors.brand} style={styles.link}>
          {entry.url}
        </Txt>
      </Pressable>
      <Txt typography="t6" color={SdsColors.grey500}>
        {t(entry.providerKey)}
      </Txt>
      <Txt typography="t6" color={SdsColors.grey500}>
        {`▶ ${t(entry.descKey)}`}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SdsColors.background,
  },
  content: {
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: SdsSpacing.lg,
    paddingTop: SdsSpacing.md,
    paddingBottom: SdsSpacing.lg,
    gap: SdsSpacing.lg,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: SdsColors.grey200,
  },
  row: {
    paddingHorizontal: SdsSpacing.lg,
    paddingVertical: SdsSpacing.md,
    gap: SdsSpacing.xxs,
  },
  link: {
    textDecorationLine: 'underline',
  },
});
