#!/usr/bin/env bash
# Menu de rede — Walker em modo dmenu, mesmo desenho do power-menu.sh.
#
#   --theme network  caixa pequena no canto superior direito, sob o ícone
#   --nosearch       três opções fixas, não há o que pesquisar
#   --nohints        sem a régua de atalhos no rodapé
#
# Esta máquina é só ethernet — não há placa Wi-Fi e há uma única conexão
# salva. Por isso o menu não lista redes: listar uma coisa só é pior que não
# listar. As três opções são o que sobra de realmente acionável aqui.

dev=$(nmcli -t -f DEVICE,TYPE,STATE device 2>/dev/null \
  | awk -F: '$2!="loopback" && $3=="connected" {print $1; exit}')

if [ -z "$dev" ]; then
  ip="sem conexão"
else
  # -t -f devolve "IP4.ADDRESS[1]:192.168.1.10/24"; corta o prefixo de máscara
  ip=$(nmcli -t -f IP4.ADDRESS device show "$dev" 2>/dev/null \
    | head -1 | cut -d: -f2 | cut -d/ -f1)
  [ -z "$ip" ] && ip="sem IP"
fi

chosen=$(printf "Copiar o IP  ·  %s\nReconectar\nAbrir o nmtui" "$ip" \
  | walker --dmenu --theme network --nosearch --nohints)

case "$chosen" in
  "Copiar o IP"*)
    printf '%s' "$ip" | wl-copy
    notify-send -a "rede" -i network-wired "IP copiado" "$ip"
    ;;
  Reconectar)
    con=$(nmcli -t -f NAME,DEVICE connection show --active 2>/dev/null \
      | awk -F: -v d="$dev" '$2==d {print $1; exit}')
    if [ -n "$con" ]; then
      nmcli connection down "$con" >/dev/null 2>&1
      nmcli connection up   "$con" >/dev/null 2>&1
      notify-send -a "rede" -i network-wired "Rede reconectada" "$con  ·  $dev"
    fi
    ;;
  "Abrir o nmtui")
    # Workspace vazia, mesmo tratamento que a barra dá ao btop.
    hyprctl dispatch 'hl.dsp.exec_cmd("[workspace empty] kitty -e nmtui")' >/dev/null
    ;;
esac
