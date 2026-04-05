#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
source .env.ota.local
RELEASE_CHANNEL=beta npx eoas publish --branch beta --nonInteractive --platform ios
