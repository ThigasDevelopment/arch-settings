#!/usr/bin/env bash
# Menu de energia — Walker em modo dmenu com tema próprio.
#
#   --theme power   caixa pequena ancorada no canto superior direito,
#                   logo abaixo do ícone de power da barra
#   --nosearch      sem campo de busca: são cinco opções fixas
#   --nohints       sem a régua de atalhos no rodapé
#
# Os glifos são Material Design da Nerd Font, a mesma família dos ícones da
# barra (ver ICON em ags/widget/Bar.tsx). O layout de item do dmenu não tem
# slot de ícone — só um GtkLabel —, então o glifo vai no próprio texto. O
# texto sai em SF Pro e só o glifo cai na JetBrains Mono, por fallback.

OFF=$'\U000F0425'      # power
REBOOT=$'\U000F0709'   # restart
SLEEP=$'\U000F04B2'    # sleep
LOGOUT=$'\U000F0343'   # logout
WINDOWS=$'\U000F05B3'  # microsoft-windows

chosen=$(printf '%s\n' \
  "$OFF  Desligar" \
  "$REBOOT  Reiniciar" \
  "$SLEEP  Suspender" \
  "$LOGOUT  Encerrar sessão" \
  "$WINDOWS  Ir para o Windows" \
  | walker --dmenu --theme power --nosearch --nohints)

# Glob e não igualdade: a linha volta com o glifo colado na frente.
case "$chosen" in
  *Desligar)          systemctl poweroff ;;
  *Reiniciar)         systemctl reboot ;;
  *Suspender)         systemctl suspend ;;
  # Expressão Lua, não "exit" solto: o dispatch deste Hyprland é avaliado
  # como Lua (mesma forma usada no bind de SUPER+Escape no hyprland.lua).
  *"Encerrar sessão") hyprctl dispatch 'hl.dsp.exit()' ;;
  # O Windows vive no outro disco, com ESP próprio (sda1), então o
  # systemd-boot daqui não enxerga entrada para ele: o caminho é marcar
  # BootNext na NVRAM e reiniciar. Gravar em efivars é root, daí o helper
  # root-only em /usr/local/bin + regra NOPASSWD. Ver reboot-to-windows.sh.
  *"Ir para o Windows")
    if ! sudo -n /usr/local/bin/reboot-to-windows 2>/dev/null; then
      notify-send -u critical "Ir para o Windows" \
        "Helper não instalado. Rode a instalação descrita em hypr/scripts/reboot-to-windows.sh"
    fi
    ;;
esac
