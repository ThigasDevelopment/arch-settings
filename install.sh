#!/usr/bin/env bash
set -euo pipefail

# Instala APENAS o que estes dotfiles precisam para funcionar.
#
# Fora de escopo de propósito: bootloader, drivers de GPU, kernel, microcode e
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
  #
  # polkit-gnome é o AGENTE, e não é opcional: sem um agente na sessão, todo
  # pedido de autorização falha em SILÊNCIO — o polkitd procura, não acha e
  # nega, sem diálogo e sem erro. Escolhido entre os quatro agentes possíveis
  # por não puxar dependência nenhuma além do que este setup já tem (os de
  # Qt trariam três pacotes só para isso).
  hyprland hyprpaper polkit polkit-gnome
  xdg-desktop-portal xdg-desktop-portal-gtk xdg-desktop-portal-hyprland

  # apps que o tema veste
  kitty nautilus

  # AGS: shell GTK em TypeScript (barra + notificações)
  gjs gtk3 gtk-layer-shell gtk4-layer-shell

  # tema: GTK3, GTK4/libadwaita, Qt5, Qt6 e ícones
  adw-gtk-theme papirus-icon-theme qt5ct qt6ct adwaita-fonts

  # cursor do mouse. O hyprland.lua e os settings.ini dos dois GTK apontam
  # para "capitaine-cursors" pelo nome — sem o pacote, os quatro caem no
  # Adwaita em silêncio.
  capitaine-cursors

  # fontes
  ttf-jetbrains-mono-nerd noto-fonts noto-fonts-emoji

  # shell
  zsh zsh-autosuggestions zsh-syntax-highlighting starship fzf

  # áudio: a barra lê volume/mídia daqui
  pipewire pipewire-pulse pipewire-alsa wireplumber playerctl pavucontrol

  # binds de screenshot (SUPER+SHIFT+S)
  grim slurp wl-clipboard

  # rede: o indicador da barra lê o estado do NetworkManager, e o
  # scripts/network-menu.sh usa nmcli e nmtui, os dois deste pacote.
  networkmanager

  # notify-send, usado pelos scripts de menu para confirmar o que fizeram
  libnotify

  # btop continua instalado, mas já NÃO é o alvo dos cliques da barra — esses
  # foram para o gnome-system-monitor abaixo. Fica porque é a ferramenta certa
  # quando você já está dentro de um terminal e não quer tirar a mão do teclado.
  btop

  # Monitor de sistema com interface. Complementa o btop, não substitui: o
  # btop é para olhar de dentro do terminal, este é para vasculhar processo e
  # sistema de arquivos com o mouse. Apesar do nome, NÃO exige a sessão do
  # GNOME — é um app GTK4/libadwaita comum, como o nautilus que já está aqui.
  # O "encerrar processo como root" dele depende do agente polkit acima.
  gnome-system-monitor

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

echo "[1/6] Atualizando sistema"
sudo pacman -Syu --noconfirm

echo "[2/6] Pacotes oficiais"
sudo pacman -S --needed --noconfirm "${PKGS[@]}"

echo "[3/6] yay"
if ! command -v yay >/dev/null 2>&1; then
  tmp=$(mktemp -d)
  git clone --depth 1 https://aur.archlinux.org/yay-bin.git "$tmp/yay-bin"
  ( cd "$tmp/yay-bin" && makepkg -si --noconfirm )
  rm -rf "$tmp"
fi

echo "[4/6] AUR"
yay -S --needed --noconfirm --answerdiff=None --answerclean=None "${AUR[@]}"

echo "[5/6] Ligando os dotfiles"
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

echo "[6/6] Pastas de ícones em cinza"
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

# Cadeado do diálogo de autenticação, em cinza.
#
# O `dialog-password` do Papirus é dourado — a única cor que aparecia no
# diálogo do polkit. A cópia vai para ~/.local/share/icons, que o GTK varre
# ANTES de /usr/share: sombreia só este nome de ícone, sem trocar o tema.
for sz in 16x16 22x22 24x24 32x32 48x48 64x64; do
  mkdir -p "$HOME/.local/share/icons/Papirus-Dark/$sz/actions"
  cp "$DOTFILES_DIR/icons/dialog-password.svg" \
     "$HOME/.local/share/icons/Papirus-Dark/$sz/actions/dialog-password.svg"
done
# O GTK só considera o diretório do usuário como parte do tema se ele tiver
# index.theme; sem isto o override é ignorado em silêncio.
cp /usr/share/icons/Papirus-Dark/index.theme \
   "$HOME/.local/share/icons/Papirus-Dark/index.theme" 2>/dev/null || true
echo "  cadeado do polkit em cinza"

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

echo "Pronto. Falta à mão:"
echo "  1. chsh -s /usr/bin/zsh        (o .zprofile sobe o Hyprland no tty1)"
echo "  2. Ajustar o monitor em hypr/hyprland.lua se quiser fixar resolução"
