# FCM 학과별 푸시 알림 구현 계획

## Context

스꾸버스 앱에 학과별 공지사항 푸시 알림 기능을 추가한다. `@react-native-firebase/*` 네이티브 모듈 5개(app, auth, analytics, crashlytics, app-check)가 이미 설치된 상태.

**기술 스택:** FCM 직접 (`@react-native-firebase/messaging`) + Notifee (`@notifee/react-native`) + Firestore (`@react-native-firebase/firestore`) + iOS NSE

**배포 전략:** Phase 1→2→3→4 순서로 개발, **앱스토어에는 Phase 4 완료 후 한 번에 릴리즈**. 유저가 처음 받는 버전이 NSE + 다국어 완전 버전. 과도기 없음.

**데이터 아키텍처:**
```
┌─────────────────────────┬──────────────────────────┐
│ Firebase (Firestore)    │ MongoDB (Node 관리)      │
├─────────────────────────┼──────────────────────────┤
│ 유저 정보                │ 버스 데이터               │
│ 디바이스/토큰            │ 공지 데이터               │
│ 알림 구독 preferences    │ 셔틀 시간표              │
│ 유저 설정 (locale 등)    │ 학과 정보                │
│                         │ 크롤링 결과              │
└─────────────────────────┴──────────────────────────┘
```
- 앱 → Firestore 직접 읽기/쓰기 (디바이스 등록, 구독 관리, 유저 설정)
- Node 서버 → 공지 발행 시 Cloud Function HTTP 호출만 (Firebase 의존성 제로)
- Cloud Functions → Firestore 구독자 쿼리 + FCM 발송 + 토큰 cleanup (Admin SDK, Security Rules 우회)

**플랫폼별 페이로드 전략:**
- **Android:** Data-only 메시지 → Notifee가 알림 UI를 앱 단에서 그림
- **iOS:** 하이브리드 페이로드 (`notification` + `data` + `mutable-content: 1`) → NSE가 표시 직전에 가공

**다국어:** 서버가 ko/en 두 버전을 페이로드에 모두 실음. iOS는 NSE가 App Groups UserDefaults에서 유저 언어 읽고 선택, Android는 Notifee가 i18n 함수로 선택.

**구독 스키마:** 통합 topics 배열 + prefix
```ts
// Topic 네임스페이스:
// category:{id}  → 공지 타입 (scholarship, career, academic, general...)
// dept:{id}      → 학과 (cs, ee, math, ...)
// library:{id}   → 도서관
// dorm:{id}      → 기숙사 (향후)
```

---

## Firestore 스키마

### `users/{uid}` (유저 문서)
```ts
{
  locale: string;       // 앱 언어 설정 ('ko' | 'en' | 'zh')
  // 향후 유저 레벨 설정 추가 가능
}
```
> `locale`은 device가 아닌 user 레벨. 유저가 앱에서 언어 변경 시 이 필드 업데이트.
> NSE(iOS)는 App Groups UserDefaults에서 읽고, 서버 발송 시에는 locale 무관 (ko/en 모두 실음).

### `users/{uid}/preferences` (단일 문서)
```ts
{
  enabled: boolean;           // 마스터 스위치
  subscribedTopics: string[]; // ["category:scholarship", "dept:cs", ...]
}
```
> **`enabled`과 `subscribedTopics`의 관계:**
> - `enabled`은 마스터 스위치. 서버 발송 시 `enabled == true AND topic 매칭`의 AND 조건.
> - `enabled: false`여도 `subscribedTopics`는 그대로 유지. 마스터 다시 ON 하면 이전 구독 복원.
> - MANDATORY_TOPICS는 마스터 OFF 시에도 항목에서 제거 불가 (앱 단 + Security Rules).

### `devices/{deviceId}` (top-level collection)
```ts
{
  uid: string;                    // Firebase Auth UID
  token: string;                  // FCM registration token
  platform: 'ios' | 'android';
  appVersion: string;
  lastActive: Timestamp;
  active: boolean;                // soft delete용
  subscribedTopics: string[];     // ← preferences에서 복제 (Cloud Function sync)
  notificationsEnabled: boolean;  // ← preferences.enabled 복제
}
```
> **top-level + topics 복제인 이유:** 발송 쿼리가 **한 번**으로 완결.
> `devices.where('active','==',true).where('notificationsEnabled','==',true).where('subscribedTopics','array-contains-any',topics)`
> Firestore `in` 30개 제한도 우회, N+1도 없음.
> preferences 변경 시 Cloud Function `syncPreferencesToDevices`가 자동 sync.

