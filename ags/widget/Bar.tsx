import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createBinding, createComputed, For, With } from "ags"
import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import GLib from "gi://GLib"
import AstalHyprland from "gi://AstalHyprland"
import AstalWp from "gi://AstalWp"
import AstalNetwork from "gi://AstalNetwork"
import AstalTray from "gi://AstalTray"

// Este Hyprland é configurado em Lua (hypr/hyprland.lua), e o `dispatch` do
// IPC passou a ser avaliado como Lua junto: `dispatch workspace 4` vira
// `hl.dispatch(workspace 4)`, que é erro de sintaxe. Todo despacho daqui
// precisa ser uma EXPRESSÃO Lua — a mesma forma que o hyprland.lua usa nos
// binds (hl.dsp.focus, hl.dsp.exec_cmd).
//
// Isso não dava erro visível em lugar nenhum: o hyprctl respondia, o
// .catch() engolia, e o botão simplesmente não fazia nada.
const dispatch = (lua: string) =>
    execAsync(["hyprctl", "dispatch", lua]).catch(() => {})

// Abre o monitor de sistema numa aba específica.
//
// Sem `[workspace empty]`, ao contrário do que o terminal pedia: o
// gnome-system-monitor tem regra de janela flutuante e centralizada no
// hyprland.lua, então mandá-lo para uma workspace vazia teria o efeito
// perverso de te ARRANCAR de onde você está — justamente a tela cuja
// atividade você clicou para observar.
//
// Ele é single-instance: chamar de novo com outra flag traz a janela que já
// existe e troca a aba, em vez de abrir uma segunda.
//
//   -r  Recursos              gráficos de CPU, memória e rede
//   -f  Sistemas de arquivos
//   -p  Processos             (fica no bind SUPER+SHIFT+Esc, não aqui)
const monitor = (aba: string) =>
    dispatch(`hl.dsp.exec_cmd("gnome-system-monitor ${aba}")`)

/* ------------------------------------------------------------------ left */

// Workspaces fixas de 1 a 5, sempre visíveis.
//
// Antes isto era um <For> sobre hypr.workspaces, que só lista as que EXISTEM —
// a barra ficava com um número só no boot e ia crescendo conforme você abria
// janelas. Uma régua fixa dá posição estável para o olho.
const WORKSPACES = [1, 2, 3, 4, 5]

// Um botão da régua. Extraído porque agora ele nasce de duas origens: a régua
// fixa de 1 a 5 e as workspaces que existem fora dela.
function WsButton({ id }: { id: number }) {
    const hypr = AstalHyprland.get_default()
    const focused = createBinding(hypr, "focusedWorkspace")
    const existing = createBinding(hypr, "workspaces")

    return (
        <button
            /* valign CENTER + heightRequest fixo: sem isto o GTK
               estica o botão para preencher a altura da barra
               (valign padrão é FILL), a margem do CSS é engolida e a
               pílula sai cortada em cima e embaixo. */
            valign={Gtk.Align.CENTER}
            heightRequest={22}
            class={createComputed([focused, existing], (f, all) => {
                if (f?.id === id) return "ws active"
                // "ocupada" = já existe no compositor, ou seja, tem janela
                return all.some((w) => w.id === id) ? "ws occupied" : "ws"
            })}
            tooltipText={createComputed([existing], (all) => {
                const ws = all.find((w) => w.id === id)
                const n = ws?.clients?.length ?? 0
                if (n === 0) return `Área ${id}  ·  vazia`
                return `Área ${id}  ·  ${n} ${n === 1 ? "janela" : "janelas"}`
            })}
            onClicked={() => dispatch(`hl.dsp.focus({ workspace = ${id} })`)}
        >
            <label label={`${id}`} />
        </button>
    )
}

