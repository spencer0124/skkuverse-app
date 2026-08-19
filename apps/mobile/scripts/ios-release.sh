#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Deliberately no `source .env`. The three values that once needed it — API host,
# Naver client ID, Google OAuth client ID — are committed constants in
# config/constants.js, and nothing reads process.env.EXPO_PUBLIC_* any more. What
# .env still holds must NOT reach a release: the App Check debug tokens are real
# secrets, and an APP_ENV=development left over from simulator push work would give
# this build the sandbox APNs entitlement. See apps/mobile/.env.example. A genuine
# per-machine build value goes in the profile `env` block in eas.json, where review
# can see it.

# EAS local build must run in a symlink-free dir (see ios-beta.sh / docs for why).
export TMPDIR="$HOME/.eas-build-tmp"
mkdir -p "$TMPDIR"
IPA="./build.ipa"
rm -f "$IPA"
eas build --platform ios --profile production --local --non-interactive --output "$IPA"
bundle exec fastlane ios upload_release ipa:"$IPA"