> **`deviceId` 생성:** 앱 첫 실행 시 UUID 생성 → MMKV에 영구 저장.
> 앱 삭제 후 재설치 시 새 UUID. FCM token과 분리 (token은 refresh될 수 있지만 deviceId는 불변).
> `getOrCreateDeviceId()` 함수로 구현.

### Firestore Security Rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 유저 문서
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;

      match /preferences {
        allow read, write: if request.auth.uid == uid;
        // MANDATORY_TOPICS 강제 포함 + topic prefix whitelist 검증
      }
    }

    // 디바이스 (top-level)
    match /devices/{deviceId} {
      allow read, write: if request.auth.uid == resource.data.uid
                         || request.auth.uid == request.resource.data.uid;
    }
  }
}
```
> **배포:** Phase 2에서 앱 코드와 함께 `firebase deploy --only firestore:rules`.
> `firestore.rules` 파일을 `apps/mobile/` 또는 레포 루트에 배치.
> Node 서버 Admin SDK는 Rules 우회하므로 서버 PR과 무관.

---

## Phase 1: FCM Foundation (클라이언트 — 서버 API 없이 동작 가능)

### 1.1 패키지 설치

```bash
cd apps/mobile && yarn add @react-native-firebase/messaging@^23.8.8 @notifee/react-native @react-native-firebase/firestore@^23.8.8
```

> RNFB 모듈은 전체 **같은 메이저 버전** 유지 원칙. 기존 5개 모듈 버전과 일치 확인.
> `@react-native-firebase/firestore` 추가 시 iOS pod 크기 ~40MB 증가 예상.

### 1.2 `app.config.ts` 수정

**파일:** `apps/mobile/app.config.ts`

(a) plugins 배열에 추가 (`@react-native-firebase/app-check` 다음):
```ts
"@react-native-firebase/messaging",
```

(b) iOS entitlements + background modes 수동 추가 (Expo SDK 51+ — 플러그인이 자동 추가 안 함):
```ts
ios: {
  // ...existing...
  entitlements: {
    "aps-environment": process.env.APP_ENV === "development"
      ? "development"
      : "production",
  },
  infoPlist: {
    ITSAppUsesNonExemptEncryption: false,
    UIBackgroundModes: ["remote-notification"],
  },
},
```

> `eas.json`의 `build.development.env`에 `APP_ENV: "development"` 명시.

### 1.3 `firebase.json` 수정

**파일:** `apps/mobile/firebase.json`

기존 키 유지 + messaging 설정 2줄 추가:
```json
"messaging_auto_init_enabled": true,
"messaging_ios_auto_register_for_remote_messages": false
```

**`auto_register: false` 중요:** JS에서 `registerDeviceForRemoteMessages()`를 먼저 호출해야 `getToken()` 동작. 안 하면 `[messaging/unregistered]` 에러.

### 1.4 APNs 키 설정 (수동, 1회)

1. Apple Developer Portal → Keys → APNs Auth Key (.p8) 생성 (또는 기존 키 재사용)
2. Firebase Console (`skkubus-95723`) → Project Settings → Cloud Messaging → iOS → .p8 업로드 (Key ID + Team ID)
3. 코드 변경 없음

### 1.5 커스텀 entry point + 백그라운드 핸들러

> **CRITICAL:** `setBackgroundMessageHandler`는 `AppRegistry.registerComponent()` **이전**에 호출해야 함.
> `app/_layout.tsx`에서 하면 Android quit-state에서 handler 안 불림.

**(a) 백그라운드 핸들러 생성:**

**생성:** `apps/mobile/src/services/background-messaging.ts`

```ts
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';

export async function backgroundMessageHandler(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
) {
  // Phase 3에서 Notifee 알림 표시 로직 추가
  if (__DEV__) console.log('[fcm] background:', remoteMessage.messageId);
}
```

**(b) 커스텀 entry point 생성:**

**생성:** `apps/mobile/index.ts`

```ts
import messaging from '@react-native-firebase/messaging';
import { backgroundMessageHandler } from './src/services/background-messaging';

// 반드시 Expo Router entry 전에 등록
messaging().setBackgroundMessageHandler(backgroundMessageHandler);

