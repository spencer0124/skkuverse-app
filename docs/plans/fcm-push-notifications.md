# FCM 학과별 푸시 알림 구현 계획

## Context

스꾸버스 앱에 학과별 공지사항 푸시 알림 기능을 추가한다. `@react-native-firebase/*` 네이티브 모듈 5개(app, auth, analytics, crashlytics, app-check)가 이미 설치된 상태.

**기술 스택:** FCM 직접 (`@react-native-firebase/messaging`) + Notifee (`@notifee/react-native`) + Firestore (`@react-native-firebase/firestore`) + Cloud Functions (`sendNotification` 범용 진입점)

**배포 전략:** Phase 1→2→3 순서로 개발, **앱스토어에는 Phase 3 완료 후 한 번에 릴리즈**. 유저가 처음 받는 버전이 다국어·읽음 처리·알림함까지 완성된 버전. 과도기 없음.

**데이터 아키텍처:**
```
┌─────────────────────────┬──────────────────────────┐
│ Firebase (Firestore)    │ MongoDB (Node 관리)      │
├─────────────────────────┼──────────────────────────┤
│ 유저 정보 (locale 포함)  │ 버스 데이터               │
│ 디바이스/토큰            │ 공지 데이터               │
│ 알림 구독 preferences    │ 셔틀 시간표              │
│ 알림 인박스 (notifications) │ 학과 정보              │
└─────────────────────────┴──────────────────────────┘
```
- 앱 → Firestore 직접 읽기/쓰기 (디바이스 등록, 구독 관리, 유저 설정, 알림함 읽음 처리)
- Node 서버 → 공지 발행 시 Cloud Function HTTP 호출만 (Firebase 의존성 제로)
- Cloud Functions → Firestore 구독자 쿼리 + 알림 레코드 생성 + FCM 발송 + 토큰 cleanup (Admin SDK, Security Rules 우회)

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
    "notificationId": "abc123",
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
- `data` → 딥링크 메타 + 앱 내 알림함 연결 (`notificationId`로 Firestore 레코드 매핑)
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

### `notifications/{notificationId}` (top-level collection, **NEW**)

앱 내 알림함 + 읽음 처리용 신규 컬렉션. 수신자마다 레코드 1개.

```ts
{
  uid: string;                   // 수신자 (Firestore 쿼리 기준)
  type: 'notice';                // 타입 — 확장 지점 (향후 'bus_arrival', 'dorm' 등)
  title: string;                 // 표시된 제목 (유저 언어로 서버가 선택)
  body: string;
  data: {                        // 타입별 자유 구조
    deptId?: string;
    articleNo?: string;
    category?: string;
  };
  read: boolean;
  createdAt: Timestamp;
  readAt: Timestamp | null;
  pushedAt: Timestamp;           // FCM 발송 시각 (failure tracking용)
  expiresAt: Timestamp;          // ⭐ TTL — createdAt + 30d (자동 삭제)
}
```

> **확장성 포인트:** `type` 필드로 공지·버스·기숙사·이벤트 등 구분. 앱 내 알림함 UI는 `type`별로 다른 아이콘·색상 렌더링.

> **쓰기 권한:** 생성/삭제는 Cloud Function만(Admin SDK). 유저는 `read`/`readAt` 필드만 업데이트 가능.

