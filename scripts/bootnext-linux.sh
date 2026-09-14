#!/usr/bin/env bash
# Aponta o próximo boot para o Linux — fonte do helper chamado pela unit
# bootnext-linux.service. Não reinicia nada: só marca.
#
# POR QUE ISTO EXISTE:
#
#   BootOrder: 0000,0001,0002
#   Boot0000* Windows Boot Manager     (ESP do sda1)
#   Boot0001* Linux Boot Manager       (systemd-boot, ESP do sdc1)
#
# O Windows está em primeiro na BootOrder desta máquina, então qualquer reboot
# que não marque nada devolve o controle ao firmware e abre o Windows. Como a
# unit roda em TODO caminho de reinício, `reboot` no terminal, atualização que
# reinicia e Ctrl+Alt+Del passam a abrir o Linux igual ao botão do power menu.
#
# Por que não arrumar a BootOrder e pronto: pôr o Linux em primeiro faria
# reiniciar PELO WINDOWS cair no Linux. A regra desejada é "cada sistema
# reinicia em si mesmo", e é a BootOrder com o Windows na frente que dá isso
# do lado de lá.
#
# NÃO precisa de regra no sudoers: quem chama é o systemd, já como root.
#
# INSTALAÇÃO (uma vez, pede senha):
#
#   cd <este repo>
#   sudo install -m 755 -o root -g root scripts/bootnext-linux.sh /usr/local/bin/bootnext-linux
#   sudo install -m 644 -o root -g root systemd/system/bootnext-linux.service /etc/systemd/system/
#   sudo systemctl enable bootnext-linux.service
#
# (o `enable` só cria o link em reboot.target.wants — a unit não roda agora,
# ela roda no caminho de desligamento quando o alvo é reboot)

set -euo pipefail

# Respeita um destino já escolhido.
#
# ESTE É O PONTO DELICADO: o botão "Ir para o Windows" grava BootNext e chama
# `systemctl reboot`. Sem esta guarda, a unit rodaria logo em seguida, no
# caminho do shutdown, sobrescreveria aquele BootNext e o botão do Windows
# levaria de volta ao Linux — quebrando justamente o que já funcionava.
if efibootmgr 2>/dev/null | grep -q '^BootNext:'; then
    exit 0
fi

# Resolve pelo nome a cada execução: reinstalar um sistema ou limpar a NVRAM
# renumera as entradas.
num=$(efibootmgr 2>/dev/null | sed -n 's/^Boot\([0-9A-Fa-f]\{4\}\)\*\?[[:space:]]\+Linux Boot Manager.*/\1/p' | head -n1)

# Se alguém renomeou a entrada, cai no caminho do binário do systemd-boot.
if [[ -z $num ]]; then
    num=$(efibootmgr 2>/dev/null | sed -n 's/^Boot\([0-9A-Fa-f]\{4\}\)\*\?.*SYSTEMD-BOOTX64\.EFI.*/\1/Ip' | head -n1)
fi

# Sai limpo mesmo sem achar: isto roda no meio de um desligamento, e travar o
# reboot por causa de um enfeite seria um péssimo negócio.
[[ -n $num ]] || exit 0

efibootmgr --bootnext "$num" >/dev/null