// A special "magic" (SUPER+M no hyprland.lua) não cabe na régua numérica
// porque ela não é uma posição — é uma gaveta que se sobrepõe à workspace
// atual.
//
// E ela exige um caminho próprio por um detalhe do Hyprland: com a magic
// aberta sobre a área 1, `focusedWorkspace` CONTINUA dizendo 1. Medido com
// hyprctl. Quem sabe se ela está na tela é o campo specialWorkspace do
// MONITOR, não a workspace em foco.
function Magic({ monitor }: { monitor: AstalHyprland.Monitor }) {
    const hypr = AstalHyprland.get_default()

    const state = createComputed(
        [createBinding(monitor, "specialWorkspace"), createBinding(hypr, "workspaces")],
        (sp, all) => {
            // Sem special na tela o Hyprland reporta id 0, não nulo — daí o
            // teste ser `< 0` e não uma checagem de existência.
            if (sp && sp.id < 0) return "aberta"

            // Fora da tela, mas com janelas dentro: vale marcar, senão você
            // esquece o que guardou lá e não há nada na barra que lembre.
            const guardadas = all
                .filter((w) => w.id < 0)
                .reduce((n, w) => n + (w.clients?.length ?? 0), 0)

            return guardadas > 0 ? "guardada" : "vazia"
        },
    )

    return (
        <button
            /* Some quando a gaveta está vazia: a régua de 1 a 5 é o estado
               normal, e um ícone permanente para o que não existe só ocupa
               espaço e treina o olho a ignorá-lo. */
            visible={state((s: string) => s !== "vazia")}
            valign={Gtk.Align.CENTER}
            heightRequest={22}
            class={state((s: string) => (s === "aberta" ? "ws magic active" : "ws magic occupied"))}
            tooltipText={state((s: string) =>
                s === "aberta"
                    ? "Magic  ·  na tela agora  ·  clique para esconder"
                    : "Magic  ·  guardada com janelas  ·  clique para mostrar",
            )}
            onClicked={() => dispatch('hl.dsp.workspace.toggle_special("magic")')}
        >
            <label label={ICON.magic} />
        </button>
    )
}

function Workspaces() {
    const hypr = AstalHyprland.get_default()
    const focused = createBinding(hypr, "focusedWorkspace")
    const existing = createBinding(hypr, "workspaces")

    // Workspaces fora da régua fixa, em ordem, sempre depois do 5.
    //
    // O critério é "existe no compositor", não "está em foco": focar a 7 já a
    // cria, então isso cobre o caso pedido, e cobre também a 9 que ficou com
    // uma janela dentro depois que você saiu dela — que sumiria da barra e
    // viraria uma janela inalcançável pelo mouse.
    //
    // A workspace em foco entra à força porque `workspaces` e
    // `focusedWorkspace` são duas ligações independentes: nada garante que as
    // duas cheguem no mesmo quadro, e por um instante a atual poderia não
    // estar na lista.
    //
    // id < 0 fica de fora: é special, e o Magic cuida dela.
    const extras = createComputed([existing, focused], (all, f) => {
        const ids = all
            .filter((w) => w.id > 0 && !WORKSPACES.includes(w.id))
            .map((w) => w.id)

        if (f && f.id > 0 && !WORKSPACES.includes(f.id) && !ids.includes(f.id)) {
            ids.push(f.id)
        }

        return ids.sort((a, b) => a - b)
    })

    return (
        <box class="workspaces" valign={Gtk.Align.CENTER}>
            {WORKSPACES.map((id) => (
                <WsButton id={id} />
            ))}

            {/* Caixa própria para o <For>: ele anexa os itens ao pai conforme
                chegam, então solto entre irmãos empurraria os extras para
                depois do indicador da magic. */}
            <box valign={Gtk.Align.CENTER}>
                <For each={extras}>{(id: number) => <WsButton id={id} />}</For>
            </box>

            {/* `With` porque a ligação é aninhada: primeiro muda o monitor em
                foco, e só então a special DESSE monitor. */}
            <With value={createBinding(hypr, "focusedMonitor")}>
                {(mon: AstalHyprland.Monitor | null) =>
                    mon ? <Magic monitor={mon} /> : <box />
                }
            </With>
        </box>
    )
}

/* ---------------------------------------------------------------- center */

function Clock() {
    const now = createPoll("", 1000, () =>
        GLib.DateTime.new_now_local().format("%d/%m · %H:%M") ?? "",
    )
    const today = createPoll("", 60_000, () =>
        GLib.DateTime.new_now_local().format("%A, %d de %B de %Y") ?? "",
    )

    // Popover com Gtk.Calendar, e não um menu do Walker: o Walker é um
    // renderizador de LISTA, e uma grade de sete colunas por seis linhas não é
    // lista — mesmo motivo já documentado aqui para o slider de volume. O
    // popover, por outro lado, já é padrão desta barra.
    //
    // Volta para o mês corrente toda vez que abre. Sem isso, quem navegou até
    // março reabre em março três dias depois e lê a data errada.
    const hoje = (cal: Gtk.Calendar) => {
        const agora = GLib.DateTime.new_now_local()
        cal.select_day(agora)
    }

    return (
        <menubutton class="clock" tooltipText={today}>
            <box>
                <label class="metricIcon" label={ICON.clock} />
                <label class="clockValue" label={now} />
            </box>

            <popover
                class="calendarPopover"
                $={(self) => self.connect("show", () => {
                    const cal = self.get_child() as Gtk.Calendar | null
                    if (cal) hoje(cal)
                })}
            >
                <Gtk.Calendar $={hoje} />
            </popover>
        </menubutton>
    )
}

/* ----------------------------------------------------------------- right */

