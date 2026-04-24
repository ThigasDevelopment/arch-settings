#!/usr/bin/env bash
set -euo pipefail

DOTFILES_DIR="${DOTFILES_DIR:-$HOME/dotfiles}"

REPO_PKGS=(
  adw-gtk-theme base base-devel breeze-icons btop chromium discord efibootmgr eog fastfetch firefox
  fzf git grim grub gsimplecal gst-plugin-pipewire gtk4-layer-shell hyprland hyprpaper intel-ucode jq
  kitty kvantum libpulse linux linux-firmware linux-headers lxappearance nano nautilus noto-fonts
  noto-fonts-emoji nvidia-open-dkms nvidia-settings nvidia-utils pavucontrol pipewire pipewire-alsa
  pipewire-jack pipewire-pulse playerctl qt5ct qt6ct reflector slurp spotify-launcher starship sudo
  swaync ttf-jetbrains-mono-nerd waybar wireplumber wl-clipboard wofi xdg-desktop-portal
  xdg-desktop-portal-gtk xdg-desktop-portal-hyprland zram-generator zsh zsh-autosuggestions
  zsh-syntax-highlighting pnpm stow curl
)

AUR_PKGS=(
  cursor-clip-git teams-for-linux-bin tela-icon-theme visual-studio-code-bin
)

echo "[1/6] Atualizando sistema"
sudo pacman -Syu --noconfirm

echo "[2/6] Instalando pacotes oficiais"
sudo pacman -S --needed --noconfirm "${REPO_PKGS[@]}"

echo "[3/6] Instalando yay via git"
if ! command -v yay >/dev/null 2>&1; then
  tmpdir=$(mktemp -d)
  git clone https://aur.archlinux.org/yay.git "$tmpdir/yay"
  (
    cd "$tmpdir/yay"
    makepkg -si --noconfirm
  )
  rm -rf "$tmpdir"
fi

echo "[4/6] Instalando pacotes AUR"
yay -S --needed --noconfirm "${AUR_PKGS[@]}"

echo "[5/6] Instalando nvm + Node LTS + opencode"
export NVM_DIR="$HOME/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
fi

# shellcheck disable=SC1090
. "$NVM_DIR/nvm.sh"
nvm install --lts
nvm alias default lts/*
npm install -g opencode-ai

echo "[6/6] Aplicando dotfiles"
mkdir -p "$HOME/.config"
stow --target="$HOME/.config" -d "$DOTFILES_DIR" hypr waybar kitty wofi swaync gtk-3.0 fontconfig cursor-clip
stow --target="$HOME" -d "$DOTFILES_DIR" zsh
ln -sf "$DOTFILES_DIR/.profile" "$HOME/.profile"
ln -sf "$DOTFILES_DIR/pavucontrol.ini" "$HOME/.config/pavucontrol.ini"

chmod +x "$HOME/.config/hypr/scripts/ws-smart.sh"
chmod +x "$HOME/.config/waybar/scripts/"*.sh

echo "Bootstrap finalizado com sucesso."
