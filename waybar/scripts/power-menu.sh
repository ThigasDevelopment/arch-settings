#!/usr/bin/env bash

chosen=$(printf "Desligar\nReiniciar\nSuspender" | wofi --dmenu --prompt "Power")

case "$chosen" in
  "Desligar") systemctl poweroff ;;
  "Reiniciar") systemctl reboot ;;
  "Suspender") systemctl suspend ;;
esac