// Player fixo no Spotify, como o spotify-status.sh fazia com playerctl -p.
// Título da janela em foco.
//
// Ele existe aqui porque não existe em mais lugar nenhum: descartamos o
// hyprbars e os apps Qt rodam sem decoração própria, então kitty e afins não
// têm barra de título. A barra é o único lugar onde esse dado cabe.
//
// Cinza secundário, não branco: o branco deste tema é do marcador de foco e
// do relógio. Um título branco competiria com os dois.
function WindowTitle() {
    const hypr = AstalHyprland.get_default()
    const focused = createBinding(hypr, "focusedClient")

    return (
        <box class="windowTitle">
            {/* `With` porque a ligação é aninhada: primeiro o cliente em foco
                muda, depois o título DESSE cliente muda. Um createBinding
                simples só pegaria a troca de janela, não o título mudando
                dentro dela (abas do kitty, navegação no Nautilus). */}
            <With value={focused}>
                {(client: AstalHyprland.Client | null) =>
                    client ? (
                        <label
                            maxWidthChars={44}
                            ellipsize={3}
                            /* `?? ""` porque o Gtk.Label recusa null: quando a
                               janela em foco fecha, o gnim descarta a ligação e
                               escreve o valor final de volta na propriedade —
                               que a essa altura é null. Sem a guarda, cada
                               troca de foco cospe um JS ERROR no log. */
                            label={createBinding(client, "title").as((t) => t ?? "")}
                        />
                    ) : (
                        <label label="" />
                    )
                }
            </With>
        </box>
    )
}

// O centro alterna: mídia quando há player, título da janela quando não há.
// Os dois respondem à mesma pergunta — "o que estou fazendo agora" — e nunca
// precisam aparecer juntos.
function Center() {
    // Só o título da janela.
    //
    // Aqui já morou um widget de mídia que tomava este espaço enquanto algo
    // tocava. Saiu porque o custo era alto demais: sem hyprbars e sem
    // decoração nos apps Qt, a barra é o ÚNICO lugar onde o título existe — e
    // com música tocando, duas janelas do mesmo app viravam indistinguíveis.
    //
    // As teclas de mídia seguem funcionando e são independentes disto: o
    // playerctl controla qualquer player, com ou sem widget na barra.
    return (
        <box>
            <WindowTitle />
        </box>
    )
}

function readFile(path: string): string {
    const [ok, data] = GLib.file_get_contents(path)
    return ok ? new TextDecoder().decode(data) : ""
}

// Lidos uma vez: não mudam enquanto a sessão vive.
const CPU_MODEL = (readFile("/proc/cpuinfo").match(/model name\s*:\s*(.+)/)?.[1] ?? "CPU").trim()
const KERNEL = readFile("/proc/sys/kernel/osrelease").trim()
const HOST = GLib.get_host_name()

const uptime = createPoll("", 60_000, () => {
    const secs = Number(readFile("/proc/uptime").split(" ")[0] ?? 0)
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    return h > 0 ? `${h}h ${m}min` : `${m}min`
})

const memTip = createPoll("", 5000, () => {
    const text = readFile("/proc/meminfo")
    const read = (key: string) => Number(text.match(new RegExp(`${key}:\\s+(\\d+)`))?.[1] ?? 0)
    const total = read("MemTotal") / 1048576
    const available = read("MemAvailable") / 1048576
    return `${(total - available).toFixed(1)} GiB de ${total.toFixed(1)} GiB em uso`
})

const DF_TIP = "df -h %s 2>/dev/null | tail -1 | awk '{print $3\" de \"$2\" em uso  (\"$5\")\"}'"

// CPU por delta de /proc/stat. Sem shell no loop.
let prevIdle = 0
let prevTotal = 0

const cpu = createPoll("0", 2000, () => {
    const [ok, data] = GLib.file_get_contents("/proc/stat")
    if (!ok) return "0"

    const fields = new TextDecoder()
        .decode(data)
        .split("\n")[0]
        .trim()
        .split(/\s+/)
        .slice(1)
        .map(Number)

    const idle = fields[3] + fields[4]
    const total = fields.reduce((a, b) => a + b, 0)
    const dIdle = idle - prevIdle
    const dTotal = total - prevTotal

    prevIdle = idle
    prevTotal = total

    return dTotal > 0 ? `${Math.round((1 - dIdle / dTotal) * 100)}%` : "0%"
})

const mem = createPoll("0", 2000, () => {
    const [ok, data] = GLib.file_get_contents("/proc/meminfo")
    if (!ok) return "0"

    const text = new TextDecoder().decode(data)
    const read = (key: string) => Number(text.match(new RegExp(`${key}:\\s+(\\d+)`))?.[1] ?? 0)

    const total = read("MemTotal")
    const available = read("MemAvailable")

    return total > 0 ? `${Math.round((1 - available / total) * 100)}%` : "0%"
})

