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

# EAS local build must run in a symlink-free directory. macOS temp dirs (/tmp,
# /var/folders) are symlinks under /private/...; in this yarn-workspaces monorepo
# the Metro "Bundle React Native code and images" phase then mismatches the entry
# path (symlink form, e.g. /tmp/...) against the Metro server root (realpath, e.g.
# /private/tmp/...) and fails: "Unable to resolve module .../apps/mobile/index.ts".
# A $HOME-based TMPDIR has no symlink so both paths match. See docs/ios-build-deploy.md.
export TMPDIR="$HOME/.eas-build-tmp"
mkdir -p "$TMPDIR"

IPA="./build.ipa"
rm -f "$IPA"
eas build --platform ios --profile beta --local --non-interactive --output "$IPA"
bundle exec fastlane ios upload_beta ipa:"$IPA"
