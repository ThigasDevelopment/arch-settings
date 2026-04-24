#!/usr/bin/env bash

chosen=$(printf "  Volume\n󰖩  Internet\n  Notificacoes" | wofi --dmenu --prompt "Status" --location center --width 320 --hide-scroll)

case "$chosen" in
  *Volume)
    if command -v pavucontrol >/dev/null 2>&1; then
      pavucontrol
    fi
    ;;
  *Notificacoes)
    swaync-client -t -sw
    ;;
  *Internet)
    if command -v btop >/dev/null 2>&1; then
		hyprctl dispatch exec "[workspace empty] kitty -e btop --preset 6"
	fi
    ;;
esac
