# linux — dotfiles mono

Hyprland em preto e branco. Sem cor em lugar nenhum: a hierarquia é feita por
peso, densidade e uma única barra branca de foco.

## O que veio do repo `arch-settings`

Só isto, e nada mais:

| Arquivo | Como veio |
|---|---|
| `hypr/hyprland.conf` → **bloco de keybindings** | literal, 61 binds |
| `kitty/kitty.conf` | intacto (só o `current-theme.conf` foi trocado) |
| `zsh/.zshrc` | intacto |
| `fontconfig/fonts.conf` | intacto |

Todo o resto do `hyprland.conf` — monitor, autostart, input, window rules,
layout, look and feel — foi escrito do zero. Não vieram de lá: `monitor
HDMI-A-1`, `device PRO X 2`, `gesture`, bloco `master`, os window rules de
XWayland/cursor-clip/hyprland-run, nem os `exec-once` de discord, spotify,
cursor-clip e fastfetch. O `hyprpaper.conf` foi reescrito do zero.

### Binds alterados

Nenhuma tecla mudou de função sem pedido. As alterações:

- `SUPER + Space` → **novo**, abre o launcher único
- `SUPER + R` e `SUPER + Return` → removidos (eram launcher e spotlight
  separados, agora é um só)
- `SUPER + P` → mesmo power menu, movido para `hypr/scripts/`
- `SUPER + [0-9]` → `dispatch workspace` direto (`ws-smart.sh` removido a pedido)

Alguns binds herdados apontam para apps que o `install.sh` **não** instala
(`discord`, `code`, `chromium`, `spotify-launcher`, `cursor-clip`, `opencode`).
Instale por conta se usar; se não, o bind só não faz nada.

## O que mudou de ferramenta

| Antes | Agora | Por quê |
|---|---|---|
| waybar + swaync | **AGS / Astal** | barra e notificações num codebase só, GTK, programável em TS |
| wofi + `spotlight.sh` | **Walker 2.x** | apps, arquivos, Google e cálculo numa caixa só; sumiu o Python |
| Catppuccin no kitty | **mono** | rampa de 16 cinzas com luminância separada |
| Tela-black-dark | **Papirus-Dark**, pastas em cinza | pasta preta some no fundo `#0b0b0b` |
| hyprpaper (config dele) | hyprpaper + wallpaper próprio | `hyprpaper.conf` reescrito; o dele apontava para `/home/dev/wallpapers` |
| `stow` | symlink por diretório | ver "stow achata" abaixo |

## A paleta inteira

```
#000000  chão absoluto (a barra)      #3d3d3d  rótulo, desabilitado
#0b0b0b  superfície de janela         #8a8a8a  texto secundário
#141414  superfície elevada, hover    #c8c8c8  texto
#262626  borda                        #ffffff  primário, foco
```

Todos os hex dos arquivos de tema têm R=G=B. Zero cor.

## Rounding e animação

`rounding = 6` com `rounding_power = 2.5` — o canto vira um squircle em vez de
um arco de círculo. É de propósito quase imperceptível.

As animações usam **uma curva só** (`0.16, 1, 0.30, 1`), e duas decisões
carregam a experiência:

- **`popin 96%`**, não os 87% do default. 87% é um salto que se *vê*;
  96% é um assentamento que se *sente*.
- **A borda anima mais devagar que a janela** (6 contra 4). Sem cor, a borda
  branca é o único sinal de foco — desenhá-la devagar torna a mudança de foco
  legível em vez de um corte seco.

## Como os quatro toolkits ficam iguais

Não dá para forçar um app a usar outro toolkit — GTK, Qt e Electron são
compilados dentro do binário. O que dá é igualar a **aparência**:

- **GTK4 / libadwaita** → `gtk-4.0/gtk.css`. libadwaita ignora
  `gtk-theme-name` por completo; redefinir as cores nomeadas é o único ponto
  de entrada. É isto que conserta o Nautilus.
- **GTK3** → `adw-gtk3-dark` + `gtk-3.0/gtk.css` com as mesmas cores.
- **Qt5 / Qt6** → `Fusion` + paleta manual de 21 roles em `colors/mono.conf`.
- **Electron** → ignoram tudo acima; precisam de tema próprio por app.

O **seletor de arquivos** de todos eles vira o mesmo diálogo GTK, via
`xdg-desktop-portal/hyprland-portals.conf`.

### Sobre barra de título

`hyprbars` foi descartado: ele não substitui a headerbar do app, **empilha**
uma segunda por cima — em app libadwaita dá barra dupla. Em vez disso, quem
tem headerbar própria usa a dela, tematizada; quem não tem fica sem barra
(`QT_WAYLAND_DISABLE_WINDOWDECORATION=1`). Em tiling, título é espaço morto.

## Armadilhas encontradas testando numa VM

