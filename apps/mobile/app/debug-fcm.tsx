import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { getLocales } from 'expo-localization';
import { Stack } from 'expo-router';
import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  useNotificationStore,
} from '@skkuverse/shared';
import type { AppLanguage } from '@skkuverse/shared';
import {
  ensureRegistered,
  requestPermission,
} from '@/services/messaging';
import { getOrCreateDeviceId } from '@/services/device-id';
import { initializeFirestoreNotifications } from '@/services/firestore-notifications';

/**
 * On-device Phase 2 debug screen — reachable via the persistent red "FCM"
 * floating button on the campus tab (kept intentionally visible even in
 * TestFlight builds so real-device diagnostics are possible without Xcode).
 *
 * Shows: platform + auth + permission + tokens + Zustand store state +
 * Firestore doc existence / contents.
 * Actions: request permission, re-run bootstrap, open OS settings, copy dump.
 */

interface DebugState {
  platform: string;
  appVersion: string;
  // Locale detection
  rawLocales: {
    languageTag: string | null;
    languageCode: string | null;
    regionCode: string | null;
  }[];
  resolvedAppLanguage: string;
  notificationLocale: string;
  // auth
  uid: string | null;
  isAnonymous: boolean | null;
  authProviders: string[];
  // FCM
  permissionStatus: string;
  isRegisteredForRemote: string;
  deviceId: string;
  apnsToken: string | null;
  fcmToken: string | null;
  // Zustand store
  storeFcmToken: string | null;
  storeDeviceId: string | null;
  storeIsTokenRegistered: boolean;
  storePermissionStatus: string;
  storeUnreadCount: number;
  storePrefsEnabled: boolean;
  storePrefsTopics: string[];
  // Firestore
  userDocExists: boolean | null;
  userDocLocale: string | null;
  prefsDocExists: boolean | null;
  prefsEnabled: boolean | null;
  prefsTopics: string[] | null;
  deviceDocExists: boolean | null;
  deviceDocData: Record<string, unknown> | null;
  // error surface
  error: string | null;
}

// Mirror of useAppInit's resolveAppLanguage — debug screen shows the same
// result so we can spot divergence between what the OS offers and what we
// actually pick.
function resolveAppLanguageLocal(): AppLanguage {
  const supported = SUPPORTED_LANGUAGES as readonly string[];
  for (const locale of getLocales()) {
    const code = locale.languageCode;
    if (code && supported.includes(code)) {
      return code as AppLanguage;
    }
  }
  return DEFAULT_LANGUAGE;
}

function toNotificationLocaleLocal(lang: AppLanguage): 'ko' | 'en' {
  return lang === 'en' ? 'en' : 'ko';
}

const INITIAL: DebugState = {
  platform: Platform.OS,
  appVersion: Constants.expoConfig?.version ?? '0.0.0',
  rawLocales: [],
  resolvedAppLanguage: '?',
  notificationLocale: '?',
  uid: null,
  isAnonymous: null,
  authProviders: [],
  permissionStatus: '?',
  isRegisteredForRemote: '?',
  deviceId: '?',
  apnsToken: null,
  fcmToken: null,
  storeFcmToken: null,
  storeDeviceId: null,
  storeIsTokenRegistered: false,
  storePermissionStatus: '?',
  storeUnreadCount: 0,
  storePrefsEnabled: false,
  storePrefsTopics: [],
  userDocExists: null,
  userDocLocale: null,
  prefsDocExists: null,
  prefsEnabled: null,
  prefsTopics: null,
  deviceDocExists: null,
  deviceDocData: null,
  error: null,
};

function authStatusLabel(s: number): string {
  switch (s) {
    case messaging.AuthorizationStatus.AUTHORIZED: return 'authorized';
    case messaging.AuthorizationStatus.PROVISIONAL: return 'provisional';
    case messaging.AuthorizationStatus.DENIED: return 'denied';
    case messaging.AuthorizationStatus.NOT_DETERMINED: return 'notDetermined';
    default: return `unknown(${s})`;
  }
}

