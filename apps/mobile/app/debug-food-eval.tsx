/**
 * 음식 분류 eval 화면 — Apple on-device 임베딩 성능 측정.
 *
 * iOS 17+ 전용. Run 버튼 → 두 축(cuisine / category) 각각:
 *   1. seed split으로 프로토타입 빌드
 *   2. test split에 evaluate 실행
 *   3. accuracy / class별 F1 / confusion matrix / 오분류 목록 렌더
 *
 * 진입: Settings 화면 하단 "🍔 Food Eval" 버튼 또는 /debug-food-eval 직접 push.
 * TODO: 도그푸딩 안정 후 진입 버튼·이 화면 제거.
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import {
  buildPrototypes,
  evaluate,
  FOOD_POSTS,
  type EvalReport,
  type LabeledPost,
} from '@skkuverse/shared';
import { getEmbedInfo, makeAppleEmbedFn, prepareEmbed } from '@/services/apple-embed';
import type { EmbedServiceInfo } from '@/services/apple-embed';

// ──────────────────────────────────────────────────────────────
// 상태 타입
// ──────────────────────────────────────────────────────────────

type Phase =
  | 'idle'
  | 'checking'
  | 'preparing'
  | 'building_cuisine'
  | 'evaluating_cuisine'
  | 'building_category'
  | 'evaluating_category'
  | 'done'
  | 'error';

interface EvalState {
  phase: Phase;
  error?: string;
  info?: EmbedServiceInfo;
  cuisineReport?: EvalReport;
  categoryReport?: EvalReport;
  durationMs?: number;
}

// ──────────────────────────────────────────────────────────────
// 메인 화면
// ──────────────────────────────────────────────────────────────

export default function DebugFoodEvalScreen() {
  const [state, setState] = useState<EvalState>({ phase: 'idle' });

  function set(patch: Partial<EvalState>) {
    setState(prev => ({ ...prev, ...patch }));
  }

  async function handleRun() {
    const t0 = Date.now();
    set({ phase: 'checking', error: undefined, cuisineReport: undefined, categoryReport: undefined });

    try {
      // 1. 에셋 정보 조회
      const info = await getEmbedInfo('ko');
      set({ info });

      // 2. 에셋 준비 — hasAssets: false라도 requestAssets()로 다운로드 가능
      //    prepare() 내부에서 notAvailable이면 throw됨
      set({ phase: 'preparing' });
      await prepareEmbed('ko');

      const embed = makeAppleEmbedFn('ko');
      const seeds = FOOD_POSTS.filter((p: LabeledPost) => p.split === 'seed');
      const tests = FOOD_POSTS.filter((p: LabeledPost) => p.split === 'test');

      // 3a. cuisine 프로토타입 빌드
      set({ phase: 'building_cuisine' });
      const cuisineProtos = await buildPrototypes(seeds, p => p.cuisine, embed);

      // 3b. cuisine 평가
      set({ phase: 'evaluating_cuisine' });
      const cuisineReport = await evaluate(tests, cuisineProtos, p => p.cuisine, embed);

      // 4a. category 프로토타입 빌드
      set({ phase: 'building_category' });
      const categoryProtos = await buildPrototypes(seeds, p => p.category, embed);

      // 4b. category 평가
      set({ phase: 'evaluating_category' });
      const categoryReport = await evaluate(tests, categoryProtos, p => p.category, embed);

      set({
        phase: 'done',
        cuisineReport,
        categoryReport,
        durationMs: Date.now() - t0,
      });
    } catch (e) {
      set({ phase: 'error', error: String(e) });
      Alert.alert('Eval failed', String(e));
    }
  }

  const isBusy = !['idle', 'done', 'error'].includes(state.phase);

  return (
    <>
      <Stack.Screen options={{ title: '🍔 Food Eval', headerShown: true }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* 헤더 */}
        <Text style={styles.title}>Apple Embedding — 음식 분류 실험</Text>
        <Text style={styles.subtitle}>
          {`플랫폼: ${Platform.OS} ${Platform.Version}\n`}
          {`데이터: ${FOOD_POSTS.filter((p: LabeledPost) => p.split === 'seed').length}개 seed · ` +
           `${FOOD_POSTS.filter((p: LabeledPost) => p.split === 'test').length}개 test`}
        </Text>

        {/* 에셋 정보 */}
        {state.info && (
          <Section title="Model Info">
            <Row label="Model ID" value={state.info.modelId} />
            <Row label="Dimension" value={String(state.info.dimension)} />
            <Row label="Max seq len" value={String(state.info.maximumSequenceLength)} />
            <Row label="Languages" value={state.info.languages.join(', ')} />
            <Row label="Has assets" value={state.info.hasAssets ? '✅ yes' : '❌ no'} />
          </Section>
        )}

        {/* Run 버튼 */}
        <Pressable
          style={[styles.runButton, isBusy && styles.runButtonDisabled]}
          onPress={handleRun}
          disabled={isBusy}
        >
          {isBusy
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.runButtonText}>▶ Run Eval</Text>}
        </Pressable>

        {/* 진행 상태 */}
        {isBusy && (
          <Text style={styles.phaseLabel}>{PHASE_LABELS[state.phase] ?? state.phase}</Text>
        )}

        {/* 에러 */}
        {state.phase === 'error' && state.error && (
          <Section title="❌ Error">
            <Text style={styles.errorText}>{state.error}</Text>
          </Section>
        )}

        {/* 결과 */}
        {state.phase === 'done' && state.cuisineReport && state.categoryReport && (
          <>
            <Text style={styles.durationLabel}>
              {`완료 — ${((state.durationMs ?? 0) / 1000).toFixed(1)}s`}
            </Text>
            <ReportSection title="요리 종류 (cuisine)" report={state.cuisineReport} />
            <ReportSection title="음식 카테고리 (category)" report={state.categoryReport} />
          </>
        )}
      </ScrollView>
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// 결과 렌더 컴포넌트
// ──────────────────────────────────────────────────────────────

