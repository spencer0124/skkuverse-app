---
title: FCM Push Notifications Plan
type: plan
status: superseded
owner: zoyoong124@gmail.com
last-updated: 2026-07-21
audience: internal
---

# FCM 학과별 푸시 알림 구현 계획

> [!WARNING]
> 이 계획은 구현 완료로 superseded — 현행 SSOT는 루트 [`CLAUDE.md`](../../CLAUDE.md)의 FCM 섹션 (옵션 D: 알림함 없음). 특히 아래 "배포 전략"의 "알림함까지 완성" 서술은 초기 구상이며 폐기됨 (옵션 D — 알림함 없이 로컬 뱃지로 대체). 이 문서는 이력 가치로만 보존한다.

## Context

스꾸버스 앱에 학과별 공지사항 푸시 알림 기능을 추가한다. `@react-native-firebase/*` 네이티브 모듈 5개(app, auth, analytics, crashlytics, app-check)가 이미 설치된 상태.

**기술 스택:** FCM 직접 (`@react-native-firebase/messaging`) + Notifee (`@notifee/react-native`) + Firestore (`@react-native-firebase/firestore`) + Cloud Functions (`sendNotification` 범용 진입점)

**배포 전략:** Phase 1→2→3 순서로 개발, **앱스토어에는 Phase 3 완료 후 한 번에 릴리즈**. 유저가 처음 받는 버전이 다국어·읽음 처리·알림함까지 완성된 버전. 과도기 없음.

**데이터 아키텍처:**

```text
┌─────────────────────────┬──────────────────────────┐
│ Firebase (Firestore)    │ MongoDB (Node 관리)      │
├─────────────────────────┼──────────────────────────┤
│ 유저 정보 (locale 포함)  │ 버스 데이터               │
│ 디바이스/토큰            │ 공지 데이터               │
│ 알림 구독 preferences    │ 셔틀 시간표              │
│                         │ 학과 정보                │
└─────────────────────────┴──────────────────────────┘
```

- 앱 → Firestore 직접 읽기/쓰기 (디바이스 등록, 구독 관리, 유저 설정)
- Node 서버 → 공지 발행 시 Cloud Function HTTP 호출만 (Firebase 의존성 제로)
- Cloud Functions → Firestore 구독자 쿼리 + FCM 발송 + 토큰 cleanup (Admin SDK, Security Rules 우회)

**알림함 (in-app inbox) 없음 — 옵션 D 채택:** 공지 자체는 스꾸버스의 기존 공지 탭이 풀 히스토리를 제공하므로 별도의 유저별 알림 레코드(`notifications` 컬렉션)를 만들지 않는다. 푸시는 fire-and-forget로 전달만 하고, 유저는 공지 탭에서 콘텐츠 열람. 대신 **미확인 알림의 가시성**은 앱 아이콘 뱃지(OS 레벨)와 탭바 뱃지(앱 내 UI) 두 가지로 확보 — 둘 다 로컬 카운터(Notifee + Zustand)로 관리하여 Firestore 비용 0원, 구현 복잡도 최소화.

**페이로드 전략 — Hybrid (공통):**

iOS/Android **둘 다 동일** 구조. `notification` + `data` 혼합 페이로드.

```json
{
  "token": "...",
  "notification": {
    "title": "장학금 공지",
    "body": "2026년 1학기 국가장학금..."
  },
  "data": {
    "type": "notice",
    "deptId": "cs",
    "articleNo": "12345",
    "category": "scholarship"
  },
  "android": {
    "priority": "high",
    "notification": { "channelId": "notice_scholarship" }
  },
  "apns": {
    "payload": { "aps": { "sound": "default" } }
  },
  "fcmOptions": { "analyticsLabel": "notice_scholarship_v1" }
}
```

- `notification` 필드 → 백그라운드·quit 상태에서 **OS가 자동 표시** (Notifee displayNotification 불필요)
- `data` → 딥링크 메타 (탭하면 `type`/`deptId`/`articleNo`로 공지 상세로 이동)
- `android.priority: high` → Doze mode 우회, 즉시 전달
- `android.notification.channelId` → 카테고리별 중요도·소리·진동 분리
- `fcmOptions.analyticsLabel` → Firebase Analytics 자동 이벤트(`notification_receive`/`notification_open`/`notification_dismiss`/`notification_foreground_receive`) 캠페인 분리

**다국어:** **서버가 `users.locale` 기준으로 언어 선택해서 `notification.title`/`body`에 완성 문구 탑재**. 앱 단에서 `title_ko`/`title_en` 분기 로직 없음. iOS NSE도 사용하지 않음.

> **현재 상태 (2026-04-19) — ko-only 운영:** MongoDB `Notice` 스키마에 **한국어 필드만 존재**. 영문 번역 파이프라인은 향후 작업(`skkuverse-ai`에서 생성 예정). 아키텍처는 locale-ready로 유지 — `users.locale`·`devices.locale` 필드와 Cloud Function의 locale별 그룹핑은 MVP부터 구현. 당장 모든 유저(`locale: 'ko' | 'en'`)에게 **한국어 문구만 발송** (Cloud Function의 `title_en ?? title_ko` fallback 경유). 영문 데이터 추가 시 Node 서버에서 `title_en`을 채우기 시작하면 코드 변경 없이 자동 전환.

**구독 스키마:** 통합 topics 배열 + prefix

```ts
// Topic 네임스페이스:
// category:{id}  → 공지 타입 (scholarship, career, academic, general...)
// dept:{id}      → 학과 (cs, ee, math, ...)
// library:{id}   → 도서관
// dorm:{id}      → 기숙사 (향후)
```

**확장성 원칙 — 향후 버스·기숙사 알림 대비:**

- Cloud Function `sendNotification`이 `type` 필드 기반 switch 분기
- Firestore `notifications.type`/`notifications.data` 자유 구조
- 앱 측 `notification-router.ts`도 `type` 기반 switch (기존 구조 그대로 사용)
- Notification Channel 배열에 신규 채널 push
- Topic prefix 확장

---

## Firestore 스키마

### `users/{uid}` (유저 문서)

```ts
{
  locale: 'ko' | 'en';           // ⭐ 서버 발송 시 언어 선택 기준
  // 향후 유저 레벨 설정 추가 가능
}
```

> `locale`은 device가 아닌 user 레벨. 유저가 앱에서 언어 변경 시 이 필드 업데이트.
> Cloud Function `syncUserLocaleToDevices`가 devices에 자동 복제 (쿼리 최적화).

### `users/{uid}/preferences` (단일 문서)

```ts
{
  enabled: boolean;           // 마스터 스위치
  subscribedTopics: string[]; // ["category:scholarship", "dept:cs", ...]
}
```

> **`enabled`과 `subscribedTopics`의 관계:**
>
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
  locale: 'ko' | 'en';           // ← users.locale 복제 (쿼리 최적화)
}
```

> **top-level + 필드 복제인 이유:** 발송 쿼리가 **한 번**으로 완결.
> `devices.where('active','==',true).where('notificationsEnabled','==',true).where('subscribedTopics','array-contains-any',topics)`
> locale은 쿼리 후 Map으로 그룹핑(`ko: [...]`, `en: [...]`)하여 언어별 sendEachForMulticast 호출.

> **`deviceId` 생성:** 앱 첫 실행 시 UUID 생성 → MMKV에 영구 저장.
> 앱 삭제 후 재설치 시 새 UUID. FCM token과 분리 (token은 refresh될 수 있지만 deviceId는 불변).
> `getOrCreateDeviceId()` 함수로 구현.

> **`notifications/{id}` 컬렉션은 사용하지 않음 (옵션 D).** 원본 공지 히스토리는 MongoDB + 공지 탭이 이미 커버하고, 미확인 알림은 로컬 뱃지(Notifee + Zustand)로 처리. Firestore 비용 0원 + Security Rules 단순화 + Cloud Function 페이로드 경량화. 향후 "알림함" 재도입이 필요해지면 `type`/`deptId`/`articleNo` 딥링크 필드는 그대로 유지되고 `data.notificationId`만 추가하면 재확장 가능.

### Firestore Security Rules

```text
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

    // `notifications/{id}` 블록 없음 — 옵션 D에서 컬렉션 자체를 만들지 않음
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

/**
 * Hybrid 페이로드(notification + data) 사용 시 백그라운드·quit 상태는
 * OS가 notification 필드로 자동 표시. 이 핸들러는 로깅만 수행.
 */
export async function backgroundMessageHandler(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
) {
  if (__DEV__) console.log('[fcm] background:', remoteMessage.messageId);
}
```

> **주의:** 여기서 `notifee.displayNotification()`을 호출하면 **hybrid 페이로드에서 알림이 중복 표시**됨 (OS 자동 + Notifee). 포그라운드 전용으로 분리.

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
  // 향후: BUS: 'bus', DORM: 'dorm',
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

> **MVP 정책:** MANDATORY_TOPICS는 현재 `[]` (empty). Security Rules의 "MANDATORY_TOPICS 강제 포함" 체크는 empty set subset 조건으로 자동 통과. 향후 긴급 공지(예: `'urgent:announcement'` — 학교 전체 공지, 시스템 점검 등)가 필요해지면 이 배열에 추가. 배열 변경 시 기존 유저의 `preferences` 문서에도 반영 필요 — 서버 Admin SDK로 일괄 migration 권장 (모든 유저가 next launch 때 자동 포함되긴 하지만 기존 devices가 즉시 topic에 등록돼야 그 시점부터 수신).

### 1.10 알림 딥링크 라우터

**생성:** `apps/mobile/src/services/notification-router.ts`

```ts
interface NotificationData {
  type?: string;
  notificationId?: string;  // Firestore notifications/{id} — 읽음 처리용
  deptId?: string;
  articleNo?: string;
  category?: string;
}
// type: 'notice' → router.push(`/notices/${deptId}/${articleNo}`)
// 향후: type: 'bus_arrival' → router.push(`/bus/${stopId}`)
```

### 1.11 알림 핸들러 훅

**생성:** `apps/mobile/src/hooks/useNotificationHandler.ts`

RootLayout 내부 (InitGate 안쪽):

- `getInitialNotification()` — quit-state 딥링크
- `onNotificationOpenedApp()` — background-state 딥링크
- `onForegroundMessage()` — 포그라운드 수신 시 Notifee 로컬 알림 표시 (Phase 3)
- **탭 시 `data.notificationId` 있으면 `markNotificationAsRead()` 호출** (Phase 3 연동)
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
  locale: 'ko' | 'en';            // ⭐ users.locale 복제 (쿼리 최적화)
}

export interface PreferencesDocument {
  enabled: boolean;
  subscribedTopics: string[];
}

export interface UserDocument {
  locale: 'ko' | 'en';
}

// `NotificationDocument` 없음 — 옵션 D에서 notifications 컬렉션 미사용
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
  // Cloud Function syncUserLocaleToDevices가 devices 자동 복제

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

// 알림함(markNotificationAsRead, subscribeToNotifications 등) 함수 없음 — 옵션 D
```

### 2.3 Firestore Security Rules 배포

**생성:** `apps/mobile/firestore.rules` (또는 레포 루트)

Phase 2 앱 작업의 일부로 배포:

```bash
firebase deploy --only firestore:rules
```

> Rules는 `users`/`users/{uid}/preferences`/`devices`만 커버. `notifications`는 옵션 D에서 제거됨.
> Node 서버 Admin SDK는 Rules 우회하므로 서버 PR과 무관.

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
  unreadCount: number;  // 알림함 뱃지용
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

> **`useNotificationInbox` 훅 없음** — 옵션 D에서 알림함 UI 제거. 대신 뱃지 카운트는 Zustand store의 `unreadCount`로 Phase 3에서 처리.

