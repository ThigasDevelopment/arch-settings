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

## Binds completas

### Hyprland (`hypr/hyprland.conf`)

#### Apps e acoes gerais

- `SUPER + T`: abrir terminal (`kitty`)
- `SUPER + W`: fechar janela ativa
- `SUPER + E`: abrir gerenciador de arquivos (`nautilus`)
- `SUPER + F`: alternar janela flutuante
- `SUPER + R`: abrir/fechar launcher (`wofi --show drun`)
- `SUPER + C`: pseudo tile (dwindle)
- `SUPER + J`: toggle split (dwindle)
- `SUPER + B`: abrir navegador (`firefox`)
- `SUPER + V`: abrir `cursor-clip`
- `SUPER + Y`: abrir VS Code (`code`)
- `SUPER + P`: abrir menu de energia (`~/.config/waybar/scripts/power-menu.sh`)
- `SUPER + O`: abrir `opencode` no terminal
- `SUPER + Escape`: abrir `hyprshutdown` (fallback para `hyprctl dispatch exit`)
- `SUPER + SHIFT + S`: screenshot de selecao e copiar para clipboard (`grim + slurp + wl-copy`)
- `SUPER + SHIFT + Escape`: abrir `btop` no terminal

#### Foco e navegacao

- `SUPER + Left`: mover foco para esquerda
- `SUPER + Right`: mover foco para direita
- `SUPER + Up`: mover foco para cima
- `SUPER + Down`: mover foco para baixo
- `SUPER + Tab`: proximo workspace
- `SUPER + SHIFT + Tab`: workspace anterior

#### Workspaces diretos

- `SUPER + 1`: ir para workspace 1 (`ws-smart.sh 1`)
- `SUPER + 2`: ir para workspace 2 (`ws-smart.sh 2`)
- `SUPER + 3`: ir para workspace 3 (`ws-smart.sh 3`)
- `SUPER + 4`: ir para workspace 4 (`ws-smart.sh 4`)
- `SUPER + 5`: ir para workspace 5 (`ws-smart.sh 5`)
- `SUPER + 6`: ir para workspace 6 (`ws-smart.sh 6`)
- `SUPER + 7`: ir para workspace 7 (`ws-smart.sh 7`)
- `SUPER + 8`: ir para workspace 8 (`ws-smart.sh 8`)
- `SUPER + 9`: ir para workspace 9 (`ws-smart.sh 9`)
- `SUPER + 0`: ir para workspace 10 (`ws-smart.sh 10`)

#### Como funciona o `ws-smart.sh`

Arquivo: `hypr/scripts/ws-smart.sh`

Objetivo:

- Evitar trocar para workspace vazio ao usar `SUPER + [1..0]`.

Fluxo:

- Recebe o numero do workspace como argumento (`WS="$1"`).
- Se nenhum argumento for informado, sai sem fazer nada.
- Consulta os workspaces via `hyprctl workspaces -j`.
- Usa `jq` para verificar se existe um workspace com:
    - `id == WS`
    - `windows > 0`
- So nesse caso executa `hyprctl dispatch workspace "WS"`.

Comportamento pratico nas binds numericas:

- Se o workspace de destino tiver ao menos uma janela, voce muda para ele.
- Se estiver vazio (ou nao existir ainda), nada acontece.

Exemplo rapido:

- `SUPER + 3`:
    - Workspace 3 com janelas: troca para o 3.
    - Workspace 3 vazio: permanece no workspace atual.

Observacao:

- As binds `SUPER + SHIFT + [1..0]` continuam movendo a janela para o workspace de destino normalmente, independente de ele estar vazio.

#### Mover janela para workspace

- `SUPER + SHIFT + 1`: mover janela ativa para workspace 1
- `SUPER + SHIFT + 2`: mover janela ativa para workspace 2
- `SUPER + SHIFT + 3`: mover janela ativa para workspace 3
- `SUPER + SHIFT + 4`: mover janela ativa para workspace 4
- `SUPER + SHIFT + 5`: mover janela ativa para workspace 5
- `SUPER + SHIFT + 6`: mover janela ativa para workspace 6
- `SUPER + SHIFT + 7`: mover janela ativa para workspace 7
- `SUPER + SHIFT + 8`: mover janela ativa para workspace 8
- `SUPER + SHIFT + 9`: mover janela ativa para workspace 9
- `SUPER + SHIFT + 0`: mover janela ativa para workspace 10

#### Workspace especial (scratch)

- `SUPER + M`: alternar workspace especial `magic`
- `SUPER + SHIFT + M`: mover janela ativa para workspace especial `magic`

#### Mouse

- `SUPER + scroll down`: proximo workspace (`e+1`)
- `SUPER + scroll up`: workspace anterior (`e-1`)
- `SUPER + mouse left drag`: mover janela (`movewindow`)
- `SUPER + mouse right drag`: redimensionar janela (`resizewindow`)

#### Teclas multimidia e brilho

- `XF86AudioRaiseVolume`: aumentar volume em 5%
- `XF86AudioLowerVolume`: diminuir volume em 5%
- `XF86AudioMute`: mute/unmute saida de audio
- `XF86AudioMicMute`: mute/unmute microfone
- `XF86MonBrightnessUp`: aumentar brilho em 5%
- `XF86MonBrightnessDown`: diminuir brilho em 5%
- `XF86AudioNext`: proxima faixa (`playerctl next`)
- `XF86AudioPause`: play/pause (`playerctl play-pause`)
- `XF86AudioPlay`: play/pause (`playerctl play-pause`)
- `XF86AudioPrev`: faixa anterior (`playerctl previous`)

### Zsh (`zsh/.zshrc`)

- `Home` (`^[[H`): ir para inicio da linha
- `End` (`^[[F`): ir para fim da linha
- `Delete` (`^[[3~`): apagar caractere sob cursor
- `Backspace` (`^H`): apagar palavra anterior
- `Ctrl + Delete` (`^[[3;5~`): apagar proxima palavra
- `Ctrl + Right` (`^[[1;5C`): avancar uma palavra
- `Ctrl + Left` (`^[[1;5D`): voltar uma palavra

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
