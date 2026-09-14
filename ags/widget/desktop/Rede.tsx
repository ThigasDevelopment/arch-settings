import { Gtk } from "ags/gtk4"
import type { Accessor } from "ags"
import { createPoll } from "ags/time"
import GLib from "gi://GLib"
import { Card, SEMPRE, type DesktopWidget } from "./Card"

/* Rede — o que passou pelo cabo.
 *
 * A barra tem um ícone que diz "conectado" e nada mais. Isso responde à
 * pergunta errada: raramente se quer saber SE há rede (dá para perceber sem
 * widget nenhum), e com frequência se quer saber se alguma coisa ainda está
 * baixando, ou quem está comendo a banda.
 */

const ICON = {
    lan: "\u{F0200}", // ethernet
    baixa: "\u{F0045}", // arrow-down
    sobe: "\u{F005D}", // arrow-up
}

const NET = "/sys/class/net"

function texto(caminho: string): string {
    try {
        const [ok, dados] = GLib.file_get_contents(caminho)
        return ok ? new TextDecoder().decode(dados).trim() : ""
    } catch {
        return ""
    }
}

/* A interface é reescolhida a cada ciclo, e não fixada na primeira leitura.
 *
 * Cabo caindo, dongle USB entrando, VPN subindo: são todos eventos que trocam
 * por onde o tráfego sai, sem aviso e sem sinal nenhum para ouvir. Ler o
 * diretório uma vez por segundo é uma listagem de duas entradas nesta
 * máquina — mais barato que qualquer forma de acompanhar isso por evento. */
function interfaceAtiva(): string | null {
    try {
        const dir = GLib.Dir.open(NET, 0)
        let nome: string | null
        let reserva: string | null = null

        while ((nome = dir.read_name()) !== null) {
            if (nome === "lo") continue
            if (texto(`${NET}/${nome}/operstate`) === "up") return nome
            /* Guardada para o caso de nenhuma estar no ar: dá para mostrar o
               nome da placa junto do "sem conexão", que é mais informativo
               que um cartão vazio. */
            if (!reserva) reserva = nome
        }
        return reserva
    } catch {
        return null
    }
}

type Amostra = {
    iface: string | null
    up: boolean
    rx: number
    tx: number
    taxaRx: number
    taxaTx: number
    t: number
}

const ZERO: Amostra = { iface: null, up: false, rx: 0, tx: 0, taxaRx: 0, taxaTx: 0, t: 0 }

const rede = createPoll<Amostra>(ZERO, 1000, (anterior) => {
    const iface = interfaceAtiva()
    /* Relógio monotônico: o de parede pode andar para trás (NTP, fuso) e
       fazer o dt virar negativo — taxa negativa, ou divisão por zero. */
    const t = GLib.get_monotonic_time() / 1e6

    if (!iface) return { ...ZERO, t }

    const rx = Number(texto(`${NET}/${iface}/statistics/rx_bytes`))
    const tx = Number(texto(`${NET}/${iface}/statistics/tx_bytes`))
    const up = texto(`${NET}/${iface}/operstate`) === "up"

    if (!Number.isFinite(rx) || !Number.isFinite(tx)) return { ...anterior, iface, up, t }

    const dt = t - anterior.t

    /* Três condições para a taxa valer: mesma interface, tempo andou, e o
       contador não voltou. Os contadores do kernel ZERAM quando o link cai e
       sobe de novo — sem a última checagem, reconectar o cabo imprimiria um
       pico de vários MiB/s que nunca existiu. */
    const comparavel = anterior.iface === iface && dt > 0
    const taxaRx = comparavel && rx >= anterior.rx ? (rx - anterior.rx) / dt : 0
    const taxaTx = comparavel && tx >= anterior.tx ? (tx - anterior.tx) / dt : 0

    return { iface, up, rx, tx, taxaRx, taxaTx, t }
})

const taxa = (bps: number) => {
    if (bps >= 1048576) return `${(bps / 1048576).toFixed(1)} MiB/s`
    if (bps >= 1024) return `${Math.round(bps / 1024)} KiB/s`
    return `${Math.round(bps)} B/s`
}

const total = (b: number) =>
    b >= 1073741824 ? `${(b / 1073741824).toFixed(1)} GiB` : `${(b / 1048576).toFixed(1)} MiB`

function Taxa({ icone, valor }: { icone: string; valor: Accessor<string> }) {
    return (
        <box class="netRate" hexpand>
            <label class="netArrow" label={icone} />
            <label class="netValue" label={valor} />
        </box>
    )
}

const Rede: DesktopWidget = {
    id: "rede",
    corner: "bottom-right",
    visible: SEMPRE,
    render: () => (
        <Card
            icon={ICON.lan}
            title={rede((r) => (r.iface ? `Rede · ${r.iface}` : "Rede"))}
            visible={SEMPRE}
        >
            <box class="rede" orientation={Gtk.Orientation.VERTICAL}>
                <box class="netRates">
                    <Taxa icone={ICON.baixa} valor={rede((r) => (r.up ? taxa(r.taxaRx) : "--"))} />
                    <Taxa icone={ICON.sobe} valor={rede((r) => (r.up ? taxa(r.taxaTx) : "--"))} />
                </box>

                {/* Os contadores do /sys são desde que o LINK subiu, não desde
                    o boot nem desde que o widget abriu — por isso o rótulo é
                    "acumulado" e não "hoje". Dizer "hoje" seria mentira toda
                    vez que o cabo tivesse caído. */}
                <label
                    class="netTotal"
                    xalign={0}
                    label={rede((r) =>
                        r.up
                            ? `acumulado   ${ICON.baixa} ${total(r.rx)}   ${ICON.sobe} ${total(r.tx)}`
                            : "sem conexão",
                    )}
                />
            </box>
        </Card>
    ),
}

export default Rede
