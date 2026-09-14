#!/usr/bin/env bash
set -euo pipefail

# Troca a enxurrada de mensagens do boot pelo splash "arch-mac": logo do Arch
# centralizado e uma barra de progresso fina, em fundo preto.
#
# NÃO é rodado pelo install.sh, pela mesma razão do secure-boot.sh: mexe em
# initramfs e na linha de comando do kernel, que são decisão do seu sistema e
# não do tema. Rode à mão quando quiser.
#
#   bash scripts/boot-splash.sh            instala
#   bash scripts/boot-splash.sh --revert   desfaz
#
# ---------------------------------------------------------------------------
# O QUE ELE MEXE
#   /usr/share/plymouth/themes/arch-mac   o tema (cópia de plymouth/arch-mac)
#   /etc/mkinitcpio.conf                  hook plymouth, e KMS cedo se NVIDIA
#   linha de comando do kernel            quiet splash loglevel=3 ...
#   initramfs/UKI                         regerado no fim, e re-assinado
#
# O texto do boot não é "desligado" — ele continua indo para o journal. Só
# deixa de ser pintado na tela. `journalctl -b` mostra tudo como antes.
#
# SE O BOOT NOVO FALHAR:
#   Em setup com UKI, este script guarda uma cópia ASSINADA do UKI atual em
#   /boot/EFI/Linux/arch-linux-backup.efi antes de tocar em qualquer coisa.
#   Segure ESPAÇO na tela do firmware para abrir o menu do systemd-boot e
#   escolha essa entrada — ela é o sistema exatamente como estava agora.
#   Depois, de volta no Arch:  bash scripts/boot-splash.sh --revert
# ---------------------------------------------------------------------------

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
THEME="arch-mac"
THEME_SRC="$SRC_DIR/plymouth/$THEME"
THEME_DEST="/usr/share/plymouth/themes/$THEME"
# Em /var/lib, e não em /root: o script roda como VOCÊ, com sudo por dentro.
# Num diretório 700 do root, as checagens `[ -f ... ]` do --revert falhariam
# todas, e ele juraria que não existe backup nenhum.
CFGBK="/var/lib/arch-mac-splash-backup"
UKI_BK="/boot/EFI/Linux/arch-linux-backup.efi"

# Parâmetros de kernel que fazem o silêncio.
#
#   quiet                       cala as mensagens do kernel na tela
#   splash                      liga o splash do plymouth
#   loglevel=3                  deixa passar erro e acima; sem isso, um aviso
#                               solto rabisca por cima do logo
#   rd.udev.log_level=3         o mesmo, para o udev DENTRO do initramfs
#   vt.global_cursor_default=0  tira o cursor piscando do console
PARAMS=(quiet splash loglevel=3 rd.udev.log_level=3 vt.global_cursor_default=0)

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '\n\033[1;31mERRO: %s\033[0m\n' "$*" >&2; exit 1; }

# --------------------------------------------------------------- onde fica a cmdline
# Três layouts possíveis, e o arquivo a editar muda em cada um:
#
#   UKI          a cmdline é COMPILADA dentro do .efi; a fonte é
#                /etc/kernel/cmdline e só vale depois de regerar o UKI
#   systemd-boot a cmdline é a linha `options` de cada entrada em
#                /boot/loader/entries/*.conf
#   GRUB         é GRUB_CMDLINE_LINUX_DEFAULT em /etc/default/grub, e precisa
#                de grub-mkconfig depois
#
# Editar o arquivo errado é o modo clássico de "fiz tudo certo e nada mudou":
# o sistema segue lendo a cmdline do lugar que você não tocou.
detectar_cmdline() {
    if grep -rqs '^[^#]*_uki=' /etc/mkinitcpio.d/ 2>/dev/null; then
        echo "uki"
    elif sudo sh -c 'ls /boot/loader/entries/*.conf' >/dev/null 2>&1; then
        echo "entries"
    elif [ -f /etc/default/grub ]; then
        echo "grub"
    else
        echo "desconhecido"
    fi
}

