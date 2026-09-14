import { Gtk, Astal } from "ags/gtk4"
import { createBinding, createComputed, createState, With } from "ags"
import type { Accessor } from "ags"
import { createPoll } from "ags/time"
import AstalMpris from "gi://AstalMpris"
import { Card, type DesktopWidget } from "./Card"

/* Multimídia — o que está tocando, no canto da tela.
 *
 * MPRIS e não playerctl: é a mesma fonte (o padrão D-Bus
 * org.mpris.MediaPlayer2), só que sem um processo por leitura. O playerctl
 * seria um spawn a cada segundo só para saber a posição da faixa.
 */

const ICON = {
    music: "\u{F075A}",
    play: "\u{F040A}",
    pause: "\u{F03E4}",
    next: "\u{F04AD}",
    prev: "\u{F04AE}",
    shuffle: "\u{F049D}",
    shuffleOff: "\u{F049E}",
    repeat: "\u{F0456}",
    repeatOff: "\u{F0457}",
    repeatOne: "\u{F0458}",
}

const COVER = 72

const mpris = AstalMpris.get_default()

/* Quem é "o player" quando há mais de um.
 *
 * Isto existe porque a resposta muda sozinha: o Spotify fica aberto o dia
 * todo em pausa e um vídeo no navegador começa a tocar. Pegar `players[0]`
 * — o que quase toda config faz — deixaria o cartão mostrando a faixa
 * parada do Spotify enquanto o som que sai da máquina é outro.
 *
 * A eleição é: quem estiver TOCANDO; na falta de alguém tocando, o
 * primeiro da lista (assim um player pausado ainda aparece, com seus
 * controles funcionando). E ela precisa ser refeita em dois momentos
 * diferentes — quando a lista muda (player abriu/fechou) e quando o estado
 * de qualquer um deles muda (o vídeo começou). Por isso a assinatura em
 * notify::playback-status de cada player, refeita a cada mudança de lista:
 * sem ela o cartão só trocaria de player quando algum aplicativo abrisse.
 */
function elegerPlayer(): Accessor<AstalMpris.Player | null> {
    const [player, setPlayer] = createState<AstalMpris.Player | null>(null)
    let hooks: Array<[AstalMpris.Player, number]> = []

    const eleger = (ignorar?: AstalMpris.Player) => {
        const players = mpris.get_players().filter((p) => p !== ignorar)
        const tocando = players.find(
            (p) => p.playbackStatus === AstalMpris.PlaybackStatus.PLAYING,
        )
        setPlayer(tocando ?? players[0] ?? null)
    }

    const religar = (ignorar?: AstalMpris.Player) => {
        for (const [p, id] of hooks) p.disconnect(id)
        hooks = mpris
            .get_players()
            .filter((p) => p !== ignorar)
            .map((p) => [p, p.connect("notify::playback-status", () => eleger())] as [
                AstalMpris.Player,
                number,
            ])
        eleger(ignorar)
    }

    mpris.connect("player-added", () => religar())

    /* O player fechado chega como argumento e é passado adiante de
       propósito: nem toda implementação já o tirou de `get_players()` na
       hora de emitir o sinal, e reeleger um player morto deixa o cartão
       preso numa faixa que não existe mais. */
    mpris.connect("player-closed", (_: unknown, fechado: AstalMpris.Player) =>
        religar(fechado),
    )

    religar()
    return player
}

const player = elegerPlayer()

/* Sem player, sem cartão. Não é o caso de mostrar "nada tocando": o widget
   de desktop é decoração útil, e decoração vazia é só ruído em cima do
   papel de parede. */
const temPlayer = player((p) => p !== null)

const tempo = (segundos: number) => {
    if (!Number.isFinite(segundos) || segundos < 0) return "--:--"
    const s = Math.floor(segundos)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const r = s % 60
    return h > 0
        ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
        : `${m}:${String(r).padStart(2, "0")}`
}

/* A capa. Pode não existir (rádio, podcast sem arte, player que não manda
   nada) — e nesse caso o lugar dela continua ocupado pelo glifo, para o
   texto ao lado não pular de posição quando a faixa seguinte tiver arte. */
function Capa({ p }: { p: AstalMpris.Player }) {
    const arte = createBinding(p, "coverArt")

    return (
        <box class="cover" valign={Gtk.Align.START}>
            <With value={arte}>
                {(arquivo: string) =>
                    arquivo ? (
                        <image file={arquivo} pixelSize={COVER} />
                    ) : (
                        <label class="coverEmpty" label={ICON.music} />
                    )
                }
            </With>
        </box>
    )
}