const PHASE_LABELS: Partial<Record<Phase, string>> = {
  checking: '⏳ 에셋 정보 조회 중...',
  preparing: '⏳ 에셋 다운로드/준비 중... (첫 실행 시 수십 초 소요)',
  building_cuisine: '⏳ Cuisine 프로토타입 빌드 중...',
  evaluating_cuisine: '⏳ Cuisine 평가 중...',
  building_category: '⏳ Category 프로토타입 빌드 중...',
  evaluating_category: '⏳ Category 평가 중...',
};

function ReportSection({ title, report }: { title: string; report: EvalReport }) {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  return (
    <Section title={title}>
      {/* 전체 accuracy */}
      <Row
        label="Accuracy"
        value={`${pct(report.accuracy)} (${
          report.classMetrics.reduce((s, m) => s + m.support, 0) - report.misclassified.length
        } / ${report.classMetrics.reduce((s, m) => s + m.support, 0)})`}
        bold
      />

      {/* 클래스별 F1 */}
      <Text style={styles.subHeader}>Class Metrics</Text>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableCell, styles.tableCellLabel]}>Label</Text>
        <Text style={styles.tableCell}>P</Text>
        <Text style={styles.tableCell}>R</Text>
        <Text style={styles.tableCell}>F1</Text>
        <Text style={styles.tableCell}>N</Text>
      </View>
      {report.classMetrics
        .sort((a, b) => b.f1 - a.f1)
        .map(m => (
          <View key={m.label} style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableCellLabel]}>{m.label}</Text>
            <Text style={styles.tableCell}>{pct(m.precision)}</Text>
            <Text style={styles.tableCell}>{pct(m.recall)}</Text>
            <Text style={[styles.tableCell, f1Color(m.f1)]}>{pct(m.f1)}</Text>
            <Text style={styles.tableCell}>{m.support}</Text>
          </View>
        ))}

      {/* Confusion matrix */}
      <Text style={styles.subHeader}>Confusion Matrix (actual → predicted)</Text>
      <ConfusionMatrix confusion={report.confusion} />

      {/* 오분류 목록 */}
      {report.misclassified.length > 0 && (
        <>
          <Text style={styles.subHeader}>
            {`오분류 ${report.misclassified.length}건`}
          </Text>
          {report.misclassified.map(({ post, predicted, score, actual }) => (
            <View key={post.id} style={styles.misclassCard}>
              <Text style={styles.misclassTitle}>{post.title}</Text>
              <Text style={styles.misclassBody} numberOfLines={2}>{post.body}</Text>
              <Text style={styles.misclassMeta}>
                {`actual: ${actual}  →  predicted: ${predicted}  (score: ${score.toFixed(3)})`}
              </Text>
            </View>
          ))}
        </>
      )}
    </Section>
  );
}