// O df ja devolve o valor com o sinal de %, entao nao precisa acrescentar.
const DF = "df -P %s 2>/dev/null | tail -1 | tr -s ' ' | cut -d' ' -f5"

const STORAGE = "/media/storage"

// Só mostra a métrica do segundo disco se ele estiver realmente montado.
// Sem isto a barra exibe "HDD" com valor vazio em qualquer máquina que não
// tenha esse ponto de montagem.
const hasStorage = GLib.file_test(STORAGE, GLib.FileTest.IS_DIR)

const diskHome = createPoll("--", 30_000, ["sh", "-c", DF.replace("%s", "/home")])
const diskStorage = createPoll("--", 30_000, ["sh", "-c", DF.replace("%s", STORAGE)])

const diskHomeTip = createPoll("", 30_000, ["sh", "-c", DF_TIP.replace("%s", "/home")])
const diskStorageTip = createPoll("", 30_000, ["sh", "-c", DF_TIP.replace("%s", STORAGE)])

// Glifos da JetBrainsMono Nerd Font. Escritos como escape para não depender
// de o arquivo ser lido em UTF-8 por qualquer editor.
const ICON = {
    arch: "\u{F08C7}",
    cpu: "\u{F035B}",
    mem: "\u{F061A}",
    home: "\u{F02CA}",
    hdd: "\u{F0A0}",
    eth: "\u{F0317}",
    wifi: "\u{F05A9}",
    offline: "\u{F05AA}",
    volMuted: "\u{F075F}",
    volLow: "\u{F057F}",
    volMed: "\u{F0580}",
    volHigh: "\u{F057E}",
    clock: "\u{F0954}",
    magic: "\u{F0068}",
    batAlert: "\u{F0083}",
    batLow: "\u{F007A}",
    batMid: "\u{F007E}",
    batFull: "\u{F0079}",
    batCharging: "\u{F0084}",
    power: "\u{23FB}",
}

/* --------------------------------------------------- bateria de periférico */

const PSU = "/sys/class/power_supply"

// Leitor tolerante. O readFile lá em cima usa file_get_contents cru, que LANÇA
// quando o arquivo não existe — serve lá porque aqueles caminhos sempre
// existem. Aqui, ausência é normal: nem todo power_supply tem model_name, e o
// diretório inteiro some quando o aparelho desliga.
function readOpt(path: string): string {
    try {
        const [ok, data] = GLib.file_get_contents(path)
        return ok ? new TextDecoder().decode(data).trim() : ""
    } catch {
        return ""
    }
}

type Periferico = { nome: string; nivel: number; carregando: boolean }

// Varre o sysfs a cada leitura em vez de fixar "hidpp_battery_0": o número no
// nome muda quando o aparelho reconecta, e o diretório some quando ele
// desliga. Fixar o caminho daria uma métrica que morre no primeiro reconnect.
//
// Vai direto ao sysfs em vez de usar o AstalBattery porque o AstalBattery fala
// com o UPower, e o serviço do UPower está inativo nesta máquina. É o mesmo
// dado, sem depender de serviço nenhum.
// Devolve TODOS os periféricos, não o primeiro que aparecer. Mouse, teclado e
// headset sem fio convivem numa mesma máquina, e a versão anterior mostrava
// só um deles — o que a ordem de leitura do diretório entregasse primeiro.
function lerPerifericos(): Periferico[] {
    let dir: GLib.Dir

    try {
        dir = GLib.Dir.open(PSU, 0)
    } catch {
        return []
    }

    const achados: Periferico[] = []
    let entrada: string | null

    while ((entrada = dir.read_name()) !== null) {
        const base = `${PSU}/${entrada}`

        // scope=Device é o que separa periférico da bateria do próprio
        // computador (scope=System). Este desktop não tem a segunda, mas um
        // notebook teria, e ela não pertence a esta métrica.
        if (readOpt(`${base}/scope`) !== "Device") continue

        const cap = readOpt(`${base}/capacity`)
        if (cap === "") continue

        const nivel = Number(cap)
        if (!Number.isFinite(nivel)) continue

        const status = readOpt(`${base}/status`)

        achados.push({
            nome: readOpt(`${base}/model_name`) || entrada,
            nivel,
            carregando: status === "Charging" || status === "Full",
        })
    }

    // Menor nível primeiro: é ele que a barra mostra, e é ele que importa.
    // Um empate cai no nome, só para a ordem não dançar entre leituras.
    return achados.sort((a, b) => a.nivel - b.nivel || a.nome.localeCompare(b.nome))
}

