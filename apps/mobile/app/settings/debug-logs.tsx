// RELEASE-GATE(debug-menu): 정식 App Store 출시 전 이 화면 + 진입 row 제거.
// 본인 디바이스 진단 전용. FCM 토큰을 화면에 노출하므로 외부 테스터 환경에서는
// 사용 금지. devLog 버퍼에는 토큰을 적지 않으므로 share/copy로 새지는 않음.
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import messaging from '@react-native-firebase/messaging';
import {
  clearDevLogs,
  formatLogsForShare,
  getDevLogs,
} from '@/services/dev-log';

export default function DebugLogsScreen() {
  const [logs, setLogs] = useState<string>(() => formatLogsForShare());
  const [token, setToken] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLogs(formatLogsForShare());
  }, []);

  useEffect(() => {
    let cancelled = false;
    messaging()
      .getToken()
      .then((t) => {
        if (!cancelled) setToken(t ?? null);
      })
      .catch(() => {
        if (!cancelled) setToken(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 의도: refresh가 logs를 갱신할 때마다 자연스럽게 같이 재계산. getDevLogs()는
  // ring buffer slice이므로 비싼 연산 아님 — useMemo 불필요.
  const entryCount = getDevLogs().length;

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: logs,
        title: 'SKKUverse Debug Logs',
      });
    } catch (e) {
      Alert.alert('공유 실패', String(e));
    }
  }, [logs]);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(logs);
    Alert.alert('복사됨', `${entryCount}개 항목`);
  }, [logs, entryCount]);

  const handleCopyToken = useCallback(async () => {
    if (!token) return;
    await Clipboard.setStringAsync(token);
    Alert.alert('FCM 토큰 복사됨');
  }, [token]);

  const handleClear = useCallback(() => {
    Alert.alert('로그 삭제', '저장된 디버그 로그를 모두 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          clearDevLogs();
          refresh();
        },
      },
    ]);
  }, [refresh]);

  return (
    <View style={styles.container}>
      <View style={styles.tokenBox}>
        <Text style={styles.tokenLabel}>FCM Token</Text>
        <Pressable onLongPress={handleCopyToken}>
          <Text style={styles.tokenValue} selectable numberOfLines={3}>
            {token ?? '(loading…)'}
          </Text>
        </Pressable>
        <Text style={styles.hint}>길게 눌러 복사 — Firebase Console에 붙여넣기 가능</Text>
      </View>

      <View style={styles.toolbar}>
        <Pressable style={styles.btn} onPress={handleShare}>
          <Text style={styles.btnText}>공유</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={handleCopy}>
          <Text style={styles.btnText}>복사</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={refresh}>
          <Text style={styles.btnText}>새로고침</Text>
        </Pressable>
        <Pressable style={[styles.btn, styles.btnDanger]} onPress={handleClear}>
          <Text style={[styles.btnText, styles.btnTextDanger]}>삭제</Text>
        </Pressable>
      </View>

      <Text style={styles.meta}>{entryCount}개 항목</Text>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.logText} selectable>
          {logs || '(로그 없음)'}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  tokenBox: {
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDD',
  },
  tokenLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#444',
    marginBottom: 4,
  },
  tokenValue: {
    fontFamily: 'Courier',
    fontSize: 10,
    color: '#222',
  },
  hint: {
    fontSize: 9,
    color: '#888',
    marginTop: 4,
  },
  toolbar: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDD',
  },
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#EEE',
  },
  btnText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#222',
  },
  btnDanger: {
    backgroundColor: '#FEE',
  },
  btnTextDanger: {
    color: '#C33',
  },
  meta: {
    paddingHorizontal: 12,
    paddingTop: 8,
    fontSize: 11,
    color: '#888',
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 48,
  },
  logText: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: '#222',
    lineHeight: 14,
  },
});
