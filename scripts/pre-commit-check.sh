#!/usr/bin/env sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec node scripts/sop/pre-commit-check.mjs "$@"