const perifericos = createPoll<Periferico[]>([], 30_000, lerPerifericos)

// Aqui o ícone segue o NÍVEL, e não o "o quê" como nas outras métricas.
//
// É quebra deliberada do padrão da barra, e o motivo é a pergunta que cada uma
// responde: CPU e disco respondem "quanto está X", e você só olha quando quer
// saber. Esta responde "preciso agir?" — um fone morrendo no meio de uma call
// é a única leitura da barra que precisa ser notada sem ser lida. Um ícone que
// esvazia faz isso; um ícone de fone, não.
//
// Com vários aparelhos, a barra mostra só o MENOR. Um item por aparelho
// encheria a barra de números que você não vai ler, e a pergunta continua
// sendo uma só: "algo está para acabar?". Quem responde "o quê, exatamente" é
// o tooltip, que lista todos.
//
// O hover existe e é honesto: ele não promete clique, promete CONTEÚDO — e
// entrega, porque é ele que revela a lista completa. Diferente do relógio e da
// rede antes do conserto, onde o fundo acendia e não havia nada atrás.
function BateriaPeriferico() {
    // O que a barra mostra: o mais crítico. A lista já vem ordenada por nível.
    const alvo = perifericos((lista) => (lista.length > 0 ? lista[0] : null))

    return (
        <box
            visible={perifericos((lista) => lista.length > 0)}
            class={alvo((p) => (p && !p.carregando && p.nivel <= 20 ? "bateria baixa" : "bateria"))}
            tooltipText={perifericos((lista) => {
                if (lista.length === 0) return ""

                const linha = (p: Periferico) =>
                    `${p.nome}  ·  ${p.nivel}%${p.carregando ? "  ·  carregando" : ""}`

                // Um aparelho só: nome e nível bastam, sem cabeçalho.
                if (lista.length === 1) return linha(lista[0])

                // Vários: o "‹" marca qual deles está aparecendo na barra, para
                // o número lá fora não ficar órfão de dono.
                return lista
                    .map((p, i) => `${linha(p)}${i === 0 ? "  ‹" : ""}`)
                    .join("\n")
            })}
        >
            <label
                class="metricIcon"
                label={alvo((p) => {
                    if (!p) return ICON.batFull
                    if (p.carregando) return ICON.batCharging
                    if (p.nivel <= 15) return ICON.batAlert
                    if (p.nivel <= 35) return ICON.batLow
                    if (p.nivel <= 70) return ICON.batMid
                    return ICON.batFull
                })}
            />
            <label class="metricValue" label={alvo((p) => (p ? `${p.nivel}%` : "--"))} />
        </box>
    )
}

// O tooltip carrega o que o número sozinho não diz: o modelo da CPU, os GiB
// absolutos, o tamanho real do disco. O ícone dá o "o quê", o número dá a
// grandeza, o tooltip dá o contexto — e o clique abre o monitor de
// sistema na aba certa.
function Metric({
    icon,
    value,
    tooltip,
    onClick,
}: {
    icon: string
    value: any
    tooltip: any
    onClick: () => void
}) {
    return (
        <button class="metric" tooltipText={tooltip} onClicked={onClick}>
            <box>
                <label class="metricIcon" label={icon} />
                <label class="metricValue" label={value} />
            </box>
        </button>
    )
}

function Divider() {
    return <box class="divider" />
}

// Um ícone de tray responde a dois gestos diferentes, então ele não pode ser
// um menubutton: o GtkMenuButton abre o popover em QUALQUER clique, e era
// exatamente isso que deixava o app inalcançável — não sobrava clique nenhum
// para chegar no Activate do protocolo.
//
// Aqui é um <button> comum, com o popover do menu criado e ancorado na mão:
//   esquerdo  →  item.activate(), o "mostra/esconde a janela" do app
//   direito   →  o menu do dbusmenu
//
// Apps que anunciam is-menu estão declarando que NÃO implementam Activate.
// Para esses o esquerdo também abre o menu — senão o ícone ficaria morto, que
// é justamente o defeito que estamos consertando.
function TrayItem({ item }: { item: AstalTray.TrayItem }) {
    let popover: Gtk.PopoverMenu

    const openMenu = () => {
        // O app pode reconstruir o menu na hora de abrir (conta logada, estado
        // do player, etc.). Sem este aviso o menu mostra o de um minuto atrás.
        item.about_to_show()
        popover.popup()
    }

    const setup = (self: Gtk.Button) => {
        popover = Gtk.PopoverMenu.new_from_model(item.menuModel)
        popover.set_parent(self)
        self.insert_action_group("dbusmenu", item.actionGroup)

        // Menu e grupo de ações são reenviados pelo app ao longo da vida do
        // ícone; ligar uma vez só congelaria o menu do primeiro segundo.
        const ids = [
            item.connect("notify::menu-model", () =>
                popover.set_menu_model(item.menuModel),
            ),
            item.connect("notify::action-group", () =>
                self.insert_action_group("dbusmenu", item.actionGroup),
            ),
        ]

        // O GtkButton só reage ao botão primário, então o secundário passa
        // direto para este gesto — os dois não disputam a mesma sequência.
        const right = new Gtk.GestureClick({ button: Gdk.BUTTON_SECONDARY })
        right.connect("pressed", openMenu)
        self.add_controller(right)

        // Popover ancorado na mão tem que ser desancorado na mão: sem isto o
        // GTK reclama de filho remanescente toda vez que um app fecha o ícone.
        self.connect("destroy", () => {
            ids.forEach((id) => item.disconnect(id))
            popover.unparent()
        })
    }

    return (
        <button
            class="trayItem"
            tooltipMarkup={createBinding(item, "tooltipMarkup")}
            onClicked={() => (item.isMenu ? openMenu() : item.activate(0, 0))}
            $={setup}
        >
            <image gicon={createBinding(item, "gicon")} />
        </button>
    )
}