Tudo abaixo quebrou de verdade e está corrigido:

**`stow` achata os diretórios.** `stow --target=~/.config hypr` **não** cria
`~/.config/hypr/hyprland.lua`; joga o conteúdo de `hypr/` direto em
`~/.config/`. Com `gtk-3.0` e `gtk-4.0` juntos, os dois disputam
`~/.config/gtk.css` e o stow aborta tudo. Por isso o `install.sh` usa
`ln -sfn` por diretório.

**CRLF mata o zsh.** Clonar o repo no Windows converte LF→CRLF, e aí todo
`source` do `.zshrc` falha com `command not found: ^M`. O `.gitattributes`
com `* text eol=lf` impede a recaída.

**`chsh` para zsh quebra o autostart.** O Hyprland precisa subir pelo
`.zprofile`, não pelo `.bash_profile` — zsh ignora o segundo por completo.

**Opções mortas do Hyprland 0.56.** `dwindle:pseudotile` e `misc:vfr` não
existem mais e derrubam o parse. `windowrule` usa formato de bloco.

**`elephant` é só o binário.** Cada provider do Walker 2.x é um pacote AUR
separado (`elephant-desktopapplications-bin` etc.). Sem eles o launcher abre
e não retorna nada. E o `elephant` não tem unit do systemd — sobe no
`exec-once`.

**`providers.sets` do Walker é um par.** O formato é
`nome = [[providers], [providers_quando_vazio]]`, não uma lista simples.

## A barra (AGS)

```
 󰣇  1 2 3 4 5              [mídia]              [tray] │ 󰍛 1% 󰘚 26% 󰋊 26% 󰌗 󰕾 40% │ 󰥔 03/09 · 16:25  ⏻
```

Só ícone e número — nenhum rótulo por extenso. Cada item tem **tooltip** no
hover com o que o número não diz: modelo da CPU, GiB absolutos, tamanho real
do disco, nome do dispositivo de áudio, uptime da máquina, janelas por área.

A ordem da direita vai do mais volátil para o mais estável: **tray → leituras
de sistema → relógio → energia**. O tray fica na ponta esquerda do grupo de
propósito — é o único cujo conteúdo é imprevisível, e na borda ele empurraria
o relógio de lugar toda vez que um app abrisse.

As workspaces são uma **régua fixa de 1 a 5**, sempre visíveis. Iterar sobre
`hypr.workspaces` só lista as que existem, e a barra ia crescendo conforme
você abria janelas — posição instável para o olho.


### Título da janela

O centro alterna: **mídia quando há player, título da janela quando não há**.
Os dois respondem à mesma pergunta e nunca precisam aparecer juntos.

O título existe aí porque não existe em mais lugar nenhum — descartamos o
`hyprbars` e os apps Qt rodam sem decoração própria, então kitty e afins não
têm barra de título. Vai em `#8a8a8a`, não branco: o branco deste tema
pertence ao marcador de foco e ao relógio.

Usa `<With>` e não `createBinding` simples porque a ligação é aninhada —
primeiro muda a janela em foco, depois muda o título *dentro* dela (abas do
kitty, navegação no Nautilus).

### Controle de volume

Clicar no ícone de volume abre um popover com `Gtk.Scale` arrastável, botão
de mudo e atalho para o mixer completo.

Isto **não cabe no Walker**: ele é um renderizador de lista e não tem
primitiva de slider — o provider `wireplumber` do elephant só oferece
"subir/descer volume" como itens com atalho de teclado. No AGS o popover
ainda ancora exatamente sob o ícone.

A ligação é nos dois sentidos, com guarda contra laço: arrastar muda o
sistema, e mudar por fora (tecla de mídia, `pavucontrol`) move o slider.

## Fontes

| Onde | Fonte |
|---|---|
| Interface do sistema — GTK3, GTK4, Qt5, Qt6, Nautilus | **SF Pro Text 11** |
| Terminal (kitty) | **JetBrainsMono Nerd Font Mono** |
| Barra, Walker, `monospace` | SF Pro Text com fallback para JetBrains Mono |

**SF Pro Text, não "SF Pro".** A Apple desenha a variante `Text` para
tamanhos de interface (abaixo de ~20pt) e a `Display` para títulos. A 11pt é
a `Text` que tem o espacejamento certo.

**Como os ícones continuam funcionando.** A barra e o Walker pedem
`"SF Pro Text", "JetBrainsMono Nerd Font"`. SF Pro não tem os codepoints da
Private Use Area onde vivem os glifos Nerd Font, então esses caracteres caem
sozinhos na JetBrains Mono. Uma cadeia só, sem trocar de família por widget.

### A armadilha do `binding` no fontconfig

O bloco de fallback global em `fontconfig/fonts.conf` usa
`binding="weak"` — e isso **não é detalhe**:

