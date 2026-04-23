#!/usr/bin/env bash

PLAYER="spotify"

if ! playerctl -l 2>/dev/null | grep -qx "$PLAYER"; then
  echo '{"text":"󰐊","class":"offline"}'
  exit 0
fi

STATUS=$(playerctl -p "$PLAYER" status 2>/dev/null)

if [ "$STATUS" = "Playing" ]; then
  echo '{"text":"󰏤","class":"playing"}'
else
  echo '{"text":"󰐊","class":"paused"}'
fi