import 'expo-router/entry';
```

**(c) `package.json` main 필드 변경:**

**수정:** `apps/mobile/package.json` — `"main"` 값을 `"./index.ts"`로 변경

> **iOS Headless 주의:** iOS에서 백그라운드 메시지 수신 시 앱 전체가 headless mode로 마운트됨.
> `useAppInit()`의 side effect들이 불필요하게 실행될 수 있음.
> Phase 3 iOS 테스트에서 확인 후 필요 시 `HeadlessCheck` 패턴 도입.
> `ensureRegistered()`는 `isDeviceRegisteredForRemoteMessages` 체크 후 이미 true면 skip → headless에서도 안전.

### 1.6 메시징 서비스 생성

**생성:** `apps/mobile/src/services/messaging.ts`

기존 `analytics.ts`, `crashlytics.ts` 패턴 — thin wrapper, never throw.

```ts
ensureRegistered()      // iOS: registerDeviceForRemoteMessages() (auto_register false 대응)
requestPermission()     // → AuthorizationStatus (실제 OS 팝업)
checkPermission()       // → AuthorizationStatus (팝업 없이 현재 상태만)
getDeviceToken()        // → string (FCM registration token)
onTokenRefresh(cb)      // → unsubscribe
onForegroundMessage(cb) // → unsubscribe
getInitialNotification()       // quit-state 탭 처리
onNotificationOpenedApp(cb)    // background-state 탭 처리
```

> **구현 시 확인:** `messaging().isDeviceRegisteredForRemoteMessages`가 동기 property인지 비동기인지
> [rnfirebase reference](https://rnfirebase.io/reference/messaging) 확인. 비동기면 await 필요.

### 1.7 deviceId 생성 유틸

**생성:** `apps/mobile/src/services/device-id.ts`

```ts
import { MMKV } from 'react-native-mmkv';
import { randomUUID } from 'expo-crypto';

const DEVICE_ID_KEY = 'skkuverse_device_id';

export function getOrCreateDeviceId(): string {
  const storage = new MMKV();
  const existing = storage.getString(DEVICE_ID_KEY);
  if (existing) return existing;

  const id = randomUUID();  // expo-crypto (Hermes 버전 무관, 안전)
  storage.set(DEVICE_ID_KEY, id);
  return id;
}
```

> `expo-crypto` 사용 — `crypto.randomUUID()`는 Hermes 버전 의존. expo-crypto는 이미 Expo에 내장.
> FCM token과 분리. Token은 refresh되지만 deviceId는 앱 재설치 전까지 불변.

### 1.8 Notification Channel 생성 (Android)

**생성:** `apps/mobile/src/services/notification-channels.ts`

```ts
const CHANNELS = [
  { id: 'notice_academic',     name: '학사 공지',   importance: AndroidImportance.DEFAULT },
  { id: 'notice_scholarship',  name: '장학 공지',   importance: AndroidImportance.HIGH },
  { id: 'notice_career',       name: '취업·모집',   importance: AndroidImportance.DEFAULT },
  { id: 'notice_general',      name: '일반·행사',   importance: AndroidImportance.DEFAULT },
  { id: 'notice_department',   name: '학과 공지',   importance: AndroidImportance.DEFAULT },
];
```

### 1.9 Topic 상수 + 유틸

**생성:** `packages/shared/src/constants/topics.ts`

```ts
export const TopicPrefix = {
  CATEGORY: 'category',
  DEPT: 'dept',
  LIBRARY: 'library',
} as const;

export const buildTopic = (prefix: string, id: string) => `${prefix}:${id}`;
export const parseTopic = (topic: string) => {
  const [prefix, ...rest] = topic.split(':');
  return { prefix, id: rest.join(':') };
};

export const MANDATORY_TOPICS: readonly string[] = [
  // 필수 기본 구독 (유저가 해제 불가)
] as const;
```

### 1.10 알림 딥링크 라우터

**생성:** `apps/mobile/src/services/notification-router.ts`

```ts
interface NotificationData {
  type: 'notice';
  deptId: string;
  articleNo: string;
  title_ko: string;
  title_en: string;
  body_ko: string;
  body_en: string;
  category?: string;
}
// type: 'notice' → router.push(`/notices/${deptId}/${articleNo}`)
```

### 1.11 알림 핸들러 훅

**생성:** `apps/mobile/src/hooks/useNotificationHandler.ts`

RootLayout 내부 (InitGate 안쪽):
- `getInitialNotification()` — quit-state 딥링크
- `onNotificationOpenedApp()` — background-state 딥링크
- `onForegroundMessage()` — Phase 3에서 Notifee 인앱 알림
- `useRef`로 initial notification 중복 처리 방지

**수정:** `apps/mobile/app/_layout.tsx` — `useNotificationHandler()` 호출 추가.

### 1.12 앱 초기화 통합

**수정:** `apps/mobile/src/hooks/useAppInit.ts`

기존 step 4 이후:
```ts
// 5. Notification channels (Android)
await setupNotificationChannels();

// 6. FCM: iOS 등록 + 권한 확인 (팝업 없음)
await ensureRegistered();
const permStatus = await checkPermission();
notificationStore.getState().setPermissionStatus(permStatus);

