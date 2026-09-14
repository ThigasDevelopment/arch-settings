# linux — dotfiles mono

Hyprland em preto e branco. A hierarquia é feita por peso, densidade e uma
única barra branca de foco.

A única exceção deliberada é o **botão de power da barra**, em vermelho
(`#b34640`, acendendo para `#ff5f56` no hover). Ele segue a mesma gramática dos
vizinhos — apagado em repouso, aceso sob o cursor —, só que no matiz em vez de
no cinza. Todo o resto continua sem cor: ícones de pasta e o cadeado do polkit
foram levados para cinza justamente para manter isso.

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

## Splash de boot

`scripts/boot-splash.sh` troca as mensagens do kernel pelo logo do Arch em
branco, centralizado, com uma barra de progresso fina — fundo preto, sem cor,
como o resto do tema. É Plymouth com tema próprio (`plymouth/arch-mac`), em
módulo `script`: as medidas são proporções da tela, então vale em qualquer
resolução.

Não roda no `install.sh`, pelo mesmo motivo do Secure Boot: mexe em initramfs
e na linha de comando do kernel. Um erro no tema estraga a tela; um erro aqui
estraga o boot.

```bash
bash scripts/boot-splash.sh            # instala
bash scripts/boot-splash.sh --revert   # desfaz
```

Rode num terminal de verdade: ele usa `sudo` por dentro, e prompt embutido de
editor ou de assistente costuma não repassar o TTY que o `sudo` exige para
pedir a senha. O script confere isso no primeiro passo e para antes de mexer
em qualquer arquivo.

O estado do Secure Boot é lido da variável EFI, não de `sudo sbctl status`: se
a checagem depender de `sudo` e o `sudo` falhar, ela responde "desligado", o
UKI sai sem assinatura e o firmware recusa o boot. Quando o estado não pode ser
determinado, o script assina assim mesmo — assinar à toa não custa nada, não
assinar custa o boot.

O que ele encosta: `/usr/share/plymouth/themes/arch-mac`, o hook `plymouth` no
`mkinitcpio.conf`, e `quiet splash loglevel=3 rd.udev.log_level=3
vt.global_cursor_default=0` na cmdline. O texto não some — continua todo em
`journalctl -b`, só deixa de ser pintado na tela.

Três coisas que ele detecta em vez de assumir:

- **Onde fica a cmdline.** UKI (`/etc/kernel/cmdline`), entradas do
  systemd-boot ou GRUB. Editar o arquivo errado é o modo clássico de "fiz tudo
  certo e nada mudou".
- **NVIDIA.** Se houver, os módulos entram em `MODULES=()` para KMS cedo. Sem
  isso a tela pisca no meio do boot, quando o driver assume a placa. Em
  Intel/AMD nada é adicionado — os módulos não existiriam.
- **Secure Boot.** Com `sbctl` ativo, re-assina no fim. O hook do sbctl só roda
  em transação do pacman, então um `mkinitcpio -P` feito à mão deixa o UKI sem
  assinatura — e o firmware recusa o boot seguinte.

Em setup com UKI, uma cópia **assinada** do UKI atual é guardada como
`arch-linux-backup.efi` antes de qualquer mudança. Ela aparece no menu do
systemd-boot (segure `ESPAÇO` no firmware) e é um boot que sabidamente
funciona. As configs anteriores vão para `/var/lib/arch-mac-splash-backup`.

A barra é dirigida por **tempo**, não pelo progresso do Plymouth — e isso foi
medido, não chutado. O número do Plymouth é a fração de serviços do systemd já
iniciados: durante o initramfs inteiro nenhum serviço roda, então ele fica em
zero justamente enquanto o logo já está na tela, e sobra ~1,4s de userspace
para a barra percorrer tudo. Na prática ela chegava à metade e o login
aparecia por cima.

O tema enche a barra em `fill.alvo` segundos (2.0, no topo do
`arch-mac.script`), usando o progresso real só como piso: se o boot correr mais
rápido que o alvo, a barra acompanha em vez de atrasar. Ela nunca anda para
trás. Se encher cedo demais e ficar esperando, **aumente** o alvo; se o login
aparecer antes de encher, **diminua**.

Para saber quanto tempo o splash realmente fica na tela nesta máquina:

```bash
journalctl -b -o short-precise | grep -E 'Show Plymouth|Terminate Plymouth'
```

Sem display manager — este setup sobe o Hyprland pelo `.zprofile` no tty1 — o
splash vai até o prompt de login. Se quiser a barra cheia parada por um instante
antes do prompt, custe o que custar no tempo de boot, segure o quit:

```bash
sudo systemctl edit plymouth-quit.service     # [Service] / ExecStartPre=/usr/bin/sleep 0.5
```

