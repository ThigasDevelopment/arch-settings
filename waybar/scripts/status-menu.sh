#!/usr/bin/env bash

chosen=$(printf "  Volume\n  Notificacoes" | wofi --dmenu --prompt "Status" --location center --width 320 --hide-scroll)

case "$chosen" in
  *Volume)
    if command -v pavucontrol >/dev/null 2>&1; then
      pavucontrol
    fi
    ;;
  *Notificacoes)
    swaync-client -t -sw
    ;;
esac
