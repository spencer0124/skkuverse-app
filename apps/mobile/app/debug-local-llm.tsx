/**
 * 로컬 LLM eval 화면 — Kanana 1.5 2.1B Q4_K_M on-device 생성 성능 측정.
 *
 * 상태 머신:
 *   idle → downloading → loading → ready → generating → ready
 *
 * 진입: Settings 화면 하단 "🦙 Local LLM" 버튼 또는 /debug-local-llm 직접 push.
 * TODO: 평가 완료 후 진입 버튼·이 화면 제거.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import type { LlamaLanguageModel } from '@react-native-ai/llama';
import {
  ensureModel,
  initModel,
  makeStreamChatFn,
  releaseModel,
  KANANA_MODEL_ID,
  KANANA_Q4_KM_SIZE_BYTES,
} from '@/services/local-llm';
import type { GenerateResult } from '@skkuverse/shared';

// ──────────────────────────────────────────────────────────────
// 상태 타입
// ──────────────────────────────────────────────────────────────

type Phase =
  | 'idle'
  | 'downloading'
  | 'loading'
  | 'ready'
  | 'generating'
  | 'error';

interface LlmState {
  phase: Phase;
  downloadPct: number;      // 0~100
  error?: string;
  streamedText: string;
  lastResult?: GenerateResult;
}

// ──────────────────────────────────────────────────────────────
// 메인 화면
// ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = '당신은 성균관대학교 캠퍼스 생활을 돕는 AI 어시스턴트입니다. 한국어로 간결하게 답하세요.';
const DEFAULT_USER_PROMPT = '학교 도서관 이용 시간을 알려줘';

export default function DebugLocalLlmScreen() {
  const [state, setState] = useState<LlmState>({
    phase: 'idle',
    downloadPct: 0,
    streamedText: '',
  });
  const [userPrompt, setUserPrompt] = useState(DEFAULT_USER_PROMPT);

  const modelRef = useRef<LlamaLanguageModel | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function set(patch: Partial<LlmState>) {
    setState(prev => ({ ...prev, ...patch }));
  }

  // 화면 종료 시 모델 메모리 해제
  useEffect(() => {
    return () => {
      if (modelRef.current) {
        releaseModel(modelRef.current).catch(console.warn);
        modelRef.current = null;
      }
    };
  }, []);

  // ──────────────────────────────────────────────────────────
  // 모델 로드 핸들러
  // ──────────────────────────────────────────────────────────

  const handleLoadModel = useCallback(async () => {
    if (modelRef.current) {
      // 이미 로드됨
      set({ phase: 'ready' });
      return;
    }

    set({ phase: 'downloading', downloadPct: 0, error: undefined });

    try {
      // 1. 다운로드 (캐시 히트 시 즉시 100%)
      const modelPath = await ensureModel((pct) => {
        set({ downloadPct: pct });
      });

      // 2. initLlama + prepare (Metal 로딩 — 수 초 소요)
      set({ phase: 'loading', downloadPct: 100 });
      const model = await initModel(modelPath);
      modelRef.current = model;

      set({ phase: 'ready' });
    } catch (e) {
      const msg = String(e);
      set({ phase: 'error', error: msg });
      Alert.alert('모델 로드 실패', msg);
    }
  }, []);

  // ──────────────────────────────────────────────────────────
  // 생성 핸들러
  // ──────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!modelRef.current) return;
    if (!userPrompt.trim()) return;

    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    set({ phase: 'generating', streamedText: '', lastResult: undefined, error: undefined });

    const streamChat = makeStreamChatFn(modelRef.current);

    try {
      const result = await streamChat(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt.trim() },
        ],
        (token) => {
          if (abort.signal.aborted) return;
          setState(prev => ({ ...prev, streamedText: prev.streamedText + token }));
        },
        abort.signal,
      );

      if (!abort.signal.aborted) {
        set({ phase: 'ready', lastResult: result });
      }
    } catch (e) {
      if (abort.signal.aborted) {
        set({ phase: 'ready' });
        return;
      }
      const msg = String(e);
      set({ phase: 'error', error: msg });
      Alert.alert('생성 실패', msg);
    }
  }, [userPrompt]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    set({ phase: 'ready' });
  }, []);

  const handleUnload = useCallback(async () => {
    if (!modelRef.current) return;
    await releaseModel(modelRef.current);
    modelRef.current = null;
    set({ phase: 'idle', streamedText: '', lastResult: undefined });
  }, []);

  // ──────────────────────────────────────────────────────────
  // 렌더
  // ──────────────────────────────────────────────────────────

  const { phase, downloadPct, error, streamedText, lastResult } = state;
  const isBusy = phase === 'downloading' || phase === 'loading' || phase === 'generating';
  const isReady = phase === 'ready';
  const modelLoaded = modelRef.current !== null;

  return (
    <>
      <Stack.Screen options={{ title: '🦙 Local LLM Eval', headerShown: true }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* 헤더 정보 */}
        <Text style={styles.title}>Kanana 1.5 2.1B — 온디바이스 LLM 실험</Text>
        <Text style={styles.subtitle}>
          {`플랫폼: ${Platform.OS} ${Platform.Version}\n`}
          {`모델: Q4_K_M  (~${(KANANA_Q4_KM_SIZE_BYTES / 1e9).toFixed(2)} GB)`}
        </Text>
        <Text style={styles.simulatorWarning}>
          ⚠️ 시뮬레이터는 Metal 미가속으로 매우 느림 — 실기기 권장.
          {'\n'}모델 ID: {KANANA_MODEL_ID.split('/').pop()}
        </Text>

        {/* 다운로드 / 로딩 진행 */}
        {(phase === 'downloading' || phase === 'loading') && (
          <Section title={phase === 'loading' ? '⏳ 모델 로딩 중...' : '⬇️ 모델 다운로드 중'}>
            {phase === 'downloading' && (
              <>
                <ProgressBar value={downloadPct} />
                <Text style={styles.progressLabel}>{downloadPct}%</Text>
              </>
            )}
            {phase === 'loading' && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#1a7a3c" />
                <Text style={styles.loadingLabel}>  initLlama + Metal compile...</Text>
              </View>
            )}
          </Section>
        )}

        {/* 모델 로드 / 언로드 버튼 */}
        <View style={styles.buttonRow}>
          {!modelLoaded ? (
            <Pressable
              style={[styles.primaryButton, isBusy && styles.buttonDisabled]}
              onPress={handleLoadModel}
              disabled={isBusy}
            >
              {isBusy && phase !== 'generating'
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryButtonText}>📥 모델 로드</Text>}
            </Pressable>
          ) : (
            <Pressable
              style={[styles.secondaryButton, isBusy && styles.buttonDisabled]}
              onPress={handleUnload}
              disabled={isBusy}
            >
              <Text style={styles.secondaryButtonText}>🗑️ 메모리 해제</Text>
            </Pressable>
          )}
        </View>

        {/* 에러 */}
        {phase === 'error' && error && (
          <Section title="❌ 오류">
            <Text style={styles.errorText}>{error}</Text>
          </Section>
        )}

        {/* 프롬프트 입력 + 생성 버튼 (모델 로드 후) */}
        {(isReady || phase === 'generating') && (
          <Section title="💬 프롬프트">
            <Text style={styles.systemPromptLabel}>시스템: {SYSTEM_PROMPT}</Text>
            <TextInput
              style={styles.promptInput}
              value={userPrompt}
              onChangeText={setUserPrompt}
              multiline
              placeholder="프롬프트를 입력하세요..."
              placeholderTextColor="#555"
              editable={!isBusy}
            />
            <View style={styles.buttonRow}>
              {phase === 'generating' ? (
                <Pressable style={styles.stopButton} onPress={handleStop}>
                  <Text style={styles.stopButtonText}>⏹ 중지</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.primaryButton, !userPrompt.trim() && styles.buttonDisabled]}
                  onPress={handleGenerate}
                  disabled={!userPrompt.trim()}
                >
                  <Text style={styles.primaryButtonText}>▶ 생성</Text>
                </Pressable>
              )}
            </View>
          </Section>
        )}

        {/* 스트리밍 출력 */}
        {(streamedText.length > 0 || phase === 'generating') && (
          <Section title={phase === 'generating' ? '⏳ 생성 중...' : '✅ 생성 결과'}>
            <Text style={styles.outputText} selectable>
              {streamedText || ' '}
            </Text>
          </Section>
        )}

        {/* 성능 지표 */}
        {lastResult && (
          <Section title="📊 성능 지표">
            <Row label="첫 토큰 latency" value={`${lastResult.firstTokenMs} ms`} />
            <Row label="출력 속도" value={`${lastResult.tokPerSec.toFixed(1)} tok/s`} bold />
            <Row label="출력 토큰" value={String(lastResult.outputTokens)} />
            <Row label="입력 토큰" value={String(lastResult.inputTokens)} />
            <Row label="총 토큰" value={String(lastResult.outputTokens + lastResult.inputTokens)} />
          </Section>
        )}

      </ScrollView>
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// 공통 UI 컴포넌트
// ──────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.rowValueBold]}>{value}</Text>
    </View>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%` as unknown as number }]} />
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// 스타일 (debug-food-eval.tsx 팔레트 유지)
// ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  content: { padding: 16, paddingBottom: 60 },

  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#999', fontSize: 13, marginBottom: 8, lineHeight: 18 },
  simulatorWarning: { color: '#ff9800', fontSize: 12, marginBottom: 16, lineHeight: 17 },

  section: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  rowLabel: { color: '#888', fontSize: 13 },
  rowValue: { color: '#ddd', fontSize: 13, flexShrink: 1, textAlign: 'right' },
  rowValueBold: { color: '#fff', fontWeight: '700', fontSize: 15 },

  buttonRow: { marginVertical: 8 },

  primaryButton: {
    backgroundColor: '#1a7a3c',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  secondaryButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  secondaryButtonText: { color: '#aaa', fontSize: 14, fontWeight: '600' },

  stopButton: {
    backgroundColor: '#7a1a1a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  stopButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  buttonDisabled: { opacity: 0.4 },

  progressTrack: {
    height: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1a7a3c',
    borderRadius: 4,
  },
  progressLabel: { color: '#4caf50', fontSize: 13, textAlign: 'right' },

  loadingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  loadingLabel: { color: '#aaa', fontSize: 13 },

  promptInput: {
    backgroundColor: '#111',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    color: '#eee',
    fontSize: 14,
    padding: 10,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  systemPromptLabel: {
    color: '#666',
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 8,
    lineHeight: 16,
  },

  outputText: { color: '#e0e0e0', fontSize: 14, lineHeight: 22 },

  errorText: { color: '#ff6b6b', fontSize: 13, lineHeight: 18 },
});