### 2.6 앱 초기화에서 Firestore 등록

**수정:** `apps/mobile/src/hooks/useAppInit.ts`

토큰 획득 후 — **병렬화로 Firestore 왕복 시간 최소화** (앱 기동 지연 방지):

```ts
const deviceId = getOrCreateDeviceId();

// 1. 필수 초기화 병렬 조회
const [userDoc, prefsDoc] = await Promise.all([
  getUserDoc(uid),
  getPreferences(uid),
]);

// 2. 없는 문서 동시 생성
const bootstrap: Promise<void>[] = [];
if (!userDoc) {
  bootstrap.push(updateUserLocale(uid, resolveAppLanguage()));
}
if (!prefsDoc) {
  bootstrap.push(updatePreferences(uid, {
    enabled: false,
    subscribedTopics: [...MANDATORY_TOPICS],
  }));
}
await Promise.all(bootstrap);

// 3. Device 등록 (preferences + locale 복제)
const finalPrefs = prefsDoc ?? { enabled: false, subscribedTopics: [...MANDATORY_TOPICS] };
const locale = userDoc?.locale ?? resolveAppLanguage();
if (token) {
  await registerDevice(deviceId, {
    uid, token, platform, appVersion, lastActive: now, active: true,
    subscribedTopics: finalPrefs.subscribedTopics,
    notificationsEnabled: finalPrefs.enabled,
    locale,
  });
}
```

**재시도 + 앱 기동 block 방지:**

```ts
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { return await fn(); }
    catch (err) {
      if (attempt === maxAttempts) throw err;
      await new Promise(r => setTimeout(r, 2 ** attempt * 500)); // 1s, 2s, 4s
    }
  }
  throw new Error('unreachable');
}

// useAppInit 본체:
try {
  await withRetry(() => initializeFirestoreNotifications(uid, token));
} catch (err) {
  // 기동 block 금지 — 알림만 실패, 앱은 정상 사용 가능
  reportCrashlytics('notifications/init', err);
}
```

**설계 의도:**

- 순차 실행(왕복 3~5회) → 병렬화로 대략 1 왕복 시간으로 단축
- 3회 exponential backoff (1s / 2s / 4s)로 네트워크 플레어 대응
- 전체 실패 시 Crashlytics 리포트만, `setIsReady(true)` 블로킹 금지 — 알림 기능은 off-critical
- offline 기동 시에도 앱 전반 기능 사용 가능 (알림 등록은 다음 온라인 기동 시 재시도)

**auth 변경 시 (anonymous → Google, Google → anon on sign-out) uid 변경 → 디바이스 문서 uid 업데이트 — Task #12 (2026-04-23 완료)**:

- **트리거:** `useAppInit`의 `onAuthStateChanged` 콜백이 `authStore.lastKnownUid`와 새 `user.uid`를 비교. 다르면 `initializeFirestoreNotifications()`를 재호출하여 `devices/{deviceId}.uid`를 새 uid로 덮어쓴다. `lastKnownUid`는 signed-out 상태 (`setUnauthenticated()`)를 거치면서도 보존되어야 sign-out → anon-re-sign-in 전환을 감지할 수 있음 — auth 스토어의 `setUnauthenticated`가 필드별 부분 merge를 쓰는 이유.
- **Race 방지:** `withRetry`의 closure 안에서 `getAuth().currentUser?.uid`를 **매 attempt마다 lazy하게** 재해석. retry가 auth transition 중간에 착지해도 그 시점의 current uid로 write. Bootstrap(:186), auth-transition(신규), `onTokenRefresh`(:220) 세 곳 모두 동일 패턴.
- **Firestore rule 수정:** `devices/{deviceId}` update rule을 `active` 필드 기반 claim 시맨틱으로 완화 — active 문서는 본인만, inactive 문서는 아무 authed user가 claim 가능. Sign-out 시 `signOutFromGoogle()`이 먼저 `unregisterDevice(deviceId)`로 `active: false` 처리. `apps/mobile/firestore.rules:38–66`의 SECURITY TRADE 주석 참조.
- **Rules unit test:** `apps/mobile/firestore.rules.test.mjs` (13 케이스). `yarn test:rules`로 실행 (내부적으로 Firestore emulator + Node 20 built-in `node:test` 사용, JDK 21+ 필수 — script가 openjdk@25를 내장 override).

언어 변경 시 `updateUserLocale(uid, newLang)` 호출 → Cloud Function `syncUserLocaleToDevices`가 devices 자동 전파.

### 2.7 exports 업데이트

**수정:** `packages/shared/src/index.ts` — notification 타입(`UserDocument`, `DeviceDocument`, `PreferencesDocument`), 스토어, topic 상수 export

> **Phase 2.8 (notifications 컬렉션 TTL) 섹션 삭제됨** — 옵션 D 채택으로 `notifications` 컬렉션 자체가 없어서 TTL 정책·cleanup Cloud Function 모두 불필요.

---

## Phase 3: Subscription UI + 뱃지

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

**생성:**

- `apps/mobile/app/notifications/_layout.tsx`
- `apps/mobile/app/notifications/settings.tsx`

**수정:** `apps/mobile/app/_layout.tsx` — `<Stack.Screen name="notifications" />`

> 알림함 라우트(`inbox.tsx`) 없음 — 옵션 D.

### 3.3 진입점

**수정:** More 화면에 "알림 설정" 메뉴만. `Bell` 아이콘 (lucide-react-native).

> "알림함" 메뉴는 추가하지 않음. 미확인 알림 가시성은 **공지 탭 뱃지(3.6)** 와 **앱 아이콘 뱃지(3.7)** 로 대체.

### 3.4 권한 요청 UX

- 마스터 토글 ON → `requestPermission()` (OS 팝업)
- 또는: 공지사항 탭 N회 방문 후 soft prompt (BottomSheet)
- denied → "설정으로 이동" 버튼

**생성:** `apps/mobile/src/features/notifications/NotificationPromptSheet.tsx`

### 3.5 포그라운드 메시지 처리

**수정:** `apps/mobile/src/hooks/useNotificationHandler.ts`

`onForegroundMessage()` 핸들러 안:

```ts
import notifee from '@notifee/react-native';

onForegroundMessage(async (remoteMessage) => {
  const { notification, data } = remoteMessage;
  if (!notification) return;

  // 포그라운드는 OS가 자동 표시 안 함 → Notifee로 로컬 알림
  await notifee.displayNotification({
    title: notification.title,
    body: notification.body,
    android: {
      channelId: mapCategoryToChannel(data?.category as string | undefined),
      pressAction: { id: 'default' },
    },
  });
});
```

> **백그라운드 핸들러에서는 `displayNotification` 호출 금지.** Hybrid 페이로드에서 OS가 이미 표시 중 → 중복 발생.

> **iOS UX 주의:** iOS는 관례상 앱 사용 중 알림 표시가 방해로 느껴질 수 있음. Phase 3 실기기 dogfooding 단계에서 유저 피드백 기준으로 전환 고려:
>
> - **(A) 양쪽 다 Notifee** `displayNotification` — 현 계획, iOS에서도 상단 헤드업 배너 표시
> - **(B) Android = Notifee, iOS = in-app toast** — SDS Toast 컴포넌트 활용 또는 신규 작성. iOS 전용 UX 관례 준수
> - **(C) 양쪽 다 in-app toast** — 플랫폼 일관성
>
> 초기 구현은 (A) 유지. dogfooding에서 "알림 방해" 피드백 나오면 (B)로 전환 — `Platform.OS === 'ios'` 분기만 추가하면 되는 low-cost 변경.

### 3.6 공지 탭 뱃지 + 앱 아이콘 뱃지 (옵션 D 핵심)

옵션 D는 알림함 UI가 없는 대신 **"미확인 알림이 있다"는 가시성**을 뱃지 두 종류로 제공한다.

#### 3.6.1 Zustand 로컬 카운터

**수정:** `packages/shared/src/store/notifications.ts`

```ts
interface NotificationState {
  // ... 기존 필드
  unreadCount: number;
}

interface NotificationActions {
  incrementUnread: () => void;      // 푸시 수신 시
  resetUnread: () => void;          // 유저가 공지 탭 진입 시
}
```

MMKV persist로 앱 재기동 후에도 카운터 유지.

#### 3.6.2 수신 경로에서 카운터 + OS 뱃지 증가

**수정:** `apps/mobile/src/services/background-messaging.ts`

```ts
import notifee from '@notifee/react-native';
import { notificationStore } from '@skkuverse/shared';

export async function backgroundMessageHandler(remoteMessage) {
  if (__DEV__) console.log('[fcm] background:', remoteMessage.messageId);
  await notifee.incrementBadgeCount(1);       // OS 앱 아이콘 뱃지 +1
  notificationStore.getState().incrementUnread();  // 인앱 뱃지 +1
}
```

**수정:** `apps/mobile/src/hooks/useNotificationHandler.ts` — `onForegroundMessage` 안쪽:

```ts
onForegroundMessage(async (remoteMessage) => {
  const { notification, data } = remoteMessage;
  if (!notification) return;

  // 포그라운드는 OS가 자동 표시 안 함 → Notifee로 로컬 알림 (3.5)
  await notifee.displayNotification({ ...fields });

  // 뱃지 카운트 증가
  await notifee.incrementBadgeCount(1);
  notificationStore.getState().incrementUnread();
});
```

#### 3.6.3 공지 탭 진입 시 리셋

**수정:** `apps/mobile/app/(tabs)/notices.tsx` (또는 `NoticesTabScreen`)

```ts
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import notifee from '@notifee/react-native';
import { notificationStore } from '@skkuverse/shared';

useFocusEffect(
  useCallback(() => {
    notifee.setBadgeCount(0);                    // OS 뱃지 제거
    notificationStore.getState().resetUnread();  // 인앱 뱃지 제거
  }, [])
);
```

> **리셋 시점을 "공지 탭 진입"으로 잡는 이유:** 알림 = 새 공지 알림. 유저가 공지 탭을 열면 새 공지들을 이미 보게 되는 경로이므로 뱃지 목적 달성. 추가 read-tracking 없이 간단하게 해결.

#### 3.6.4 공지 탭 뱃지 렌더링

**수정:** `apps/mobile/app/(tabs)/_layout.tsx` — 공지 탭의 `tabBarBadge` prop.

```tsx
<Tabs.Screen
  name="notices"
  options={{
    tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
  }}
/>
```

`unreadCount`는 Zustand store에서 selector로 구독. 0일 때 undefined 반환으로 뱃지 숨김.

### 3.7 푸시 탭 시 딥링크 (읽음 처리 없음)

**수정:** `apps/mobile/src/hooks/useNotificationHandler.ts`

```ts
// getInitialNotification + onNotificationOpenedApp 공통 처리:
const handlePress = (remoteMessage) => {
  const data = remoteMessage?.data as NotificationData | undefined;
  navigateFromNotification(data);
  // markAsRead 없음 — 옵션 D에서는 Firestore notifications 없음
  // 뱃지는 3.6.3에서 공지 탭 진입 시 자동 리셋
};
```

> 탭해서 들어간 공지 상세 화면을 벗어나 공지 탭으로 돌아오는 시점에 `useFocusEffect`가 발동 → 뱃지 자동 리셋.

### 3.8 언어 변경 → Firestore sync

**수정:** 언어 변경 로직 (settings store setter 또는 useAppInit)

```ts
// 앱 내 한국어 → 영어 전환 시:
updateUserLocale(uid, newLang);
// Cloud Function syncUserLocaleToDevices가 devices.locale 자동 복제
// 다음 알림부터 새 언어로 수신
```

> **App Groups / UserDefaults sync 불필요.** 서버가 `devices.locale` 읽어서 알림 생성 시 언어 선택하므로 앱 단 sync 불필요.

