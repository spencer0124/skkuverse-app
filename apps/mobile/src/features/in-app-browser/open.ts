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
import { getMiniAppDetailSync, getMiniAppEntrySync } from '@skkuverse/shared';

export interface MiniAppParams {
  /** 상단 좌측에 표시할 서비스 이름(헤더 제목). 빈 문자열이면 페이지 타이틀로 폴백. */
  serviceName: string;
  /** 미니앱 시작 URL = 홈 버튼 목적지. */
  startUrl: string;
  /** 레지스트리 미니앱 slug(있으면 정보 시트·공유 링크·홈 추가가 활성화). */
  id?: string;
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
export function openMiniApp({ serviceName, startUrl, id }: MiniAppParams): void {
  const { url, isWeb } = normalizeUrl(startUrl);
  if (!isWeb) {
    void Linking.openURL((startUrl ?? '').trim()).catch(() => {});
    return;
  }
  router.push({
    pathname: '/in-app-browser',
    params: { serviceName: serviceName ?? '', startUrl: url, ...(id ? { id } : {}) },
  } as never);
}

/**
 * 레지스트리 slug로 미니앱을 연다(홈 타일·딥링크 진입점). 미등록 id면 no-op.
 * serviceName/startUrl은 레지스트리에서 해석 → 호출부 하드코딩 제거(SSOT).
 */
export function openMiniAppById(id: string): void {
  const entry = getMiniAppEntrySync(id);
  const detail = getMiniAppDetailSync(id);
  if (!entry || !detail) return;
  openMiniApp({ id, serviceName: entry.name, startUrl: detail.startUrl });
}

/**
 * 단순 외부 링크를 셸로 연다(공지 원문·마크다운 링크·SDUI external 등). 서비스 이름은
 * 선택 — 없으면 헤더가 페이지 타이틀로 폴백. openMiniApp의 얇은 래퍼.
 */
export function openInAppBrowser(url: string, serviceName = ''): void {
  openMiniApp({ serviceName, startUrl: url });
}
