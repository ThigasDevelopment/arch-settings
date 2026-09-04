#!/usr/bin/env bash
set -euo pipefail

# Instala APENAS o que estes dotfiles precisam para funcionar.
#
# Fora de escopo de propósito: bootloader, kernel, microcode e
# seus apps pessoais. Isso é decisão do seu sistema, não do tema.
#
# Alguns binds herdados apontam para apps que este script NÃO instala
# (discord, code, chromium, spotify-launcher, cursor-clip, opencode).
# Se você usa, instale por conta; se não, o bind só não faz nada.

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOTFILES_DIR="${DOTFILES_DIR:-$SRC_DIR}"

# Os configs entram em ~/.config como SYMLINK apontando para este diretório.
# Rodar direto de um pendrive criaria links que morrem no instante em que
# você desplugar, e o Hyprland subiria sem config nenhuma.
#
# Recusa em vez de copiar sozinho: uma cópia silenciosa deixaria você achando
# que edita o pendrive enquanto o sistema lê outro lugar.
case "$DOTFILES_DIR" in
  "$HOME"/*) ;;
  *)
    echo "Este repo está fora do seu HOME:"
    echo "  $DOTFILES_DIR"
    echo
    echo "Os links de ~/.config apontariam para cá e quebrariam se isto for"
    echo "mídia removível. Copie para um lugar fixo e rode de lá:"
    echo
    echo "  cp -r \"$DOTFILES_DIR\" ~/Documents/Projects/linux"
    echo "  cd ~/Documents/Projects/linux && bash install.sh"
    echo
    exit 1
    ;;
esac

# ---------------------------------------------------------------- repo oficial
PKGS=(
  # compositor e sessão
  hyprland hyprpaper polkit mesa
  xdg-desktop-portal xdg-desktop-portal-gtk xdg-desktop-portal-hyprland

  # apps que o tema veste
  kitty nautilus

  # AGS: shell GTK em TypeScript (barra + notificações)
  gjs gtk3 gtk-layer-shell gtk4-layer-shell

  # tema: GTK3, GTK4/libadwaita, Qt5, Qt6 e ícones
  adw-gtk-theme papirus-icon-theme qt5ct qt6ct adwaita-fonts

  # fontes
  ttf-jetbrains-mono-nerd noto-fonts noto-fonts-emoji

  # shell
  zsh zsh-autosuggestions zsh-syntax-highlighting starship fzf

  # áudio: a barra lê volume/mídia daqui
  pipewire pipewire-pulse pipewire-alsa wireplumber playerctl

  # binds de screenshot (SUPER+SHIFT+S)
  grim slurp wl-clipboard

  # alvo dos cliques nas métricas da barra
  btop

  # requisitos duros dos providers do Walker:
  #   fd          — elephant-files, sem ele o launcher não acha arquivo
  #   imagemagick — elephant-clipboard, sem ele imagens não entram no histórico
  fd imagemagick

  # Secure Boot com chaves próprias (scripts/secure-boot.sh)
  sbctl

  # para compilar do AUR
  git base-devel
)

# -------------------------------------------------------------------- AUR
AUR=(
  # Fonte de interface do sistema. Proprietária da Apple: o PKGBUILD baixa
  # direto dos servidores dela, não é redistribuível. Se preferir algo de
  # licença aberta com desenho próximo, troque por `inter-font` (repo
  # oficial) e ajuste os quatro pontos: gtk-3.0, gtk-4.0, qt*ct e fonts.conf.
  otf-apple-sf-pro

  # Mixer NATIVO do PipeWire (GTK4 + libadwaita).
  #
  # O pavucontrol foi trocado por ele. Nota: o sistema JÁ era PipeWire puro —
  # não existe daemon pulseaudio instalado. O `libpulse` que o pavucontrol
  # puxava é só a biblioteca CLIENTE do protocolo PA, atendida pelo
  # pipewire-pulse. A troca é por afinidade, não por corrigir stack.
  pwvucontrol

  # barra e notificações
  aylurs-gtk-shell-git libastal-meta

  # launcher + backend de providers.
  # elephant sozinho é só o binário: cada provider é um pacote separado.
  # Sem eles o Walker abre e não retorna NADA.
  walker-bin
  #
  # Use as variantes DE FONTE (sem -bin): o walker-bin puxa `elephant`
  # compilado, e os providers `-bin` dependem de `elephant-bin`, que
  # CONFLITA com ele. Misturar as duas famílias trava a instalação.
  elephant-desktopapplications
  elephant-files
  elephant-calc
  elephant-websearch
  elephant-runner
  elephant-clipboard
  elephant-menus
  elephant-providerlist
)

echo "[1/7] Atualizando sistema"
sudo pacman -Syu --noconfirm

echo "[2/7] Pacotes oficiais"
sudo pacman -S --needed --noconfirm "${PKGS[@]}"

echo "[3/7] Driver de vídeo"
# Sem driver o Hyprland NEM INICIA, e o erro não diz "falta driver". Ele diz:
#
#   MESA: error: ZINK: vkCreateInstance failed (VK_ERROR_INCOMPATIBLE_DRIVER)
#   MESA-EGL: warning: egl: failed to create dri2 screen
#
# O Mesa cai no Zink (OpenGL sobre Vulkan) quando não acha driver nativo, e
# aí falta Vulkan também. Por isso isto não é opcional aqui.
#
# Pule com:  SKIP_GPU=1 bash install.sh
if [ "${SKIP_GPU:-0}" = "1" ]; then
  echo "  SKIP_GPU=1 — pulando."
else
  # Detecção pelo /sys: `lspci` vem do pciutils, que não está no base.
  #
  # Filtra pela CLASSE PCI 0x03xxxx (display controller). Ler o vendor de
  # TODOS os dispositivos não serve: quase toda placa-mãe tem chipset Intel
  # (0x8086) ou AMD (0x1002) em ponte, áudio e USB, e o script acabaria
  # instalando driver de vídeo do fabricante errado. Testado numa VM com
  # chipset Intel e GPU virtual: sem o filtro, "detectava Intel".
  #
  # Máquina híbrida pode ter duas GPUs de fabricantes diferentes, por isso a
  # checagem é acumulativa e não if/elif.
  gpu_pkgs=()
  has_nvidia=0

  vendors=""
  for d in /sys/bus/pci/devices/*/; do
    cls="$(cat "$d/class" 2>/dev/null)" || continue
    case "$cls" in
      0x03*) vendors="$vendors $(cat "$d/vendor" 2>/dev/null)" ;;
    esac
  done

  if [[ " $vendors " == *" 0x10de "* ]]; then
    has_nvidia=1
    echo "  NVIDIA detectada"
    # nvidia-dkms (proprietário) e não nvidia-open-dkms: o open só cobre
    # Turing para cima, o proprietário cobre de Maxwell às atuais.
    gpu_pkgs+=(nvidia-dkms nvidia-utils egl-wayland)

    # Headers do kernel REALMENTE instalado — o DKMS não compila sem eles,
    # e `linux-headers` não serve para linux-lts/zen/hardened.
    for k in linux linux-lts linux-zen linux-hardened linux-rt; do
      pacman -Qq "$k" >/dev/null 2>&1 && gpu_pkgs+=("$k-headers")
    done
  fi

  if [[ " $vendors " == *" 0x1002 "* ]]; then
    echo "  AMD detectada"
    gpu_pkgs+=(vulkan-radeon libva-mesa-driver)
  fi

  if [[ " $vendors " == *" 0x8086 "* ]]; then
    echo "  Intel detectada"
    gpu_pkgs+=(vulkan-intel intel-media-driver)
  fi

  if [ ${#gpu_pkgs[@]} -eq 0 ]; then
    echo "  nenhuma GPU conhecida encontrada; seguindo só com o mesa."
    echo "  Se o Hyprland não subir, o driver é o primeiro lugar a olhar."
  else
    sudo pacman -S --needed --noconfirm "${gpu_pkgs[@]}"
  fi

  # NVIDIA precisa de early KMS para o Wayland. Só mexe se ainda não estiver lá.
  if [ "$has_nvidia" = "1" ] && ! grep -q 'nvidia_drm' /etc/mkinitcpio.conf; then
    echo "  habilitando early KMS da NVIDIA no initramfs"
    sudo cp /etc/mkinitcpio.conf /etc/mkinitcpio.conf.bak
    sudo sed -i 's/^MODULES=(\(.*\))/MODULES=(\1 nvidia nvidia_modeset nvidia_uvm nvidia_drm)/' /etc/mkinitcpio.conf
    sudo sed -i 's/^MODULES=( /MODULES=(/' /etc/mkinitcpio.conf
    sudo mkinitcpio -P
    echo "  backup do original em /etc/mkinitcpio.conf.bak"
    NEEDS_REBOOT=1
  fi
fi

echo "[4/7] yay"
if ! command -v yay >/dev/null 2>&1; then
  tmp=$(mktemp -d)
  git clone --depth 1 https://aur.archlinux.org/yay-bin.git "$tmp/yay-bin"
  ( cd "$tmp/yay-bin" && makepkg -si --noconfirm )
  rm -rf "$tmp"
fi

echo "[5/7] AUR"
yay -S --needed --noconfirm --answerdiff=None --answerclean=None "${AUR[@]}"

echo "[6/7] Ligando os dotfiles"
# Symlink por diretório. NÃO use `stow --target=~/.config`: o stow espalha o
# CONTEÚDO do pacote no alvo, então gtk-3.0/gtk.css viraria ~/.config/gtk.css
# e colidiria com o gtk-4.0. Aqui cada pasta vira ~/.config/<nome>.
mkdir -p "$HOME/.config"
for d in hypr ags walker elephant kitty gtk-3.0 gtk-4.0 qt5ct qt6ct xdg-desktop-portal fontconfig; do
  [ -d "$DOTFILES_DIR/$d" ] || continue
  rm -rf "$HOME/.config/$d"
  ln -sfn "$DOTFILES_DIR/$d" "$HOME/.config/$d"
done
ln -sf "$DOTFILES_DIR/.profile"       "$HOME/.profile"
ln -sf "$DOTFILES_DIR/zsh/.zshrc"     "$HOME/.zshrc"
ln -sf "$DOTFILES_DIR/zsh/.zprofile"  "$HOME/.zprofile"
ln -sf "$DOTFILES_DIR/starship.toml"  "$HOME/.config/starship.toml"
chmod +x "$DOTFILES_DIR/hypr/scripts/"*.sh "$DOTFILES_DIR/scripts/"*.sh

# O elephant procura arquivos nos diretórios listados em files.toml, e TOML
# não expande variável. Reescreve o caminho do home com o usuário real.
sed -i "s|^  \"/home/[^\"]*\",|  \"$HOME\",|" "$DOTFILES_DIR/elephant/files.toml"
echo "  busca de arquivos apontada para $HOME"

echo "[7/7] Pastas de ícones em cinza"
# O Papirus vem com pastas azuis. Em cinza elas ficam legíveis sobre o fundo
# preto sem introduzir cor — as pretas somem no #0b0b0b.
for theme in Papirus-Dark Papirus; do
  for dir in /usr/share/icons/$theme/*/places /usr/share/icons/$theme/*/*/places; do
    [ -d "$dir" ] || continue
    ( cd "$dir" || exit 0
      for f in folder-grey-*.svg; do
        [ -e "$f" ] || continue
        sudo ln -sf "$f" "folder-${f#folder-grey-}"
      done
      [ -e folder-grey.svg ] && sudo ln -sf folder-grey.svg folder.svg
    )
  done
done
sudo gtk-update-icon-cache -f /usr/share/icons/Papirus-Dark >/dev/null 2>&1 || true

echo

# ----------------------------------------------------------------- Secure Boot
# Só DIAGNÓSTICO. Enrolar chave e ligar o Secure Boot exigem dois passos na
# BIOS que nenhum processo do sistema pode fazer: entrar em Setup Mode e
# ativar o toggle. Se desse para fazer pelo SO, malware faria também — é o
# modelo de segurança, não limitação do script.
echo
echo "── Secure Boot ──"
if command -v sbctl >/dev/null 2>&1; then
    sb_status="$(sudo sbctl status 2>/dev/null)"
    if printf '%s' "$sb_status" | grep -qi "Secure Boot:.*enabled"; then
        echo "  já está ATIVO. Nada a fazer."
    elif printf '%s' "$sb_status" | grep -qi "Setup Mode:.*Enabled"; then
        echo "  firmware em Setup Mode — pronto para enrolar chaves."
        echo "  Próximo passo:  bash $DOTFILES_DIR/scripts/secure-boot.sh"
    else
        echo "  desativado, e o firmware NÃO está em Setup Mode."
        echo "  Para habilitar:"
        echo "    1. BIOS → Boot → Secure Boot → Key Management → Clear Secure Boot Keys"
        echo "    2. bash $DOTFILES_DIR/scripts/secure-boot.sh"
        echo "    3. BIOS → habilitar Secure Boot"
        echo "  Deixe para o final, com o desktop já funcionando — e tenha a chave"
        echo "  de recuperação do BitLocker em mãos se você dá dual boot com Windows."
    fi
else
    echo "  sbctl não instalado (deveria ter vindo com este script)."
fi

if [ "${NEEDS_REBOOT:-0}" = "1" ]; then
  echo
  echo "────────────────────────────────────────────────"
  echo " REINICIE antes de logar no Hyprland."
  echo " O módulo da NVIDIA foi adicionado ao initramfs e"
  echo " só entra em vigor no próximo boot. Sem reiniciar,"
  echo " o compositor falha com erro de EGL."
  echo "────────────────────────────────────────────────"
fi

echo "Pronto. Falta à mão:"
echo "  1. chsh -s /usr/bin/zsh    e depois LOGOUT COMPLETO"
echo '     (o $SHELL é herdado no login; sem relogar, o kitty abre em'
echo "      bash e o .zprofile — que sobe o Hyprland no tty1 — é ignorado)"
echo "  2. Ajustar o monitor em hypr/hyprland.conf se quiser fixar resolução"