### 3.9 Analytics

**수정 없음.** Firebase Analytics가 `notification` 필드 포함 메시지에 대해 다음 이벤트를 **자동 기록**:

- `notification_receive` (백그라운드·quit 수신)
- `notification_open` (탭)
- `notification_dismiss` (스와이프)
- `notification_foreground_receive` (포그라운드 수신)

`fcmOptions.analyticsLabel`로 캠페인별 집계 가능. 수동 `logEvent('push_notification_*')` 불필요.

> **예외:** 유저 언어별 클릭률, 학과별 오픈율 등 커스텀 차원 분석이 필요하면 `analyticsLabel` 외에 별도 수동 로그 추가 가능. 기본 계획엔 포함 안 함.

---

## 수정 대상 파일 요약

### 신규 생성

| 파일 | Phase |
| --- | --- |
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
| `apps/mobile/app/notifications/_layout.tsx` | 3 |
| `apps/mobile/app/notifications/settings.tsx` | 3 |
| `apps/mobile/src/features/notifications/NotificationSettingsScreen.tsx` | 3 |
| `apps/mobile/src/features/notifications/NotificationPromptSheet.tsx` | 3 |

### 기존 수정

| 파일 | Phase | 변경 |
| --- | --- | --- |
| `apps/mobile/package.json` | 1 | `"main": "./index.ts"` |
| `apps/mobile/app.config.ts` | 1 | plugin + entitlements (APP_ENV 분기) + UIBackgroundModes |
| `apps/mobile/firebase.json` | 1 | messaging 설정 2줄 |
| `apps/mobile/app/_layout.tsx` | 1,3 | handler hook + notifications route |
| `apps/mobile/app/(tabs)/_layout.tsx` | 3 | 공지 탭 tabBarBadge (unreadCount) |
| `apps/mobile/app/(tabs)/notices.tsx` | 3 | useFocusEffect로 뱃지 리셋 (Notifee + Zustand) |
| `apps/mobile/src/hooks/useAppInit.ts` | 1,2 | FCM 등록 + 토큰 + deviceId + users/devices/preferences Firestore 등록 |
| `apps/mobile/src/hooks/useNotificationHandler.ts` | 3 | foreground Notifee + 뱃지 증가 (markAsRead 없음) |
| `apps/mobile/src/services/background-messaging.ts` | 3 | 뱃지 증가 (Notifee + Zustand) |
| `packages/shared/src/store/notifications.ts` | 2,3 | unreadCount 필드 + increment/reset actions |
| `packages/shared/src/index.ts` | 2 | notification 타입/스토어/상수 export |

### 삭제 대상 (이전 계획 잔재 — **이미 삭제됨 또는 애초에 생성하지 않음**)

- ~~`apps/mobile/plugins/withNotificationServiceExtension.js`~~ — iOS NSE 전략 폐기
- ~~App Groups 설정 / NSE Bundle ID~~ — NSE 없음
- ~~`title_ko`/`title_en`/`body_ko`/`body_en` data 필드~~ — 서버가 `notification.title`/`body`에 완성 문구 탑재
- ~~background-messaging.ts의 `notifee.displayNotification`~~ — hybrid 페이로드로 OS 자동 표시
- ~~Analytics 수동 `push_notification_open/receive` 로그~~ — Firebase 자동 이벤트로 대체
- ~~`notifications` Firestore 컬렉션~~ — 옵션 D에서 미사용 (앱 아이콘/탭 뱃지는 로컬 카운터로 대체)
- ~~`NotificationDocument` 타입, `markNotificationAsRead`, `subscribeToNotifications`, `useNotificationInbox`, `NotificationInboxScreen.tsx`, `inbox.tsx` 라우트~~ — 옵션 D
- ~~`data.notificationId` 필드~~ — 읽음 처리 없으므로 불필요
- ~~Phase 2.8 TTL 정책 / `cleanupStaleNotifications` Cloud Function~~ — `notifications` 컬렉션 없음

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
      type: 'notice',                  // ⭐ 확장 지점
      noticeId: notice.id,
      topics: computeTopics(notice),  // ["category:scholarship", "dept:cs"]
      title_ko: notice.title,         // MongoDB에 한국어 필드만 존재
      body_ko: notice.summary,
      // ko-only MVP: title_en/body_en은 현재 null. Cloud Function이 ko fallback.
      // 영문 번역 파이프라인 구축 시 이 두 필드만 채우면 locale='en' 유저가 자동으로 영문 수신.
      title_en: notice.title_en ?? null,
      body_en: notice.summary_en ?? null,
      deptId: notice.deptId,
      articleNo: notice.articleNo,
      category: notice.category,
    }),
  });
}
```

> 다국어 문구는 **Cloud Function 측에서 locale별로 선택**해서 `notification.title`/`body`에 탑재. 현재 MVP는 ko-only — Node는 한국어만 보내고 영문은 `null` 또는 생략. 향후 영문 데이터 추가 시 Node 측 코드만 업데이트.

### Firebase Cloud Functions (별도 workspace: `functions/`)

위치: monorepo 루트 `functions/` 또는 별도 저장소

**1. `sendNotification` — HTTP function (범용 진입점, 확장 지점)**

```ts
export const sendNotification = onRequest(async (req, res) => {
  // 1. API key 인증
  if (req.headers['x-api-key'] !== process.env.API_KEY) {
    return res.status(401).send('Unauthorized');
  }

  // 2. 타입별 분기
  switch (req.body.type) {
    case 'notice':
      return handleNoticeNotification(req.body, res);
    // 향후 추가 예정:
    // case 'bus_arrival': return handleBusNotification(req.body, res);
    // case 'dorm':        return handleDormNotification(req.body, res);
    default:
      return res.status(400).send(`Unknown type: ${req.body.type}`);
  }
});
```

**2. `handleNoticeNotification` — 공지 발송 로직 (옵션 D — 레코드 생성 없음)**

```text
1. devices 쿼리 (한 번):
   where active == true
     AND notificationsEnabled == true
     AND subscribedTopics array-contains-any topics  // ≤10개 제한 주의

2. locale별 그룹핑: { ko: [...], en: [...] }

3. 각 그룹마다 sendEachForMulticast (500토큰씩 배치):
   - locale별 문구 선택 (ko fallback — MVP ko-only 대응):
     const title = locale === 'en' ? (payload.title_en ?? payload.title_ko) : payload.title_ko;
     const body  = locale === 'en' ? (payload.body_en  ?? payload.body_ko ) : payload.body_ko;
   - notification.title/body = 위에서 선택한 문구
   - data.type = 'notice', data.deptId, data.articleNo, data.category  // notificationId 없음 (옵션 D)
   - android.priority = 'high'
   - android.notification.channelId = mapCategoryToChannel(category)
   - apns.payload.aps.sound = 'default'
   - fcmOptions.analyticsLabel = `notice_${category}_v1`

4. UNREGISTERED/INVALID_ARGUMENT → devices/{id}.active = false
```

> **옵션 D 효과:** `notifications` 레코드 대량 생성(수신자당 1개) 단계가 사라져 **공지당 500 writes 완전 제거**. Cloud Function 실행 시간·Firestore 비용 동반 감소.

> **ko-only MVP 시사점:** 현재 `payload.title_en`/`body_en`이 null로 넘어오므로 locale='en' 유저도 `??` fallback에 의해 한국어 문구 수신. 영문 번역 파이프라인이 생기면 fallback이 자연스럽게 en 문구를 우선 선택 → 코드 변경 없음.

**3. `syncPreferencesToDevices` — Firestore onUpdate trigger**

```text
users/{uid}/preferences 변경 감지
  → 해당 uid의 모든 devices 문서에 subscribedTopics + notificationsEnabled 복제
```

> `_syncedAt` 필드 등으로 무한루프 방지 (devices onUpdate 트리거는 만들지 않음).

**4. `syncUserLocaleToDevices` — Firestore onUpdate trigger (**NEW**)**

```text
users/{uid}.locale 변경 감지
  → 해당 uid의 모든 devices 문서에 locale 복제
  → 다음 알림부터 새 언어로 수신
```

**5. `cleanupStaleDevices` — scheduled function**

```text
주기 cron (주 1회)
  → lastActive가 N개월 이전인 devices soft delete
  → UNREGISTERED 토큰으로 인한 유령 device 문서 정리 속도 개선 (월→주)
  → 빈번한 디바이스 변경(폰 교체, 앱 재설치) 환경 대응
```

> **유령 device 가설:** 앱 재설치 시 새 deviceId가 발급되고 기존 document는 active 상태로 남음. sendEachForMulticast에서 `UNREGISTERED` 반환되면 즉시 `active:false`로 바뀌지만, 그전까지는 불필요한 FCM 호출 발생. 주 1회 cron으로 빠른 정리.

### 인증

Node → Cloud Function 호출 시 `X-API-Key` 헤더 검증 (환경변수).
Google Cloud IAM은 스꾸 규모엔 오버엔지니어링.
Cloud Function URL은 `FCM_FANOUT_URL` env 변수로 관리 (dev/prod 분리 가능).

### Cloud Functions 배포

**위치:** monorepo 루트 `functions/` workspace (또는 별도 저장소). 앱 workspace와 의존성 분리.
**스택:** TypeScript + `firebase-functions` v6 + `firebase-admin` v12 + Node 20 런타임.

**배포 명령 (MVP — 수동):**

```bash
# 개별 function 배포 (권장 — 테스트 범위 명확)
firebase deploy --only functions:sendNotification
firebase deploy --only functions:syncPreferencesToDevices,functions:syncUserLocaleToDevices

# 전체 배포 (초기 셋업 시)
firebase deploy --only functions
```

**Secrets 관리:**

```bash
# 1st gen: functions config
firebase functions:config:set cloud.api_key="$(openssl rand -hex 32)"

# 2nd gen 마이그레이션 시: Secret Manager (권장)
firebase functions:secrets:set CLOUD_FUNCTION_API_KEY
```

**향후 자동화:** GitHub Actions (`.github/workflows/deploy-functions.yml`) — `main` 브랜치 `functions/` 하위 변경 push 시 `firebase deploy --only functions` 자동 실행. MVP는 수동으로 충분.

**로컬 테스트:**

```bash
# Firestore + Functions emulator
firebase emulators:start --only functions,firestore

# Cloud Function HTTP 호출 테스트 (Node 서버 연동 전)
curl -X POST http://localhost:5001/{project}/us-central1/sendNotification \
  -H "Content-Type: application/json" \
  -H "X-API-Key: local-dev-key" \
  -d '{ "type": "notice", "topics": ["category:scholarship"], ... }'
