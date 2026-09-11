#!/usr/bin/env bash
# Reinicia direto no Windows — fonte do helper root-only.
#
# Esta máquina tem dois discos com ESP separado: o systemd-boot mora no
# sdc1 (/boot) e o Windows Boot Manager no sda1, que o systemd-boot não
# varre. Por isso não dá para usar `systemctl reboot --boot-loader-entry`:
# não existe entrada de Windows no loader. O que existe é a entrada de
# firmware Boot0000, e o caminho é marcá-la como BootNext na NVRAM.
#
# BootNext é one-shot: o firmware a consome no próximo boot e a BootOrder
# normal (Linux) volta a valer sozinha depois. Nada é gravado em disco.
#
# O número da entrada é resolvido pelo nome a cada execução, e não fixado,
# porque reinstalar o Windows ou limpar a NVRAM renumera as entradas.
#
# INSTALAÇÃO (uma vez, pede senha):
#
#   sudo install -m 755 -o root -g root \
#     ~/.config/hypr/scripts/reboot-to-windows.sh /usr/local/bin/reboot-to-windows
#   sudo sh -c 'printf "%s ALL=(root) NOPASSWD: /usr/local/bin/reboot-to-windows\n" dev \
#     > /etc/sudoers.d/reboot-to-windows; chmod 440 /etc/sudoers.d/reboot-to-windows'
#   sudo visudo -c
#   sudo -n -l /usr/local/bin/reboot-to-windows   # tem de responder sem pedir senha
#
# A regra NÃO sai por `printf ... | sudo install /dev/stdin ...`: o install
# não copia de pipe e o arquivo fica VAZIO — sem erro, e o sudoers segue
# "parsed OK", então a falha só aparece como senha sendo pedida. Foi o que
# aconteceu em 2026-09-11. Redirecionamento dentro do `sh -c` funciona.
#
# A cópia em /usr/local/bin é de propósito: uma regra NOPASSWD apontando
# para script dentro de ~ seria escalada de privilégio — qualquer coisa
# que escrevesse no home viraria root. O alvo do sudoers tem de ser
# root-only. Este arquivo aqui é só a fonte versionada nos dotfiles;
# reinstale depois de editá-lo.

set -euo pipefail

num=$(efibootmgr | sed -n 's/^Boot\([0-9A-Fa-f]\{4\}\)\*\?[[:space:]]\+Windows Boot Manager.*/\1/p' | head -n1)

if [[ -z $num ]]; then
  echo "reboot-to-windows: nenhuma entrada EFI 'Windows Boot Manager' na NVRAM" >&2
  exit 1
fi

efibootmgr --bootnext "$num" >/dev/null
exec systemctl reboot
