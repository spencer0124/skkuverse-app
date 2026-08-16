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
# EAS local build must run in a symlink-free dir (see ios-beta.sh / docs for why).
export TMPDIR="$HOME/.eas-build-tmp"
mkdir -p "$TMPDIR"
IPA="./build.ipa"
rm -f "$IPA"
eas build --platform ios --profile production --local --non-interactive --output "$IPA"
echo "Build: $IPA"