Mudar o tema exige regerar o initramfs: o `arch-mac.script` é **copiado para
dentro** dele pelo hook. Editar só `/usr/share/plymouth/themes/` não muda nada
no próximo boot — rode o `boot-splash.sh` de novo, que é idempotente.

O logo vai em branco. Para trocar pelo azul do Arch, `logo-arch-blue.png` já
está instalado ao lado:

```bash
sudo cp /usr/share/plymouth/themes/arch-mac/logo-arch-blue.png \
        /usr/share/plymouth/themes/arch-mac/logo.png
sudo mkinitcpio -P && sudo sbctl sign-all
```

Os PNGs saem de `plymouth/gen-assets.sh` (librsvg + imagemagick). O SVG de
`/usr/share/pixmaps` não serve direto: dois dos três paths dele desenham um
"™" que, na tela de boot, vira sujeira ao lado do logo.

## Dual boot: qual sistema o reboot abre

A NVRAM desta máquina tem o Windows na frente:

```
BootOrder: 0000,0001,0002
Boot0000* Windows Boot Manager     (ESP do sda1)
Boot0001* Linux Boot Manager       (systemd-boot, ESP do sdc1)
```

Os dois sistemas moram em discos com ESP separado, então o systemd-boot daqui
não enxerga o Windows e `systemctl reboot --boot-loader-entry` não serve para
nenhum dos lados. O que existe é `BootNext` na NVRAM: one-shot, consumido pelo
firmware no próximo boot, sem nada gravado em disco.

A regra é **cada sistema reinicia em si mesmo**, e são dois mecanismos, um de
cada lado:

| Reiniciando de | Quem marca | Abre |
|---|---|---|
| Linux (botão, `reboot`, update, Ctrl+Alt+Del) | `bootnext-linux.service` | Linux |
| Windows | ninguém — vale a `BootOrder` | Windows |
| "Ir para o Windows" no power menu | `reboot-to-windows.sh` | Windows |

Sem o lado do Linux, **reiniciar caía no Windows** e exigia `F8` para escolher
na mão. A unit roda no caminho do desligamento, só quando o alvo é reboot
(`WantedBy=reboot.target`), e antes de desmontar — o `efibootmgr` mora em
`/usr`, que mais para o fim do shutdown já pode não estar lá. No `poweroff` ela
não roda: desligar e ligar de novo segue a `BootOrder`, ou seja, Windows.

A guarda que faz os dois lados conviverem: se já existe um `BootNext`, a unit
sai sem tocar em nada. O botão "Ir para o Windows" marca `BootNext` e só então
chama `systemctl reboot` — sem essa guarda, a unit sobrescreveria o destino
logo em seguida e o botão do Windows voltaria para o Linux.

Os dois resolvem o número da entrada pelo nome a cada execução: reinstalar um
sistema ou limpar a NVRAM renumera tudo.

**Não** troque isso por `efibootmgr --bootorder 0001,0000,0002`. Pôr o Linux em
primeiro conserta o lado de cá, mas faz *reiniciar pelo Windows* cair no
Linux — é a `BootOrder` com o Windows na frente que dá a simetria do lado de lá.

Instalação da unit (uma vez, pede senha; não precisa de regra no sudoers,
porque quem chama é o systemd, já como root):

```bash
sudo install -m 755 -o root -g root scripts/bootnext-linux.sh /usr/local/bin/bootnext-linux
sudo install -m 644 -o root -g root systemd/system/bootnext-linux.service /etc/systemd/system/
sudo systemctl enable bootnext-linux.service
```

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
4. Splash de boot, se quiser: `bash scripts/boot-splash.sh`

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
hypr/          hyprland.lua, hyprpaper.conf, wallpapers/, scripts/ (power menu, boot)
ags/           app.ts, style.css, widget/Bar.tsx, widget/Notifications.tsx
walker/        config.toml, themes/mono/ (launcher), themes/power/ (menu de energia)
elephant/      files.toml — onde o launcher procura arquivos
kitty/         kitty.conf (intacto), current-theme.conf (mono)
gtk-3.0/       settings.ini, gtk.css
gtk-4.0/       settings.ini, gtk.css      ← o que conserta o Nautilus
qt5ct/ qt6ct/  Fusion + paleta de 21 roles
xdg-desktop-portal/   seletor de arquivos unificado
zsh/           .zshrc (intacto), .zprofile (sobe o Hyprland no tty1)
scripts/       secure-boot.sh, boot-splash.sh (rodar à mão), bootnext-linux.sh
plymouth/      tema arch-mac do splash de boot + gen-assets.sh
systemd/       user/ags.service, system/bootnext-linux.service (dual boot)
starship.toml  prompt sem cor
```
