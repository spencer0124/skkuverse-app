/**
 * 인앱 브라우저 진입 헬퍼.
 *
 * 외부 웹페이지를 expo-web-browser(봉인 시스템 브라우저) 대신 인앱 브라우저 화면으로
 * 연다 — 거기서만 readability 주입·온디바이스 AI(요약/질문/Q&A)가 가능. expo-router의
 * 전역 `router` 싱글톤을 써 훅 없이 어디서든 호출 가능.
 *
 * 스킴 처리:
 *   - http:// → https:// 로 업그레이드. iOS ATS(NSAllowsArbitraryLoads 미설정)가 cleartext
 *     http 로드를 차단하므로, 그대로 띄우면 빈 화면이 된다. 우리 도메인(skku/skkuverse)은
 *     전부 https 지원(student.skku.edu는 http→https 302). 앱 전역 ATS를 낮추는 대신 진입점에서
 *     업그레이드해 보안 유지 + prebuild 불필요.
 *   - http(s) 가 아닌 스킴(mailto:/tel:/itms-apps: 등) → WebView는 렌더 못 하므로 OS로 위임.
 */
import { Linking } from 'react-native';
import { router } from 'expo-router';

export function openInAppBrowser(rawUrl: string, title?: string): void {
  const trimmed = (rawUrl ?? '').trim();
  const url = trimmed.startsWith('http://') ? `https://${trimmed.slice('http://'.length)}` : trimmed;

  // 웹 페이지가 아니면(mailto/tel/itms 등) OS에 위임.
  if (!url.startsWith('https://')) {
    void Linking.openURL(trimmed).catch(() => {});
    return;
  }

  router.push({
    pathname: '/in-app-browser',
    params: { url, title: title ?? '' },
  } as never);
}