# Acrescenta os PARAMS que faltam numa string de cmdline, sem duplicar.
# Compara por CHAVE: se já existe loglevel=7, respeita a sua escolha e não
# empilha um segundo loglevel — dois valores para a mesma chave é sorteio.
acrescentar_params() {
    local atual="$1" p chave resultado="$1"
    for p in "${PARAMS[@]}"; do
        chave="${p%%=*}"
        if ! printf ' %s ' "$atual" | grep -qE " ${chave}(=[^ ]*)? "; then
            resultado="$resultado $p"
        fi
    done
    printf '%s' "$resultado"
}

# --------------------------------------------------------------- secure boot
# Lê o estado do FIRMWARE, e não do `sudo sbctl status`.
#
# Era sbctl, e isso quase custou um boot: o `sudo` falhou por não ter terminal,
# o grep não casou, e o script concluiu "Secure Boot: no". Seguiria em frente,
# gravaria um UKI sem assinatura e o firmware recusaria o boot seguinte — com
# a máquina já reiniciada, tarde demais para consertar por aqui.
#
# A variável EFI é mundo-legível (-rw-r--r--) e não depende de privilégio
# nenhum. Ela tem 5 bytes: 4 de atributos e o último é o valor.
#
# Devolve: yes | no | desconhecido. "desconhecido" NÃO é tratado como "no" em
# lugar nenhum — na dúvida o script assina, porque assinar à toa não custa
# nada e não assinar custa o boot.
detectar_secure_boot() {
    local var=/sys/firmware/efi/efivars/SecureBoot-8be4df61-93ca-11d2-aa0d-00e098032b8c
    if [ ! -d /sys/firmware/efi ]; then
        echo "no"          # boot legado/BIOS: Secure Boot não existe
    elif [ -r "$var" ]; then
        case "$(od -An -t u1 "$var" 2>/dev/null | awk '{print $NF}')" in
            1) echo "yes" ;;
            0) echo "no" ;;
            *) echo "desconhecido" ;;
        esac
    else
        echo "desconhecido"
    fi
}

# Pede a senha AGORA, de uma vez.
#
# Sem isto o primeiro `sudo` do script era lá dentro do passo 1, e num ambiente
# sem terminal ele falhava com "a terminal is required" no MEIO do trabalho.
# Aqui não chegou a estragar nada, mas é sorte de ordem: o certo é descobrir
# que não dá para autenticar antes de encostar em qualquer arquivo.
pedir_sudo() {
    sudo -v 2>/dev/null && return 0
    die "não consigo autenticar com sudo aqui.
    Rode este script direto num terminal (kitty, ou um tty): alguns prompts
    embutidos não repassam o terminal que o sudo precisa para pedir a senha."
}

# ------------------------------------------------------------------------ revert
if [ "${1:-}" = "--revert" ]; then
    pedir_sudo
    sudo test -d "$CFGBK" || die "não achei backup em $CFGBK — nada para desfazer."

    say "Restaurando as configs de antes"
    if sudo test -f "$CFGBK/mkinitcpio.conf"; then
        sudo cp -a "$CFGBK/mkinitcpio.conf" /etc/mkinitcpio.conf
        info "mkinitcpio.conf restaurado"
    fi
    if sudo test -f "$CFGBK/cmdline"; then
        sudo cp -a "$CFGBK/cmdline" /etc/kernel/cmdline
        info "/etc/kernel/cmdline restaurado"
    fi
    if sudo test -d "$CFGBK/entries"; then
        sudo cp -a "$CFGBK/entries/." /boot/loader/entries/
        info "entradas do systemd-boot restauradas"
    fi
    if sudo test -f "$CFGBK/grub"; then
        sudo cp -a "$CFGBK/grub" /etc/default/grub
        sudo grub-mkconfig -o /boot/grub/grub.cfg
        info "/etc/default/grub restaurado e grub.cfg regerado"
    fi

    say "Regerando o initramfs"
    sudo mkinitcpio -P
    if [ "$(detectar_secure_boot)" != no ] && command -v sbctl >/dev/null 2>&1; then
        say "Re-assinando"
        sudo sbctl sign-all || die "sbctl sign-all falhou — NÃO reinicie com Secure Boot ligado."
    fi

    say "Pronto"
    info "O tema segue em $THEME_DEST — sem o hook, ele não faz nada."
    info "Para tirar de vez:  sudo pacman -Rns plymouth && sudo rm -rf $THEME_DEST"
    sudo test -f "$UKI_BK" && info "O UKI de backup segue em $UKI_BK — apague quando não precisar mais."
    exit 0