function SysTray() {
    const tray = AstalTray.get_default()
    const items = createBinding(tray, "items")

    return (
        <box class="tray">
            <For each={items}>
                {(item: AstalTray.TrayItem) => <TrayItem item={item} />}
            </For>
        </box>
    )
}

// Rede: só o ícone. O estado cabe inteiro na forma do glifo, sem texto.
function Network() {
    const network = AstalNetwork.get_default()

    const icon = createComputed(
        [createBinding(network, "primary"), createBinding(network, "connectivity")],
        (primary, connectivity) => {
            if (connectivity !== AstalNetwork.Connectivity.FULL) return ICON.offline
            return primary === AstalNetwork.Primary.WIFI ? ICON.wifi : ICON.eth
        },
    )

    const tip = createComputed(
        [createBinding(network, "primary"), createBinding(network, "connectivity")],
        (primary, connectivity) => {
            const estado =
                connectivity !== AstalNetwork.Connectivity.FULL
                    ? "Rede offline"
                    : primary === AstalNetwork.Primary.WIFI
                      ? "Wi-Fi conectado"
                      : "Ethernet conectada"

            return `${estado}\nclique para IP, reconectar e nmtui`
        },
    )

    // <button>, não <box>: até agora isto tinha o :hover do .metric pintando o
    // fundo e nenhuma ação por trás — prometia clique e não entregava.
    return (
        <button
            class="metric netOnly"
            tooltipText={tip}
            onClicked={() =>
                execAsync([
                    `${GLib.get_home_dir()}/.config/hypr/scripts/network-menu.sh`,
                ]).catch(() => {})
            }
        >
            <label class="metricIcon" label={icon} />
        </button>
    )
}

// Glifo de volume a partir do nível. Vale para qualquer nó — a saída padrão
// na barra, uma placa de som na lista, o áudio de um app.
const volumeGlyph = (node: AstalWp.Node) =>
    createComputed(
        [createBinding(node, "volume"), createBinding(node, "mute")],
        (volume, mute) => {
            if (mute) return ICON.volMuted
            if (volume < 0.01) return ICON.volLow
            if (volume < 0.5) return ICON.volMed
            return ICON.volHigh
        },
    )

const volumePct = (node: AstalWp.Node) =>
    createComputed(
        [createBinding(node, "volume"), createBinding(node, "mute")],
        (volume, mute) => (mute ? "--" : `${Math.round(volume * 100)}%`),
    )

