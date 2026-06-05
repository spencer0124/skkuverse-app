/**
 * 미니앱 셸 진입 헬퍼.
 *
 * 미니앱 = (서비스 이름 + 시작 URL) 두 인자로 정의되는 인앱 브라우저 화면. 외부 웹페이지를
 * expo-web-browser(봉인 시스템 브라우저) 대신 이 셸로 열어 readability 주입·온디바이스
 * AI(요약/질문/Q&A)를 붙인다. expo-router 전역 `router` 싱글톤을 써 훅 없이 호출 가능.
 *
 * 스킴 처리:
 *   - http:// → https:// 업그레이드(iOS ATS가 cleartext http를 차단).
 *   - http(s)가 아닌 스킴(mailto:/tel:/itms-apps: 등) → WebView 렌더 불가라 OS로 위임.
 */
import { Linking } from 'react-native';
import { router } from 'expo-router';

export interface MiniAppParams {
  /** 상단 좌측에 표시할 서비스 이름(헤더 제목). 빈 문자열이면 페이지 타이틀로 폴백. */
  serviceName: string;
  /** 미니앱 시작 URL = 홈 버튼 목적지. */
  startUrl: string;
}

/** http→https 업그레이드 후 web 스킴 여부 반환. */
function normalizeUrl(raw: string): { url: string; isWeb: boolean } {
  const trimmed = (raw ?? '').trim();
  const url = trimmed.startsWith('http://')
    ? `https://${trimmed.slice('http://'.length)}`
    : trimmed;
  return { url, isWeb: url.startsWith('https://') };
}

/** 미니앱(서비스 이름 + 시작 URL)을 셸로 연다. web이 아닌 스킴은 OS로 위임. */
export function openMiniApp({ serviceName, startUrl }: MiniAppParams): void {
  const { url, isWeb } = normalizeUrl(startUrl);
  if (!isWeb) {
    void Linking.openURL((startUrl ?? '').trim()).catch(() => {});
    return;
  }
  router.push({
    pathname: '/in-app-browser',
    params: { serviceName: serviceName ?? '', startUrl: url },
  } as never);
}

/**
 * 단순 외부 링크를 셸로 연다(공지 원문·마크다운 링크·SDUI external 등). 서비스 이름은
 * 선택 — 없으면 헤더가 페이지 타이틀로 폴백. openMiniApp의 얇은 래퍼.
 */
export function openInAppBrowser(url: string, serviceName = ''): void {
  openMiniApp({ serviceName, startUrl: url });
}
