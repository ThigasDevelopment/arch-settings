#!/usr/bin/env bash
set -euo pipefail

# Habilita Secure Boot no Arch com chaves próprias, via sbctl.
#
# NÃO é rodado pelo install.sh: exige dois passos na BIOS que nenhum script
# pode fazer por você. Rode à mão quando quiser.
#
# ---------------------------------------------------------------------------
# ANTES DE RODAR — na BIOS da ASUS:
#   Boot → Secure Boot → Key Management → Clear Secure Boot Keys
#   Isso põe o firmware em Setup Mode, único estado em que dá para enrolar
#   chave própria. O script se recusa a continuar fora dele.
#
# DEPOIS DE RODAR:
#   Reboot → BIOS → habilitar Secure Boot → salvar.
# ---------------------------------------------------------------------------
#
# POR QUE AS CHAVES DA MICROSOFT SÃO OBRIGATÓRIAS AQUI (--microsoft):
#   1. Você tem dual boot. Sem o certificado da Microsoft enrolado, o Windows
#      Boot Manager não valida e o Windows simplesmente não dá boot.
#   2. A option ROM da GTX 1660 SUPER é assinada pela Microsoft. Sem esse
#      certificado, o firmware pode recusar inicializar a placa.
#
# SOBRE MÓDULOS DE KERNEL:
#   O kernel do Arch é compilado com CONFIG_LOCK_DOWN_KERNEL_FORCE_NONE=y e
#   sem CONFIG_MODULE_SIG_FORCE, ou seja: não exige módulo assinado nem ativa
#   lockdown sob Secure Boot. Por isso o NVIDIA DKMS continua carregando
#   normalmente — diferente do Ubuntu/Fedora, onde você teria que assinar o
#   módulo a cada atualização de kernel.
#
# AVISO — BITLOCKER:
#   Mudar o estado do Secure Boot pode disparar o pedido da chave de
#   recuperação do BitLocker no próximo boot do Windows. Tenha ela em mãos.

if ! command -v sbctl >/dev/null 2>&1; then
    echo "sbctl não instalado. Rode: sudo pacman -S sbctl"
    exit 1
fi

cat <<.MSG.
== Como ler o status do sbctl ==

  "Installed: X sbctl is not installed" NAO fala do pacote.
  E jargao do sbctl para "as chaves dele ainda nao estao enroladas no
  firmware". Se voce chegou ate aqui, o pacote esta instalado.

  O que importa e a linha "Setup Mode".
.MSG.

echo "== Estado atual =="
sudo sbctl status
echo

if ! sudo sbctl status | grep -qi "Setup Mode:.*Enabled"; then
    cat <<'MSG'
O firmware NÃO está em Setup Mode — não dá para enrolar chaves próprias.

Na BIOS da ASUS:
  Boot → Secure Boot → Key Management → Clear Secure Boot Keys
Salve, reinicie, e rode este script de novo.
MSG
    exit 1
fi

echo "== Criando chaves =="
sudo sbctl create-keys

echo
echo "== Enrolando chaves + certificados da Microsoft =="
echo "   (--microsoft é obrigatório: sem ele o Windows e a option ROM da GPU param)"
sudo sbctl enroll-keys --microsoft

echo
echo "== Assinando bootloader e kernel =="
#
# Em vez de uma lista fixa de caminhos, pergunta ao próprio sbctl o que está
# sem assinatura na ESP e assina isso.
#
# A lista fixa era frágil: ela cobria systemd-boot, mas o archinstall instala
# GRUB por padrão, cujos binários ficam em /boot/EFI/GRUB/grubx64.efi. Com a
# lista antiga o script rodava "com sucesso" e não assinava o bootloader real
# — e a máquina não bootava com Secure Boot ligado.
#
# `sbctl sign -s` registra o arquivo no banco do sbctl, e o hook do pacman
# re-assina sozinho a cada atualização de kernel ou bootloader.
#
# CASO UKI: se o archinstall montou o boot com Unified Kernel Image, o
# artefato bootável é um único /boot/EFI/Linux/*.efi — não existe vmlinuz
# separado a assinar. O `sbctl verify` varre a ESP e acha o UKI sozinho;
# uma lista fixa de caminhos passaria batido por ele e você ligaria o
# Secure Boot numa máquina que não boota.

mapfile -t unsigned < <(sudo sbctl verify 2>/dev/null | awk '/is not signed$/ {print $2}')

if [ ${#unsigned[@]} -eq 0 ]; then
    echo "  nada pendente — tudo já assinado"
else
    for target in "${unsigned[@]}"; do
        echo "  assinando $target"
        sudo sbctl sign -s "$target"
    done
fi

# O kernel pode não estar na ESP (setup com /boot separado); garante.
for extra in /boot/vmlinuz-linux /boot/vmlinuz-linux-lts /boot/vmlinuz-linux-zen; do
    [ -f "$extra" ] || continue
    sudo sbctl list-files 2>/dev/null | grep -qF "$extra" && continue
    echo "  assinando $extra"
    sudo sbctl sign -s "$extra"
done

echo
echo "== Verificação =="
sudo sbctl verify || true

cat <<'MSG'

Pronto. Agora:
  1. Reinicie
  2. BIOS → habilitar Secure Boot → salvar
  3. De volta no Arch, confira com:  sbctl status

O sbctl instalou um hook do pacman que re-assina automaticamente a cada
atualização de kernel. Você não precisa repetir nada.
MSG
