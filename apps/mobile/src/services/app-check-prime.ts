import appCheck from '@react-native-firebase/app-check';
import { logHandledError } from '@/services/crashlytics';

/**
 * Firestore write 직전의 App Check 토큰 준비 — 시간 기반 강제 갱신.
 *
 * 배경 (두 겹의 트레이드오프):
 *
 * 1. 왜 write 전에 토큰을 챙기나 — 알려진 Firebase SDK 버그: stale App Check
 *    토큰이면 로컬 캐시는 mutation을 수락하고 onSnapshot도 에코하지만 서버는
 *    PERMISSION_DENIED, write는 앱 재시작까지 pending-writes 큐에 갇힌다.
 *    사용자 체감은 "설정이 앱 껐다 켜야 반영됨".
 *    refs: flutterfire#12799, firebase-android-sdk#5235 (저장된 토큰이 있으면
 *    auto-refresh가 스케줄되지 않는 안드로이드 이슈).
 *
 * 2. 왜 "매 write마다 getToken(true)"는 안 되나 — 강제 갱신은 매번 Play
 *    Integrity attestation을 호출하는데, 이 API에는 쿼터가 있어 write 밀집
 *    구간(온보딩: 로그인→기기등록→시드→토글)에서 스로틀(-8)에 걸린다.
 *    90일 실측 82명. 스로틀 순간의 시드 write 실패가 "유령 preferences"
 *    버그의 방아쇠였다 — docs/internal/2026-07-notices-picker-ghost-state.md.
 *
 * 절충: 강제 갱신(true)은 FORCE_REFRESH_INTERVAL_MS에 한 번만. 그 사이의
 * write는 getToken(false) — SDK가 유효한 캐시 토큰을 재사용하고, 만료 시에만
 * 스스로 갱신하므로 Integrity 호출이 발생하지 않는다. 토큰 수명(1시간) 대비
 * 5분 주기는 #5235 류의 stale 토큰을 여전히 충분히 커버한다.
 *
 * 갱신 타임스탬프는 모듈 레벨 단일 상태 — notifications/bookmarks 등 모든
 * write 경로가 이 함수를 공유해야 스로틀 예산이 합산 관리된다 (파일별 사본
 * 금지).
 *
 * 실패는 삼킨다 — 갱신이 안 되면 캐시된 토큰으로 write를 진행시킨다.
 * 나쁜 네트워크에서 write를 블록하지 않기 위함이며, 호출자의 withRetry가
 * 실제 write 실패를 처리한다.
 */
const FORCE_REFRESH_INTERVAL_MS = 5 * 60_000;

let lastForcedRefreshAt = 0;

export async function primeAppCheck(): Promise<void> {
  try {
    if (Date.now() - lastForcedRefreshAt < FORCE_REFRESH_INTERVAL_MS) {
      await appCheck().getToken(false);
      return;
    }
    await appCheck().getToken(true);
    lastForcedRefreshAt = Date.now();
  } catch (e) {
    logHandledError('app-check/refresh', e);
  }
}