```xml
<match target="pattern">
  <edit name="family" mode="append" binding="weak">
    <string>JetBrainsMono Nerd Font</string>
  </edit>
</match>
```

Com `binding="strong"` a família anexada **vence** a que o app pediu, e todo
`sans-serif` do sistema vira monoespaçado. Aconteceu no primeiro teste:
`fc-match sans-serif` devolvia `JetBrainsMono Nerd Font`. Com `weak` ela vai
para o fim da cadeia e serve só de fallback.

Conferir com:

```bash
fc-match sans-serif    # SF Pro Text
fc-match monospace     # JetBrainsMono Nerd Font
fc-match --format='%{family}\n' :charset=f08c7   # glifo do Arch -> Nerd Font
```

### Licença

`otf-apple-sf-pro` é AUR e o PKGBUILD baixa direto dos servidores da Apple —
a fonte é proprietária e não redistribuível. Se preferir licença aberta com
desenho próximo, `inter-font` está no repo oficial; trocar exige ajustar
quatro pontos: `gtk-3.0/settings.ini`, `gtk-4.0/settings.ini`, os dois
`qt*ct.conf` e o `fontconfig/fonts.conf`.

## Wallpaper e blur

Wallpaper: logo do Arch em `#d0d3d4` centralizado sobre `#27292c`, composto em
1920×1080. A imagem original tinha 596×335; esticada, as bordas do logo
borravam.

O blur é **leve** (`size 4`, `passes 2`) e as janelas continuam **opacas**
(`opacity 1.0`). Baixar a opacidade da janela inteira lavaria o texto junto —
o blur aparece através do que é translúcido por conta própria: o fundo do
kitty (`background_opacity 0.85`), a barra e o Walker. `vibrancy = 0` porque
ela reintroduz saturação de cor.

## Secure Boot

`scripts/secure-boot.sh` deixa tudo pronto via `sbctl`. Não roda no
`install.sh` porque exige dois passos na BIOS.

O ponto que costuma quebrar dual boot: é **obrigatório** enrolar também os
certificados da Microsoft (`--microsoft`). Sem eles o Windows Boot Manager não
valida e a option ROM da 1660 SUPER pode não inicializar.

O kernel do Arch traz `CONFIG_LOCK_DOWN_KERNEL_FORCE_NONE=y` e não define
`CONFIG_MODULE_SIG_FORCE` — não exige módulo assinado nem ativa lockdown sob
Secure Boot. Por isso o **NVIDIA DKMS continua carregando**, diferente do
Ubuntu/Fedora.

## Instalação

```bash
git clone <este-repo> ~/Documents/Projects/linux
cd ~/Documents/Projects/linux
./install.sh
```

O script instala **apenas o que os dotfiles precisam**.
Bootloader, kernel, microcode e driver de GPU são decisão do seu sistema —
fora de escopo.

**Rodando de um pendrive:** o script **recusa** rodar de fora do seu `$HOME`
e manda copiar primeiro. Os links em `~/.config` apontam para o diretório
do repo — se ele estiver em mídia removível, morrem no instante em que
você desplugar e o Hyprland sobe sem config nenhuma.

A recusa é de propósito, em vez de copiar sozinho: uma cópia silenciosa
deixaria você editando o pendrive enquanto o sistema lê outro lugar.

Depois, à mão:

1. `chsh -s /usr/bin/zsh`
2. Ajustar o monitor em `hypr/hyprland.lua` se quiser fixar resolução
3. Firefox → `about:config` → `widget.use-xdg-desktop-portal.file-picker = true`

## Verificar

```bash
hyprctl reload
hyprctl configerrors      # tem que sair vazio
ags quit; ags run
walker                    # SUPER + Space
```

## Versões-alvo

- **Hyprland 0.56.x** — sintaxe de `windowrule` em bloco
- **Walker 2.17** — tema é um *diretório* com XML de GTK Builder + `style.css`
- **AGS v2 / Astal**, bindings `astal/gtk3`

## Estrutura

```
hypr/          hyprland.lua, hyprpaper.conf, wallpapers/, scripts/power-menu.sh
ags/           app.ts, style.css, widget/Bar.tsx, widget/Notifications.tsx
walker/        config.toml, themes/mono/ (launcher), themes/power/ (menu de energia)
elephant/      files.toml — onde o launcher procura arquivos
kitty/         kitty.conf (intacto), current-theme.conf (mono)
gtk-3.0/       settings.ini, gtk.css
gtk-4.0/       settings.ini, gtk.css      ← o que conserta o Nautilus
qt5ct/ qt6ct/  Fusion + paleta de 21 roles
xdg-desktop-portal/   seletor de arquivos unificado
zsh/           .zshrc (intacto), .zprofile (sobe o Hyprland no tty1)
scripts/       secure-boot.sh (sbctl, rodar à mão)
starship.toml  prompt sem cor
```
