# OTA (Over-The-Air) 업데이트

## 개요

`expo-updates` + 셀프호스팅 `expo-open-ota` 서버로 JS 번들을 앱스토어 심사 없이 배포.

- **서버:** `https://ota.skkuverse.com` (OCI Free Tier A1, Docker)
- **대시보드:** `https://ota.skkuverse.com/dashboard/`
- **인프라 레포:** `skkuverse-codepush`

## 업데이트 발행

```bash
cd apps/mobile

# beta (TestFlight/Internal Testing 사용자에게만)
./scripts/ota-beta.sh

# production (App Store/Play Store 사용자에게만)
./scripts/ota-release.sh
```

**채널 분리:**
- `beta` 채널: `ios-beta.sh` / `android-beta.sh`로 빌드된 앱이 받음 (TestFlight/Internal Testing)
- `production` 채널: `ios-release.sh` / `android-release.sh`로 빌드된 앱이 받음 (App Store/Play Store)
- 채널은 `app.config.ts`에서 `EAS_BUILD_PROFILE` 환경변수로 빌드 시점에 결정됨
- **권장 워크플로우:** beta에 먼저 OTA 발행 → 검증 → production에 발행

**주의:**
- 워킹 트리가 clean해야 함 (커밋 필요)
- `EXPO_TOKEN`은 `.env.ota.local`에 저장 (gitignored). 스크립트가 자동으로 읽음
- `--platform ios`는 lottie-react-native web export 이슈 회피용
- 채널은 빌드 시점에 결정됨 — 기존 빌드의 채널은 변경 불가

## 업데이트 전략

### 다운로드 타이밍

| 시나리오 | 동작 |
|---------|------|
| Cold start | `checkAutomatically: ON_LOAD` + 커스텀 스플래시에서 체크 |
| 백그라운드 5분+ 복귀 | 커스텀 스플래시 → 체크 → 다운로드 → 적용 |
| 백그라운드 5분 미만 복귀 | 조용히 다운로드만, 스플래시 안 뜸 |

### 적용 흐름

```
커스텀 스플래시 → 업데이트 체크 (10초 타임아웃)
├─ 없음 → 바로 메인 진입
└─ 있음 → 다운로드 → reloadAsync() → 앱 재시작 → 메인 진입
    └─ 타임아웃 초과 → 기존 번들로 메인 진입 (다음 기회에 적용)
```

### 구현 파일

| 파일 | 역할 |
|------|------|
| `src/hooks/useOTAUpdate.ts` | 체크/다운로드/적용 훅 (에러 삼킴, dev no-op) |
| `src/providers/InitGate.tsx` | 커스텀 스플래시 + OTA 흐름 + 백그라운드 복귀 처리 |

## 네이티브 빌드가 필요한 경우

OTA는 **JS 번들만** 교체. 다음 변경은 네이티브 리빌드 + 앱스토어 재배포 필요:

- `app.config.ts`의 plugins, ios, android 섹션 변경
- 새 네이티브 모듈 추가/제거
- Expo SDK 버전 업그레이드
- `runtimeVersion` 변경

리빌드 시 `runtimeVersion`을 bump해야 기존 OTA 업데이트와 충돌 안 남.

## 서버 구성

```
OCI A1 (ARM64, 4 OCPU, 24GB)
├── Docker: ghcr.io/axelmarciano/expo-open-ota:latest (포트 3010)
├── Nginx: ota.skkuverse.com → 127.0.0.1:3010
├── SSL: Cloudflare Origin Certificate
├── 스토리지: 로컬 파일시스템 (./updates)
└── 코드 서명: RSA keys (./keys)
```

### 서버 환경변수 (.env)

| 변수 | 설명 |
|------|------|
| `BASE_URL` | `https://ota.skkuverse.com` |
| `EXPO_ACCESS_TOKEN` | Expo API 토큰 |
| `EXPO_APP_ID` | EAS 프로젝트 ID |
| `JWT_SECRET` | 대시보드 인증 |
| `ADMIN_PASSWORD` | 대시보드 로그인 비밀번호 |
| `STORAGE_MODE` | `local` (추후 `s3`로 전환 가능) |
| `USE_DASHBOARD` | `true` |

## app.config.ts 설정

```typescript
runtimeVersion: "3.5.0",  // 고정 문자열. 네이티브 변경 시에만 수동 bump
updates: {
  url: "https://ota.skkuverse.com/manifest",
  enabled: true,
  fallbackToCacheTimeout: 0,
  requestHeaders: {
    // EAS_BUILD_PROFILE=beta → "beta", 그 외 �� "production"
    "expo-channel-name": process.env.EAS_BUILD_PROFILE === "beta" ? "beta" : "production",
  },
  codeSigningCertificate: "./certs/certificate.pem",
  codeSigningMetadata: {
    keyid: "main",
    alg: "rsa-v1_5-sha256",
  },
},
```

**runtimeVersion:** 고정 문자열 사용. `{ policy: "fingerprint" }`는 EAS build와 eoas 간 해시 불일치 이슈로 사용하지 않음. 네이티브 코드 변경 시 수동으로 올려야 함.

**expo-channel-name:** `EAS_BUILD_PROFILE` 환경변수로 빌드 시 자동 결정. `--profile beta` → `"beta"`, `--profile production` → `"production"`. 없으면 서버가 400 반환.

## Troubleshooting

### OTA 발행 시 "Error validating expo auth"
`EXPO_TOKEN` 환경변수 누락. `.env.ota.local` 파일에 토큰이 있는지 확인. 없으면 [expo.dev](https://expo.dev) → Settings → Access tokens에서 발급 후 `.env.ota.local`에 `EXPO_TOKEN=<토큰>` 추가.

### 서버 로그에 "No channel name provided" (400)
앱이 `expo-channel-name` 헤더를 안 보냄. `app.config.ts`의 `updates.requestHeaders`에 추가하고 네이티브 리빌드 필요.

### 앱에서 업데이트 안 받아짐
1. 서버 헬스체크: `curl https://ota.skkuverse.com/hc`
2. manifest 응답: `curl -H "expo-channel-name: beta" -H "expo-platform: ios" -H "expo-runtime-version: 3.5.0" -H "expo-protocol-version: 1" https://ota.skkuverse.com/manifest`
3. 서버 로그: `ssh oracle "docker compose -f /opt/skkuverse-codepush/docker-compose.yml logs --tail 20"`
4. 앱이 요청하는 채널/runtimeVersion 확인: 서버 로그에서 `Expo-Channel-Name`과 `Expo-Runtime-Version` 헤더 확인

### runtimeVersion 불일치 (No update found)
서버에 올라간 OTA의 runtimeVersion과 앱의 runtimeVersion이 다르면 업데이트가 안 됨. `app.config.ts`의 `runtimeVersion`을 확인하���, 네이티브 리빌드 후 새 빌드를 TestFlight/Play Store에 올려야 함.
