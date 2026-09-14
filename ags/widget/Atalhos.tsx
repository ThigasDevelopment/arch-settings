import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState, With } from "ags"
import { execAsync } from "ags/process"

/* Folha de atalhos.
 *
 * Isto morou no Walker em modo dmenu e saiu de lá por um limite duro: o item
 * do dmenu é UM label sem markup — testado, `<b>x</b>` aparece literal — e
 * todo item é selecionável. Título de seção e filete viravam linhas de texto
 * com tracinho, competindo com os atalhos pela mesma tipografia. Aqui cada
 * coisa é um widget: o filete tem 1px, o título tem corpo próprio, e nada
 * disso entra na navegação.
 *
 * A lista continua vindo do `hyprctl binds -j`, ou seja, do compositor: é o
 * que impede a folha de envelhecer. E a seção de cada bind continua marcada
 * na própria `description`, no formato "Seção|glifo  texto", escrita no
 * hyprland.lua — assim não existe uma segunda lista para manter em dia.
 */

const FALLBACK = "Outros"

/* Ordem de exibição dos modificadores, não a ordem dos bits. O SUPER vira o
   logo do Arch, o mesmo glifo que abre a barra: essa tecla é a raiz de quase
   todo atalho daqui, e repetir a palavra "SUPER" 50 vezes numa coluna é
   ruído. */
const MODS: Array<[number, string]> = [
    [64, "\u{F08C7}"],
    [4, "CTRL"],
    [8, "ALT"],
    [1, "SHIFT"],
]

/* Nomes que o X11 usa e ninguém lê. Só os que existem nesta config. */
const BONITO: Record<string, string> = {
    left: "←",
    right: "→",
    up: "↑",
    down: "↓",
    SPACE: "Espaço",
    Escape: "Esc",
    mouse_down: "Roda ↓",
    mouse_up: "Roda ↑",
    "mouse:272": "Clique esq.",
    "mouse:273": "Clique dir.",
    XF86AudioRaiseVolume: "Volume +",
    XF86AudioLowerVolume: "Volume −",
    XF86AudioMute: "Mudo",
    XF86AudioMicMute: "Mudo do mic",
    XF86MonBrightnessUp: "Brilho +",
    XF86MonBrightnessDown: "Brilho −",
    XF86AudioNext: "Faixa →",
    XF86AudioPrev: "Faixa ←",
    XF86AudioPlay: "Play",
    XF86AudioPause: "Pause",
}

type Bind = {
    modmask: number
    key: string
    keycode: number
    description?: string
}

type Atalho = { teclas: string[]; icone: string; texto: string }
type Secao = { nome: string; itens: Atalho[] }

function ler(saida: string): Secao[] {
    const binds: Bind[] = JSON.parse(saida)
    const ordem: string[] = []
    const grupos = new Map<string, Atalho[]>()

    for (const b of binds) {
        const desc = b.description ?? ""
        if (!desc) continue

        const corte = desc.indexOf("|")
        const nome = corte > 0 ? desc.slice(0, corte) : FALLBACK
        const resto = corte > 0 ? desc.slice(corte + 1) : desc

        /* A description nasce "glifo  texto", com dois espaços. Separar os
           dois aqui é o que permite alinhar os glifos numa coluna própria em
           vez de deixá-los flutuando no começo de cada frase. */
        const espaco = resto.indexOf("  ")
        const icone = espaco > 0 ? resto.slice(0, espaco) : ""
        const texto = espaco > 0 ? resto.slice(espaco + 2) : resto

        const teclas = MODS.filter(([bit]) => b.modmask & bit).map(([, n]) => n)
        const tecla = b.key || `code:${b.keycode}`
        teclas.push(BONITO[tecla] ?? tecla)

        if (!grupos.has(nome)) {
            grupos.set(nome, [])
            ordem.push(nome)
        }
        grupos.get(nome)!.push({ teclas, icone, texto })
    }

    /* "Outros" junta bind sem marca de seção e vai sempre para o fim: um
       esquecimento no hyprland.lua não pode partir a folha no meio. O resto
       sai na ordem em que apareceu, que é a ordem do próprio arquivo. */
    const nomes = ordem.filter((n) => n !== FALLBACK)
    if (grupos.has(FALLBACK)) nomes.push(FALLBACK)

    return nomes.map((nome) => ({ nome, itens: grupos.get(nome)! }))
}

/* Três colunas, cortadas por PESO e não por quantidade de seções.
 *
 * Uma seção custa as linhas dela mais duas (título e filete). Dividir pelo
 * número de seções deixaria "Mover janelas", com onze linhas, ao lado de
 * "Sistema", com cinco — e a folha inteira com a altura da maior coluna,
 * metade dela vazia. Foi o que aconteceu na primeira versão em duas colunas:
 * a esquerda ia até o pé da tela e a direita terminava no meio.
 *
 * Três e não duas porque a folha fica com forma de teclado — larga e baixa —
 * em vez de uma coluna de 1071px que ocupava a tela inteira na vertical.
 */
const COLUNAS = 3