function Controles({ p }: { p: AstalMpris.Player }) {
    const status = createBinding(p, "playbackStatus")
    const embaralhar = createBinding(p, "shuffleStatus")
    const repetir = createBinding(p, "loopStatus")

    /* `canControl` é a resposta do próprio player à pergunta "você aceita
       comando?". Um rádio web responde não. Sem checar, o botão existe,
       clica e não acontece nada — o pior tipo de botão. */
    const controlavel = createBinding(p, "canControl")

    return (
        <box class="controls">
            <button
                class="ctl small"
                tooltipText="Aleatório"
                sensitive={controlavel}
                onClicked={() => p.shuffle()}
            >
                <label
                    label={embaralhar((s) =>
                        s === AstalMpris.Shuffle.ON ? ICON.shuffle : ICON.shuffleOff,
                    )}
                    class={embaralhar((s) => (s === AstalMpris.Shuffle.ON ? "on" : "off"))}
                />
            </button>

            <button
                class="ctl"
                tooltipText="Anterior"
                sensitive={createBinding(p, "canGoPrevious")}
                onClicked={() => p.previous()}
            >
                <label label={ICON.prev} />
            </button>

            <button
                class="ctl main"
                tooltipText={status((s) =>
                    s === AstalMpris.PlaybackStatus.PLAYING ? "Pausar" : "Tocar",
                )}
                sensitive={controlavel}
                onClicked={() => p.play_pause()}
            >
                <label
                    label={status((s) =>
                        s === AstalMpris.PlaybackStatus.PLAYING ? ICON.pause : ICON.play,
                    )}
                />
            </button>

            <button
                class="ctl"
                tooltipText="Próxima"
                sensitive={createBinding(p, "canGoNext")}
                onClicked={() => p.next()}
            >
                <label label={ICON.next} />
            </button>

            <button
                class="ctl small"
                tooltipText="Repetir"
                sensitive={controlavel}
                onClicked={() => p.loop()}
            >
                <label
                    label={repetir((l) =>
                        l === AstalMpris.Loop.TRACK
                            ? ICON.repeatOne
                            : l === AstalMpris.Loop.PLAYLIST
                              ? ICON.repeat
                              : ICON.repeatOff,
                    )}
                    class={repetir((l) =>
                        l === AstalMpris.Loop.NONE || l === AstalMpris.Loop.UNSUPPORTED
                            ? "off"
                            : "on",
                    )}
                />
            </button>
        </box>
    )
}

function Tocando({ p }: { p: AstalMpris.Player }) {
    const titulo = createBinding(p, "title").as((t) => t || "Sem título")
    const artista = createBinding(p, "artist").as((a) => a || "")
    const duracao = createBinding(p, "length")

    /* Posição por polling, e não por sinal: o MPRIS só notifica `Position`
       quando alguém PULA na faixa — tocar do começo ao fim não emite nada,
       por desenho do protocolo (senão seria um sinal por segundo em D-Bus
       para todo mundo ouvindo). Quem quer uma barra que anda tem que
       perguntar. Um segundo é a menor granularidade que o texto ao lado
       mostra, então não adianta perguntar mais rápido. */
    const bruta = createPoll(0, 1000, () => p.position)

    /* Posição travada na duração. Player nenhum garante que uma coisa não
       passe da outra: no fim da faixa o `Position` pode vir alguns décimos
       adiante do `mpris:length`, e aí o texto mostra 3:35 de uma música de
       3:34 e a bolinha tenta sair da barra. */
    const posicao = createComputed([bruta, duracao], (pos: number, dur: number) =>
        dur > 0 ? Math.min(pos, dur) : pos,
    )

    /* Faixa sem duração conhecida (stream ao vivo, rádio) devolve -1 ou 0:
       aí não existe "quanto falta", e uma barra que nunca enche é pior que
       barra nenhuma. */
    const temBarra = duracao((d) => d > 0)

    return (
        <box class="media">
            <Capa p={p} />

            <box class="info" orientation={Gtk.Orientation.VERTICAL} hexpand>
                <label class="title" xalign={0} maxWidthChars={26} ellipsize={3} label={titulo} />
                <label
                    class="artist"
                    xalign={0}
                    maxWidthChars={30}
                    ellipsize={3}
                    label={artista}
                    visible={artista((a) => a !== "")}
                />

                <slider
                    class="seek"
                    hexpand
                    visible={temBarra}
                    sensitive={createBinding(p, "canSeek")}
                    min={0}
                    max={duracao((d) => (d > 0 ? d : 1))}
                    value={posicao}
                    /* "change-value" e não "value-changed": o primeiro só
                       dispara por ação do usuário, o segundo dispara também
                       quando o polling acima escreve a posição nova — e aí
                       cada segundo de música viraria um seek para o lugar
                       onde a faixa já está. O valor novo chega como terceiro
                       argumento do sinal do Gtk.Range; a queda para
                       `self.value` é a rede de segurança para o caso de vir
                       só o widget. */
                    onChangeValue={(self: Astal.Slider, _t: Gtk.ScrollType, valor: number) => {
                        p.position = Number.isFinite(valor) ? valor : self.value
                    }}
                />

                <box class="times" visible={temBarra}>
                    <label class="pos" xalign={0} hexpand label={posicao((v) => tempo(v))} />
                    <label class="len" xalign={1} label={duracao((d) => tempo(d))} />
                </box>

                <Controles p={p} />
            </box>
        </box>
    )
}

const Media: DesktopWidget = {
    id: "media",
    corner: "bottom-left",
    visible: temPlayer,
    render: () => (
        <Card
            icon={ICON.music}
            title={player((p) => p?.identity || "Multimídia")}
            visible={temPlayer}
        >
            {/* `With` porque o player inteiro é trocado, não só os dados
                dele: quando a eleição muda de aplicativo, toda ligação
                presa no player velho tem que morrer junto. */}
            <With value={player}>
                {(p: AstalMpris.Player | null) => (p ? <Tocando p={p} /> : <box />)}
            </With>
        </Card>
    ),
}

export default Media