// Uma linha de som: nome, porcentagem, botão de mudo e slider.
//
// A mesma linha serve para uma saída e para o áudio de um app sem nenhuma
// diferença, porque AstalWp.Endpoint e AstalWp.Stream herdam os dois de
// AstalWp.Node — e volume, mute e description moram no Node.
function SoundRow({
    node,
    current,
    onPick,
}: {
    node: AstalWp.Node
    current?: any
    onPick?: () => void
}) {
    const icon = volumeGlyph(node)
    const pct = volumePct(node)

    const name = createBinding(node, "description").as((d) => d || node.name || "áudio")

    // Ligação de mão dupla com o wireplumber, como no popover antigo, com uma
    // diferença que a lista dinâmica obriga: o handler é desconectado quando a
    // linha morre. Sem isso, desconectar um fone USB deixa um callback vivo
    // escrevendo num Gtk.Scale já destruído.
    const bindScale = (scale: Gtk.Scale) => {
        scale.set_range(0, 1)
        scale.set_increments(0.05, 0.1)
        scale.set_draw_value(false)
        scale.set_value(node.volume)

        let interno = false

        scale.connect("value-changed", () => {
            if (interno) return
            node.volume = scale.get_value()
        })

        const id = node.connect("notify::volume", () => {
            interno = true
            scale.set_value(node.volume)
            interno = false
        })

        scale.connect("destroy", () => node.disconnect(id))
    }

    return (
        <box
            class={
                current
                    ? current((c: boolean) => (c ? "soundRow current" : "soundRow"))
                    : "soundRow"
            }
            orientation={Gtk.Orientation.VERTICAL}
        >
            <box class="soundHead">
                {onPick
                    ? [
                          <button
                              class="soundName"
                              hexpand
                              tooltipText="Tornar esta a saída padrão"
                              onClicked={onPick}
                          >
                              <label xalign={0} maxWidthChars={24} ellipsize={3} label={name} />
                          </button>,
                      ]
                    : [
                          <label
                              class="soundName"
                              xalign={0}
                              hexpand
                              maxWidthChars={24}
                              ellipsize={3}
                              label={name}
                          />,
                      ]}
                <label class="soundPct" label={pct} />
            </box>

            <box class="soundSlider">
                <button class="volumeMute" onClicked={() => (node.mute = !node.mute)}>
                    <label label={icon} />
                </button>

                <Gtk.Scale hexpand orientation={Gtk.Orientation.HORIZONTAL} $={bindScale} />
            </box>
        </box>
    )
}

// Volume: na barra, o ícone e o valor da saída PADRÃO. No popover, todas as
// saídas e todos os apps tocando, cada um com seu próprio slider.
//
// Isto não cabe no Walker (ele é um renderizador de lista, não tem primitiva
// de slider) nem no pavucontrol para o uso do dia a dia — o pavucontrol
// continua ali no rodapé para configuração de perfil e entrada.
function Volume() {
    const audio = AstalWp.get_default()!.audio

    // Guardado para o botão do mixer poder fechar o popover. O GTK não fecha
    // sozinho: o clique é consumido pelo botão, não vaza para fora do
    // popover, então sem o popdown() o pavucontrol abre ATRÁS de um popover
    // que continua aberto por cima.
    let popover: Gtk.Popover

    const speakers = createBinding(audio, "speakers")
    const streams = createBinding(audio, "streams")

    return (
        <menubutton class="metric volume">
            {/* `With` porque a ligação é aninhada: trocar a saída padrão troca
                o OBJETO defaultSpeaker, e só depois o volume DESSE objeto muda.
                Um createBinding direto congelaria a barra no aparelho que era
                padrão quando o AGS subiu. */}
            <With value={createBinding(audio, "defaultSpeaker")}>
                {(sp: AstalWp.Endpoint | null) =>
                    sp ? (
                        <box
                            tooltipText={createComputed(
                                [createBinding(sp, "description"), volumePct(sp)],
                                (device, valor) =>
                                    `${device || "Saída de áudio"}\n${valor}\nclique para saídas e apps`,
                            )}
                        >
                            <label class="metricIcon" label={volumeGlyph(sp)} />
                            <label class="metricValue" label={volumePct(sp)} />
                        </box>
                    ) : (
                        <box>
                            <label class="metricIcon" label={ICON.volMuted} />
                            <label class="metricValue" label="--" />
                        </box>
                    )
                }
            </With>

            <popover class="volumePopover" $={(self) => (popover = self)}>
                <box orientation={Gtk.Orientation.VERTICAL} widthRequest={280}>
                    <label class="soundSection" xalign={0} label="Saídas" />

                    {/* Cada <For> mora numa caixa só dele, e não solto entre
                        irmãos estáticos: o For anexa os itens ao pai conforme
                        eles chegam, então com irmãos ele empurra a lista para
                        depois de todos — as saídas apareciam embaixo do botão
                        do mixer. A caixa dedicada devolve a posição ao grupo e
                        deixa a ordem interna com o For. */}
                    <box orientation={Gtk.Orientation.VERTICAL}>
                        {/* A saída padrão é marcada com a mesma barra branca de
                            2px que marca a workspace em foco e o alvo no menu
                            do tray. Clicar no nome troca o padrão. */}
                        <For each={speakers}>
                            {(ep: AstalWp.Endpoint) => (
                                <SoundRow
                                    node={ep}
                                    current={createBinding(ep, "isDefault")}
                                    onPick={() => (ep.isDefault = true)}
                                />
                            )}
                        </For>
                    </box>

                    {/* Some inteira quando nada está tocando: uma seção com
                        título e nenhum item é só ruído. */}
                    <box
                        class="soundApps"
                        orientation={Gtk.Orientation.VERTICAL}
                        visible={streams((list) => list.length > 0)}
                    >
                        {/* Filete separando as saídas dos apps. É o mesmo
                            recurso dos três grupos da barra: sem cor, só o
                            espaço não bastava para dizer que aqui começa
                            outra coisa. */}
                        <box class="soundDivider" />

                        <label class="soundSection" xalign={0} label="Aplicativos" />

                        <box orientation={Gtk.Orientation.VERTICAL}>
                            <For each={streams}>
                                {(st: AstalWp.Stream) => <SoundRow node={st} />}
                            </For>
                        </box>
                    </box>

                    <button
                        class="volumeMore"
                        onClicked={() => {
                            // Fecha antes de abrir: o mixer completo substitui
                            // este popover, não convive com ele.
                            popover.popdown()
                            execAsync("pavucontrol").catch(() => {})
                        }}
                    >
                        <label xalign={0} label="Abrir o mixer completo" />
                    </button>
                </box>
            </popover>
        </menubutton>
    )
}