const peso = (secoes: Secao[]) =>
    secoes.reduce((acc, s) => acc + s.itens.length + 2, 0)

/* Parte em `n` blocos CONTÍGUOS — a ordem das seções é a do hyprland.lua e
   não pode ser embaralhada — minimizando a altura do bloco mais alto.
   Busca exaustiva: são meia dúzia de seções, o custo é combinatório só no
   papel, e uma programação dinâmica aqui seria mais código que proveito. */
function partir(secoes: Secao[], n: number): Secao[][] {
    if (n <= 1 || secoes.length <= 1) return [secoes]

    let melhor: Secao[][] = [secoes]
    let menorAltura = Infinity

    /* O limite do corte guarda pelo menos uma seção para cada coluna que
       ainda falta; sem isso o último bloco sairia vazio e a folha ficaria
       com uma coluna fantasma ocupando margem. */
    for (let corte = 1; corte <= secoes.length - (n - 1); corte++) {
        const cabeca = secoes.slice(0, corte)
        const resto = partir(secoes.slice(corte), n - 1)
        const altura = Math.max(peso(cabeca), ...resto.map(peso))

        if (altura < menorAltura) {
            menorAltura = altura
            melhor = [cabeca, ...resto]
        }
    }

    return melhor
}

function Tecla({ nome }: { nome: string }) {
    return <label class="tecla" label={nome} />
}

function Linha({ a }: { a: Atalho }) {
    return (
        <box class="atalhoLinha">
            <box class="atalhoTeclas">
                {a.teclas.flatMap((t, i) =>
                    i === 0
                        ? [<Tecla nome={t} />]
                        : [<label class="atalhoMais" label="+" />, <Tecla nome={t} />],
                )}
            </box>
            <label class="atalhoIcone" label={a.icone} />
            <label class="atalhoTexto" xalign={0} hexpand label={a.texto} />
        </box>
    )
}

function Coluna({ secoes }: { secoes: Secao[] }) {
    return (
        <box class="atalhoColuna" orientation={Gtk.Orientation.VERTICAL}>
            {secoes.map((s) => (
                <box class="atalhoSecao" orientation={Gtk.Orientation.VERTICAL}>
                    <label class="atalhoTitulo" xalign={0} label={s.nome} />
                    {/* Irmão do .soundDivider do popover de volume: mesma cor,
                        mesmo 1px. É o filete que o dmenu não sabia desenhar. */}
                    <box class="atalhoFilete" />
                    {s.itens.map((a) => (
                        <Linha a={a} />
                    ))}
                </box>
            ))}
        </box>
    )
}

const [secoes, setSecoes] = createState<Secao[]>([])
const [aberta, setAberta] = createState(false)

export function toggleAtalhos() {
    if (aberta.peek()) {
        setAberta(false)
        return false
    }

    /* Relê a cada abertura em vez de uma vez na subida do AGS: um
       `hyprctl reload` troca os binds sem reiniciar a barra, e uma folha que
       mostra o estado de três horas atrás é pior que não ter folha. */
    execAsync(["hyprctl", "binds", "-j"])
        .then((saida) => {
            setSecoes(ler(saida))
            setAberta(true)
        })
        .catch(() => {
            /* Sem os binds não há folha: abrir uma janela vazia só faria o
               usuário apertar Esc sem entender o que aconteceu. */
        })

    return true
}

export default function Atalhos() {
    return (
        <window
            name="atalhos"
            class="Atalhos"
            layer={Astal.Layer.OVERLAY}
            exclusivity={Astal.Exclusivity.IGNORE}
            /* EXCLUSIVE porque o Esc PRECISA chegar aqui: é a única saída
               garantida da folha. Com ON_DEMAND o teclado só vem se o
               compositor resolver dar foco à camada, e aí a tecla de fechar
               vira sorte. */
            keymode={Astal.Keymode.EXCLUSIVE}
            application={app}
            $={(self: Astal.Window) => {
                const teclado = new Gtk.EventControllerKey()
                teclado.connect("key-pressed", (_c: unknown, keyval: number) => {
                    if (keyval === Gdk.KEY_Escape || keyval === Gdk.KEY_Return) {
                        setAberta(false)
                        return true
                    }
                    return false
                })
                self.add_controller(teclado)

                /* Clique em qualquer lugar também fecha. Numa folha de
                   consulta não há nada para clicar: o único gesto possível é
                   "já vi o que precisava". */
                const clique = new Gtk.GestureClick()
                clique.connect("pressed", () => setAberta(false))
                self.add_controller(clique)
            }}
            visible={aberta}
        >
            <box class="atalhos" orientation={Gtk.Orientation.VERTICAL}>
                <box class="atalhosHead">
                    <label class="atalhosTitulo" xalign={0} hexpand label="Atalhos" />
                    <label class="atalhosDica" label="Esc para fechar" />
                </box>

                <With value={secoes}>
                    {(lista: Secao[]) => (
                        <box class="atalhosCorpo">
                            {partir(lista, COLUNAS).map((g) => (
                                <Coluna secoes={g} />
                            ))}
                        </box>
                    )}
                </With>
            </box>
        </window>
    )
}
