import { useEffect, useState } from 'react';
import { Text, Pressable, Alert, ScrollView, StyleSheet, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Stack } from 'expo-router';
import messaging from '@react-native-firebase/messaging';
import {
  ensureRegistered,
  requestPermission,
} from '@/services/messaging';
import { getOrCreateDeviceId } from '@/services/device-id';

/**
 * TODO: Remove — temporary debug screen for FCM testing.
 * Shows permission status, device ID, APNs token, FCM token.
 */

interface DebugInfo {
  permissionStatus: string;
  deviceId: string;
  apnsToken: string | null;
  fcmToken: string | null;
  isRegistered: string;
  platform: string;
  error: string | null;
}

export default function DebugFcmScreen() {
  const [info, setInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadInfo() {
    setLoading(true);
    try {
      // requestPermission is idempotent — no dialog if already granted
      const perm = await requestPermission();
      await ensureRegistered();

      const isReg = messaging().isDeviceRegisteredForRemoteMessages;
      const deviceId = getOrCreateDeviceId();

      // Wait a moment for APNs token
      let apnsToken: string | null = null;
      for (let i = 0; i < 6; i++) {
        try {
          apnsToken = await messaging().getAPNSToken();
          if (apnsToken) break;
        } catch { /* keep trying */ }
        await new Promise((r) => setTimeout(r, 500));
      }

      let fcmToken: string | null = null;
      let error: string | null = null;

      if (apnsToken && (perm === 'authorized' || perm === 'provisional')) {
        try {
          fcmToken = await messaging().getToken();
        } catch (e: any) {
          error = e.message || String(e);
        }
      } else if (!apnsToken) {
        error = 'APNs token not received (waited 3s)';
      }

      setInfo({
        permissionStatus: perm,
        deviceId,
        apnsToken,
        fcmToken,
        isRegistered: String(isReg),
        platform: Platform.OS,
        error,
      });
    } catch (e: any) {
      setInfo({
        permissionStatus: 'error',
        deviceId: 'error',
        apnsToken: null,
        fcmToken: null,
        isRegistered: 'error',
        platform: Platform.OS,
        error: e.message || String(e),
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    loadInfo();
  }, []);

  function handleCopy(label: string, value: string | null) {
    if (!value) return;
    Clipboard.setStringAsync(value);
    Alert.alert('Copied', `${label} copied to clipboard`);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'FCM Debug', headerShown: true }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>FCM Debug Info</Text>

        {loading ? (
          <Text style={styles.loading}>Loading... (waiting for APNs token)</Text>
        ) : info ? (
          <>
            <Row label="Platform" value={info.platform} />
            <Row label="Permission" value={info.permissionStatus} />
            <Row label="isRegisteredForRemote" value={info.isRegistered} />
            <Row label="Device ID" value={info.deviceId} onCopy={() => handleCopy('Device ID', info.deviceId)} />
            <Row
              label="APNs Token"
              value={info.apnsToken || '(null)'}
              onCopy={info.apnsToken ? () => handleCopy('APNs Token', info.apnsToken) : undefined}
              mono
            />
            <Row
              label="FCM Token"
              value={info.fcmToken || '(null)'}
              onCopy={info.fcmToken ? () => handleCopy('FCM Token', info.fcmToken) : undefined}
              mono
            />
            {info.error && <Row label="Error" value={info.error} error />}

            <Pressable style={styles.button} onPress={loadInfo}>
              <Text style={styles.buttonText}>Refresh</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
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
        style={[
          styles.value,
          mono && styles.mono,
          error && styles.error,
        ]}
        selectable
      >
        {value}
      </Text>
      {onCopy && <Text style={styles.copyHint}>tap to copy</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  content: { padding: 20, paddingTop: 40 },
  title: { fontSize: 20, fontWeight: '700', color: '#58a6ff', marginBottom: 24 },
  loading: { color: '#8b949e', fontSize: 14 },
  row: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#161b22',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  label: { fontSize: 12, color: '#8b949e', marginBottom: 4 },
  value: { fontSize: 14, color: '#c9d1d9' },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11 },
  error: { color: '#f85149' },
  copyHint: { fontSize: 10, color: '#58a6ff', marginTop: 4 },
  button: {
    marginTop: 12,
    padding: 14,
    backgroundColor: '#21262d',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
    alignItems: 'center',
  },
  buttonText: { color: '#58a6ff', fontSize: 14, fontWeight: '600' },
});