if (permStatus === 'authorized' || permStatus === 'provisional') {
  const token = await getDeviceToken();
  notificationStore.getState().setFcmToken(token);
  // Phase 2에서 Firestore 등록 추가
}
```

> `checkPermission()` 체크만, `requestPermission()` 아님 → 팝업 안 뜸.
> 실제 팝업은 Phase 3 알림 설정 화면 마스터 토글에서만.

---

## Phase 2: Firestore Integration

### 2.1 타입 정의

**생성:** `packages/shared/src/types/notifications.ts`

```ts
export interface DeviceDocument {
  uid: string;
  token: string;
  platform: 'ios' | 'android';
  appVersion: string;
  lastActive: Date;
  active: boolean;
  subscribedTopics: string[];     // preferences에서 복제 (Cloud Function sync)
  notificationsEnabled: boolean;  // preferences.enabled 복제
}

export interface PreferencesDocument {
  enabled: boolean;
  subscribedTopics: string[];
}
```

### 2.2 Firestore 서비스

**생성:** `apps/mobile/src/services/firestore-notifications.ts`

```ts
import firestore from '@react-native-firebase/firestore';

// 디바이스 등록 (upsert) — top-level collection
registerDevice(deviceId, data: DeviceDocument)
  → devices/{deviceId} set (merge)

// 디바이스 해제 (soft delete)
unregisterDevice(deviceId)
  → devices/{deviceId} update { active: false }

// 유저 locale 업데이트
updateUserLocale(uid, locale)
  → users/{uid} set ({ locale }, merge)

// 구독 설정 읽기
getPreferences(uid) → users/{uid}/preferences get

// 구독 설정 쓰기 (MANDATORY_TOPICS 강제 포함 — 중복 제거)
updatePreferences(uid, prefs: PreferencesDocument)
  → topics = [...new Set([...prefs.subscribedTopics, ...MANDATORY_TOPICS])]
  → users/{uid}/preferences set ({ enabled, subscribedTopics: topics })

// 마스터 토글 OFF
disableNotifications(uid)
  → users/{uid}/preferences update { enabled: false }
  // subscribedTopics는 유지 (다시 ON 시 복원)

// 실시간 구독 변경 감지 (multi-device sync)
onPreferencesChanged(uid, callback) → onSnapshot listener → unsubscribe
```

### 2.3 Firestore Security Rules 배포

**생성:** `apps/mobile/firestore.rules` (또는 레포 루트)

Phase 2 앱 작업의 일부로 배포:
```bash
firebase deploy --only firestore:rules
```

> Node 서버 PR과 무관. Admin SDK는 Rules 우회.

### 2.4 Zustand 스토어

**생성:** `packages/shared/src/store/notifications.ts`

`settings.ts` 패턴 (MMKV persist):

```ts
interface NotificationState {
  fcmToken: string | null;
  deviceId: string | null;
  isTokenRegistered: boolean;
  permissionStatus: 'notDetermined' | 'authorized' | 'denied' | 'provisional';
  preferences: PreferencesDocument;
}
```

### 2.5 알림 설정 훅 (Firestore onSnapshot 기반)

**생성:** `packages/shared/src/hooks/useNotificationPreferences.ts`

> React Query + onSnapshot 조합은 listener 생명주기 관리가 복잡 (메모리 누수 가능).
> 알림 설정 화면 하나에서만 쓰므로 **`useState` + `useEffect(onSnapshot)`로 단순화**:

```ts
export function useNotificationPreferences(uid: string | null) {
  const [prefs, setPrefs] = useState<PreferencesDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = onPreferencesChanged(uid, (newPrefs) => {
      setPrefs(newPrefs);
      setLoading(false);
    });
    return unsubscribe;
  }, [uid]);

  return { prefs, loading };
}
```

> `onPreferencesChanged`는 `apps/mobile`에서 DI로 주입하거나,
> 훅 자체를 `apps/mobile/src/hooks/`에 배치.

### 2.6 앱 초기화에서 Firestore 등록

**수정:** `apps/mobile/src/hooks/useAppInit.ts`

토큰 획득 후:
```ts
const deviceId = getOrCreateDeviceId();

// 신규 유저: preferences 문서 없으면 default 생성
const prefsDoc = await getPreferences(uid);
if (!prefsDoc) {
  await updatePreferences(uid, {
    enabled: false,
    subscribedTopics: [...MANDATORY_TOPICS],
  });
}