```

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

1. Firestore `devices/{deviceId}` 문서 생성 확인 (locale 포함)
2. `users/{uid}.locale` + `users/{uid}/preferences` 읽기/쓰기
3. auth 변경 → 토큰 재등록
4. Security Rules (다른 uid 차단) — `notifications` 규칙 없음 확인 (옵션 D)
5. `getOrCreateDeviceId()` → MMKV persist 확인

### Phase 3

1. 알림 설정 화면 → 탭/학과 목록
2. 마스터 ON → OS 팝업 → 토큰 획득
3. 카테고리/학과 토글 → Firestore 즉시 반영
4. 마스터 OFF → `enabled: false`, `subscribedTopics` 유지
5. 마스터 다시 ON → 이전 구독 복원
6. MANDATORY_TOPICS 비활성 토글
7. 포그라운드 수신 → Notifee 로컬 알림 표시 + **앱 아이콘 뱃지 +1 + 공지 탭 뱃지 +1**
8. 백그라운드 수신 → **OS 자동 표시** (Notifee 호출 없음 — 중복 없음 확인) + **앱 아이콘 뱃지 +1**
9. 알림 탭 → 딥링크 (`/notices/{deptId}/{articleNo}`)
10. 공지 탭 진입 → 앱 아이콘 뱃지 0으로 리셋 + 탭바 뱃지 제거 (`useFocusEffect`)
11. 언어 변경 → `users.locale` → Cloud Function → `devices.locale` 전파 확인 (다음 알림부터 언어 변경)
12. **Firebase Analytics DebugView 실시간 확인:**

    ```bash
    # Android
    adb shell setprop debug.firebase.analytics.app com.zoyoong.skkubus

    # iOS: Xcode → Edit Scheme → Run → Arguments → "-FIRDebugEnabled"
    ```

    Firebase Console → Analytics → DebugView에서 알림 수신/탭 시 다음 이벤트가 실시간 기록되는지 확인:
    - `notification_receive` (백그라운드·quit 수신)
    - `notification_open` (탭)
    - `notification_dismiss` (스와이프)
    - `notification_foreground_receive` (포그라운드 수신)

    `fcmOptions.analyticsLabel`(예: `notice_scholarship_v1`) 값이 이벤트 파라미터에 태깅되는지 함께 확인. → 카테고리별 오픈율 분석에 활용.

### 통합 E2E (출시 전)

1. 서버 공지 발행 → Android/iOS 알림 수신 + 앱 아이콘 뱃지 +1
2. 탭 → 딥링크 → 공지 상세 → 공지 탭으로 돌아오면 뱃지 자동 리셋
3. 언어 전환 → 다음 알림 언어 변경
4. 구독 해제 → 미수신 확인
5. 마스터 OFF → 전체 미수신 확인
6. 앱 종료 후 재기동 → Zustand `unreadCount` 영속성 확인 (MMKV persist)

---

## 주의사항

1. **`useFrameworks: "static"`** — 기존 `withFirebaseModularHeaders.js`가 RNFB 전체 커버. Notifee static linking 호환 확인
2. **Expo Go 미지원** — dev build 필수 (이미 사용 중)
3. **`expo-notifications` 미설치** — FCM + Notifee와 충돌 방지
4. **Android 13+ POST_NOTIFICATIONS** — `messaging().requestPermission()` 자동 처리
5. **runtimeVersion bump** — 네이티브 모듈 3개 추가 → OTA 불가, `3.5.1` → `3.6.0`
6. **`setBackgroundMessageHandler` 위치** — `index.ts`에서 `expo-router/entry` 전. `_layout.tsx` 금지
7. **iOS `registerDeviceForRemoteMessages()`** — `auto_register: false` 시 필수. 안 하면 `UNREGISTERED` 에러
8. **Firestore Security Rules** — Phase 2에서 앱 코드와 함께 배포. Admin SDK는 우회
9. **RNFB 버전 일치** — firestore 추가 시 기존 모듈과 같은 메이저 버전 유지
10. **`array-contains-any` 최대 10개** — 공지당 topics 10개 이하 유지. 초과 시 쿼리 분할 필요. **전학과 공지 대응 (향후):** 68개 학과 전체 대상 공지가 필요해지면 `dept:all` 와일드카드 토픽 도입 — MANDATORY_TOPICS 또는 가입 시 default로 모든 유저가 자동 구독. Phase 3 착수 후 실제 운영 데이터 기준으로 필요성 재평가. MVP는 현 구조로 충분
11. **`syncPreferencesToDevices`/`syncUserLocaleToDevices` 무한루프 방지** — devices onUpdate 트리거 만들지 않기. sync-originated change 구분 필요 시 `_syncedAt` 필드로 판별
12. **토글 debounce** — 알림 설정 화면에서 Firestore write를 500ms debounce. sync Cloud Function 과도 실행 방지
13. **Hybrid 페이로드 중복 표시 함정** — 백그라운드 핸들러에서 절대 `notifee.displayNotification()` 호출 금지. OS 자동 표시 + Notifee로 **2회 알림** 발생. 포그라운드에서만 Notifee 호출
14. **Cloud Function `type` 계약** — 신규 타입 추가 시 기존 `handleNoticeNotification`과 동일한 페이로드 계약(`notification` 필드 + `data.type`/딥링크 필드 필수) 유지
15. **Android hybrid intent 주의** — Android 백그라운드에서 hybrid 페이로드 수신 시 data는 `onNewIntent` 경유. RNFirebase `getInitialNotification()`/`onNotificationOpenedApp()`이 추상화하지만, 네이티브 Activity launchMode 변경 시 회귀 가능. 자세한 사항은 [FCM 공식 문서](https://firebase.google.com/docs/cloud-messaging/customize-messages/set-message-type)
16. **뱃지 멀티 디바이스 싱크 미지원 (옵션 D 제약)** — `unreadCount`는 Zustand + MMKV 로컬 카운터라 폰/태블릿 간 독립. 한 기기에서 공지 탭 열어도 다른 기기의 뱃지는 남아있음. 스꾸버스 유저 대부분이 단일 기기 사용이라 실용상 무시 가능. 멀티 디바이스 싱크가 필요해지면 옵션 A(Firestore `notifications` 컬렉션 + onSnapshot)로 전환 가능 — 이 경우 딥링크 필드(`type`/`deptId`/`articleNo`)는 그대로 재사용
17. **뱃지 리셋 타이밍** — 공지 탭 `useFocusEffect`에서 `notifee.setBadgeCount(0)` + `store.resetUnread()`. 알림 탭→딥링크(공지 상세)→뒤로(공지 탭) 흐름에서 마지막 단계에 자동 발동. 공지 탭을 경유하지 않는 진입 경로는 없으므로 누락 케이스 없음

---

## 진행 상태 (2026-04-19)

### Phase 1: FCM Foundation — ✅ 완료 (실기기 토큰 검증 + 테스트 알림 수신 완료)

| 단계 | 상태 | 비고 |
| --- | --- | --- |
| 1.1 패키지 설치 | ✅ | messaging@23.8.8, firestore@23.8.8, notifee@9.1.8 |
| 1.2 app.config.ts | ✅ | messaging plugin + aps-environment + UIBackgroundModes |
| 1.3 firebase.json | ✅ | messaging_auto_init + auto_register false |
| 1.4 APNs 키 설정 | ✅ | .p8 키 Firebase Console 업로드 완료 |
| 1.5 커스텀 entry point | ✅ | index.ts + background-messaging.ts + package.json main 변경 |
| 1.6 messaging.ts | ✅ | ensureRegistered, checkPermission, requestPermission, getDeviceToken 등 |
| 1.7 device-id.ts | ✅ | UUID v4 생성 + MMKV 영구 저장 |
| 1.8 notification-channels.ts | ✅ | Android 5개 채널 (academic, scholarship, career, general, department) |
| 1.9 topics.ts | ✅ | TopicPrefix, buildTopic, parseTopic, MANDATORY_TOPICS |
| 1.10 notification-router.ts | ✅ | data payload → Expo Router 경로 변환 (NotificationData 타입은 전략 변경에 따라 정리됨) |
| 1.11 useNotificationHandler.ts | ✅ | quit/background/foreground 처리, _layout.tsx에 통합 |
| 1.12 useAppInit 통합 | ✅ | setupChannels → ensureRegistered → checkPermission → getToken |

### 추가 작업 (Phase 1 과정에서)

| 작업 | 상태 | 비고 |
| --- | --- | --- |
| withPushNotificationsCapability.js | ✅ | SystemCapabilities.com.apple.Push 추가 plugin |
| provisioning profile 갱신 | ✅ | Apple Developer Portal Push 활성화 → dist.mobileprovision에 aps-environment 포함 확인 |
| debug-fcm.tsx | ✅ | 임시 FCM 디버그 화면 (permission, deviceId, token 확인 + 복사) |
| AdMob init 순서 변경 | ✅ | FCM 이전 → 이후로 이동, fire-and-forget (시뮬레이터에서 blocking 방지) |
| iOS 시뮬레이터 빌드 | ✅ | 빌드 성공, 크래시 없음, FCM SDK 초기화 확인 |
| TestFlight 빌드 | ✅ | Build 3.5.1-100, 업로드 성공 |
| 실기기 토큰 검증 | ✅ | TestFlight 실기기에서 FCM 토큰 발급 + 테스트 알림 수신 성공 |

### 시뮬레이터 검증 결과

- ✅ FCM SDK 초기화 (`FIRMessaging proxy enabled`)
- ✅ 백그라운드 핸들러 등록 (`signalBackgroundMessageHandlerSet`)
- ✅ `checkPermission()` → authorized
- ✅ `getOrCreateDeviceId()` → UUID 생성 + MMKV 저장
- ❌ FCM 토큰 발급 불가 — 시뮬레이터에서 `aps-environment` entitlement가 strip됨 (자동 서명 제약)
- ✅ 실기기 TestFlight → 토큰 발급 + 알림 수신 성공 (2026-04-19 완료)

### 디버그 진입점 (유지 — Phase 3까지)

Phase 2 진행 중 실기기 진단이 필요해 일부 디버그 코드를 의도적으로 **유지**로 전환:

- `app/debug-fcm.tsx` — **유지**. Phase 2 전용으로 확장됨: permission/auth/token/Firestore docs/raw getLocales() 전체 진단 + Run Bootstrap Now / Request Permission / Open Settings / Copy Dump 액션. Phase 3 설정 화면 안정 후 제거.
- `app/(tabs)/campus.tsx` 빨간 "FCM" 플로팅 버튼 — **유지** (`__DEV__` 가드 없음, TestFlight에서도 노출). Phase 3 설정 화면이 공식 진입점 되면 제거.
- `src/hooks/useAppInit.ts` `requestPermission()` 호출 — **유지**. iOS에서 idempotent하므로 Phase 3 마스터 토글과 공존 가능.
- `plugins/withPushNotificationsCapability.js` — **영구 유지** (production 필수).

**Phase 2 이후 공식 확인 수단:**

- FCM 토큰: Firestore Console → `devices/{deviceId}` 문서 직접 확인 or 디버그 화면
- 권한 상태: iOS 설정 앱 / Android 앱 정보 → 알림 or 디버그 화면
- 수신 테스트: Firebase Console → Cloud Messaging → Send test message

### Phase 2: Firestore Integration — ✅ 완료 (2026-04-20)

**주요 커밋:**

- `b865c33` — Phase 2 Firestore device/preferences bootstrap (types, service, rules, store, hook, useAppInit integration)
- `b599a23` — requestPermission 복귀 + on-device debug screen (checkPermission이 팝업 못 띄워 신규 기기 bootstrap 미발동 이슈 해결)
- `9315e8b` — locale이 preference order를 따르고 매 launch마다 refresh (기존 users.locale stale 값 문제 해결)

- [x] Phase 1 임시 코드 정리 (requestPermission 복귀, debug-fcm은 Phase 2 도구로 확장)
- [x] 2.1 타입 정의 (`UserDocument`, `DeviceDocument`, `PreferencesDocument`)
- [x] 2.2 firestore-notifications.ts (device + preferences 함수만, 알림함 함수 없음)
- [x] 2.3 Security Rules 배포 (users + preferences + devices만. `notifications` 없음)
- [x] 2.4 Zustand notification store (`unreadCount` 포함)
- [x] 2.5 useNotificationPreferences 훅만 (useNotificationInbox 없음)
- [x] 2.6 useAppInit에 device/user/preferences 등록 통합 (Promise.all + withRetry + Crashlytics logHandledError)
- [x] 2.7 shared exports
- [x] Firestore Security Rules live 배포 (`skkubus-95723`)
- [x] TestFlight 빌드 3.5.1-102 업로드 + 실기기 검증 완료
- [x] OTA 2회 beta 채널 배포 (debug screen + locale refresh fix)

**Phase 2 구현 세부:**

- `users/{uid}.locale`은 매 launch마다 OS detect 결과로 refresh (preference list iterate, `getLocales()` 전체 순회 후 첫 supported 반환). `'zh'` → `'ko'` fallback.
- `devices/{deviceId}.locale`도 osLocale 직접 사용 (stale userDoc 무시).
- bootstrap은 fire-and-forget — withRetry 3회 (1s/2s/4s) 후 실패 시 Crashlytics `notifications/init` 라벨로 기록, 앱 기동 block 금지.
- onTokenRefresh 리스너도 동일 initializeFirestoreNotifications 재호출 — APNs 늦게 도착하거나 FCM 토큰 로테이션 시 자가치유.

### Phase 3: UI + 뱃지 — ✅ 완료 (2026-04-22)

**완료 커밋 요약 (chronological):**

- `497ebe9 feat(notifications): Phase 3 — settings UI + badge + foreground display` — UI + 뱃지 + 포그라운드 Notifee
- `082a14b fix(notifications): flush pending write on unmount` — (후속 commit 81cb070 로 대체)
- `085c2ce fix(notifications): force-refresh App Check token before Firestore writes` — primeAppCheck 도입
- `81cb070 fix(notifications): remove debounce orphan-promise race, await writes inline` — toggle write 경로 race 제거
- `fdef8a1 chore(fcm): diag instrumentation for preferences-write stall` — `[fcm-diag]` 진단 로그 (TestFlight 안정 후 revert 예정)
- (후속) `chore(fcm): diag logging for Firestore realtime listener path` — `[fcm-diag]` 로그 범위 확장. Revert 범위에 다음 파일들 포함:
  - `apps/mobile/src/services/firestore-notifications.ts` (onPreferencesChanged ATTACH/DETACH/fire + snapshot metadata, updatePreferences prime/set timing split, primeAppCheck UNCHANGED/ROTATED detection, initializeFirestoreNotifications START/reads/END)
  - `apps/mobile/src/hooks/useNotificationPreferences.ts` (effect run, callback with diff-vs-prior, cleanup)
  - `apps/mobile/src/hooks/useAppInit.ts` (onAuthStateChanged uid transition log, 3x `[fcm-diag] bootstrap ... FAILED` warn, firestore.setLogLevel confirmation log)
  - `apps/mobile/src/features/notifications/NotificationSettingsScreen.tsx` (localPrefs sync from onSnapshot with change detection, writeAndLog START/SUCCESS/FAILED)
  - 전체 grep: `grep -rn '\[fcm-diag\]' apps/mobile/src` → 모두 제거
- `9c27e41 fix(app-check): inject debug token via JS provider.configure on iOS simulator` — **debug token 주입 경로 fix (아래 섹션 참조)**
- `b2ca214 fix(app-check): strip debug token from beta/production bundles` — prod/beta 번들에서 debug token extras 제거

**실기기 / TestFlight 확인 남은 것:**

- [ ] TestFlight 빌드에서 App Attest 경로로 App Check 정상 작동
- [ ] Android 실기기 / Emulator 에서 Play Integrity 경로 확인
- [ ] 백그라운드/킬드 수신 시 OS 자동 표시 + 뱃지 +1
- [x] **preferences ↔ devices drift fix 완료 (2026-04-23)** — Option B (CF 배포) 채택. `syncPreferencesToDevices` (2nd gen, asia-northeast3, retry + age guard + diff guard + maxInstances: 10) 배포 완료. 실측 latency ~0.3초. `functions/src/sync-preferences-to-devices.ts`. 기존 테스트용 CF 6개 (`KingoLogin`, `SetToken`, `LiveActivity_*`, `*Live*`) 같이 삭제됨. 6 → 1 clean slate. Phase 3 디버깅 기록 #2 + Phase 3 과금/주의사항 섹션 참조.
- [x] **`[fcm-diag]` 로그 revert 완료 (2026-04-23)** — 4개 파일 (`firestore-notifications.ts` / `useNotificationPreferences.ts` / `useAppInit.ts` / `NotificationSettingsScreen.tsx`) 전부 원래 dev-only 패턴으로 복원. 디버깅 기법 두 개는 아래 "Phase 3 디버깅 기법 정리" 섹션에 문서화만 남김 (필요 시 재적용하기 위한 reference).
- [ ] **Node 20 → 22 runtime bump** — Node 20 deprecated 2026-04-30. `functions/package.json` 의 `engines.node` 를 `"22"` 로 변경 후 `firebase deploy --only functions:syncPreferencesToDevices --force`. 7일 내 긴급.
- [ ] **GCP Billing budget alert 설정** — 월 $5 budget + $1/$3/$5 이메일 알림. runaway CF 시 사전 차단. Firebase Console → ⚙ → Usage and billing → Billing account → "예산 만들기". 5분.
- [ ] **나머지 CF 4개 배포** — 아래 "CF 배포 현황 및 잔여" 섹션 참조.

### Phase 3 디버깅 기록: App Check debug token on iOS Simulator

**증상 (user-visible):** 알림 설정 화면에서 토글 ON/OFF 시 UI는 즉시 반응하지만 Firebase Console `users/{uid}/preferences/main` 문서는 안 바뀜. 앱 kill + 재실행해야 전 세션의 토글 결과가 문서에 반영됨.

**뿌리 원인 (5겹):**

1. `.env` 의 `FIREBASE_APP_CHECK_DEBUG_TOKEN_IOS` 가 **네이티브 iOS 에 연결된 적 없음.** `@react-native-firebase/app-check` Expo plugin 은 `AppDelegate.swift` 에 `RNFBAppCheckModule.sharedInstance()` 한 줄만 삽입 — `.env` 참조 로직 없음.
2. 그래서 AppCheckCore 의 `GACAppCheckDebugProvider` 는 env var 도 UserDefaults 도 비어있는 상태로 시작 → **매 실행마다 새 random UUID 생성**해서 UserDefaults 에 저장.
3. 이 random UUID 는 Firebase Console 의 debug tokens 에 등록돼 있지 않으므로 `POST .../exchangeDebugToken` 이 **HTTP 403 `"App attestation failed."`** 반환.
4. App Check 토큰 없이 Firestore `.set()` 하면 offline persistence 가 로컬 캐시에 반영 (→ `onSnapshot` 은 즉시 새 값 emit, UI 는 정상 갱신) 후 서버로 retry. 서버는 거부, mutation 은 **pending-writes queue 에 적재**.
5. 콜드 스타트 시 queue 가 disk persist 되어 retry 재개 → 어느 시점에 토큰 교환이 우연히 성공하면 queue flush → 사용자에게 "재실행 후 한꺼번에 반영" 으로 보임.

**fix (`9c27e41` + `b2ca214`):**

```ts
// app.config.ts — EAS_BUILD_PROFILE gate
extra: {
  ...(process.env.EAS_BUILD_PROFILE === "beta" ||
  process.env.EAS_BUILD_PROFILE === "production"
    ? {}
    : {
        firebaseAppCheckDebugTokenIos:
          process.env.FIREBASE_APP_CHECK_DEBUG_TOKEN_IOS,
        firebaseAppCheckDebugTokenAndroid:
          process.env.FIREBASE_APP_CHECK_DEBUG_TOKEN_ANDROID,
      }),
  // ...
}

