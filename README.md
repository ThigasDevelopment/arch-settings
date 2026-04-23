# Dotfiles - Hyprland + Waybar

Este repositório reúne minhas configuracoes para ambiente Wayland com **Hyprland** e **Waybar**.

## Estrutura

```text
.
├── hypr/
│   ├── hyprland.conf
│   ├── hyprpaper.conf
│   └── scripts/
│       └── ws-smart.sh
├── waybar/
│   ├── config.jsonc
│   ├── style.css
│   └── scripts/
│       ├── spotify-play-icon.sh
│       └── spotify-status.sh
└── zsh/
```

## O que cada arquivo faz

### `hypr/hyprland.conf`

Configuracao principal do Hyprland.

- Define monitor `HDMI-A-1` em `1920x1080@120`.
- Seta apps padrao:
    - terminal: `kitty`
    - gerenciador de arquivos: `nemo`
    - launcher: `wofi --show drun`
    - navegador: `firefox`
- Inicializa no login: `eww`, `hyprpaper`, `discord`, `spotify-launcher`, `copyq`, `waybar`.
- Ajusta tema escuro via `gsettings` e variaveis de ambiente (`QT_QPA_PLATFORMTHEME`, cursor).
- Configura visual (gaps, bordas, arredondamento, blur, sombras, animacoes).
- Define atalhos importantes:
    - `SUPER + T`: abre terminal
    - `SUPER + E`: abre Nemo
    - `SUPER + B`: abre navegador
    - `SUPER + W`: fecha janela ativa
    - `SUPER + SHIFT + S`: screenshot por selecao (`grim` + `slurp` + `wl-copy`)
    - `SUPER + [1..0]`: chama script de workspace inteligente
    - teclas multimidia: volume, brilho, playerctl

### `hypr/hyprpaper.conf`

Configuracao do wallpaper com `hyprpaper`.

- Preload da imagem: `/home/dev/wallpapers/arch-linux.png`
- Aplica no monitor `HDMI-A-1`.

### `hypr/scripts/ws-smart.sh`

Script para troca de workspace "inteligente".

- Recebe um numero de workspace via argumento.
- So executa `hyprctl dispatch workspace <N>` se o workspace de destino tiver pelo menos 1 janela.
- Evita alternar para workspaces vazios por acidente.

### `waybar/config.jsonc`

Layout e modulos da Waybar.

- Barra no topo (`layer: top`) com margens e espacamento customizados.
- Modulos:
    - esquerda: icone + janela ativa (`hyprland/window`)
    - centro: workspaces (`hyprland/workspaces`)
    - direita: controles Spotify, audio, rede, CPU, memoria, tray e relogio
- Integracao Spotify:
    - modulo principal: `~/.config/waybar/scripts/spotify-status.sh`
    - botoes prev/next com `playerctl`
    - clique no modulo Spotify: play/pause
    - clique direito: abre Spotify
- Relogio:
    - formato principal `HH:MM`
    - formato alternativo com data no clique do meio
    - clique esquerdo chama `~/.config/waybar/scripts/calendar-toggle.sh`

> Observacao: o script `calendar-toggle.sh` e referenciado, mas nao esta neste repositório.

### `waybar/style.css`

Tema visual da Waybar.

- Fonte: `JetBrainsMono Nerd Font`.
- Barra com fundo semi-transparente, borda sutil e cantos arredondados.
- Workspaces com estados visuais para ativo/hover.
- Bloco do Spotify com gradiente verde e classes para estado:
    - `.playing`
    - `.paused`
    - `.offline` / `.idle`

### `waybar/scripts/spotify-play-icon.sh`

Retorna icone de estado do Spotify em JSON para Waybar.

- Se Spotify nao estiver disponivel no `playerctl`: classe `offline`.
- Se estiver tocando: classe `playing`.
- Caso contrario: classe `paused`.

### `waybar/scripts/spotify-status.sh`

Retorna status detalhado do Spotify em JSON para Waybar.

- Detecta se o player `spotify` esta ativo.
- Le `status`, `artist` e `title` via `playerctl`.
- Mostra texto curto (`artista - musica`, truncado) e tooltip completo.
- Expõe classes CSS para estilizar estado (`playing`, `paused`, `offline`, `idle`).

## Dependencias

Pacotes/comandos usados por essa configuracao:

- `hyprland`
- `hyprpaper`
- `waybar`
- `kitty`
- `nemo`
- `wofi`
- `eww`
- `copyq`
- `spotify-launcher` ou cliente Spotify compativel
- `playerctl`
- `jq`
- `grim`
- `slurp`
- `wl-copy` (normalmente via `wl-clipboard`)
- `pavucontrol`
- `brightnessctl`

## Instalacao rapida

### Opcao 1: com GNU Stow

No diretorio raiz do repositorio:

```bash
stow hypr waybar zsh
```

Isso deve criar links em `~/.config` (dependendo de como seu repo esta organizado no sistema).

### Opcao 2: links simbolicos manualmente

```bash
mkdir -p ~/.config/hypr ~/.config/waybar
ln -sf ~/dotfiles/hypr/hyprland.conf ~/.config/hypr/hyprland.conf
ln -sf ~/dotfiles/hypr/hyprpaper.conf ~/.config/hypr/hyprpaper.conf
ln -sf ~/dotfiles/hypr/scripts/ws-smart.sh ~/.config/hypr/scripts/ws-smart.sh

ln -sf ~/dotfiles/waybar/config.jsonc ~/.config/waybar/config.jsonc
ln -sf ~/dotfiles/waybar/style.css ~/.config/waybar/style.css
ln -sf ~/dotfiles/waybar/scripts/spotify-status.sh ~/.config/waybar/scripts/spotify-status.sh
ln -sf ~/dotfiles/waybar/scripts/spotify-play-icon.sh ~/.config/waybar/scripts/spotify-play-icon.sh
```

Depois:

```bash
chmod +x ~/.config/hypr/scripts/ws-smart.sh
chmod +x ~/.config/waybar/scripts/spotify-status.sh
chmod +x ~/.config/waybar/scripts/spotify-play-icon.sh
```

## Uso

- Reinicie a sessao do Hyprland ou rode:

```bash
hyprctl reload
```

- Para reiniciar Waybar durante ajustes:

```bash
pkill waybar && waybar
```

## Personalizacao

- Monitor e resolucao: ajuste em `hypr/hyprland.conf`.
- Wallpaper: ajuste em `hypr/hyprpaper.conf`.
- Atalhos e apps padrao: ajuste em `hypr/hyprland.conf`.
- Modulos e ordem da barra: ajuste em `waybar/config.jsonc`.
- Tema da barra: ajuste em `waybar/style.css`.

## Notas

- O script de workspace inteligente depende de `jq`.
- Os scripts do Spotify dependem de `playerctl` e de um player MPRIS ativo.
- Existe referencia a `~/.config/waybar/scripts/calendar-toggle.sh`; crie esse script se quiser acao no clique do relogio.