// device 등록 (preferences에서 subscribedTopics, enabled 읽어서 포함)
const prefs = prefsDoc ?? { enabled: false, subscribedTopics: [...MANDATORY_TOPICS] };
if (token) {
  await registerDevice(deviceId, {
    uid, token, platform, appVersion, lastActive: now, active: true,
    subscribedTopics: prefs.subscribedTopics,
    notificationsEnabled: prefs.enabled,
  });
}
```

auth 변경 시 (anonymous → Google) uid 변경 → 디바이스 문서 uid 업데이트.
언어 변경 시 `updateUserLocale(uid, newLang)` 호출 추가.

### 2.7 exports 업데이트

**수정:** `packages/shared/src/index.ts` — notification 타입, 스토어, topic 상수 export

---

## Phase 3: Subscription UI + Notifee 알림 표시

### 3.1 알림 설정 화면

**생성:** `apps/mobile/src/features/notifications/NotificationSettingsScreen.tsx`

1. **마스터 토글** — "알림 받기" ON/OFF
   - ON → `requestPermission()` (OS 팝업) + `Firestore preferences.enabled = true`
   - OFF → `Firestore preferences.enabled = false` (subscribedTopics 유지)
2. **카테고리별 토글** — `GET /notices/tabs` 데이터 재활용:
   - `fixed` 탭 → `category:{tabId}` 토픽 토글
   - `picker` 탭 → `dept:{deptId}` 토픽 토글
3. MANDATORY_TOPICS → 토글 disabled (회색, "기본 구독")
4. SDS 컴포넌트 사용
5. `useNoticeTabs()` + `useNotificationPreferences()` 조합
6. **토글 변경 시 debounce 500ms** — 마지막 토글만 Firestore 저장, `syncPreferencesToDevices` 과도 실행 방지

### 3.2 라우트 추가

**생성:** `apps/mobile/app/notifications/settings.tsx`
**생성:** `apps/mobile/app/notifications/_layout.tsx`
**수정:** `apps/mobile/app/_layout.tsx` — `<Stack.Screen name="notifications" />`

### 3.3 진입점

**수정:** More 화면에 "알림 설정" 메뉴. `Bell` 아이콘 (lucide-react-native).

### 3.4 권한 요청 UX

- 마스터 토글 ON → `requestPermission()` (OS 팝업)
- 또는: 공지사항 탭 N회 방문 후 soft prompt (BottomSheet)
- denied → "설정으로 이동" 버튼

**생성:** `apps/mobile/src/features/notifications/NotificationPromptSheet.tsx`

### 3.5 Notifee 알림 표시

**수정:** `apps/mobile/src/services/background-messaging.ts`

```ts
import notifee from '@notifee/react-native';