function ConfusionMatrix({ confusion }: { confusion: Record<string, Record<string, number>> }) {
  const labels = Object.keys(confusion);
  if (labels.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View>
        {/* 헤더 행 */}
        <View style={styles.matrixRow}>
          <Text style={[styles.matrixCell, styles.matrixHeaderCell]}>{''}</Text>
          {labels.map(l => (
            <Text key={l} style={[styles.matrixCell, styles.matrixHeaderCell]}>
              {l.slice(0, 3)}
            </Text>
          ))}
        </View>
        {/* 데이터 행 */}
        {labels.map(actual => (
          <View key={actual} style={styles.matrixRow}>
            <Text style={[styles.matrixCell, styles.matrixHeaderCell]}>
              {actual.slice(0, 3)}
            </Text>
            {labels.map(predicted => {
              const count = confusion[actual]?.[predicted] ?? 0;
              return (
                <Text
                  key={predicted}
                  style={[
                    styles.matrixCell,
                    actual === predicted && count > 0 && styles.matrixDiagonal,
                    actual !== predicted && count > 0 && styles.matrixError,
                  ]}
                >
                  {count > 0 ? String(count) : '·'}
                </Text>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
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

function f1Color(f1: number): object {
  if (f1 >= 0.8) return styles.f1Good;
  if (f1 >= 0.5) return styles.f1Mid;
  return styles.f1Bad;
}

// ──────────────────────────────────────────────────────────────
// 스타일
// ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  content: { padding: 16, paddingBottom: 60 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#999', fontSize: 13, marginBottom: 20, lineHeight: 18 },
  durationLabel: { color: '#4caf50', fontSize: 13, marginBottom: 8 },
  phaseLabel: { color: '#aaa', fontSize: 13, textAlign: 'center', marginVertical: 8 },
  errorText: { color: '#ff6b6b', fontSize: 13, lineHeight: 18 },

  runButton: {
    backgroundColor: '#1a7a3c',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginVertical: 12,
  },
  runButtonDisabled: { backgroundColor: '#333' },
  runButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  section: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  sectionTitle: { color: '#aaa', fontSize: 12, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  subHeader: { color: '#888', fontSize: 11, marginTop: 12, marginBottom: 6, fontWeight: '600', textTransform: 'uppercase' },

  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  rowLabel: { color: '#888', fontSize: 13 },
  rowValue: { color: '#ddd', fontSize: 13, flexShrink: 1, textAlign: 'right' },
  rowValueBold: { color: '#fff', fontWeight: '700', fontSize: 15 },

  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: 'row', marginBottom: 3 },
  tableCell: { color: '#bbb', fontSize: 12, width: 60, textAlign: 'right' },
  tableCellLabel: { flex: 1, textAlign: 'left', color: '#ddd' },
  f1Good: { color: '#4caf50' },
  f1Mid: { color: '#ff9800' },
  f1Bad: { color: '#f44336' },

  matrixRow: { flexDirection: 'row' },
  matrixCell: { width: 36, height: 28, textAlign: 'center', textAlignVertical: 'center', fontSize: 11, color: '#bbb', lineHeight: 28 },
  matrixHeaderCell: { color: '#888', fontWeight: '600' },
  matrixDiagonal: { color: '#4caf50', fontWeight: '700' },
  matrixError: { color: '#f44336', fontWeight: '700' },

  misclassCard: { backgroundColor: '#2a1010', borderRadius: 8, padding: 10, marginBottom: 8 },
  misclassTitle: { color: '#ddd', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  misclassBody: { color: '#999', fontSize: 12, marginBottom: 4 },
  misclassMeta: { color: '#f44336', fontSize: 12 },
});