fi

# ------------------------------------------------------------------- checagens
[ -d "$THEME_SRC" ] || die "não achei o tema em $THEME_SRC"
command -v mkinitcpio >/dev/null || die "este script assume mkinitcpio (não cobre dracut/booster)."

LAYOUT="$(detectar_cmdline)"
[ "$LAYOUT" = "desconhecido" ] && die "não identifiquei onde fica a linha de comando do kernel (nem UKI, nem systemd-boot, nem GRUB)."

# NVIDIA só entra se a máquina tiver NVIDIA. Num Intel/AMD esses módulos não
# existem e o mkinitcpio reclamaria a cada regeração, para sempre.
#
# A pergunta é feita ao modinfo, e não ao pacman: o que importa não é o nome do
# pacote (nvidia, nvidia-dkms, nvidia-open, nvidia-open-dkms, e o que vier
# depois), é se existe um módulo construído PARA O KERNEL ATUAL. Se o DKMS
# ainda não compilou, colocar o módulo no initramfs só geraria aviso.
TEM_NVIDIA=no
if modinfo nvidia_drm >/dev/null 2>&1; then
    TEM_NVIDIA=yes
fi

TEM_SB="$(detectar_secure_boot)"

pedir_sudo

say "Detectado"
info "linha de comando do kernel: $LAYOUT"
info "NVIDIA: $TEM_NVIDIA     Secure Boot ativo: $TEM_SB"

# --------------------------------------------------------------------- backup
say "1/8  Backup"
sudo mkdir -p "$CFGBK"
sudo cp -a /etc/mkinitcpio.conf "$CFGBK/mkinitcpio.conf"
case "$LAYOUT" in
    uki)     [ -f /etc/kernel/cmdline ] && sudo cp -a /etc/kernel/cmdline "$CFGBK/cmdline" ;;
    entries) sudo mkdir -p "$CFGBK/entries"; sudo cp -a /boot/loader/entries/. "$CFGBK/entries/" ;;
    grub)    sudo cp -a /etc/default/grub "$CFGBK/grub" ;;
esac
info "configs em $CFGBK"

# A cópia do UKI é a rede de segurança de verdade: a assinatura do Secure Boot
# fica DENTRO do binário, então a cópia continua válida e o systemd-boot a
# lista como uma entrada a mais. É um boot que sabidamente funciona, guardado
# antes de mexer em qualquer coisa.
# O `ls` vai com sudo porque /boot costuma ser vfat montado com fmask=0077:
# 700 para o root. Um glob comum não enxerga nada ali e devolveria a lista
# vazia sem erro — o backup simplesmente não aconteceria, em silêncio.
UKI_ATUAL=""
while IFS= read -r c; do
    [ -z "$c" ] && continue
    [ "$c" = "$UKI_BK" ] && continue
    UKI_ATUAL="$c"
    break