export async function backgroundMessageHandler(remoteMessage) {
  const { data } = remoteMessage;
  const lang = /* MMKV에서 유저 언어 읽기 */;
  const title = data[`title_${lang}`] || data.title_ko;
  const body = data[`body_${lang}`] || data.body_ko;

  await notifee.displayNotification({
    title, body,
    android: {
      channelId: mapCategoryToChannel(data.category),
      pressAction: { id: 'default' },
    },
  });
}
```

### 3.6 언어 변경 시 Firestore + App Groups sync

**수정:** 언어 변경 로직 (settings store setter 또는 useAppInit)

```ts
// 언어 변경 시:
updateUserLocale(uid, newLang);           // Firestore users/{uid}.locale
// iOS: App Groups UserDefaults에도 저장 (NSE가 읽음)
```

### 3.7 Analytics 이벤트

**수정:** `apps/mobile/src/services/analytics.ts`

```ts
logNotificationPermissionResult(status)
logNotificationSubscriptionChange(topic, subscribed)
// 수동 로그 (push_ prefix로 예약 이벤트명 충돌 방지):
logEvent('push_notification_open', { type, deptId, articleNo })
logEvent('push_notification_receive', { type, deptId })
```

### 3.8 iOS Headless 확인

Phase 3 iOS 테스트에서:
- 백그라운드 메시지 수신 → `useAppInit()` side effect 발생 여부 확인
- 발생 시 `index.ts`에 `HeadlessCheck` 패턴 도입

---

## Phase 4: iOS NSE (Notification Service Extension)

> Phase 3과 묶어서 **한 번에 출시**.

### 4.1 NSE 타겟 생성

- `@bacons/apple-targets` 또는 `withDangerousMod` 커스텀 플러그인
- Bundle ID: `com.example.skkumap.NotificationServiceExtension`
- 별도 provisioning profile

### 4.2 App Groups 설정

- 앱과 NSE가 공유하는 App Group 컨테이너 생성
- 앱이 UserDefaults에 유저 언어 저장 → NSE가 읽기

### 4.3 NSE 다국어 + 이미지

- `serviceExtensionDidReceiveRequest`에서:
  1. App Groups UserDefaults → 유저 언어
  2. 페이로드 `title_{lang}` / `body_{lang}` 선택
  3. `fcm_options.image` → `UNNotificationAttachment`
- `serviceExtensionTimeWillExpire()` fallback 필수 (30초 타임아웃)

---

## 수정 대상 파일 요약

### 신규 생성
| 파일 | Phase |
|---|---|
| `apps/mobile/index.ts` | 1 |
| `apps/mobile/src/services/messaging.ts` | 1 |
| `apps/mobile/src/services/background-messaging.ts` | 1 |
| `apps/mobile/src/services/device-id.ts` | 1 |
| `apps/mobile/src/services/notification-channels.ts` | 1 |
| `apps/mobile/src/services/notification-router.ts` | 1 |
| `apps/mobile/src/hooks/useNotificationHandler.ts` | 1 |
| `packages/shared/src/constants/topics.ts` | 1 |
| `packages/shared/src/types/notifications.ts` | 2 |
| `packages/shared/src/store/notifications.ts` | 2 |
| `apps/mobile/src/services/firestore-notifications.ts` | 2 |
| `apps/mobile/src/hooks/useNotificationPreferences.ts` | 2 |
| `apps/mobile/firestore.rules` | 2 |
| `apps/mobile/app/notifications/settings.tsx` | 3 |
| `apps/mobile/app/notifications/_layout.tsx` | 3 |
| `apps/mobile/src/features/notifications/NotificationSettingsScreen.tsx` | 3 |
| `apps/mobile/src/features/notifications/NotificationPromptSheet.tsx` | 3 |
| `apps/mobile/plugins/withNotificationServiceExtension.js` | 4 |

### 기존 수정
| 파일 | Phase | 변경 |
|---|---|---|
| `apps/mobile/package.json` | 1 | `"main": "./index.ts"` |
| `apps/mobile/app.config.ts` | 1 | plugin + entitlements (APP_ENV 분기) + UIBackgroundModes |
| `apps/mobile/firebase.json` | 1 | messaging 설정 2줄 |
| `apps/mobile/app/_layout.tsx` | 1,3 | handler hook + notifications route |
| `apps/mobile/src/hooks/useAppInit.ts` | 1,2 | FCM 등록 + 토큰 + deviceId + Firestore 등록 |
| `packages/shared/src/index.ts` | 2 | notification 타입/스토어/상수 export |
| `apps/mobile/src/services/analytics.ts` | 3 | push_notification_open/receive 수동 로그 |
| `apps/mobile/src/services/background-messaging.ts` | 3 | Notifee 알림 표시 로직 |

---

## 서버 측 구현

### Node.js 서버 (기존 스꾸버스 API)

Firebase 의존성 **제로**. 공지 발행 시 Cloud Function HTTP 호출만:

```ts
async function publishNotice(notice) {
  await NoticeModel.create(notice);  // MongoDB 저장

  await fetch(CLOUD_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.CLOUD_FUNCTION_API_KEY,
    },
    body: JSON.stringify({
      noticeId: notice.id,
      topics: computeTopics(notice),  // ["category:scholarship", "dept:cs"]
      title_ko: notice.title_ko,
      title_en: notice.title_en,
      body_ko: notice.summary_ko,
      body_en: notice.summary_en,
    }),
  });
}
```

- `firebase-admin` 불필요
- 서비스 계정 키 불필요
- 발송 로직 변경 시 Node 서버 재배포 불필요

### Firebase Cloud Functions (별도 workspace: `functions/`)

위치: monorepo 루트 `functions/` 또는 별도 저장소

**1. `sendNoticeNotification` — HTTP function (핵심)**

```ts
// API 키 인증
// Firestore 구독자 쿼리:
//   devices where active == true
//     AND subscribedTopics array-contains-any notice.topics
//   → 토큰 수집 (쿼리 한 방)
// FCM sendEachForMulticast() 500토큰씩 배치
// UNREGISTERED/INVALID_ARGUMENT → devices/{id}.active = false
// 다국어 페이로드 (ko/en 모두 data에)
// Android: data-only / iOS: 하이브리드 (notification + data + mutable-content)
```

> **쿼리 최적화:** `subscribedTopics`를 `devices` 문서에 복제.
> 유저가 preferences 변경 시 해당 uid의 모든 devices도 업데이트.
> → `array-contains-any` 한 번으로 대상 토큰 직접 조회 (N+1 제거).
> 이 sync는 아래 `syncPreferencesToDevices`가 자동 처리.

**2. `syncPreferencesToDevices` — Firestore onUpdate trigger**

```
users/{uid}/preferences 변경 감지
  → 해당 uid의 모든 devices 문서에 subscribedTopics 복제
