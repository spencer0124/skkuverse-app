# OTA (Over-The-Air) 업데이트

## 개요

`expo-updates` + 셀프호스팅 `expo-open-ota` 서버로 JS 번들을 앱스토어 심사 없이 배포.

- **서버:** `https://ota.skkuverse.com` (OCI Free Tier A1, Docker)
- **대시보드:** `https://ota.skkuverse.com/dashboard/`
- **인프라 레포:** `skkuverse-codepush`

## 업데이트 발행

```bash
cd apps/mobile

# 프로덕션 발행
EXPO_TOKEN=<토큰> RELEASE_CHANNEL=production npx eoas publish --branch production --nonInteractive --platform ios

# 프리뷰 발행
EXPO_TOKEN=<토큰> RELEASE_CHANNEL=preview npx eoas publish --branch preview --nonInteractive --platform ios
```

**주의:**
- 워킹 트리가 clean해야 함 (커밋 필요)
- `EXPO_TOKEN` 필수 (expo.dev에서 발급한 access token)
- `--platform ios`는 lottie-react-native web export 이슈 회피용

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
runtimeVersion: "1.0.0",
updates: {
  url: "https://ota.skkuverse.com/manifest",
  enabled: true,
  fallbackToCacheTimeout: 0,
  requestHeaders: {
    "expo-channel-name": "production",  // 로컬 빌드에서는 이게 필수
  },
  codeSigningCertificate: "./certs/certificate.pem",
  codeSigningMetadata: {
    keyid: "main",
    alg: "rsa-v1_5-sha256",
  },
},
```

**중요:** `requestHeaders`의 `expo-channel-name`은 EAS 클라우드 빌드에서는 자동 주입되지만, **로컬 빌드(`--local`)에서는 수동 설정 필수**. 없으면 서버가 400 반환.

## Troubleshooting

### OTA 발행 시 "Error validating expo auth"
`EXPO_TOKEN` 환경변수 누락. 발행 커맨드에 포함해야 함.

### 서버 로그에 "No channel name provided" (400)
앱이 `expo-channel-name` 헤더를 안 보냄. `app.config.ts`의 `updates.requestHeaders`에 추가하고 네이티브 리빌드 필요.

### 앱에서 업데이트 안 받아짐
1. 서버 헬스체크: `curl https://ota.skkuverse.com/hc`
2. manifest 응답: `curl -H "expo-channel-name: production" -H "expo-platform: ios" -H "expo-runtime-version: 1.0.0" -H "expo-protocol-version: 1" https://ota.skkuverse.com/manifest`
3. 서버 로그: `ssh oracle "docker compose -f /opt/skkuverse-codepush/docker-compose.yml logs --tail 20"`
