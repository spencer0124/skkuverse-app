#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
npx eoas publish --branch beta --nonInteractive --platform ios