```

> 발송 쿼리 최적화용. preferences → devices 단방향 sync.

**3. `cleanupStaleDevices` — scheduled function**

```
주기 cron (월 1회 등)
  → lastActive가 N개월 이전인 devices soft delete
```

### 인증

Node → Cloud Function 호출 시 `X-API-Key` 헤더 검증 (환경변수).
Google Cloud IAM은 스꾸 규모엔 오버엔지니어링.
Cloud Function URL은 `FCM_FANOUT_URL` env 변수로 관리 (dev/prod 분리 가능).

### Cloud Functions 세대

**1st gen 사용.** 2nd gen(Cloud Run 기반)은 concurrency 등 기능 풍부하나 스꾸 규모엔 오버엔지니어링.
URL 포맷: `https://{region}-{project}.cloudfunctions.net/{functionName}`

### 비용

Cloud Functions 무료 티어: 월 200만 호출, 400k GB-초.
스꾸버스 (공지 ~100개/일 × 30일 = 3000 호출/월) → 여유.
단, Cloud Functions 2nd gen 또는 Firestore 사용 시 **Blaze plan 필요** (사용량 기반, free tier 안에서는 무과금).

### 콜드 스타트

Cloud Function이 유휴 → 첫 호출 2~5초 지연.
공지 알림 특성상 치명적 아님. 필요 시 min instances 1 설정 (소액).

### Firestore 스키마 보완 — `subscribedTopics` devices 복제

```ts
// devices/{deviceId} (보완)
{
  uid: string;
  token: string;
  platform: 'ios' | 'android';
  appVersion: string;
  lastActive: Timestamp;
  active: boolean;
  subscribedTopics: string[];  // ← preferences에서 복제 (Cloud Function sync)
  notificationsEnabled: boolean;  // ← preferences.enabled 복제
}
```

> 발송 쿼리가 **한 번의 Firestore 쿼리**로 완결:
> ```
> devices
>   .where('active', '==', true)
>   .where('notificationsEnabled', '==', true)
>   .where('subscribedTopics', 'array-contains-any', topics)
> ```
> Firestore `in` 연산자 30개 제한 문제도 우회.

---

## 검증 방법

### Phase 1
1. `yarn ios`로 빌드 — messaging + notifee + firestore pod 확인
2. `ensureRegistered()` 성공 로그 (iOS)
3. `checkPermission()` → 팝업 안 뜸
4. 임시 dev 코드로 `requestPermission()` → 토큰 획득 확인
5. Firebase Console → 테스트 메시지 → 수신 확인
6. **quit state 알림 탭 → 딥링크** (CRITICAL 회귀)
7. background state 알림 탭 → 딥링크
8. foreground 메시지 수신 → 콘솔 로그

### Phase 2
1. Firestore `devices/{deviceId}` 문서 생성 확인
2. `users/{uid}/preferences` 읽기/쓰기
3. auth 변경 → 토큰 재등록
4. Security Rules (다른 uid 차단)
5. `getOrCreateDeviceId()` → MMKV persist 확인

### Phase 3
1. 알림 설정 화면 → 탭/학과 목록
2. 마스터 ON → OS 팝업 → 토큰 획득
3. 카테고리/학과 토글 → Firestore 즉시 반영
4. 마스터 OFF → `enabled: false`, `subscribedTopics` 유지
5. 마스터 다시 ON → 이전 구독 복원
6. MANDATORY_TOPICS 비활성 토글
7. Notifee 알림 + 다국어 (Android)
8. `push_notification_open` Analytics 확인
9. **iOS headless side effect 확인**

### Phase 4
1. iOS NSE 다국어 제목/본문
2. 이미지 첨부
3. `serviceExtensionTimeWillExpire` fallback

### 통합 E2E (출시 전)
1. 서버 공지 발행 → Android/iOS 알림 수신
2. 탭 → 딥링크 → 공지 상세
3. 다국어 전환 → 알림 언어 변경
4. 구독 해제 → 미수신 확인
5. 마스터 OFF → 전체 미수신 확인

---

## 주의사항