done < <(sudo sh -c 'ls -1 /boot/EFI/Linux/arch-linux.efi /boot/EFI/Linux/*.efi 2>/dev/null' || true)
if [ -n "$UKI_ATUAL" ]; then
    if sudo test -f "$UKI_BK"; then
        info "$UKI_BK já existe — mantendo (é o backup que sabidamente boota)"
    else
        disp=$(df --output=avail -k /boot | tail -1)
        prec=$(( $(sudo stat -c %s "$UKI_ATUAL") / 1024 ))
        if [ "$disp" -gt $(( prec + 51200 )) ]; then
            sudo cp -a "$UKI_ATUAL" "$UKI_BK"
            info "cópia assinada de $(basename "$UKI_ATUAL") salva como $(basename "$UKI_BK")"
        else
            info "AVISO: /boot sem espaço para a cópia de segurança — seguindo sem ela"
        fi
    fi
fi

# ------------------------------------------------------------------- plymouth
say "2/8  Pacote plymouth"
sudo pacman -S --needed --noconfirm plymouth ||
    die 'não consegui instalar o plymouth. Se disse "target not found", rode um `sudo pacman -Syu` completo e tente de novo.'

say "3/8  Instalando o tema em $THEME_DEST"
sudo install -d -m 755 "$THEME_DEST"
sudo install -m 644 "$THEME_SRC/arch-mac.script" "$THEME_DEST/"
sudo install -m 644 "$THEME_SRC"/*.png          "$THEME_DEST/"
sudo install -m 644 "$THEME_SRC/arch-mac.plymouth" "$THEME_DEST/$THEME.plymouth"

say "4/8  Definindo $THEME como tema padrão"
sudo plymouth-set-default-theme "$THEME"
info "tema ativo: $(plymouth-set-default-theme)"

# -------------------------------------------------------------- mkinitcpio.conf
say "5/8  /etc/mkinitcpio.conf"

# O hook vai logo DEPOIS do udev: o plymouth precisa do udev já de pé para
# achar o dispositivo de vídeo, e precisa vir antes de qualquer hook que possa
# pedir senha (encrypt/sd-encrypt), senão o pedido aparece em tela preta.
#
# Casa `systemd` também: quem usa initramfs baseado em systemd não tem o hook
# `udev` na lista, e o mesmo raciocínio de ordem vale para ele.
if grep -qE '^HOOKS=.*\bplymouth\b' /etc/mkinitcpio.conf; then
    info "hook plymouth já estava presente"
else
    sudo sed -i -E 's/^(HOOKS=\([^)]*\b(udev|systemd)\b)/\1 plymouth/' /etc/mkinitcpio.conf
    grep -qE '^HOOKS=.*\bplymouth\b' /etc/mkinitcpio.conf ||
        die "não consegui inserir o hook plymouth — edite HOOKS à mão (plymouth logo após udev/systemd)."
    info "hook plymouth inserido após udev"
fi

# KMS cedo da NVIDIA.
#
# Sem isto o splash começa no framebuffer do firmware e, quando o driver
# assume a placa, a tela pisca e troca de modo no meio do boot. Com os módulos
# dentro do initramfs, quem desenha o splash desde o primeiro quadro já é a
# NVIDIA, e não há troca.
#
# modeset e fbdev não vão na cmdline de propósito: nos drivers atuais os dois
# já são default=1, e parâmetro repetido só envelhece mal.
if [ "$TEM_NVIDIA" = yes ]; then
    if grep -qE '^MODULES=.*\bnvidia\b' /etc/mkinitcpio.conf; then
        info "módulos da NVIDIA já estavam em MODULES"
    else
        sudo sed -i -E 's/^MODULES=\((.*)\)/MODULES=(\1 nvidia nvidia_modeset nvidia_uvm nvidia_drm)/' /etc/mkinitcpio.conf
        sudo sed -i -E 's/^MODULES=\( +/MODULES=(/' /etc/mkinitcpio.conf
        info "MODULES: nvidia nvidia_modeset nvidia_uvm nvidia_drm"
    fi
fi
grep -E '^(MODULES|HOOKS)=' /etc/mkinitcpio.conf | sed 's/^/    /'

# ---------------------------------------------------------------------- cmdline
say "6/8  Linha de comando do kernel ($LAYOUT)"
case "$LAYOUT" in
    uki)
        sudo touch /etc/kernel/cmdline
        atual="$(cat /etc/kernel/cmdline)"
        novo="$(acrescentar_params "$atual")"
        printf '%s\n' "$novo" | sudo tee /etc/kernel/cmdline >/dev/null
        info "$novo"
        ;;
    entries)
        while IFS= read -r ent; do
            [ -z "$ent" ] && continue
            sudo grep -q '^options ' "$ent" || continue
            atual="$(sudo grep '^options ' "$ent" | head -1 | cut -d' ' -f2-)"
            novo="$(acrescentar_params "$atual")"
            sudo sed -i "s|^options .*|options $novo|" "$ent"
            info "$(basename "$ent"): $novo"
        done < <(sudo sh -c 'ls -1 /boot/loader/entries/*.conf 2>/dev/null' || true)
        ;;
    grub)
        atual="$(grep '^GRUB_CMDLINE_LINUX_DEFAULT=' /etc/default/grub | sed -E 's/^[^=]+="(.*)"$/\1/')"
        novo="$(acrescentar_params "$atual")"
        sudo sed -i "s|^GRUB_CMDLINE_LINUX_DEFAULT=.*|GRUB_CMDLINE_LINUX_DEFAULT=\"$novo\"|" /etc/default/grub
        info "$novo"
        ;;
esac

# ---------------------------------------------------------------------- regerar
say "7/8  Regerando o initramfs"
sudo mkinitcpio -P
[ "$LAYOUT" = grub ] && sudo grub-mkconfig -o /boot/grub/grub.cfg

say "8/8  Secure Boot ($TEM_SB)"
if [ "$TEM_SB" = no ]; then
    info "não está ativo — nada a assinar"
elif ! command -v sbctl >/dev/null 2>&1; then
    [ "$TEM_SB" = yes ] && die "Secure Boot ATIVO e sbctl não instalado: o UKI que acabei de gerar não tem assinatura e o firmware vai recusar. NÃO reinicie — rode --revert ou instale o sbctl e assine."
    info "sem sbctl e sem saber o estado do firmware — seguindo, confira você mesmo"
else
    # O hook do sbctl só roda em transação do pacman. Como o mkinitcpio acima
    # foi na mão, o UKI recém-escrito está SEM assinatura neste instante —
    # reiniciar agora daria "Access Denied" no firmware.
    sudo sbctl sign-all || die "sbctl sign-all falhou — NÃO reinicie. Rode --revert."
    pendentes="$(sudo sbctl verify 2>/dev/null | grep -c 'is not signed' || true)"
    if [ "${pendentes:-0}" -gt 0 ]; then
        sudo sbctl verify | grep 'is not signed' | sed 's/^/    /'
        die "sobrou binário sem assinatura — NÃO reinicie. Assine com: sudo sbctl sign -s <caminho>"
    fi
    info "tudo assinado"
fi

ASSINA_TXT=""
[ "$TEM_SB" != no ] && ASSINA_TXT=" && sudo sbctl sign-all"

cat <<TXT

Pronto. No próximo boot: logo do Arch e a barra, sem as mensagens.

  Logo em azul:   sudo cp $THEME_DEST/logo-arch-blue.png $THEME_DEST/logo.png
                  sudo mkinitcpio -P$ASSINA_TXT
  Desfazer tudo:  bash $SRC_DIR/scripts/boot-splash.sh --revert
  Ver o log:      journalctl -b      (o texto continua todo lá)

A barra usa a estimativa de progresso do plymouth, calibrada pela duração do
boot anterior. No PRIMEIRO boot depois desta instalação ela anda irregular,
porque ainda não existe referência; do segundo em diante fica suave.
TXT