// src/services/app-check.ts — provider.configure에 debugToken 전달
const extra = Constants.expoConfig?.extra ?? {};
provider.configure({
  apple: {
    provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
    ...(__DEV__ && extra.firebaseAppCheckDebugTokenIos
      ? { debugToken: extra.firebaseAppCheckDebugTokenIos as string }
      : {}),
  },
  // android 동일 패턴
});
```

RN Firebase 의 `RNFBAppCheckProvider.m:44–48` 이 `debugToken` 인자를 받으면 `setenv("FIRAAppCheckDebugToken", value)` 호출 → AppCheckCore 가 `NSProcessInfo.processInfo.environment` 에서 직접 읽음 → UserDefaults 경로 우회.

**왜 UserDefaults 경로는 안 되는지:** `GACAppCheckDebugProvider` 소스상으로는 UserDefaults (`GACAppCheckDebugToken` key) 가 정상 fallback 으로 동작해야 함. 실제로 `xcrun simctl spawn booted defaults write com.example.skkumap GACAppCheckDebugToken <uuid>` 로 값을 써도 앱은 이 값을 안 읽고 다른(auto-generated) UUID 를 계속 씀. 추정 원인은 GULUserDefaults 의 초기 캐싱/container path mismatch 이지만 결론은 "이 경로는 믿지 말 것 — JS setenv 경로 쓸 것".

**실기기(App Attest) 시에는 debug token 이 존재해도 무시됨.** `__DEV__ === false` 에서 `provider: 'appAttestWithDeviceCheckFallback'` 이 선택돼 `FIRAppAttestProvider` 가 instantiate, debug token 은 dead code path. `EAS_BUILD_PROFILE` gate 까지 같이 쓰면 bundle 자체에도 안 들어감.

**시뮬레이터 동작 안 할 때 디버그 순서:**

1. Metro 에 `[fcm-diag] app-check refresh FAILED: ... 403 ... "App attestation failed"` 뜨는지 확인 (diag 로그 유지 중)
2. `.env` 의 `FIREBASE_APP_CHECK_DEBUG_TOKEN_IOS` 값과 Firebase Console → Project → App Check → iOS 앱 (`com.example.skkumap`) → Manage debug tokens 리스트가 **대소문자까지 정확히** 일치하는지 확인
3. `.env` 만 바꾸고 rebuild 안 했으면 `npx expo prebuild --clean && yarn ios` — `app.config.ts extras` 는 빌드 타임에 박히므로 네이티브 재빌드 필요
4. 위 모두 맞는데 여전히 실패면 `Constants.expoConfig?.extra.firebaseAppCheckDebugTokenIos` 가 런타임에 undefined 아닌지 확인 (빌드 시 `.env` 를 못 읽었을 수 있음)

### Phase 3 디버깅 기록 #2: preferences ↔ devices drift (원래 "Kill 때만 반영" 증상의 진짜 원인, 2026-04-23)

**증상 (user-visible):** 알림 설정 화면에서 토글해도 "실제 푸시가 기존 구독 그대로 옴 / 앱을 껐다 켜야 반영됨". Phase 3 디버깅 #1 의 App Check 원인 제거 후에도 이 증상이 남아 있었음.

**원인:** `users/{uid}/preferences/main` 과 `devices/{deviceId}` 가 같은 `subscribedTopics` / `notificationsEnabled` 필드를 **중복 저장 (replica)** 하도록 설계됨 (쿼리 최적화 목적 — Cloud Function이 devices를 topic별로 쿼리해서 FCM 발송). 원래 Phase 2 설계는 서버에 Firestore `onWrite` 트리거 Cloud Function `syncPreferencesToDevices` 를 두고 복제를 담당시킴. **이 Cloud Function은 배포되지 않았음.** `NotificationSettingsScreen.tsx:104` 주석 참조.

결과:

- `updatePreferences()` (토글 시 호출) — `users/.../preferences/main` 만 씀
- `registerDevice()` (devices 문서 쓰는 유일 경로) — **bootstrap / token refresh / auth transition 시에만 호출** (`useAppInit`)
- 토글 시 → preferences 는 실시간 업데이트 ✅, devices 는 stale ❌
- 앱 kill + 재실행 → `initializeFirestoreNotifications` 이 fresh preferences 읽어서 `registerDevice` 로 devices 에 복제 → "재실행해야 반영" 증상

**실제 검증 (2026-04-23 세션 로그):**

- `preferences/main.subscribedTopics = [academic]` (updateTime 10:53:34, 마지막 토글 시각과 정확히 일치)
- `devices/{deviceId}.subscribedTopics = [recruitment, scholarship, career, academic, event]` (updateTime 10:51:39 — 그 세션 bootstrap 때 값 그대로)
- FCM 타겟팅은 devices 기반 → 유저가 academic만 남기려 해도 실제 푸시는 5개 다 배송됨.

**수정 옵션:**

| 옵션 | 내용 | 비용 | 다기기 커버 |
| ------ | ------ | ------ | ------------- |
| A | 클라이언트 사이드 미러: `updatePreferences` 내부에서 `devices/{deviceId}` 도 같은 트랜잭션으로 업데이트 | 5분 | 현재 기기만 |
| B | Cloud Function `syncPreferencesToDevices` (Phase 2 원래 설계) 실제 배포 | CF 배포 + Firestore onWrite trigger 비용 | ✅ 다기기 전부 |
| C | A + B 병행 — 현재 기기는 client-side zero-latency, 다기기는 CF 가 propagate | A+B 합산 | ✅ + 최저 latency |
| D | `devices.subscribedTopics` 필드 제거, preferences 를 single source of truth, Cloud Function 이 발송 시 join | 아키텍처 변경 | ✅ (drift 원천 차단) |

단일 기기 dogfooding 단계 → **A 먼저 적용 / 다기기 공식 출시 전 B 추가**. CF 배포 자원 확보되면 **C** 로 정리.

**2026-04-23 결정 및 실행:** 바로 **Option B (CF)** 채택 배포. Client-side mirror (Option A) 는 미적용 — 실측 서버 ack latency 0.3초가 체감상 충분히 빠름. C 는 필요 시 후속.

### CF 배포 현황 및 잔여 (2026-04-23)

| # | CF 이름 | 상태 | 비고 |
| --- | -------- | ------ | ------ |
| 1 | `syncPreferencesToDevices` | ✅ 배포 완료 (2026-04-23, asia-northeast3) | drift 해결. retry + age guard + diff guard + maxInstances:10 |
| 2 | `sendNotification` (HTTP) | ❌ 미배포 | **진짜 푸시 발송 entry point.** API key 인증 + type 분기. Node 백엔드가 공지 발행 시 호출. |
| 3 | `handleNoticeNotification` | ❌ 미배포 | `sendNotification` 의 helper. devices 쿼리 + locale 그룹핑 + multicast FCM 발송 + UNREGISTERED cleanup. 실제 푸시 배송 담당. |
| 4 | `syncUserLocaleToDevices` | ❌ 미배포 | `users/{uid}.locale` onUpdate → devices 에 locale 복제. 언어 변경 시 다음 알림부터 새 언어. |
| 5 | `cleanupStaleDevices` | ❌ 미배포 | scheduled cron (주 1회). N개월 이상 inactive devices 정리. 유령 document 방지. 선택. |

**"진짜 푸시 알림" 은 CF #2 + #3 조합.** 이게 없으면 백엔드에서 공지 발행해도 유저 기기에 푸시 도착 안 함 (now-까지는 devices 만 갱신될 뿐 발송 경로 없음). 앞선 plan 섹션 `### Firebase Cloud Functions` 의 코드 스케치 참조하여 별도 PR/plan 으로 구현.

