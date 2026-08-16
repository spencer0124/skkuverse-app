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
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
AAB="./build.aab"
rm -f "$AAB"
eas build --platform android --profile production --local --non-interactive --output "$AAB"
bundle exec fastlane android upload_release aab:"$AAB"
