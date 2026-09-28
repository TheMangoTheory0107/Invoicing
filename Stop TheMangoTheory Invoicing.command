#!/bin/bash
# Double-click to stop the invoicing app's background server.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$DIR/.server.pid"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  kill "$(cat "$PID_FILE")"
  rm -f "$PID_FILE"
  echo "Stopped. You can close this window."
else
  echo "It wasn't running. You can close this window."
fi
sleep 3