**CF #2+3 배포 전 할 일:** Node 백엔드에서 CF HTTP endpoint 호출하는 코드 + `X-API-Key` 인증용 secret 공유 + topic 포맷 (`category:scholarship` 등) 발행 측 convention 합의.

### Phase 3 운영 가이드 — 과금/보안 주의 (2026-04-23 배포 후)

**예상 월 비용 (DAU 700–800 기준):**

- Invocations: ~11K/월 (유저 토글 ~6K + bootstrap redundant ~5K)
- 무료 티어 (2M invocations, 400K GB-초) 대비 < 1% — **월 $0 예상**
- Firestore 유발 과금: 일 370 reads + 730 writes — 무료 티어 (50K reads/20K writes per day) 대비 < 4%

**위험 레벨별 방어 체크:**

| 위험도 | 항목 | 현재 방어 | 필요 추가 조치 |
| -------- | ------ | --------- | ------ |
| 🔴 | Retry amplification (버그 시 최대 7일 재시도) | event age guard 10분 + maxInstances 10 | 운영 지표 주간 체크 |
| 🔴 | Admin SDK 가 Firestore rules 우회 | `.where('uid', '==', uid)` 스코프 + whitelist field-value update | 코드 리뷰 시 반드시 확인 |
| 🟡 | diff guard false negative | Set 비교 | `PreferencesDocument` 스키마 변경 시 PR review sync |
| 🟡 | 미래 trigger 루프 | 현재 devices 에 쓰는 CF 는 이 1개뿐 | 새 CF 추가 시 경로 루프 리뷰 |
| 🟡 | Artifact Registry 누적 | 1-day cleanup policy 자동 설정됨 (asia-northeast3) | 없음 |
| 🟡 | Cloud Build 분 (배포 시) | 수동 배포만 (CI 없음) | CI 추가 시 대책 필요 |
| 🟢 | Eventarc / Network egress | 규모 아직 충분 | 없음 |

**Budget alert 권장:** Firebase Console → ⚙ → Usage and billing → Billing account → "예산 만들기" → 월 $5 + $1/$3/$5 이메일 알림. 5분. 버그로 비용 폭주 시 하루 안에 감지.

**주간 확인 habit:** Firebase Console → Functions → `syncPreferencesToDevices` 하단 메트릭 (Invocations, Errors, Median execution time, Active instances). 이상 징후 (예: Errors > 0, Instances 급증) 바로 보임.

**Node 20 → 22 긴급:** Node 20 runtime 2026-04-30 deprecated (7일 뒤). `functions/package.json` 의 `engines.node: "20"` → `"22"` 변경 후 `firebase deploy --only functions:syncPreferencesToDevices --force` 로 재배포. 안 하면 5/1 이후 배포 자체가 블록됨 (기존 함수는 2026-10-30 까지 계속 동작).

### Phase 3 디버깅 기법 정리 (이 세션에서 확립, 향후 재활용)

**1. Firestore snapshot metadata 의 완전한 가시성 — `includeMetadataChanges: true`**

Default `onSnapshot()` 은 **metadata-only change 를 fire 하지 않음**. 즉 local write 의 `hasPendingWrites: true → false` (서버 ack), `fromCache: true → false` (listener server-connected 전환) 같은 transition 은 data 가 동일하면 snapshot 이 emit 되지 않음. 디버깅 중 "write 가 서버 도달 못 함 (ack snapshot 없음)" 으로 **오판** 유발.

```ts
// firestore-notifications.ts:onPreferencesChanged — 세션 로그의 결정적 signal 확보용
.onSnapshot(
  { includeMetadataChanges: true },  // ← 디버깅용 플래그
  (snap) => { ... },
  (err) => { ... },
)
```

켜두면 매 write 당 기대 시퀀스:

```text
fire N: fromCache=false, hasPendingWrites=true   (local echo, 새 data)
fire N+1 (~50-500ms 뒤): fromCache=false, hasPendingWrites=false   (server ack, data 동일)
```

성능 영향 거의 없음 (개별 doc listener 한정). 상시 유지할지는 팀 판단 — dogfood 기간엔 유지 권장.

**2. Firestore REST API 로 server-truth 검증 — Firebase Console 신뢰 말 것**

Firebase Console 자체가 Firestore listener 사용하는 웹앱이라 **stale 뷰를 보일 수 있음** (backgrounded tab, wss upgrade 실패, 내부 cache). 증상 확인할 때 Console 화면만 봤다가 오진 가능. Ground truth 는 REST API.

`~/.config/configstore/firebase-tools.json` 에 저장된 Firebase CLI refresh_token 으로 OAuth access_token 발급 → `firestore.googleapis.com/v1/...` 로 직접 조회. Node 스크립트 한 방에 가능 (이 세션의 검증 스크립트 참조, 대략 40줄).

엔드포인트:

```text
GET https://firestore.googleapis.com/v1/projects/skkubus-95723/databases/(default)/documents/<path>
Authorization: Bearer <access_token>
```

`createTime` + `updateTime` 필드가 각 문서에 자동 포함되므로 drift 검증 시 두 replica 의 `updateTime` 비교로 바로 판정 가능.

**일반 원칙:** data 복제를 두는 시스템에서는 두 replica 의 `updateTime` 비교를 디버깅 first-step으로 삼을 것. 같은 updateTime 이면 동기 OK, 다르면 drift 의심. 본 세션에서는 `updateTime` 차이 2분 = stale bootstrap 으로 즉시 결론 도출.

- [ ] 3.1 NotificationSettingsScreen
- [ ] 3.2 `app/notifications/settings.tsx` 라우트 (inbox 라우트 없음)
- [ ] 3.3 More 화면 진입점 (설정만, 알림함 없음)
- [ ] 3.4 권한 요청 UX
- [ ] 3.5 포그라운드 Notifee displayNotification
- [ ] 3.6 뱃지 설계
  - [ ] 3.6.1 Zustand `unreadCount` + `incrementUnread`/`resetUnread` actions
  - [ ] 3.6.2 background/foreground 핸들러에서 `notifee.incrementBadgeCount(1)` + `incrementUnread()`
  - [ ] 3.6.3 공지 탭 `useFocusEffect`에서 `setBadgeCount(0)` + `resetUnread()`
  - [ ] 3.6.4 탭바 `tabBarBadge` (unreadCount)
- [ ] 3.7 푸시 탭 시 딥링크만 (markAsRead 없음)
- [ ] 3.8 언어 변경 → updateUserLocale
- [ ] 3.9 Analytics 자동 이벤트 확인만 (수동 로그 없음)

### Known Issue: @react-native-firebase/* v24 lockstep bump blocked

**Attempted 2026-04-22:** `yarn workspace mobile add @react-native-firebase/{app,auth,analytics,crashlytics,firestore,messaging}@^24.0.0` → `npx expo prebuild --clean` → `yarn ios`. Packages install cleanly (peer-dep warnings only), typecheck + lint pass, but iOS native build fails with:

```text
❌ RNFBFirestoreCommon.h:40 — expected a type (RCTPromiseRejectBlock)
❌ RNFBFirestoreCollectionModule.h:28 — declaration of 'RCTBridgeModule' must be
    imported from module 'RNFBApp.RNFBAppModule' before it is required
```

This is the Firebase-with-modular-headers-and-static-frameworks error class. Our `plugins/withFirebaseModularHeaders.js` applies:

- `$RNFirebaseAsStaticFramework = true`
- `CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES` on all pods
- `CLANG_ENABLE_MODULES = NO` on targets starting with `RNFB*`

These patches were sufficient for v23. In v24 RN Firebase apparently added stricter Clang module declarations for Firestore internals, and our post_install hook runs **before** `react_native_post_install` which may reset the flags. Several possible next steps (untried):

- Move the withFirebaseModularHeaders snippet AFTER `react_native_post_install` in the post_install block so React Native's defaults don't override ours.
- Widen `CLANG_ENABLE_MODULES = NO` to more targets (not just RNFB*) — maybe dependencies of RNFB need it too.
- Switch back to dynamic frameworks (`useFrameworks: "dynamic"` in expo-build-properties) — v24 may assume that.
- Inspect v24 release notes / invertase/react-native-firebase issue tracker for `'RCTBridgeModule' must be imported from module 'RNFBApp.RNFBAppModule'` resolutions.

Reverted back to 23.8.8 for app/auth/analytics/crashlytics/firestore/messaging to restore working state. `@react-native-firebase/app-check` remains at 24.0.0 because it was already there pre-session and the peer-dep violation has not caused observable issues (App Check works fine per Phase 3 debug-token section above). Next session should taskbox ~1 hour specifically for this bump attempt.

