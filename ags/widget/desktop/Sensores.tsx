import { Gtk } from "ags/gtk4"
import { createComputed } from "ags"
import type { Accessor } from "ags"
import { createPoll } from "ags/time"
import { execAsync } from "ags/process"
import GLib from "gi://GLib"
import { Card, SEMPRE, type DesktopWidget } from "./Card"

/* Sensores — o que a barra não mostra.
 *
 * A barra já responde "quanto de CPU e de RAM está em uso". O que falta nela
 * é CALOR, e a GPU inteira. Numa máquina que compila e roda jogo por Proton,
 * esse é o número que explica um travamento que a carga sozinha não explica.
 */

const ICON = {
    term: "\u{F050F}", // thermometer
    chip: "\u{F035B}", // cpu (o mesmo da barra, de propósito)
    gpu: "\u{F08AE}", // expansion-card
}

function texto(caminho: string): string {
    try {
        const [ok, dados] = GLib.file_get_contents(caminho)
        return ok ? new TextDecoder().decode(dados).trim() : ""
    } catch {
        /* Ausência é normal aqui: o caminho varia por máquina e por boot.
           Quem chama trata o vazio. */
        return ""
    }
}

/* ------------------------------------------------------------------- cpu */

/* O hwmon do coretemp é descoberto pelo NOME, não pelo número.
 *
 * `/sys/class/hwmon/hwmonN` é atribuído na ordem em que os módulos carregam,
 * e essa ordem muda entre boots. Nesta máquina o coretemp caiu no hwmon2
 * hoje; gravar "hwmon2" no código é escrever um widget que um dia mostra a
 * temperatura do chipset — ou nada, sem avisar. */
const CORETEMP = (() => {
    const base = "/sys/class/hwmon"
    try {
        const dir = GLib.Dir.open(base, 0)
        let nome: string | null
        while ((nome = dir.read_name()) !== null) {
            if (texto(`${base}/${nome}/name`) === "coretemp") return `${base}/${nome}`
        }
    } catch {
        /* sem /sys/class/hwmon: máquina virtual, container */
    }
    return null
})()

/* Os rótulos (`Package id 0`, `Core 0`...) são lidos UMA vez: eles não mudam
   enquanto a máquina está ligada, e é o `_input` ao lado que varia. Ler os
   dois a cada ciclo dobraria o número de arquivos abertos por segundo sem
   nenhuma informação nova. */
const CPU = (() => {
    let pacote: string | null = null
    const nucleos: string[] = []
    let limite = 84

    if (CORETEMP) {
        for (let i = 1; i <= 32; i++) {
            const rotulo = texto(`${CORETEMP}/temp${i}_label`)
            if (!rotulo) continue
            if (rotulo.startsWith("Package")) pacote = `${CORETEMP}/temp${i}_input`
            else if (rotulo.startsWith("Core")) nucleos.push(`${CORETEMP}/temp${i}_input`)
        }
        const max = Number(texto(`${CORETEMP}/temp1_max`)) / 1000
        if (Number.isFinite(max) && max > 0) limite = max
    }

    return { pacote, nucleos, limite }
})()

type LeituraCpu = { pacote: number; menor: number; maior: number } | null

/* 2s e não 1s: temperatura de silício não muda de forma interessante mais
   rápido que isso, e o widget fica coberto por janela a maior parte do
   tempo. */
const cpu = createPoll<LeituraCpu>(null, 2000, () => {
    if (!CPU.pacote && CPU.nucleos.length === 0) return null

    const lidos = CPU.nucleos.map((c) => Number(texto(c)) / 1000).filter(Number.isFinite)
    const pacote = CPU.pacote ? Number(texto(CPU.pacote)) / 1000 : NaN

    if (lidos.length === 0 && !Number.isFinite(pacote)) return null

    return {
        pacote: Number.isFinite(pacote) ? pacote : Math.max(...lidos),
        menor: lidos.length ? Math.min(...lidos) : pacote,
        maior: lidos.length ? Math.max(...lidos) : pacote,
    }
})

/* ------------------------------------------------------------------- gpu */

const TEM_NVIDIA = GLib.find_program_in_path("nvidia-smi") !== null