/* ------------------------------------------------------------------- bar */

export default function Bar(gdkmonitor: Gdk.Monitor) {
    const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

    return (
        <window
            visible
            name="bar"
            class="Bar"
            gdkmonitor={gdkmonitor}
            exclusivity={Astal.Exclusivity.EXCLUSIVE}
            anchor={TOP | LEFT | RIGHT}
            application={app}
            /* A altura da barra vem DAQUI, da janela.
               Colocar heightRequest no centerbox não funciona: o
               gtk4-layer-shell dimensiona a superfície pela janela, e a
               camada continuava com 31px por mais que o filho pedisse 34.
               Verificável com `hyprctl layers`. */
            heightRequest={34}
        >
            <centerbox>
                <box $type="start" class="side">
                    <button
                        class="brand"
                        tooltipText={uptime((u) => `${HOST}  ·  Linux ${KERNEL}\nligado há ${u}`)}
                        onClicked={() => monitor("-r")}
                    >
                        <label label={ICON.arch} />
                    </button>
                    <Workspaces />
                </box>

                {/* Centro: mídia quando há player, título da janela quando não há. */}
                <box $type="center">
                    <Center />
                </box>

                {/*
                    Ordem da direita, do mais volátil para o mais estável:
                    ícones de app (tray) → leituras de sistema → estado → energia.
                    O tray vem primeiro porque é o único grupo cujo conteúdo é
                    imprevisível; deixá-lo na borda faria o resto dançar de posição
                    toda vez que um app abrisse ou fechasse.

                    A rede fica DEPOIS do filete e colada no power, não junto das
                    métricas: todo item daquele bloco é um par ícone+número, e a
                    rede é só ícone — um ímpar no meio de pares quebra o ritmo.
                    Encostada no power ela fica com o único outro item só-glifo da
                    barra, e o relógio, que é o que mais se lê, ganha a posição
                    logo após o filete, que é a mais fácil de achar.
                */}
                <box $type="end" class="side" halign={Gtk.Align.END}>
                    <SysTray />
                    <Divider />

                    <Metric
                        icon={ICON.cpu}
                        value={cpu}
                        tooltip={cpu((v) => `${CPU_MODEL}\n${v} em uso`)}
                        onClick={() => monitor("-r")}
                    />
                    <Metric
                        icon={ICON.mem}
                        value={mem}
                        tooltip={memTip}
                        onClick={() => monitor("-r")}
                    />
                    <Metric
                        icon={ICON.home}
                        value={diskHome}
                        tooltip={diskHomeTip((t) => `/home\n${t}`)}
                        onClick={() => monitor("-f")}
                    />
                    {/*
                        Spread de array em vez de `cond ? <Metric/> : <box/>`.
                        O <box/> vazio do else continuava sendo um filho de .side
                        e herdava a margem de 2px de cada lado — sobrava um vão
                        fantasma entre o disco e a rede em toda máquina sem o
                        segundo disco montado. Com o spread, quando não há
                        storage nada é criado.
                    */}
                    {hasStorage
                        ? [
                              <Metric
                                  icon={ICON.hdd}
                                  value={diskStorage}
                                  tooltip={diskStorageTip((t) => `${STORAGE}\n${t}`)}
                                  onClick={() => monitor("-f")}
                              />,
                          ]
                        : []}

                    <BateriaPeriferico />
                    <Volume />

                    <Divider />
                    <Clock />
                    <Network />

                    <button
                        class="power"
                        tooltipText="Desligar, reiniciar, suspender ou encerrar a sessão"
                        onClicked={() =>
                            execAsync([
                                `${GLib.get_home_dir()}/.config/hypr/scripts/power-menu.sh`,
                            ]).catch(() => {})
                        }
                    >
                        <label label={ICON.power} />
                    </button>
                </box>
            </centerbox>
        </window>
    )
}
