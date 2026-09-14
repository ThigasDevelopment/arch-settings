import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createComputed, createState } from "ags"
import type { Corner, DesktopWidget } from "./desktop/Card"
import Media from "./desktop/Media"
import Sensores from "./desktop/Sensores"
import Rede from "./desktop/Rede"

/* Widgets de desktop — a camada de baixo.
 *
 * O que faz um widget ser "de desktop" não é o desenho, é a CAMADA. O
 * wlr-layer-shell tem quatro (background, bottom, top, overlay) e as janelas
 * comuns entram entre bottom e top. A barra vive em `top`, por isso fica
 * sempre por cima; estes vivem em `bottom`, acima do papel de parede (o
 * hyprpaper ocupa `background`) e abaixo de qualquer janela. Abrir o kitty em
 * cima cobre o widget; fechar revela de novo. É o comportamento de "widget de
 * área de trabalho" do KDE/conky, e sai de graça do protocolo — não precisa
 * de regra no Hyprland para funcionar.
 *
 * Exclusivity.NORMAL, não IGNORE: NORMAL é "não reservo espaço para mim, mas
 * respeito o que os outros reservaram". Um cartão no canto de cima ficaria
 * POR BAIXO da barra com IGNORE, cortado nos primeiros 34px.
 *
 * O blur vem junto sem nenhuma configuração nova: a layerrule do
 * hyprland.lua casa com o namespace `gtk4-layer-shell`, que é o de toda
 * janela do AGS. Por isso `namespace` não é definido aqui — trocar o nome
 * para "desktop" seria mais bonito no `hyprctl layers` e custaria o blur.
 */

/* O registro. Adicionar um widget novo é escrever o módulo dele em
   widget/desktop/ e acrescentar aqui — o resto (janela, camada, canto,
   visibilidade) já está resolvido. */
const WIDGETS: DesktopWidget[] = [Media, Sensores, Rede]

/* Espiar.
 *
 * A camada `bottom` tem um preço embutido: o widget só aparece quando o
 * desktop aparece. Numa tela com o navegador maximizado ele existe, funciona
 * e está invisível — e "só vejo numa área vazia" não é widget, é enfeite.
 *
 * O `peek` é a saída: enquanto ligado, as janelas sobem para `overlay` e
 * ficam por cima de TUDO, inclusive de janela em tela cheia. É um toggle e
 * não um "enquanto segura" porque uma tecla presa não dá para representar
 * num bind do Hyprland sem um segundo bind de release — e um atalho que
 * pisca se você soltar rápido demais é pior que um que fica.
 *
 * Quem liga isso é o `ags request peek`, tratado no app.ts. */
const [espiando, setEspiando] = createState(false)

export function togglePeek() {
    const novo = !espiando.peek()
    setEspiando(novo)
    return novo
}

/* Distância das bordas da tela. Um número só, em todos os cantos: é o que
   faz cartões de cantos diferentes parecerem alinhados entre si. */
const GAP = 16

export default function Desktop(gdkmonitor: Gdk.Monitor) {
    const { TOP, BOTTOM, LEFT, RIGHT } = Astal.WindowAnchor

    const ANCORA: Record<Corner, number> = {
        "top-left": TOP | LEFT,
        "top-right": TOP | RIGHT,
        "bottom-left": BOTTOM | LEFT,
        "bottom-right": BOTTOM | RIGHT,
    }

    /* Uma janela por canto OCUPADO, não uma por widget e nem uma só para
       tudo. Uma por widget dá duas superfícies sobrepostas quando dois
       cartões dividem o canto; uma só para tudo teria que ser do tamanho da
       tela, e uma camada do tamanho da tela em `bottom` engole todo clique
       que cairia no desktop. Do tamanho do conteúdo, ancorada no canto, ela
       só existe onde o cartão está desenhado. */
    return (Object.keys(ANCORA) as Corner[])
        .map((corner) => ({ corner, ws: WIDGETS.filter((w) => w.corner === corner) }))
        .filter(({ ws }) => ws.length > 0)
        .map(({ corner, ws }) => (
            <window
                name={`desktop-${corner}`}
                class="Desktop"
                gdkmonitor={gdkmonitor}
                layer={espiando((e) => (e ? Astal.Layer.OVERLAY : Astal.Layer.BOTTOM))}
                exclusivity={Astal.Exclusivity.NORMAL}
                anchor={ANCORA[corner]}
                margin={GAP}
                application={app}
                /* `visible` por ÚLTIMO, e isto não é gosto de formatação: as
                   propriedades são aplicadas na ordem em que estão escritas, e
                   é `visible` que mapeia a superfície. Com ele em cima, a
                   janela nascia visível antes de o `layer` ser aplicado e
                   ficava no TOP (o padrão do gtk4-layer-shell) — os cartões da
                   direita apareciam POR CIMA das janelas, e só eles, porque o
                   da esquerda só é mapeado mais tarde, quando surge um player.

                   Enquanto isso: a janela existe enquanto ALGUM cartão do
                   canto tiver o que mostrar. Com todos escondidos ela sai do
                   ar inteira — uma camada viva e vazia continuaria recebendo
                   clique no desktop. */
                visible={createComputed(
                    ws.map((w) => w.visible),
                    (...vs: boolean[]) => vs.some(Boolean),
                )}
            >
                <box class="desktopStack" orientation={Gtk.Orientation.VERTICAL}>
                    {ws.map((w) => w.render())}
                </box>
            </window>
        ))
}