const QUERY = [
    "nvidia-smi",
    "--query-gpu=temperature.gpu,utilization.gpu,memory.used,memory.total,power.draw",
    "--format=csv,noheader,nounits",
]

type LeituraGpu = {
    temp: number
    uso: number
    vramUsada: number
    vramTotal: number
    watts: number
} | null

/* A NVIDIA proprietária não publica nada em /sys que sirva: não há hwmon sob
   /sys/class/drm/cardN/device para ela. Então aqui é spawn mesmo, e é por
   isso que o intervalo é o maior dos dois — 3s. */
let falhas = 0

const gpu = createPoll<LeituraGpu>(null, 3000, async (anterior) => {
    if (!TEM_NVIDIA) return null

    try {
        const saida = await execAsync(QUERY)
        const n = saida.trim().split(",").map((x) => Number(x.trim()))
        if (n.length < 4 || !n.slice(0, 4).every(Number.isFinite)) throw new Error("resposta torta")

        falhas = 0
        return {
            temp: n[0],
            uso: n[1],
            vramUsada: n[2],
            vramTotal: n[3],
            watts: Number.isFinite(n[4]) ? n[4] : 0,
        }
    } catch {
        /* Uma falha isolada (driver recarregando, GPU acordando) não apaga a
           linha: apagar e voltar a cada tropeço é pisca-pisca. Mas segurar o
           número velho para sempre é MENTIR sobre a temperatura de uma peça
           que pode estar esquentando — por isso o widget desiste na terceira
           falha seguida e some. */
        falhas += 1
        return falhas >= 3 ? null : anterior
    }
})

/* ----------------------------------------------------------------- card */

function Linha({
    icone,
    nome,
    valor,
    detalhe,
    quente,
}: {
    icone: string
    nome: string
    valor: Accessor<string>
    detalhe: Accessor<string>
    quente?: Accessor<boolean>
}) {
    return (
        <box class="sensorRow">
            <label class="sensorIcon" label={icone} />
            <label class="sensorName" label={nome} />
            <label
                /* Sem vermelho: o tema não tem cor nenhuma. Quente aqui é o
                   branco puro, o mesmo peso que a barra usa para foco — o
                   número salta da linha sem inventar uma paleta. */
                class={quente ? quente((q) => (q ? "sensorTemp quente" : "sensorTemp")) : "sensorTemp"}
                label={valor}
            />
            <label class="sensorInfo" hexpand xalign={1} label={detalhe} />
        </box>
    )
}

const grau = (v: number) => `${Math.round(v)}°`

const Sensores: DesktopWidget = {
    id: "sensores",
    corner: "bottom-right",
    visible: SEMPRE,
    render: () => (
        <Card icon={ICON.term} title="Sensores" visible={SEMPRE}>
            <box class="sensores" orientation={Gtk.Orientation.VERTICAL}>
                <Linha
                    icone={ICON.chip}
                    nome="CPU"
                    valor={cpu((c) => (c ? grau(c.pacote) : "--"))}
                    quente={cpu((c) => (c ? c.pacote >= CPU.limite : false))}
                    detalhe={cpu((c) =>
                        c && CPU.nucleos.length > 0
                            ? `núcleos ${grau(c.menor)}–${grau(c.maior)}`
                            : "",
                    )}
                />

                {/* Sem NVIDIA a linha não existe — e não é um "N/A" ocupando
                    espaço para dizer que não tem nada a dizer. Spread de
                    array pelo mesmo motivo da barra: um <box/> vazio no else
                    ainda herdaria a margem da linha e deixaria um vão. */}
                {TEM_NVIDIA ? [<Linha
                    icone={ICON.gpu}
                    nome="GPU"
                    valor={gpu((g) => (g ? grau(g.temp) : "--"))}
                    quente={gpu((g) => (g ? g.temp >= 83 : false))}
                    detalhe={createComputed([gpu], (g: LeituraGpu) =>
                        g
                            ? `${g.uso}%  ·  ${(g.vramUsada / 1024).toFixed(1)}/${(
                                  g.vramTotal / 1024
                              ).toFixed(1)} GiB  ·  ${Math.round(g.watts)} W`
                            : "",
                    )}
                />]
                    : []}
            </box>
        </Card>
    ),
}

export default Sensores