> **생명주기:** `expiresAt` 필드에 Firestore TTL 정책 활성화 → 30일 지난 알림 자동 삭제. 자세한 내용은 Phase 2.8 참조.

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

    // 알림함 (top-level, NEW)
    match /notifications/{id} {
      allow read: if request.auth.uid == resource.data.uid;
      allow update: if request.auth.uid == resource.data.uid
                    && request.resource.data.diff(resource.data)
                         .affectedKeys()
                         .hasOnly(['read', 'readAt']);
      allow create, delete: if false;  // 서버 전용 (Admin SDK는 우회)
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

export interface NotificationDocument {
  uid: string;
  type: 'notice';                 // 향후 확장
  title: string;
  body: string;
  data: {
    deptId?: string;
    articleNo?: string;
    category?: string;
  };
  read: boolean;
  createdAt: Date;
  readAt: Date | null;
  pushedAt: Date;
  expiresAt: Date;                // TTL — createdAt + 30d
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

// === 알림함 (NEW) ===

// 읽음 처리 (푸시 탭 + 인박스 탭 공용)
markNotificationAsRead(notificationId)
  → notifications/{id} update { read: true, readAt: now }

// 모두 읽음 (batch)
markAllNotificationsAsRead(uid)
  → batch update where uid + read == false

// 알림함 실시간 구독 (최근 50개)
subscribeToNotifications(uid, callback, limit = 50)
  → notifications
      .where('uid', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .onSnapshot → unsubscribe
```

### 2.3 Firestore Security Rules 배포

**생성:** `apps/mobile/firestore.rules` (또는 레포 루트)

Phase 2 앱 작업의 일부로 배포:
```bash
firebase deploy --only firestore:rules
```

> `notifications/{id}` 규칙: `read` + `readAt`만 유저 업데이트 허용 (`diff().affectedKeys().hasOnly()` 체크). 생성/삭제는 서버 전용.
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

**생성:** `apps/mobile/src/hooks/useNotificationInbox.ts` (알림함용 동일 패턴)

```ts
export function useNotificationInbox(uid: string | null, limit = 50) {
  const [items, setItems] = useState<NotificationDocument[]>([]);
  // subscribeToNotifications 래핑
}
```

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

auth 변경 시 (anonymous → Google) uid 변경 → 디바이스 문서 uid 업데이트.
언어 변경 시 `updateUserLocale(uid, newLang)` 호출 → Cloud Function `syncUserLocaleToDevices`가 devices 자동 전파.

### 2.7 exports 업데이트

**수정:** `packages/shared/src/index.ts` — notification 타입, 스토어, topic 상수 export

### 2.8 `notifications` 컬렉션 생명주기 (TTL)

**정책:** 생성 후 **30일 후 자동 삭제** (과거 공지는 기존 공지 탭에서 조회 가능 — 알림함은 "최근 상호작용" 용도).

**구현 (1순위): Firestore TTL 필드**

Cloud Function이 `notifications/{id}` 생성 시 `expiresAt` 필드를 30일 후 Timestamp로 설정:

```ts
const now = admin.firestore.Timestamp.now();
const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
await notificationsRef.add({
  // ...
  createdAt: now,
  pushedAt: now,
  expiresAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + thirtyDaysMs),
});
```

Firebase Console에서 **1회 설정**:
- Firestore → TTL 탭 → Add Policy
- Collection: `notifications`
- Timestamp field: `expiresAt`
- 활성화 후 Firestore가 ~24시간 주기로 expire된 문서 자동 삭제 (**비과금**)

**구현 (2순위, TTL 정책 사용 불가 시): scheduled Cloud Function**

```ts
// 주 1회 cron
export const cleanupStaleNotifications = onSchedule('every monday 04:00', async () => {
  const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 30 * 86400 * 1000);
  const stale = await db.collection('notifications')
    .where('createdAt', '<', cutoff)
    .limit(500)  // 배치 단위
    .get();
  const batch = db.batch();
  stale.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
});
```

**비용 시사점:**
- 예상 write: 공지 100개/일 × 평균 수신자 500명 = 50K writes/day → ~$27/month @ Blaze
- TTL 자동 삭제는 무과금 → 저장 비용도 30일 내로 유지
- MVP 규모 (MAU ~5K)에선 문제 없음, 10K+ 도달 시 대안 A (공지별 캐시 + 유저별 read 분리 구조)로 전환 검토

> **검증:** Phase 2 배포 후 24~48시간 경과 시 TTL 정책이 실제로 expire된 레코드를 삭제하는지 Firestore Console에서 확인.

---

## Phase 3: Subscription UI + 알림함 + 읽음 처리

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
- `apps/mobile/app/notifications/inbox.tsx` (**NEW**)

**수정:** `apps/mobile/app/_layout.tsx` — `<Stack.Screen name="notifications" />`

### 3.3 진입점

**수정:** More 화면에 "알림 설정" 메뉴. `Bell` 아이콘 (lucide-react-native).
**수정:** More 화면에 "알림함" 메뉴. `Inbox` 아이콘. Unread 뱃지 포함.

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
> - **(A) 양쪽 다 Notifee** `displayNotification` — 현 계획, iOS에서도 상단 헤드업 배너 표시
> - **(B) Android = Notifee, iOS = in-app toast** — SDS Toast 컴포넌트 활용 또는 신규 작성. iOS 전용 UX 관례 준수
> - **(C) 양쪽 다 in-app toast** — 플랫폼 일관성
>
> 초기 구현은 (A) 유지. dogfooding에서 "알림 방해" 피드백 나오면 (B)로 전환 — `Platform.OS === 'ios'` 분기만 추가하면 되는 low-cost 변경.

### 3.6 앱 내 알림함 화면 (**NEW**)

**생성:** `apps/mobile/src/features/notifications/NotificationInboxScreen.tsx`

- `useNotificationInbox(uid)` onSnapshot으로 최근 50개 구독
- 렌더링:
  - `read: false` → 색깔 있는 배경 (unread 표시) + unread dot
  - `read: true` → 회색 배경
  - `type`별 아이콘 (현재는 `notice`만, `lucide` Bell)
  - `createdAt` relative time ("3분 전")
- 탭 시:
  - `markNotificationAsRead(id)` 호출
  - `navigateFromNotification(data)` 호출 (기존 router 재사용, `type` switch)
- "모두 읽음" 버튼 → `markAllNotificationsAsRead(uid)` batch update
- Empty state: "받은 알림이 없어요"

> **Pagination 정책 (MVP):** 최근 50개만 표시. 더 오래된 알림은 TTL 30일(Phase 2.8)로 자동 삭제되므로 유저가 실제로 "놓친 알림"을 못 보는 경우는 드뭄 — 원본 공지는 기존 공지 탭에서 전체 조회 가능. 장기 유저 대응이 필요해지면 cursor-based "더 보기" 버튼 추가 (createdAt desc + startAfter).

### 3.7 푸시 탭 시 읽음 처리

**수정:** `apps/mobile/src/hooks/useNotificationHandler.ts`

```ts
// getInitialNotification + onNotificationOpenedApp 공통 처리:
const handlePress = async (remoteMessage) => {
  const data = remoteMessage?.data as NotificationData | undefined;
  if (data?.notificationId) {
    // fire-and-forget (실패해도 딥링크는 진행)
    markNotificationAsRead(data.notificationId).catch(() => {});
  }
  navigateFromNotification(data);
};
```

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
| `apps/mobile/src/hooks/useNotificationInbox.ts` | 2 |
| `apps/mobile/firestore.rules` | 2 |
| `apps/mobile/app/notifications/_layout.tsx` | 3 |
| `apps/mobile/app/notifications/settings.tsx` | 3 |
| `apps/mobile/app/notifications/inbox.tsx` | 3 |
| `apps/mobile/src/features/notifications/NotificationSettingsScreen.tsx` | 3 |
| `apps/mobile/src/features/notifications/NotificationInboxScreen.tsx` | 3 |
| `apps/mobile/src/features/notifications/NotificationPromptSheet.tsx` | 3 |

### 기존 수정
| 파일 | Phase | 변경 |
|---|---|---|
| `apps/mobile/package.json` | 1 | `"main": "./index.ts"` |
| `apps/mobile/app.config.ts` | 1 | plugin + entitlements (APP_ENV 분기) + UIBackgroundModes |
| `apps/mobile/firebase.json` | 1 | messaging 설정 2줄 |
| `apps/mobile/app/_layout.tsx` | 1,3 | handler hook + notifications route |
| `apps/mobile/src/hooks/useAppInit.ts` | 1,2 | FCM 등록 + 토큰 + deviceId + users/devices/preferences Firestore 등록 |
| `apps/mobile/src/hooks/useNotificationHandler.ts` | 3 | foreground Notifee + 탭 시 markAsRead |
| `packages/shared/src/index.ts` | 2 | notification 타입/스토어/상수 export |

### 삭제 대상 (이전 계획 잔재 — **이미 삭제됨 또는 애초에 생성하지 않음**)
- ~~`apps/mobile/plugins/withNotificationServiceExtension.js`~~ — iOS NSE 전략 폐기
- ~~App Groups 설정 / NSE Bundle ID~~ — NSE 없음
- ~~`title_ko`/`title_en`/`body_ko`/`body_en` data 필드~~ — 서버가 `notification.title`/`body`에 완성 문구 탑재
- ~~background-messaging.ts의 `notifee.displayNotification`~~ — hybrid 페이로드로 OS 자동 표시
- ~~Analytics 수동 `push_notification_open/receive` 로그~~ — Firebase 자동 이벤트로 대체

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

**2. `handleNoticeNotification` — 공지 발송 로직**

```
1. Firestore notifications 레코드 수신자당 대량 생성 (batchedWrites)
   - uid, type: 'notice', title (locale별), body (locale별),
     data: { deptId, articleNo, category },
     read: false, createdAt: now, pushedAt: now

2. devices 쿼리 (한 번):
   where active == true
     AND notificationsEnabled == true
     AND subscribedTopics array-contains-any topics  // ≤10개 제한 주의

3. locale별 그룹핑: { ko: [...], en: [...] }

4. 각 그룹마다 sendEachForMulticast (500토큰씩 배치):
   - locale별 문구 선택 (ko fallback — MVP ko-only 대응):
     const title = locale === 'en' ? (payload.title_en ?? payload.title_ko) : payload.title_ko;
     const body  = locale === 'en' ? (payload.body_en  ?? payload.body_ko ) : payload.body_ko;
   - notification.title/body = 위에서 선택한 문구
   - data.notificationId = 해당 유저 notification 레코드 ID
   - data.type = 'notice', data.deptId, data.articleNo, data.category
   - android.priority = 'high'
   - android.notification.channelId = mapCategoryToChannel(category)
   - apns.payload.aps.sound = 'default'
   - fcmOptions.analyticsLabel = `notice_${category}_v1`

5. UNREGISTERED/INVALID_ARGUMENT → devices/{id}.active = false
```

> **ko-only MVP 시사점:** 현재 `payload.title_en`/`body_en`이 null로 넘어오므로 locale='en' 유저도 `??` fallback에 의해 한국어 문구 수신. 영문 번역 파이프라인이 생기면 fallback이 자연스럽게 en 문구를 우선 선택 → 코드 변경 없음.

**3. `syncPreferencesToDevices` — Firestore onUpdate trigger**

```
users/{uid}/preferences 변경 감지
  → 해당 uid의 모든 devices 문서에 subscribedTopics + notificationsEnabled 복제
```

> `_syncedAt` 필드 등으로 무한루프 방지 (devices onUpdate 트리거는 만들지 않음).

**4. `syncUserLocaleToDevices` — Firestore onUpdate trigger (**NEW**)**

```
users/{uid}.locale 변경 감지
  → 해당 uid의 모든 devices 문서에 locale 복제
  → 다음 알림부터 새 언어로 수신
```

**5. `cleanupStaleDevices` — scheduled function**

```
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
4. Security Rules (다른 uid 차단 + `notifications`의 read/readAt만 업데이트 허용)
5. `getOrCreateDeviceId()` → MMKV persist 확인

### Phase 3
1. 알림 설정 화면 → 탭/학과 목록
2. 마스터 ON → OS 팝업 → 토큰 획득
3. 카테고리/학과 토글 → Firestore 즉시 반영
4. 마스터 OFF → `enabled: false`, `subscribedTopics` 유지
5. 마스터 다시 ON → 이전 구독 복원
6. MANDATORY_TOPICS 비활성 토글
7. 포그라운드 수신 → Notifee 로컬 알림 표시
8. 백그라운드 수신 → **OS 자동 표시** (Notifee 호출 없음 — 중복 없음 확인)
9. 알림 탭 → `notifications/{id}.read = true` 확인 + 딥링크
10. 앱 내 알림함 → unread 뱃지 / "모두 읽음" 동작
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
1. 서버 공지 발행 → Android/iOS 알림 수신
2. 탭 → 딥링크 → 공지 상세 + 알림함에서 read 상태 확인
3. 언어 전환 → 다음 알림 언어 변경
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
8. **Firestore Security Rules** — Phase 2에서 앱 코드와 함께 배포. Admin SDK는 우회
9. **RNFB 버전 일치** — firestore 추가 시 기존 모듈과 같은 메이저 버전 유지
10. **`array-contains-any` 최대 10개** — 공지당 topics 10개 이하 유지. 초과 시 쿼리 분할 필요. **전학과 공지 대응 (향후):** 68개 학과 전체 대상 공지가 필요해지면 `dept:all` 와일드카드 토픽 도입 — MANDATORY_TOPICS 또는 가입 시 default로 모든 유저가 자동 구독. Phase 3 착수 후 실제 운영 데이터 기준으로 필요성 재평가. MVP는 현 구조로 충분
11. **`syncPreferencesToDevices`/`syncUserLocaleToDevices` 무한루프 방지** — devices onUpdate 트리거 만들지 않기. sync-originated change 구분 필요 시 `_syncedAt` 필드로 판별
12. **토글 debounce** — 알림 설정 화면에서 Firestore write를 500ms debounce. sync Cloud Function 과도 실행 방지
13. **Hybrid 페이로드 중복 표시 함정** — 백그라운드 핸들러에서 절대 `notifee.displayNotification()` 호출 금지. OS 자동 표시 + Notifee로 **2회 알림** 발생. 포그라운드에서만 Notifee 호출
14. **Cloud Function `type` 계약** — 신규 타입 추가 시 기존 `handleNoticeNotification`과 동일한 페이로드 계약(`notification` 필드 + `data.notificationId` 필수) 유지
15. **`notifications` 쓰기 제약** — 앱은 `read`/`readAt`만 업데이트 가능(Security Rules). 생성/삭제는 Cloud Function Admin SDK 전용
16. **Android hybrid intent 주의** — Android 백그라운드에서 hybrid 페이로드 수신 시 data는 `onNewIntent` 경유. RNFirebase `getInitialNotification()`/`onNotificationOpenedApp()`이 추상화하지만, 네이티브 Activity launchMode 변경 시 회귀 가능. 자세한 사항은 [FCM 공식 문서](https://firebase.google.com/docs/cloud-messaging/customize-messages/set-message-type)

---

## 진행 상태 (2026-04-19)

### Phase 1: FCM Foundation — ✅ 완료 (실기기 토큰 검증 + 테스트 알림 수신 완료)

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
| 1.10 notification-router.ts | ✅ | data payload → Expo Router 경로 변환 (NotificationData 타입은 전략 변경에 따라 정리됨) |
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
| 실기기 토큰 검증 | ✅ | TestFlight 실기기에서 FCM 토큰 발급 + 테스트 알림 수신 성공 |

### 시뮬레이터 검증 결과

- ✅ FCM SDK 초기화 (`FIRMessaging proxy enabled`)
- ✅ 백그라운드 핸들러 등록 (`signalBackgroundMessageHandlerSet`)
- ✅ `checkPermission()` → authorized
- ✅ `getOrCreateDeviceId()` → UUID 생성 + MMKV 저장
- ❌ FCM 토큰 발급 불가 — 시뮬레이터에서 `aps-environment` entitlement가 strip됨 (자동 서명 제약)
- ✅ 실기기 TestFlight → 토큰 발급 + 알림 수신 성공 (2026-04-19 완료)

### 남은 임시 코드 (**Phase 2 PR에서 제거**)

Phase 2 Firestore 통합이 공식 진입점/검증 수단으로 대체하므로 Phase 2 PR 시작 시 일괄 제거:

- `app/debug-fcm.tsx` — FCM 디버그 화면 → 알림 설정 화면(Phase 3)이 공식 진입점
- `app/(tabs)/campus.tsx` — 빨간 "FCM" 플로팅 버튼 → 제거
- `src/hooks/useAppInit.ts` — `requestPermission()` 임시 호출 + `debugFcmToken` state → Phase 3 마스터 토글이 공식 권한 요청 지점
- `plugins/withPushNotificationsCapability.js` — **유지** (production에도 필요)

**대체 확인 수단 (Phase 2+ 이후):**
- FCM 토큰: Firestore Console → `devices/{deviceId}` 문서 직접 확인
- 권한 상태: iOS 설정 앱 / Android 앱 정보 → 알림
- 수신 테스트: Firebase Console → Cloud Messaging → Send test message

### Phase 2: Firestore Integration — 미착수

- [ ] Phase 1 임시 코드 제거 (debug-fcm, FCM 플로팅 버튼, 임시 requestPermission)
- [ ] 2.1 타입 정의 (users, devices, preferences, **notifications** — `expiresAt` 포함)
- [ ] 2.2 firestore-notifications.ts (device + preferences + **inbox** 함수)
- [ ] 2.3 Security Rules 배포 (`notifications` 규칙 포함)
- [ ] 2.4 Zustand notification store
- [ ] 2.5 useNotificationPreferences + **useNotificationInbox** 훅
- [ ] 2.6 useAppInit에 device/user/preferences 등록 통합 (Promise.all + withRetry)
- [ ] 2.7 shared exports
- [ ] 2.8 Firestore TTL 정책 활성화 (`notifications.expiresAt` 30d)

### Phase 3: UI + 알림함 + 읽음 처리 — 미착수

- [ ] 3.1 NotificationSettingsScreen
- [ ] 3.2 `app/notifications/{settings,inbox}.tsx` 라우트
- [ ] 3.3 More 화면 진입점 (설정 + 알림함)
- [ ] 3.4 권한 요청 UX
- [ ] 3.5 포그라운드 Notifee displayNotification
- [ ] 3.6 NotificationInboxScreen
- [ ] 3.7 푸시 탭 시 markNotificationAsRead
- [ ] 3.8 언어 변경 → updateUserLocale
- [ ] 3.9 Analytics 자동 이벤트 확인만 (수동 로그 없음)

### Phase 4: iOS NSE — ❌ **전략 폐기 (섹션 삭제됨)**

서버가 `users.locale` 기준 `notification.title`/`body` 선택 → NSE로 다국어 처리 불필요.
App Groups UserDefaults sync, NSE 타겟, NSE provisioning profile, `mutable-content` 플래그 모두 사용하지 않음.
