#!/bin/bash
# Publish OTA to the production channel, then tag the source commit.
#
# Tag format: ota/prod/YYYY-MM-DDTHHMM  (ISO-like, KST local time)
#   - `T` cleanly separates date and time for downstream parsing.
#   - Same date+minute won't clash in single-user practice; bump precision
#     to %H%M%S later if needed.
#
# `set -euo pipefail` + eoas oclif exit codes guarantee we only reach
# the tag step when both platforms published successfully.
#
# Future extensions (Slack ping / GH release / Crashlytics meta) go in
# the "on-success actions" block below — just add lines.

set -euo pipefail
cd "$(dirname "$0")/.."

# ── stage 1: capture pre-publish state ──
COMMIT_SHA="$(git rev-parse HEAD)"
COMMIT_SHORT="$(git rev-parse --short HEAD)"

# ── stage 2: load env + publish ──
# .env first (EXPO_PUBLIC_* build constants — metro inlines these at bundle
# time), then .env.ota.local (EXPO_TOKEN for eoas auth). Sourcing only
# .env.ota.local was the bug that caused EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to
# inline as undefined in OTA bundles → Google Sign-In returned idToken=null on
# Android → 12500 symptom.
set -a
source .env
source .env.ota.local
set +a
# eoas 버전 고정 — 미고정 npx는 릴리스 당일의 최신 메이저를 받는다.
# 2026-07-21 hotfix OTA 때 전날 나온 v3이 우리 v1-스타일 설정
# (updates.requestHeaders에 expo-app-id 없음)을 거부하며 발행이 중단됐다.
# 버전을 올릴 땐 `npx eoas init` 마이그레이션을 함께 검증할 것.
EOAS_VERSION="2.3.19"
# Publishing to the WRONG runtimeVersion succeeds silently and reaches no
# device (2026-07-29 incident). Surface the target loudly before publishing;
# verify it matches the store builds' runtime (see docs/how-to/ota-update.md).
RT="$(grep -o 'runtimeVersion: *"[^"]*"' app.config.ts | head -1 | sed 's/.*"\(.*\)"/\1/')"
echo "🎯 publishing for runtimeVersion=${RT} — store builds must match or nobody receives this"
RELEASE_CHANNEL=production npx -y "eoas@${EOAS_VERSION}" publish --branch production --nonInteractive --platform ios
RELEASE_CHANNEL=production npx -y "eoas@${EOAS_VERSION}" publish --branch production --nonInteractive --platform android

# ── stage 3: compute tag (ISO-like date + time) ──
TAG="ota/prod/$(date +%Y-%m-%dT%H%M)"

# ── stage 4: on-success actions ──
git tag -a "$TAG" "$COMMIT_SHA" -m "OTA prod $TAG (commit: ${COMMIT_SHORT})"
git push origin "$TAG"
echo "✅ OTA published & tagged: $TAG → $COMMIT_SHORT"
