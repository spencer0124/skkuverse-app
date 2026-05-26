import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Txt } from '@skkuverse/sds';
import { SdsColors, useSettingsStore } from '@skkuverse/shared';

// 워크어라운드 게이트 비밀번호. 보안 자산이 아니라 우발 클릭 방지용이라
// 평문 비교로 충분 (실제 보안은 Firestore rules + Firebase Auth가 담당).
const DEV_PASSWORD = '0001';

export function DeveloperModeScreen() {
  const router = useRouter();
  const developerMode = useSettingsStore((s) => s.developerMode);
  const setDeveloperMode = useSettingsStore((s) => s.setDeveloperMode);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (password === DEV_PASSWORD) {
      setDeveloperMode(true);
      router.back();
      return;
    }
    setError('비밀번호가 올바르지 않습니다');
  }

  function handleDisable() {
    Alert.alert('개발자 모드 비활성화', '비활성화하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '비활성화',
        style: 'destructive',
        onPress: () => {
          setDeveloperMode(false);
          router.back();
        },
      },
    ]);
  }

  if (developerMode) {
    return (
      <View style={styles.container}>
        <Txt typography="t3" style={styles.title}>
          개발자 모드
        </Txt>
        <Txt typography="t6" color={SdsColors.grey500} style={styles.subtitle}>
          현재 활성화되어 있습니다.{'\n'}Android에서 Google 로그인 시도가 가능합니다.
        </Txt>
        <Button type="light" size="big" display="block" onPress={handleDisable}>
          비활성화
        </Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Txt typography="t3" style={styles.title}>
        개발자 모드 활성화
      </Txt>
      <Txt typography="t6" color={SdsColors.grey500} style={styles.subtitle}>
        비밀번호를 입력하세요.
      </Txt>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setError(null);
        }}
        secureTextEntry
        keyboardType="number-pad"
        maxLength={4}
        autoFocus
        placeholder="••••"
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
      />
      {error ? (
        <Txt typography="t7" color={SdsColors.red500} style={styles.error}>
          {error}
        </Txt>
      ) : null}
      <Button
        type="primary"
        size="big"
        display="block"
        onPress={handleSubmit}
        disabled={password.length === 0}
      >
        확인
      </Button>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: SdsColors.background,
  },
  title: {
    marginTop: 24,
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: SdsColors.grey300,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  error: {
    marginBottom: 12,
  },
});
