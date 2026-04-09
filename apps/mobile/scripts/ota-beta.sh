#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
source .env.ota.local
set +a
RELEASE_CHANNEL=beta npx eoas publish --branch beta --nonInteractive --platform ios
RELEASE_CHANNEL=beta npx eoas publish --branch beta --nonInteractive --platform android
