#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Load .env into the shell BEFORE invoking eas. eas-cli reads app.config.ts by
# spawning `expo config` with EXPO_NO_DOTENV=1 hard-coded
# (eas-cli/build/project/expoConfig.js), so the file itself is invisible to it —
# only the inherited environment survives. Without this, app.config.ts's
# EXPO_PUBLIC_BASE_URL guard throws and the build dies before it starts. Same
# reason ota-{beta,release}.sh source .env, and the same mechanism behind the
# OTA bundles that once shipped with EXPO_PUBLIC_* inlined as undefined.
set -a
source .env
set +a

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
