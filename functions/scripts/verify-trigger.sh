#!/usr/bin/env bash
# Boot the emulators and run the onPreferencesWrite integration verifier.
#
# A wrapper rather than a bare npm script because the emulator needs a JDK 21+
# and a normal macOS box usually has JAVA_HOME pointed at 17 for the Android
# toolchain — so `npm run verify:trigger` failed with a firebase-tools Java
# error on exactly the machines it was written for. The probe is shared with
# the rules suite; see scripts/find-jdk.sh for why locating a JDK is not one line.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=../../scripts/find-jdk.sh
source "$repo_root/scripts/find-jdk.sh"

cd "$repo_root/functions"
npm run build

exec firebase emulators:exec --only functions,firestore \
  --project demo-skku-verify-trigger \
  "node --experimental-strip-types scripts/verify-trigger.ts"