1. **`useFrameworks: "static"`** — 기존 `withFirebaseModularHeaders.js`가 RNFB 전체 커버. Notifee static linking 호환 확인
2. **Expo Go 미지원** — dev build 필수 (이미 사용 중)
3. **`expo-notifications` 미설치** — FCM + Notifee와 충돌 방지
4. **Android 13+ POST_NOTIFICATIONS** — `messaging().requestPermission()` 자동 처리
5. **runtimeVersion bump** — 네이티브 모듈 3개 추가 → OTA 불가, `3.5.1` → `3.6.0`
6. **`setBackgroundMessageHandler` 위치** — `index.ts`에서 `expo-router/entry` 전. `_layout.tsx` 금지
7. **iOS `registerDeviceForRemoteMessages()`** — `auto_register: false` 시 필수. 안 하면 `UNREGISTERED` 에러
8. **iOS Headless** — 백그라운드 수신 시 앱 전체 마운트. Phase 3 확인 후 대응
9. **Firestore Security Rules** — Phase 2에서 앱 코드와 함께 배포. Admin SDK는 우회
10. **RNFB 버전 일치** — firestore 추가 시 기존 모듈과 같은 메이저 버전 유지
11. **`array-contains-any` 최대 10개** — 공지당 topics 10개 이하 유지. 초과 시 쿼리 분할 필요
12. **`syncPreferencesToDevices` 무한루프 방지** — devices onUpdate 트리거 만들지 않기. sync-originated change 구분 필요 시 `_syncedAt` 필드로 판별
13. **토글 debounce** — 알림 설정 화면에서 Firestore write를 500ms debounce. sync Cloud Function 과도 실행 방지

---

## 진행 상태 (2026-04-19)

### Phase 1: FCM Foundation — ✅ 완료 (실기기 토큰 검증 중)

| 단계 | 상태 | 비고 |
|---|---|---|
| 1.1 패키지 설치 | ✅ | messaging@23.8.8, firestore@23.8.8, notifee@9.1.8 |
| 1.2 app.config.ts | ✅ | messaging plugin + aps-environment + UIBackgroundModes |
| 1.3 firebase.json | ✅ | messaging_auto_init + auto_register false |
| 1.4 APNs 키 설정 | ✅ | .p8 키 Firebase Console 업로드 완료 |
| 1.5 커스텀 entry point | ✅ | index.ts + background-messaging.ts + package.json main 변경 |
| 1.6 messaging.ts | ✅ | ensureRegistered, checkPermission, requestPermission, getDeviceToken 등 |
| 1.7 device-id.ts | ✅ | UUID v4 생성 + MMKV 영구 저장 |
| 1.8 notification-channels.ts | ✅ | Android 5개 채널 (academic, scholarship, career, general, department) |
| 1.9 topics.ts | ✅ | TopicPrefix, buildTopic, parseTopic, MANDATORY_TOPICS |
| 1.10 notification-router.ts | ✅ | data payload → Expo Router 경로 변환 |
| 1.11 useNotificationHandler.ts | ✅ | quit/background/foreground 처리, _layout.tsx에 통합 |
| 1.12 useAppInit 통합 | ✅ | setupChannels → ensureRegistered → checkPermission → getToken |

### 추가 작업 (Phase 1 과정에서)

| 작업 | 상태 | 비고 |
|---|---|---|
| withPushNotificationsCapability.js | ✅ | SystemCapabilities.com.apple.Push 추가 plugin |
| provisioning profile 갱신 | ✅ | Apple Developer Portal Push 활성화 → dist.mobileprovision에 aps-environment 포함 확인 |
| debug-fcm.tsx | ✅ | 임시 FCM 디버그 화면 (permission, deviceId, token 확인 + 복사) |
| AdMob init 순서 변경 | ✅ | FCM 이전 → 이후로 이동, fire-and-forget (시뮬레이터에서 blocking 방지) |
| iOS 시뮬레이터 빌드 | ✅ | 빌드 성공, 크래시 없음, FCM SDK 초기화 확인 |
| TestFlight 빌드 | ✅ | Build 3.5.1-100, 업로드 성공 |

### 시뮬레이터 검증 결과

- ✅ FCM SDK 초기화 (`FIRMessaging proxy enabled`)
- ✅ 백그라운드 핸들러 등록 (`signalBackgroundMessageHandlerSet`)
- ✅ `checkPermission()` → authorized
- ✅ `getOrCreateDeviceId()` → UUID 생성 + MMKV 저장
- ❌ FCM 토큰 발급 불가 — 시뮬레이터에서 `aps-environment` entitlement가 strip됨 (자동 서명 제약)
- ⏳ 실기기 TestFlight에서 토큰 발급 + 알림 수신 테스트 대기 중

### 남은 임시 코드 (테스트 후 제거 필요)

- `app/debug-fcm.tsx` — FCM 디버그 화면
- `app/(tabs)/campus.tsx` — 빨간 "FCM" 플로팅 버튼
- `src/hooks/useAppInit.ts` — `requestPermission()` 임시 호출 + `debugFcmToken` state
- `plugins/withPushNotificationsCapability.js` — 유지 (production에도 필요)

### Phase 2~4: 미착수

Phase 1 실기기 검증 완료 후 Phase 2 (Firestore Integration)로 진행 예정.
