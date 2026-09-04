#!/usr/bin/env bash
# Menu de energia — Walker em modo dmenu com tema próprio.
#
#   --theme power   caixa pequena ancorada no canto superior direito,
#                   logo abaixo do ícone de power da barra
#   --nosearch      sem campo de busca: são quatro opções fixas
#   --nohints       sem a régua de atalhos no rodapé

chosen=$(printf "Desligar\nReiniciar\nSuspender\nEncerrar sessão" \
  | walker --dmenu --theme power --nosearch --nohints)

case "$chosen" in
  Desligar)          systemctl poweroff ;;
  Reiniciar)         systemctl reboot ;;
  Suspender)         systemctl suspend ;;
  "Encerrar sessão") hyprctl dispatch exit ;;
esac
