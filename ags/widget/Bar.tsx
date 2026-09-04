import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createBinding, createComputed, For, With } from "ags"
import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import GLib from "gi://GLib"
import AstalHyprland from "gi://AstalHyprland"
import AstalMpris from "gi://AstalMpris"
import AstalWp from "gi://AstalWp"
import AstalNetwork from "gi://AstalNetwork"
import AstalTray from "gi://AstalTray"

// Abre um app numa workspace vazia — mesmo comportamento dos on-click da waybar.
const spawnEmpty = (cmd: string) =>
    execAsync(["hyprctl", "dispatch", "exec", `[workspace empty] ${cmd}`]).catch(() => {})

/* ------------------------------------------------------------------ left */

// Workspaces fixas de 1 a 5, sempre visíveis.
//
// Antes isto era um <For> sobre hypr.workspaces, que só lista as que EXISTEM —
// a barra ficava com um número só no boot e ia crescendo conforme você abria
// janelas. Uma régua fixa dá posição estável para o olho.
const WORKSPACES = [1, 2, 3, 4, 5]

function Workspaces() {
    const hypr = AstalHyprland.get_default()
    const focused = createBinding(hypr, "focusedWorkspace")
    const existing = createBinding(hypr, "workspaces")

    return (
        <box class="workspaces" valign={Gtk.Align.CENTER}>
            {WORKSPACES.map((id) => (
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
                    onClicked={() => hypr.dispatch("workspace", `${id}`)}
                >
                    <label label={`${id}`} />
                </button>
            ))}
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

    return (
        <box class="clock" tooltipText={today}>
            <label class="metricIcon" label={ICON.clock} />
            <label class="clockValue" label={now} />
        </box>
    )
}

/* ----------------------------------------------------------------- right */

// Player fixo no Spotify, como o spotify-status.sh fazia com playerctl -p.
function Media({ player, visible }: { player: AstalMpris.Player; visible: any }) {
    const title = createComputed(
        [createBinding(player, "artist"), createBinding(player, "title")],
        (artist, name) => (artist ? `${artist} — ${name}` : (name ?? "")),
    )

    return (
        <box class="media" visible={visible}>
            <button class="mediaStep" onClicked={() => player.previous()}>
                <label label="‹" />
            </button>

            <button class="mediaTitle" onClicked={() => player.play_pause()}>
                <label maxWidthChars={28} ellipsize={3} label={title} />
            </button>

            <button class="mediaStep" onClicked={() => player.next()}>
                <label label="›" />
            </button>
        </box>
    )
}

// Título da janela em foco.
//
// Ele existe aqui porque não existe em mais lugar nenhum: descartamos o
// hyprbars e os apps Qt rodam sem decoração própria, então kitty e afins não
// têm barra de título. A barra é o único lugar onde esse dado cabe.
//
// Cinza secundário, não branco: o branco deste tema é do marcador de foco e
// do relógio. Um título branco competiria com os dois.
function WindowTitle({ visible }: { visible: any }) {
    const hypr = AstalHyprland.get_default()
    const focused = createBinding(hypr, "focusedClient")

    return (
        <box class="windowTitle" visible={visible}>
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
                            label={createBinding(client, "title")}
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
    const spotify = AstalMpris.Player.new("spotify")
    const playing = createBinding(spotify, "available")

    return (
        <box>
            <Media player={spotify} visible={playing} />
            <WindowTitle visible={playing((p) => !p)} />
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
    power: "\u{23FB}",
}

// O tooltip carrega o que o número sozinho não diz: o modelo da CPU, os GiB
// absolutos, o tamanho real do disco. O ícone dá o "o quê", o número dá a
// grandeza, o tooltip dá o contexto — e o clique abre o btop na aba certa.
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

function SysTray() {
    const tray = AstalTray.get_default()
    const items = createBinding(tray, "items")

    return (
        <box class="tray">
            <For each={items}>
                {(item: AstalTray.TrayItem) => (
                    <menubutton
                        class="trayItem"
                        tooltipMarkup={createBinding(item, "tooltipMarkup")}
                        menuModel={createBinding(item, "menuModel")}
                        $={(self) =>
                            self.insert_action_group("dbusmenu", item.actionGroup)
                        }
                    >
                        <image gicon={createBinding(item, "gicon")} />
                    </menubutton>
                )}
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
            if (connectivity !== AstalNetwork.Connectivity.FULL) return "Rede offline"
            return primary === AstalNetwork.Primary.WIFI ? "Wi-Fi conectado" : "Ethernet conectada"
        },
    )

    return (
        <box class="metric netOnly" tooltipText={tip}>
            <label class="metricIcon" label={icon} />
        </box>
    )
}

// Volume: ícone que acompanha o nível, mais o valor em %.
function Volume() {
    const speaker = AstalWp.get_default()!.audio.defaultSpeaker

    const icon = createComputed(
        [createBinding(speaker, "volume"), createBinding(speaker, "mute")],
        (volume, mute) => {
            if (mute) return ICON.volMuted
            if (volume < 0.01) return ICON.volLow
            if (volume < 0.5) return ICON.volMed
            return ICON.volHigh
        },
    )

    const pct = createComputed(
        [createBinding(speaker, "volume"), createBinding(speaker, "mute")],
        (volume, mute) => (mute ? "--" : `${Math.round(volume * 100)}%`),
    )

    const tip = createComputed(
        [
            createBinding(speaker, "description"),
            createBinding(speaker, "volume"),
            createBinding(speaker, "mute"),
        ],
        (device, volume, mute) => {
            const estado = mute ? "mudo" : `volume em ${Math.round(volume * 100)}%`
            return `${device || "Saída de áudio"}\n${estado}\nclique para o controle`
        },
    )

    // Slider de verdade, num popover ancorado sob o ícone.
    //
    // Isto NÃO cabe no Walker: ele é um renderizador de lista, não tem
    // primitiva de slider — o provider wireplumber do elephant só oferece
    // "subir/descer volume" como itens com atalho, o que é pior do que já
    // temos. Aqui é um Gtk.Scale arrastável, ligado nos dois sentidos ao
    // wireplumber: mexer aqui muda o sistema, e mudar por fora (tecla de
    // mídia, pavucontrol) move o slider.
    const bindScale = (scale: Gtk.Scale) => {
        scale.set_range(0, 1)
        scale.set_increments(0.05, 0.1)
        scale.set_draw_value(false)
        scale.set_value(speaker.volume)

        let interno = false

        scale.connect("value-changed", () => {
            if (interno) return
            speaker.volume = scale.get_value()
        })

        // Guarda contra laço: sem o flag, atualizar o slider a partir do
        // wireplumber dispara value-changed, que reescreve o volume, que
        // emite de novo.
        speaker.connect("notify::volume", () => {
            interno = true
            scale.set_value(speaker.volume)
            interno = false
        })
    }

    return (
        <menubutton class="metric volume" tooltipText={tip}>
            <box>
                <label class="metricIcon" label={icon} />
                <label class="metricValue" label={pct} />
            </box>

            <popover class="volumePopover">
                <box orientation={Gtk.Orientation.VERTICAL} widthRequest={230}>
                    <box class="volumeHead">
                        <label
                            class="volumeDevice"
                            maxWidthChars={24}
                            ellipsize={3}
                            xalign={0}
                            hexpand
                            label={createBinding(speaker, "description").as(
                                (d) => d || "Saída de áudio",
                            )}
                        />
                        <label class="volumePct" label={pct} />
                    </box>

                    <box class="volumeRow">
                        <button
                            class="volumeMute"
                            onClicked={() => (speaker.mute = !speaker.mute)}
                        >
                            <label label={icon} />
                        </button>

                        <Gtk.Scale
                            hexpand
                            orientation={Gtk.Orientation.HORIZONTAL}
                            $={bindScale}
                        />
                    </box>

                    <button
                        class="volumeMore"
                        onClicked={() => execAsync("pwvucontrol").catch(() => {})}
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
                        onClicked={() => spawnEmpty("kitty -e btop")}
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
                    ícones de app (tray) → leituras de sistema → relógio → energia.
                    O tray vem primeiro porque é o único grupo cujo conteúdo é
                    imprevisível; deixá-lo na borda faria o resto dançar de posição
                    toda vez que um app abrisse ou fechasse.
                */}
                <box $type="end" class="side" halign={Gtk.Align.END}>
                    <SysTray />
                    <Divider />

                    <Metric
                        icon={ICON.cpu}
                        value={cpu}
                        tooltip={cpu((v) => `${CPU_MODEL}\n${v} em uso`)}
                        onClick={() => spawnEmpty("kitty -e btop --preset 1")}
                    />
                    <Metric
                        icon={ICON.mem}
                        value={mem}
                        tooltip={memTip}
                        onClick={() => spawnEmpty("kitty -e btop --preset 2")}
                    />
                    <Metric
                        icon={ICON.home}
                        value={diskHome}
                        tooltip={diskHomeTip((t) => `/home\n${t}`)}
                        onClick={() => spawnEmpty("kitty -e btop --preset 5")}
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
                                  onClick={() => spawnEmpty("kitty -e btop --preset 5")}
                              />,
                          ]
                        : []}

                    <Network />
                    <Volume />

                    <Divider />
                    <Clock />

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
