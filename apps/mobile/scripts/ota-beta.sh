#!/bin/bash
# Publish OTA to the beta channel, then tag the source commit.
#
# Tag format: ota/beta/YYYY-MM-DDTHHMM  (ISO-like, KST local time)
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
# time), then .env.ota.local (EXPO_TOKEN for eoas auth). Mirror of
# ota-release.sh — both scripts must source .env or EXPO_PUBLIC_* values
# will be inlined as undefined.
set -a
source .env
source .env.ota.local
set +a
RELEASE_CHANNEL=beta npx eoas publish --branch beta --nonInteractive --platform ios
RELEASE_CHANNEL=beta npx eoas publish --branch beta --nonInteractive --platform android

# ── stage 3: compute tag (ISO-like date + time) ──
TAG="ota/beta/$(date +%Y-%m-%dT%H%M)"

# ── stage 4: on-success actions ──
git tag -a "$TAG" "$COMMIT_SHA" -m "OTA beta $TAG (commit: ${COMMIT_SHORT})"
git push origin "$TAG"
echo "✅ OTA published & tagged: $TAG → $COMMIT_SHORT"
