#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
JAR=target/datawise-desktop-4.0.1.jar
if [[ ! -f "$JAR" ]]; then
  echo "Missing $JAR. Run: mvn -q package"
  exit 1
fi
exec java -cp "$JAR:target/lib/*" org.apache.datawise.desktop.DatawiseDesktopApp "$@"