export default function DebugFcmScreen() {
  const [state, setState] = useState<DebugState>(INITIAL);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    setBusyLabel('Collecting...');
    const next: DebugState = { ...INITIAL };

    try {
      // Locale detection diagnostics
      next.rawLocales = getLocales().map((l) => ({
        languageTag: l.languageTag ?? null,
        languageCode: l.languageCode ?? null,
        regionCode: l.regionCode ?? null,
      }));
      const resolved = resolveAppLanguageLocal();
      next.resolvedAppLanguage = resolved;
      next.notificationLocale = toNotificationLocaleLocal(resolved);

      const user = getAuth().currentUser;
      next.uid = user?.uid ?? null;
      next.isAnonymous = user?.isAnonymous ?? null;
      next.authProviders = user?.providerData.map((p) => p.providerId) ?? [];

      try {
        const perm = await messaging().hasPermission();
        next.permissionStatus = authStatusLabel(perm);
      } catch (e) {
        next.permissionStatus = `ERR: ${String(e)}`;
      }

      try {
        await ensureRegistered();
        next.isRegisteredForRemote = String(
          messaging().isDeviceRegisteredForRemoteMessages,
        );
      } catch (e) {
        next.isRegisteredForRemote = `ERR: ${String(e)}`;
      }

      next.deviceId = getOrCreateDeviceId();

      if (Platform.OS === 'ios') {
        try {
          for (let i = 0; i < 6; i++) {
            const t = await messaging().getAPNSToken();
            if (t) { next.apnsToken = t; break; }
            await new Promise((r) => setTimeout(r, 500));
          }
        } catch (e) {
          next.apnsToken = `ERR: ${String(e)}`;
        }
      }

      try {
        next.fcmToken = await messaging().getToken();
      } catch (e) {
        next.fcmToken = `ERR: ${String(e)}`;
      }

      const store = useNotificationStore.getState();
      next.storeFcmToken = store.fcmToken;
      next.storeDeviceId = store.deviceId;
      next.storeIsTokenRegistered = store.isTokenRegistered;
      next.storePermissionStatus = store.permissionStatus;
      next.storeUnreadCount = store.unreadCount;
      next.storePrefsEnabled = store.preferences.enabled;
      next.storePrefsTopics = store.preferences.subscribedTopics;

      if (user?.uid) {
        try {
          const userSnap = await firestore()
            .collection('users')
            .doc(user.uid)
            .get();
          next.userDocExists = userSnap.exists();
          if (userSnap.exists()) {
            const data = userSnap.data() as { locale?: string };
            next.userDocLocale = data.locale ?? null;
          }
        } catch (e) {
          next.userDocExists = false;
          next.error = `users/{uid} read: ${String(e)}`;
        }

        try {
          const prefSnap = await firestore()
            .collection('users')
            .doc(user.uid)
            .collection('preferences')
            .doc('main')
            .get();
          next.prefsDocExists = prefSnap.exists();
          if (prefSnap.exists()) {
            const data = prefSnap.data() as {
              enabled?: boolean;
              subscribedTopics?: string[];
            };
            next.prefsEnabled = data.enabled ?? null;
            next.prefsTopics = data.subscribedTopics ?? null;
          }
        } catch (e) {
          next.prefsDocExists = false;
          next.error = (next.error ? next.error + ' | ' : '') +
            `preferences read: ${String(e)}`;
        }

        try {
          const devSnap = await firestore()
            .collection('devices')
            .doc(next.deviceId)
            .get();
          next.deviceDocExists = devSnap.exists();
          if (devSnap.exists()) {
            next.deviceDocData = devSnap.data() ?? null;
          }
        } catch (e) {
          next.deviceDocExists = false;
          next.error = (next.error ? next.error + ' | ' : '') +
            `devices read: ${String(e)}`;
        }
      }
    } catch (e) {
      next.error = (next.error ? next.error + ' | ' : '') + String(e);
    }

    setState(next);
    setBusy(false);
    setBusyLabel('');
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRequestPermission() {
    setBusy(true);
    setBusyLabel('requestPermission()');
    try {
      const status = await requestPermission();
      Alert.alert('requestPermission', `Result: ${status}`);
    } catch (e) {
      Alert.alert('requestPermission error', String(e));
    }
    setBusy(false);
    setBusyLabel('');
    await load();
  }

  async function handleRunBootstrap() {
    setBusy(true);
    setBusyLabel('Running bootstrap...');
    try {
      const user = getAuth().currentUser;
      if (!user) throw new Error('no auth user');
      const token = await messaging().getToken();
      if (!token) throw new Error('no FCM token');
      const deviceId = getOrCreateDeviceId();
      const appVersion = Constants.expoConfig?.version ?? '0.0.0';
      const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';

      const resolved = resolveAppLanguageLocal();
      const osLocale = toNotificationLocaleLocal(resolved);
      await initializeFirestoreNotifications({
        uid: user.uid,
        deviceId,
        token,
        platform,
        appVersion,
        osLocale,
      });
      Alert.alert(
        'Bootstrap OK',
        `locale sent: ${osLocale} (resolved from "${resolved}")`,
      );
    } catch (e) {
      Alert.alert('Bootstrap FAILED', String(e));
    }
    setBusy(false);
    setBusyLabel('');
    await load();
  }

  function handleOpenSettings() {
    Linking.openSettings().catch(() => {});
  }

  async function handleCopyDump() {
    const dump = JSON.stringify(state, null, 2);
    await Clipboard.setStringAsync(dump);
    Alert.alert('Copied', 'Dump copied to clipboard');
  }

  return (
    <>
      <Stack.Screen options={{ title: 'FCM Debug', headerShown: true }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Phase 2 Debug</Text>
        {busy ? <Text style={styles.loading}>⏳ {busyLabel}</Text> : null}

        <Section title="Platform / App">
          <Row label="platform" value={state.platform} />
          <Row label="appVersion" value={state.appVersion} />
        </Section>

        <Section title="Locale detection">
          <Row
            label="resolveAppLanguage()"
            value={state.resolvedAppLanguage}
          />
          <Row
            label="toNotificationLocale()"
            value={state.notificationLocale}
          />
          <Row
            label="raw getLocales() (ordered)"
            value={JSON.stringify(state.rawLocales, null, 2)}
            mono
            onCopy={() =>
              copy(JSON.stringify(state.rawLocales, null, 2))
            }
          />
        </Section>

        <Section title="Auth">
          <Row
            label="uid"
            value={state.uid ?? '(none)'}
            onCopy={state.uid ? () => copy(state.uid!) : undefined}
            mono
          />
          <Row label="isAnonymous" value={String(state.isAnonymous)} />
          <Row
            label="providers"
            value={state.authProviders.join(', ') || '(none)'}
          />
        </Section>

        <Section title="FCM (live)">
          <Row label="permission" value={state.permissionStatus} />
          <Row
            label="isRegisteredForRemote"
            value={state.isRegisteredForRemote}
          />
          <Row
            label="deviceId"
            value={state.deviceId}
            onCopy={() => copy(state.deviceId)}
            mono
          />
          <Row
            label="APNs token"
            value={state.apnsToken ?? '(null)'}
            onCopy={
              state.apnsToken ? () => copy(state.apnsToken!) : undefined
            }
            mono
          />
          <Row
            label="FCM token"
            value={state.fcmToken ?? '(null)'}
            onCopy={state.fcmToken ? () => copy(state.fcmToken!) : undefined}
            mono
          />
        </Section>

        <Section title="Notification store (Zustand)">
          <Row
            label="store.fcmToken"
            value={state.storeFcmToken ? '[present]' : '(null)'}
          />
          <Row
            label="store.deviceId"
            value={state.storeDeviceId ?? '(null)'}
            mono
          />
          <Row
            label="store.isTokenRegistered"
            value={String(state.storeIsTokenRegistered)}
          />
          <Row
            label="store.permissionStatus"
            value={state.storePermissionStatus}
          />
          <Row
            label="store.unreadCount"
            value={String(state.storeUnreadCount)}
          />
          <Row
            label="store.preferences.enabled"
            value={String(state.storePrefsEnabled)}
          />
          <Row
            label="store.preferences.subscribedTopics"
            value={JSON.stringify(state.storePrefsTopics)}
          />
        </Section>

        <Section title="Firestore — users/{uid}">
          <Row label="exists" value={String(state.userDocExists)} />
          <Row label="locale" value={state.userDocLocale ?? '(null)'} />
        </Section>

        <Section title="Firestore — preferences/main">
          <Row label="exists" value={String(state.prefsDocExists)} />
          <Row label="enabled" value={String(state.prefsEnabled)} />
          <Row
            label="subscribedTopics"
            value={JSON.stringify(state.prefsTopics)}
          />
        </Section>

        <Section title="Firestore — devices/{deviceId}">
          <Row label="exists" value={String(state.deviceDocExists)} />
          <Row
            label="data"
            value={
              state.deviceDocData
                ? JSON.stringify(state.deviceDocData, null, 2)
                : '(null)'
            }
            mono
            onCopy={
              state.deviceDocData
                ? () => copy(JSON.stringify(state.deviceDocData, null, 2))
                : undefined
            }
          />
        </Section>

        {state.error ? (
          <Section title="Error">
            <Row label="recent" value={state.error} error />
          </Section>
        ) : null}

        <Pressable style={styles.button} onPress={load}>
          <Text style={styles.buttonText}>🔄 Refresh</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={handleRequestPermission}>
          <Text style={styles.buttonText}>🔔 Request Permission</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.buttonPrimary]}
          onPress={handleRunBootstrap}
        >
          <Text style={[styles.buttonText, styles.buttonTextPrimary]}>
            🚀 Run Bootstrap Now
          </Text>
        </Pressable>
        <Pressable style={styles.button} onPress={handleOpenSettings}>
          <Text style={styles.buttonText}>⚙️ Open iOS Settings</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={handleCopyDump}>
          <Text style={styles.buttonText}>📋 Copy Full Dump (JSON)</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

async function copy(value: string) {
  await Clipboard.setStringAsync(value);
  Alert.alert('Copied', `${value.length} chars to clipboard`);
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </>
  );
}

function Row({
  label,
  value,
  onCopy,
  mono,
  error,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  mono?: boolean;
  error?: boolean;
}) {
  return (
    <Pressable style={styles.row} onPress={onCopy} disabled={!onCopy}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[styles.value, mono && styles.mono, error && styles.error]}
        selectable
      >
        {value}
      </Text>
      {onCopy ? <Text style={styles.copyHint}>tap to copy</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  content: { padding: 20, paddingTop: 40, paddingBottom: 80 },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#58a6ff',
    marginBottom: 16,
  },
  loading: {
    color: '#d29922',
    fontSize: 13,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  row: {
    marginBottom: 10,
    padding: 12,
    backgroundColor: '#161b22',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  label: { fontSize: 11, color: '#8b949e', marginBottom: 4 },
  value: { fontSize: 13, color: '#c9d1d9' },
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
  },
  error: { color: '#f85149' },
  copyHint: { fontSize: 10, color: '#58a6ff', marginTop: 4 },
  button: {
    marginTop: 10,
    padding: 14,
    backgroundColor: '#21262d',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#238636',
    borderColor: '#2ea043',
  },
  buttonText: { color: '#58a6ff', fontSize: 14, fontWeight: '600' },
  buttonTextPrimary: { color: '#ffffff' },
});
