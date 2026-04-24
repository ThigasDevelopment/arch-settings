#!/usr/bin/env bash

vol=0
muted="no"

if command -v wpctl >/dev/null 2>&1; then
  wp_out=$(wpctl get-volume @DEFAULT_AUDIO_SINK@ 2>/dev/null)
  vol=$(printf '%s' "$wp_out" | awk '{printf "%d", $2 * 100}')
  printf '%s' "$wp_out" | grep -q "MUTED" && muted="yes"
elif command -v pactl >/dev/null 2>&1; then
  vol=$(pactl get-sink-volume @DEFAULT_SINK@ 2>/dev/null | awk -F'/' 'NR==1 {gsub(/ /, "", $2); gsub(/%/, "", $2); print $2}')
  pactl get-sink-mute @DEFAULT_SINK@ 2>/dev/null | grep -q "yes" && muted="yes"
fi

net_state="Offline"
if command -v nmcli >/dev/null 2>&1; then
  if nmcli -t -f TYPE,STATE device status 2>/dev/null | grep -q '^wifi:connected$'; then
    ssid=$(nmcli -t -f ACTIVE,SSID dev wifi 2>/dev/null | awk -F: '$1=="yes" {print $2; exit}')
    if [ -n "$ssid" ]; then
      net_state="Wi-Fi: ${ssid}"
    else
      net_state="Wi-Fi Online"
    fi
  elif nmcli -t -f TYPE,STATE device status 2>/dev/null | grep -q '^ethernet:connected$'; then
    net_state="Ethernet Online"
  elif nmcli -t -f STATE general 2>/dev/null | grep -q '^connected'; then
    net_state="Online"
  fi
elif ip route 2>/dev/null | grep -q '^default '; then
  net_state="Online"
fi

notif_state="Ativas"
if command -v swaync-client >/dev/null 2>&1; then
  if [ "$(swaync-client -D 2>/dev/null)" = "true" ]; then
    notif_state="DND"
  fi
fi

if [ "$muted" = "yes" ]; then
  audio_icon="󰝟"
elif [ "$vol" -eq 0 ]; then
  audio_icon="󰕿"
elif [ "$vol" -lt 35 ]; then
  audio_icon="󰖀"
else
  audio_icon="󰕾"
fi

text="${audio_icon}  "
tooltip="Volume: ${vol}%\nRede: ${net_state}\nNotificacoes: ${notif_state}"

printf '{"text":"%s","tooltip":"%s"}\n' "$text" "$tooltip"
