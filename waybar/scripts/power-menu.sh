#!/usr/bin/env bash

chosen=$(printf "  Desligar\n󰜉  Reiniciar\n󰤄  Suspender\n󰍃  Logout" | wofi --dmenu --prompt "Power")

case "$chosen" in
  *Desligar) systemctl poweroff ;;
  *Reiniciar) systemctl reboot ;;
  *Suspender) systemctl suspend ;;
  *Logout) hyprctl dispatch exit ;;
esac