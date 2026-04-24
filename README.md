# Dotfiles (Hyprland)

Setup pessoal para Wayland com foco em produtividade no dia a dia.

## O que este repo configura

- `hypr/`: Hyprland (`hyprland.conf`, `hyprpaper.conf`, scripts)
- `waybar/`: barra, tema e scripts (`power-menu`, `status`, `spotify`)
- `kitty/`, `wofi/`, `swaync/`: terminal, launcher e notificacoes
- `zsh/.zshrc` e `.profile`: shell/env vars
- `gtk-3.0/`, `fontconfig/`, `cursor-clip/`: tema/fontes/clipboard daemon
- `pavucontrol.ini`: preferencias do mixer de audio

## Dependencias principais

Pacotes/comandos usados diretamente nesta configuracao:

- `hyprland`, `hyprpaper`, `waybar`, `swaync`
- `kitty`, `nautilus`, `wofi`
- `spotify-launcher`, `playerctl`
- `wpctl` (PipeWire), `nmcli` (NetworkManager), `pavucontrol`
- `grim`, `slurp`, `wl-copy` (`wl-clipboard`)
- `jq`, `stow`

## Instalacao automatica (bootstrap)

Use o script `bootstrap.sh` para instalar pacotes, AUR, nvm/Node e aplicar os dotfiles.

No diretorio `~/dotfiles`:

```bash
chmod +x bootstrap.sh
./bootstrap.sh
```

O script instala:

- Pacotes oficiais via `pacman`
- `yay` via `git clone` + `makepkg`
- AUR (`cursor-clip-git`, `tela-icon-theme`, `visual-studio-code-bin`)
- `nvm`, Node LTS e `opencode-ai` global via npm do nvm
- Links/configs com `stow`

## Instalar com GNU Stow (recomendado)

No diretorio `~/dotfiles`:

```bash
mkdir -p ~/.config

stow --target="$HOME/.config" hypr waybar kitty wofi swaync gtk-3.0 fontconfig cursor-clip
stow --target="$HOME" zsh

ln -sf ~/dotfiles/.profile ~/.profile
ln -sf ~/dotfiles/pavucontrol.ini ~/.config/pavucontrol.ini
```

Garantir scripts executaveis:

```bash
chmod +x ~/.config/hypr/scripts/ws-smart.sh
chmod +x ~/.config/waybar/scripts/*.sh
```

## Comandos uteis

```bash
# Recarregar Hyprland
hyprctl reload

# Reiniciar Waybar
pkill waybar && waybar

# Testar script de status da Waybar
~/.config/waybar/scripts/status-indicator.sh
```

## Atalhos principais (Hyprland)

- `SUPER + T`: abre terminal (`kitty`)
- `SUPER + E`: abre arquivos (`nautilus`)
- `SUPER + R`: abre/fecha `wofi`
- `SUPER + B`: abre navegador
- `SUPER + W`: fecha janela ativa
- `SUPER + SHIFT + S`: screenshot de selecao (`grim + slurp + wl-copy`)
- `SUPER + Tab` / `SUPER + SHIFT + Tab`: proximo/anterior workspace
- `SUPER + Escape`: menu de saida (`hyprshutdown` ou exit)

## Pontos para personalizar rapido

- Monitor, autostart, keybinds: `hypr/hyprland.conf`
- Wallpaper: `hypr/hyprpaper.conf`
- Modulos da barra: `waybar/config.jsonc`
- Tema da barra: `waybar/style.css`

## Problemas comuns

- `disk#storage` mostra erro: ajuste `"path": "/media/storage"` em `waybar/config.jsonc`.
- Sem rede/volume no status: verifique `nmcli` e `wpctl` instalados.
- Spotify sempre offline: confirme player MPRIS ativo (`playerctl -p spotify status`).

## Screenshots (opcional, recomendado)

Voce pode gerar prints e adicionar aqui para documentar o visual.

Exemplo de captura:

```bash
mkdir -p ~/dotfiles/assets
grim ~/dotfiles/assets/desktop-full.png
grim -g "$(slurp)" ~/dotfiles/assets/waybar-detail.png
```

Depois referencie no README:

```md
## Preview

![Desktop](assets/desktop-full.png)
![Waybar](assets/waybar-detail.png)
```
