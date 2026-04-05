#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
AAB="./build.aab"
rm -f "$AAB"
eas build --platform android --profile production --local --non-interactive --output "$AAB"
bundle exec fastlane android upload_beta aab:"$AAB"
