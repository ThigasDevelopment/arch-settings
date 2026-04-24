#!/usr/bin/env bash

PLAYER="spotify"

if ! playerctl -l 2>/dev/null | grep -qx "$PLAYER"; then
  echo '{"text":"󰓇 404 Not Found","tooltip":"Spotify fechado","class":"404 Not Found"}'
  exit 0
fi

STATUS=$(playerctl -p "$PLAYER" status 2>/dev/null)
TITLE=$(playerctl -p "$PLAYER" metadata title 2>/dev/null)
ARTIST=$(playerctl -p "$PLAYER" metadata artist 2>/dev/null)
ICON="󰏤"

if [ -z "$TITLE" ]; then
  echo '{"text":"󰏤","tooltip":"Spotify aberto","class":"idle"}'
  exit 0
fi

TEXT="󰓇 $ARTIST - $TITLE"
SHORT=$(printf "%s" "$TEXT" | cut -c1-32)

if [ "$STATUS" = "Playing" ]; then
  CLASS="playing"
  ICON="󰏤"
else
  CLASS="paused"
  ICON="󰐊"
fi

printf '{"text":"%s","tooltip":"%s","class":"%s"}\n' "$ICON" "$TEXT" "$CLASS"