### Phase 4: iOS NSE — ❌ **전략 폐기 (섹션 삭제됨)**

서버가 `users.locale` 기준 `notification.title`/`body` 선택 → NSE로 다국어 처리 불필요.
App Groups UserDefaults sync, NSE 타겟, NSE provisioning profile, `mutable-content` 플래그 모두 사용하지 않음.

---

## Delivery CF — ✅ 배포 완료 (2026-04-23)

**구독 파이프라인과 짝이 되는 발송 파이프라인.** Phase 1~3 + `syncPreferencesToDevices` 까지가 "유저 → Firestore" 구독 상태 관리였다면, 이 섹션은 "외부 트리거 → FCM → 유저 기기" 배송을 담당.

### 구현 구조

```text
크롤러/백엔드 ──(POST + X-API-Key)──▶ sendNotification (dispatcher)
                                            │
                                            ▼
                                     handleNoticeNotification
                                            │
                                  devices where active==true
                                    AND notificationsEnabled==true
                                    AND subscribedTopics array-contains-any
                                            │
                                  locale 별 그룹 → sendEachForMulticast (500배치)
                                            │
                                            ▼
                                     FCM → APNs/Play ──▶ 유저 기기
                                            │
                                     Allowlist cleanup
                                (UNREGISTERED/INVALID_REGISTRATION_TOKEN만)
```

### 핵심 파일

| 파일 | 역할 |
| --- | --- |
| `functions/src/send-notification.ts` | HTTP dispatcher — `defineSecret('FCM_API_KEY')` + timingSafeEqual + POST-only + type switch |
| `functions/src/handle-notice.ts` | notice 핸들러 — payload 검증 + devices 쿼리 + locale 그룹 + FCM 발송 + allowlist cleanup + 구조화 로깅 |
| `functions/src/channels.ts` | `mapCategoryToChannel()` — 앱 측 `notification-channels.ts` 와 SYNC |
| `functions/src/types.ts` | `UserDocument`, `DeviceDocument`, `NoticeNotificationPayload`, `NotificationRequest` — `packages/shared/src/types/notifications.ts` 와 SYNC |
| `apps/mobile/firestore.indexes.json` | composite index (active + notificationsEnabled + subscribedTopics) |

### 설계 결정 기록

1. **`messaging/invalid-argument` 는 cleanup allowlist 에서 의도적 제외** — payload-wide 에러 (4KB 초과, reserved data key, bad TTL 등) 에서도 떠서, 포함하면 bad payload 한 건으로 healthy 500 기기가 `active:false` 로 꺼지는 대규모 데이터 손실 footgun. Allowlist 는 `registration-token-not-registered` + `invalid-registration-token` 두 개만 — unknown 에러 코드는 fail-closed (cleanup 안 함).

2. **`.trim()` 방어 on Secret value** — `openssl rand -hex 32 | firebase functions:secrets:set --data-file -` 저장 시 **openssl 출력의 trailing `\n` 까지 secret 값에 포함**되어 CF 의 `timingSafeEqual` length 선체크에서 valid 호출이 전부 401 되던 함정. 코드 레벨 `.trim()` 으로 저장 방식 무관한 방어.

3. **FCM `data` 는 `Record<string, string>`** — v1 API 는 runtime validation 에서 non-string value 를 throw. optional 필드는 undefined 시 객체에서 제외해야 안전 (TypeScript 타입만으로는 런타임 보장 못함).

4. **Composite index 선언적 관리** — Firestore 콘솔의 에러 링크 클릭 수동 생성 대신 `firestore.indexes.json` 에 박아서 코드리뷰 가시성 + 환경 재현성 확보. 배포 순서는 indexes → CF (CF 먼저 배포하면 첫 호출이 `FAILED_PRECONDITION`).

5. **HTTP method POST 전용 + `timingSafeEqual`** — GET/OPTIONS 은 405, key 비교는 length 선체크 후 timing-safe equal.

6. **`handleNoticeNotification` 은 export 하되 `index.ts` 에서 re-export 안 함** — dispatcher 가 호출하지만 독립 HTTP endpoint 로 노출되지 않음 (2nd gen CF 는 onRequest 객체만 endpoint 화).

### 검증

- **E2E**: Test 2 (valid payload, `category:academic`) → `HTTP 200 {sent:1,failed:1,cleanedUp:0}` + 본인 iOS Simulator 에 실제 푸시 도달.
- **Critical 회귀 방지**: Test 3 (5KB+ body) → FCM 이 `invalid-argument` 리턴 → CF 응답 `{sent:0,failed:2,cleanedUp:0}` — **healthy 기기 `active:true` 유지 확인**.
- **카테고리 라우팅**: 구독한 3개 (scholarship, career, recruitment) 만 `sent:1`, 미구독 5개 (academic, event, library, dorm, general) 는 `sent:0` — devices 쿼리 필터 동작 확인.

### 운영 주의사항

- **Secret Manager 의 `FCM_API_KEY`** — `firebase functions:secrets:access` 로만 가치 있고, 코드/커밋/이미지 어디에도 저장 금지. Rotation: `openssl rand -hex 32 | firebase functions:secrets:set FCM_API_KEY --data-file -` → CF 재배포 → 이전 버전 `destroy`.
- **Payload 계약 (`NoticeNotificationPayload`) 은 외부 API 계약** — 수정 시 백엔드 측 호출 코드 동시 수정 필요. `type` 확장은 dispatcher switch 케이스 + 신규 핸들러 모듈 추가.
- **구조화 로깅** — Cloud Logging 에서 `jsonPayload.noticeId="..."` 필터로 단일 호출 추적 가능. failed/cleanedUp 급증 시 최우선 확인 지표.

### 아직 안 한 것 (Tier 2 follow-up)

- `syncUserLocaleToDevices` CF — `users/{uid}.locale` 변경 → devices 전파
- `cleanupStaleDevices` scheduled CF — 주 1회 cron, 오래된 inactive device 정리
- Idempotency (동일 `noticeId` dedup) — 현재 백엔드 책임
- Rate limiting — API key 유출 대응
- TestFlight/Play Internal Testing 실기기 검증 (App Attest / Play Integrity 경로)

---

## Phase 3.1 v3 재개정 (2026-04-23) — 설정 탭 가시성 + picker prefix 버그 수정

**배경 버그 2개 (동시 수정):**

1. **Picker 탭 숨김:** `NotificationSettingsScreen` 이 `pickerTabs.flatMap(...)` 로 선택된 deptId 가 있을 때만 렌더 → 도서관 picker 를 한 번도 선택 안 한 유저는 도서관 섹션이 통째로 안 보임. 9개 탭 중 5~6개만 노출되는 문제로 드러남.

2. **Picker 토픽 prefix 하드코딩:** 도서관 선택 시에도 `buildTopic('dept', deptId)` 가 호출되어 Firestore 에 `dept:lib-hssc` 가 저장. 백엔드는 `library:lib-hssc` 로 발송 → CF `array-contains-any` 매칭 실패 → 도서관 푸시는 **구조적으로 매칭 불가능** 상태였음. 즉 유저가 도서관 구독 UI 를 켜도 delivery 가 0 건.

**해결 구조:**

- `pickerPrefixForTabKey(tabKey)` 헬퍼 신설 (`packages/shared/src/constants/topics.ts`). `dept → 'dept'`, `library → 'library'`, unknown → undefined. 호출부는 undefined 이면 헤더까지 skip + dev warn.
- `updateSubscribedTopics(uid, delta)` delta API 신설. `SubscribedTopicsDelta` 는 discriminated union `{ add } | { remove }` — 동시 호출을 타입 레벨에서 차단 (2-write 시퀀스가 원자 아닌 함정 회피). 내부는 Firestore `arrayUnion`/`arrayRemove` 로 per-call atomic. MANDATORY 제거 시도는 dev throw + prod silent filter.
- Picker 편집 = notices 탭에서만. `NoticePickerSheet` 는 pure 유지 — `onConfirm(newIds, { oldIds })` 시그니처로 emit 만. 모든 비즈니스 로직 (diff / cascade / pending) 은 `NoticesTabScreen` 의 callback 에서 처리. zustand SSOT 유지.
- Cascade 제거는 fire-and-forget (`await` 없이) — sheet dismiss 애니메이션이 네트워크 latency 뒤로 밀리지 않게. 실패 시 `logHandledError` 만.
- `AddedItemsNotificationSheet` 신규 — picker 의 onDismiss 에서 present (애니메이션 overlap race 회피). 1개 추가 = express [네/나중에]. N개 추가 = 체크박스 리스트 (**기본 체크 OFF**, 분리 원칙 적용). Dismissal = "나중에" = no-op.
- 알림 설정 화면은 view-only. 9개 탭 서버 순서대로 iterate, fixed → 단일 토글, picker → 헤더 + 들여쓰기 dept 토글 + (선택 0개면 "공지 탭으로 가기" 링크). 개별 dept 토글은 delta API 직접 write.

**런칭 전 정책:** legacy `dept:{libId}` 데이터 없음 가정 → migration 코드 스킵. 다음 picker confirm 시 cascade remove (`arrayRemove`) + opt-in sheet add (`arrayUnion`) 로 자연 수렴.

**완료된 체크리스트 (실기기 검증은 별도):**

- `yarn lint` / 모바일 `tsc --noEmit` / `yarn test:rules` / shared `vitest` — 전부 green.
- 시뮬레이터 수동 QA 항목 12개 (이 PR 의 sibling plan `~/.claude/plans/fcm-snoopy-goblet.md` 참조).

**다음 작업:**

- 딥링크 파라미터 (`?tab=dept&openPicker=true`) + 수신 로직 — "공지 탭으로 가기" 링크가 3 step 탭 없이 picker 를 바로 열도록.
- Cascade write 실패 시 toast + retry (런칭 후 hardening).
- Mobile 용 test harness (vitest + RNTL) 도입 후 delta API / picker diff / sheet 유닛 테스트 소급 추가 — 이번 PR 에선 mobile 테스트 러너 미설치로 shared 패키지 테스트만 포함.

---

## Phase 5 v5 SSOT — Firestore 단일 진실, 서버 derive (2026-04-25)

**배경.** Phase 1~4 완료 후 클라가 직접 `subscribedTopics`를 계산해서 Firestore에 쓰는 fan-out-on-client 패턴이었음. 결과적으로 (1) picker 선택값이 로컬 MMKV(`useSettingsStore.pickerSelections`)에만 살아 멀티 디바이스 sync 0, (2) `dept:*` / `library:*` 같은 derived 토픽을 클라가 다양한 코드 경로에서 추가/삭제 → drift 위험, (3) v3 에서 picker prefix 미커버(`dorm`/`general` 케이스) 같은 잠재 버그가 클라 derive 로직 안에 누적.

**핵심 원칙 재정의.** "기록은 의도(intent), 전송은 파생(derived)". 클라는 의도만 Firestore에 쓰고, Cloud Function이 단일 위치에서 derive해서 derived 필드를 채움. Firestore Rules가 derived 필드의 client write를 인프라 차원에서 봉쇄.

### 데이터 모델 (`users/{uid}/preferences/main`)

