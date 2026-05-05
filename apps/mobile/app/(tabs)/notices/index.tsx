import { useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useAuthStore, useSettingsStore, useT } from '@skkuverse/shared';
import { NoticesTabScreen } from '@/features/notices/NoticesTabScreen';
import { OnboardingLanding } from '@/features/notices/components/OnboardingLanding';
import { NoticesSearchFallbackBar } from '@/features/notices/components/NoticesSearchFallbackBar';
import { useTabFocusTracking } from '@/hooks/useTabFocusTracking';
import { GoogleAuthError } from '@/services/google-auth';
import {
  signInWithDeviceMigration,
  classifyAndRestoreOnboarding,
} from '@/services/auth-flow';

// iOS 26+ only. False on iOS<26 and Android. Mirrors the predicate used in
// `(tabs)/_layout.tsx:28` — when false, NativeTabs (and bottomAccessory) is
// not in play, so the search-entry UI must come from the screen body
// instead. Module-scope is the project idiom.
const GLASS_AVAILABLE = isLiquidGlassAvailable();

// Native iOS bar (UINavigationBar) handles the top chrome — same
// `unstable_headerRightItems` API as the home tab so profile + kebab buttons
// get the system Liquid Glass capsule treatment automatically. Header
// options are configured in notices/_layout.tsx. The 9-tab strip lives
// inside the SectionList ListHeaderComponent (NoticesTabStrip via
// NoticesTabScreen → NoticeListPanel listHeader prop), preserving the iOS 26
// NativeTabs chain-root rule (RNSScreen subviews[0] = SectionList).
export default function NoticesTab() {
  useTabFocusTracking('notices');
  const router = useRouter();
  const { t } = useT();
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);

  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  // "이미 가입한 적 있어요" 단축경로 — Google 로그인 후 Firestore prefs SSOT
  // 에서 onboardedAt 시그널 + dept 미러를 즉시 가져와서 게이트 해제. listener
  // (useAppInit.ts:240) fallback도 같은 일을 하지만, sign-in 직후 명시 호출
  // 이 flicker window 차단 + 신규 vs 기존 가입자 분기 결정 시점 보장.
  //
  // 'dept' 키 cross-link: classifyAndRestoreOnboarding이 prefs.pickerSelections.dept를
  // read해서 MMKV에 미러. 같은 read는 useAppInit.ts listener에도 존재.
  // server-side functions/src/notifications/tabsContract.ts에도 'dept' picker
  // tab key가 hardcoded — 셋 다 함께 수정 필요한 cross-cutting hard-code.
  async function handleExistingAccountSignIn() {
    if (signingIn) return;
    setSigningIn(true);
    setSignInError(null);
    try {
      const user = await signInWithDeviceMigration('notices');
      const result = await classifyAndRestoreOnboarding(user.uid, 'notices');
      switch (result.kind) {
        case 'restored':
          // 게이트 자동 해제 → NoticesTabScreen 렌더. 라우팅 불필요.
          break;
        case 'read-failed':
          // 동일 화면 유지 → 사용자가 인지 가능하므로 명시 toast.
          setSignInError(t('error.network'));
          break;
        case 'new':
        case 'corrupt':
          // 신규 가입자 또는 corrupt state — wizard 강제. modal stack push.
          router.push('/onboarding');
          break;
      }
    } catch (err) {
      if (err instanceof GoogleAuthError) {
        switch (err.code) {
          case 'DOMAIN_NOT_ALLOWED':
            setSignInError(t('auth.domainNotAllowed'));
            break;
          case 'CANCELLED':
            break;
          case 'PLAY_SERVICES_UNAVAILABLE':
            setSignInError(t('auth.playServicesError'));
            break;
          default:
            setSignInError(t('auth.unknownError'));
        }
      } else {
        setSignInError(t('auth.unknownError'));
      }
    } finally {
      setSigningIn(false);
    }
  }

  // Header (NoticesHeader 9-tab strip) is configured at the Stack layout level
  // — see notices/_layout.tsx. Branches override `headerShown` to gate the
  // 9-tab strip (visible only on the normal branch). Both branches MUST set
  // headerShown explicitly because react-navigation's inline setOptions is
  // sticky: an `isAnonymous` flicker on cold-start (Firebase hydration race)
  // makes the gate branch fire briefly and write `headerShown: false`, which
  // would persist into the normal branch without an explicit re-set here.
  // `<Stack.Screen>` is options-only (no UIView), so it doesn't break the
  // iOS 26 NativeTabs chain-root rule for minimize-on-scroll.
  if (isAnonymous || !onboardingCompleted) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <OnboardingLanding
          onStartPress={() => router.push('/onboarding')}
          onExistingAccountPress={handleExistingAccountSignIn}
          loading={signingIn}
          signInError={signInError}
        />
      </>
    );
  }

  // iOS<26 / Android fallback: bottomAccessory (NoticesAccessoryBar) only
  // mounts on iOS 26 NativeTabs path; pre-26 + Android take JSX <Tabs> with
  // no accessory slot. Mount NoticesSearchFallbackBar as a Fragment sibling
  // so the search entry exists on every OS. iOS 26 keeps `!GLASS_AVAILABLE`
  // false → the bar never mounts there, leaving NoticesTabScreen as the
  // first native subview (RNSScreen subviews[0] = SectionList/FlatList for
  // the chain-root rule). Stack.Screen emits no native view either — only
  // options. The fallback bar is `position: 'absolute'` with `bottom`
  // computed from useBottomTabBarHeight(), so it overlays the list rather
  // than displacing it.
  return (
    <>
      <Stack.Screen options={{ headerShown: true }} />
      <NoticesTabScreen />
      {!GLASS_AVAILABLE && <NoticesSearchFallbackBar />}
    </>
  );
}