```ts
PreferencesDocument = {
  // === Intent (client writable) ===
  enabled: boolean,                              // 마스터 토글
  categoryEnabled: {                             // 3 super-카테고리
    essential: boolean,                          // 미래 확장용 (현재 토픽 0개)
    services: boolean,                           // 미래 확장용 (현재 토픽 0개)
    notices: boolean,                            // 9개 공지 탭의 super-master
  },
  noticeTabEnabled: Record<string, boolean>,     // per-notice-tab override (key: server tab key)
  pickerSelections: Record<string, string[]>,    // per picker tab의 사용자 선택 id 배열
  onboardedAt: Timestamp | null,                 // 첫 onboarding 완료 시각. canonical "user has onboarded" signal
                                                 // for second-device auto-restore (notices/index handler + useAppInit listener).
                                                 // Rules: 'null → timestamp' 한 방향 immutability 강제 (시드 후 immutable).

  // === Derived (CF only — Rules block client write) ===
  subscribedTopics: string[],                    // CF가 채움; handle-notice의 array-contains-any 쿼리 대상
  derivedAt: Timestamp | null,                   // serverTimestamp; 진단/디버깅용
}
```

**불변식**: `subscribedTopics === deriveSubscribedTopics(enabled, categoryEnabled, noticeTabEnabled, pickerSelections)`. (`onboardedAt`은 derive 입력 아님 — provenance metadata.)

### 카테고리 → 토픽 매핑

- `categoryEnabled.notices === false` → 모든 notice 토픽 0
- `categoryEnabled.notices === true`:
  - 각 fixed tab key (`academic`/`scholarship`/`career`/`recruitment`/`event`)에 대해 `noticeTabEnabled[key] !== false`이면 `category:${key}` emit
  - 각 picker tab key (`dept`/`library`/`dorm`/`general`)에 대해 `noticeTabEnabled[key] !== false`이면 `pickerSelections[key]`의 각 id로 `${key}:${id}` emit (key === topic prefix identity 컨벤션)
- `categoryEnabled.essential` / `services` → 현재 정의된 토픽 0 (미래 `essential:emergency` 같은 확장 시점에 분기 추가)

`noticeTabEnabled[key]`의 default-on 정책 (undefined → ON): 백엔드가 새 탭 추가하면 기존 유저에게 자동 활성화 (opt-out 모델).

### 컴포넌트

| 파일 | 역할 |
| --- | --- |
| `functions/src/notifications/tabsContract.ts` | 백엔드 categories.json의 부분 mirror — `FIXED_TAB_KEYS` (5) + `KNOWN_PICKER_KEYS` (4). 백엔드 새 탭 추가 시 같은 release에서 갱신 필수. 컨벤션: picker key === topic prefix. |
| `functions/src/notifications/derive.ts` | `deriveSubscribedTopics` 순수 함수. enabled OFF → 빈 배열 (defense in depth). Unknown picker key → `logger.warn` (drift 조기 감지). |
| `functions/src/triggers/onPreferencesWrite.ts` | `users/{uid}/preferences/main` onDocumentWritten 트리거. Guard 1: intent 변경 없으면 skip (self-loop 방지). Guard 2: derive 결과가 현재값과 동일하면 skip (idempotency). retry: false. |
| `functions/src/utils/equality.ts` | `setEquals` / `shallowEqual` / `pickerSelectionsEqual` — 트리거 가드용 순수 helper. |
| `functions/scripts/verify-trigger.ts` | `firebase emulators:exec` 기반 통합 검증기. 4 시나리오 (initial seed → derive, self-loop guard, intent change, idempotency). 실행: `npm run verify:trigger`. CF 트리거/Rules/derive 변경 시 회귀. |
| `apps/mobile/src/services/firestore-notifications.ts` | 클라 write API 4개 — `setMasterEnabled`, `setCategoryEnabled`, `setNoticeTabEnabled`, `setPickerSelectionRemote`. 모두 단일 dot-path `updateDoc`. **트랜잭션 사용 안 함** — Firestore offline 큐잉이 트랜잭션을 즉시 reject (캠퍼스 wifi dead spot 보호). 추가로 `seedOnboardingPreferences`, `unregisterDevice`, `initializeFirestoreNotifications`. |
| `apps/mobile/src/features/notifications/NotificationSettingsScreen.tsx` | 마스터 + 3 카테고리 토글 + 9 sub-tab 토글 + 학과 picker sub-row + 편집 진입. `useNotificationStore.preferences` 구독 (Firestore listener fed). |
| `apps/mobile/src/features/notices/NoticesTabScreen.tsx` | 우상단 벨 아이콘 (notices OFF 시 빗금) → `/notifications/settings` deeplink. 별도 컨텍스트 시트 없음 (Toss 패턴: 컨텍스트 진입 = subset/deeplink). |
| `apps/mobile/src/hooks/useAppInit.ts` | `onAuthStateChanged` 안에서 uid 변화마다 `onPreferencesChanged` 리스너 재구독해서 store에 pump. **이게 SSOT 약속의 wire** — 없으면 store는 default에서 안 변함. |

### Firestore Rules (Phase F 봉쇄)

```text
match /users/{uid}/preferences/main {
  allow read: if auth.uid == uid;
  allow create: if auth.uid == uid && (subscribedTopics absent or empty);
  allow update: if auth.uid == uid
                && !affectedKeys().hasAny(['subscribedTopics', 'derivedAt'])
                // onboardedAt: 'null → timestamp' 한 방향 전환만 허용 (시드 후 immutable).
                // CF는 admin SDK라 우회 가능. seedOnboardingPreferences가 wizard 완료 시
                // serverTimestamp()로 시드 — 자동복원 discriminator 책임.
                && (resource.data.onboardedAt == request.resource.data.onboardedAt
                    || (resource.data.onboardedAt == null
                        && request.resource.data.onboardedAt is timestamp));
  allow delete: if false;
}
```

테스트: `apps/mobile/firestore.rules.test.mjs` 30 케이스 (devices 13 + preferences 13 + onboardedAt immutability 4). 실행: `yarn test:rules`.

### Anon → Google 디바이스 claim (2026-04-25 보강)

Task #12가 Google→anon 방향만 커버했고 anon→Google (onboarding 첫 로그인 + login.tsx 재로그인) 방향은 빈 그림자였음. 증상: preferences/main은 Google uid로 정상 생성되는데 device 문서가 anon uid + active:true로 갇혀 `syncPreferencesToDevices`가 google_uid 쿼리로 0 매치 → fan-out 전부 손실. Cloud Logging의 `notifications/auth-transition` 핸들드 에러로만 보이는 silent failure.

**해결**: `OnboardingScreen.handleSignIn` + `app/login.tsx` 양쪽에 mirror 패턴 — sign-in 전 `unregisterDevice(deviceId)` (rule path a로 self-unregister 허용 → active:false) + sign-in 후 `await initializeFirestoreNotifications({uid: user.uid, ...})` (rule path b로 새 uid가 inactive doc claim).

### Auto-restore on second-device sign-in (2026-04-28)

**배경.** 게이트는 `isAnonymous || !onboardingCompleted` (`apps/mobile/app/(tabs)/notices/index.tsx`). `onboardingCompleted`가 MMKV-local 플래그라 2번째 기기 / 앱 재설치 후 항상 false → Firestore preferences가 SSOT로 살아있어도 같은 Google 계정 유저가 wizard를 다시 밟아야 했음. UX 결함 + 본인이 dogfooding 중 발견.

**Discriminator 결정 — 명시 필드 채택.** v3까지 implicit 시그널(`pickerSelections.dept ≥1` non-empty)을 검토했지만 출시 전이라 schema migration 부담 0 → `PreferencesDocument`에 `onboardedAt: Timestamp | null` 명시 필드 추가가 더 정직. JSDoc 시간폭탄(wizard step 2 invariant) 회피 + Rules가 'null→timestamp' 한 방향 immutability 강제로 데이터 레이어가 contract 보장.

**구현 — dual-write always-overwrite**:

- **Primary path (인라인 핸들러)**: `notices/index.tsx`의 `handleExistingAccountSignIn` — OnboardingLanding 보조 액션 "이미 가입한 적 있어요" → Google sign-in 직후 `getPreferences(uid)` 명시 read → `onboardedAt != null && pickerSelections.dept.length > 0`이면 `useSettingsStore.restoreOnboardingFromRemote()` 즉시 호출 (UX 즉시성, flicker 없음). 신규 가입자 또는 corrupt state면 `/onboarding` push.
- **Fallback path (cold-start)**: `useAppInit.ts`의 prefs listener가 동일한 자동복원 로직을 fallback으로 호출 — 평범한 부팅(이미 인증된 returning user)에서도 게이트 자동 해제. listener는 navigate 못하니 corrupt state는 log-only.
- **`restoreOnboardingFromRemote` action** (`packages/shared/src/store/settings.ts`): always-overwrite (no idempotency guard). 의도: SSOT mirror = eventual consistency > idempotency. 부수효과: account-switch (logout A → signin B) 시 A의 stale dept를 B 값으로 자동 self-heal. dual-write는 동일 데이터로 race-free.

**Seed**: `seedOnboardingPreferences`가 wizard 완료 시 `onboardedAt: serverTimestamp()` 박음 — clock skew 방어. `initializeFirestoreNotifications` default doc은 `onboardedAt: null` (anon/신규 유저).

**'dept' cross-cutting hard-code**: discriminator 책임은 `onboardedAt`이 떠맡았지만 dept 미러 read는 여전히 3 sites — `notices/index.tsx` handler, `useAppInit.ts` listener, server-side `tabsContract.ts`. coordinated rename 필요. Inline 주석에 cross-link.

**검증**: Rules 4 케이스 (`firestore.rules.test.mjs` "ONBOARDED_AT IMMUTABILITY"), settings store 4 케이스 (`packages/shared/src/store/__tests__/settings.test.ts`). 마이그레이션 액션: 출시 전이라 strict Rule 채택 → 본인 doc은 console에서 삭제 후 재시드 (다음 부팅에 default doc 자동 생성, wizard 한 번 통과로 onboardedAt 채움).

**Sticky 잔존** (본 PR scope 외 후속): logout 후 `useSettingsStore` / `useNotificationStore.preferences` reset 없음 — anon 상태 유지 시 이전 유저 데이터 sticky. always-overwrite가 다른 계정 sign-in 케이스는 self-heal하지만 anon-only 케이스는 후속 PR (`resetOnboardingState` + `resetPreferences` action 신설 + `signOutFromGoogle`에서 호출).

### 검증 인프라

- `cd functions && npm test` — derive + tabsContract + equality 31 케이스
- `cd functions && npm run verify:trigger` — 에뮬레이터 4 시나리오
- `yarn test:rules` — 30 케이스 (devices 13 + preferences 13 + onboardedAt immutability 4)
- `cd packages/shared && yarn test` — 89 케이스 (`restoreOnboardingFromRemote` 4 신설 포함)
- `cd apps/mobile && yarn lint && npx tsc --noEmit` — 타입/린트
- 매 phase 끝, deploy 직전, dogfooding 시작 전 모두 회귀 가능

### 디버깅 단서 (이번 작업에서 발견된 함정)

1. **Zustand persist + schema migration**: `preferences`를 MMKV에 persist하면 v4 shape이 v5 hydration을 덮어씀 → undefined throw → ErrorBoundary "something went wrong". `partialize`로 `preferences` 제외, Firestore listener가 단일 source. 일반 원칙: **server-truth state는 client persist 금지**.
2. **CF 함수 부분 deploy의 함정**: `firebase deploy --only functions:onPreferencesWrite`는 그 함수만 갱신. `channels.ts`의 `mapCategoryToChannel` 변경은 import한 `sendNotification`이 redeploy되어야 적용. 한 PR이 여러 함수 영향 시 명시적 deploy 목록 필요.
3. **Trigger Guard 1 확장 누락**: 새 intent 필드(`noticeTabEnabled`) 추가 시 Guard 1의 비교에도 추가 안 하면 토글 변경이 "intent unchanged"로 잘못 판정 → derive 안 돌고 토픽 안 바뀜. 스키마 추가 = 가드도 같이 확장이 패턴.
