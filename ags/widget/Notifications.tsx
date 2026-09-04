import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState, For } from "ags"
import { timeout, Timer } from "ags/time"
import GLib from "gi://GLib"
import AstalNotifd from "gi://AstalNotifd"

// Quanto tempo cada urgência fica na tela.
//
// Crítica é 0 = não sai sozinha. O padrão freedesktop diz que urgência
// crítica permanece até o usuário agir, e a versão anterior quebrava isso
// dando os mesmos 5s para todo mundo: um aviso de bateria acabando sumia
// junto com um "download concluído".
const LIFETIME: Record<number, number> = {
    [AstalNotifd.Urgency.LOW]: 4000,
    [AstalNotifd.Urgency.NORMAL]: 6000,
    [AstalNotifd.Urgency.CRITICAL]: 0,
}

// Pilha limitada. Sem teto, uma rajada (build quebrando, sync de arquivos)
// empurra a coluna para fora da tela e as mais recentes — justamente as que
// importam — ficam invisíveis embaixo da barra.
const MAX = 4

// Duração do recolhimento na saída. Precisa bater com o transitionDuration
// do revealer: é este número que segura a notificação na lista tempo
// suficiente para a animação terminar antes do widget ser destruído.
const ANIM = 220

// Quem sabe fechar cada notificação com animação. O daemon avisa a resolução
// por id, não por widget, então o componente precisa deixar aqui um jeito de
// ser alcançado — sem isto o único caminho é destruir o widget na hora, que é
// exatamente o "some sem efeito de saída".
const closers = new Map<number, () => void>()

// O hint image-path chega das DUAS formas e nada no protocolo obriga uma ou
// outra: caminho de arquivo (capa de álbum, avatar, print) ou nome de ícone
// do tema — o `notify-send -i firefox` manda "firefox" por este mesmo hint.
// Tratar tudo como caminho faz o ícone sumir em silêncio, que era o defeito.
const isPath = (s: string) => s.startsWith("/") || s.startsWith("file://")

function Notification({ n }: { n: AstalNotifd.Notification }) {
    const actions = n.get_actions()

    // O app pode pedir um tempo próprio; só caímos no nosso default quando
    // ele não pede nada. Respeitar isso é metade do "padrão".
    const life = n.expireTimeout > 0 ? n.expireTimeout : (LIFETIME[n.urgency] ?? 6000)

    let timer: Timer | null = null

    const disarm = () => {
        timer?.cancel()
        timer = null
    }

    const arm = () => {
        disarm()
        if (life > 0) timer = timeout(life, () => n.dismiss())
    }

    const setup = (self: Gtk.Widget) => {
        arm()

        // Passar o mouse por cima segura o relógio. É o que torna a
        // notificação legível: sem isso, ler um corpo de três linhas é uma
        // corrida contra o timer, e clicar numa ação é sorte.
        const hover = new Gtk.EventControllerMotion()
        hover.connect("enter", disarm)
        hover.connect("leave", arm)
        self.add_controller(hover)

        // Clique no corpo: invoca a ação "default" se o app tiver mandado uma
        // (é a convenção do protocolo — abrir a conversa, focar a janela),
        // senão apenas descarta. Antes não havia jeito nenhum de tirar uma
        // notificação da tela além de esperar.
        const click = new Gtk.GestureClick({ button: Gdk.BUTTON_PRIMARY })
        click.connect("pressed", () => {
            disarm()
            if (actions.some((a) => a.id === "default")) n.invoke("default")
            else n.dismiss()
        })
        self.add_controller(click)

        self.connect("destroy", disarm)
    }

    // Caminho vira miniatura: é conteúdo, identifica a notificação.
    // Nome de ícone vira selo no cabeçalho: é identidade do app, do mesmo
    // peso do nome que está do lado.
    const thumb = n.image && isPath(n.image) ? n.image : ""
    const badge = thumb ? "" : n.image || n.appIcon || ""

    let card: Gtk.Widget

    // O revealer nasce JÁ revelado de propósito: a entrada continua sendo a
    // animação de camada do Hyprland, que é a que você aprovou. Somar uma
    // segunda animação aqui faria a primeira notificação entrar duas vezes.
    // Ele existe só para o caminho de volta.
    const reveal = (self: Gtk.Revealer) => {
        const close = () => {
            // A altura recolhe (o revealer) e o cartão desbota (o CSS) ao
            // mesmo tempo. Só o recolhimento parece um esmagamento; só o
            // desbotamento deixa um buraco na pilha até o widget sumir.
            card.add_css_class("closing")
            self.set_reveal_child(false)
        }

        closers.set(n.id, close)

        // Só apaga se o fechador ainda for o nosso: uma notificação
        // substituída (mesmo id, conteúdo novo) monta o componente de novo, e
        // o destroy do antigo não pode levar o registro do atual junto.
        self.connect("destroy", () => {
            if (closers.get(n.id) === close) closers.delete(n.id)
        })
    }

    return (
        <revealer
            revealChild
            transitionType={Gtk.RevealerTransitionType.SLIDE_UP}
            transitionDuration={ANIM}
            $={reveal}
        >
        <box
            class={n.urgency === AstalNotifd.Urgency.CRITICAL ? "notification critical" : "notification"}
            orientation={Gtk.Orientation.VERTICAL}
            $={(self) => {
                card = self
                setup(self)
            }}
        >
            <box class="header">
                {badge ? [<image class="appIcon" iconName={badge} />] : []}
                <label class="appName" label={n.appName || "sistema"} />
                <label
                    class="time"
                    hexpand
                    halign={Gtk.Align.END}
                    label={GLib.DateTime.new_from_unix_local(n.time).format("%H:%M") ?? ""}
                />
            </box>

            <box class="content">
                {/* A miniatura (capa de álbum, avatar, print) fica à esquerda do
                    texto, como em qualquer daemon: é ela que identifica a
                    notificação antes de você ler uma palavra. */}
                {thumb ? [<image class="thumb" file={thumb} pixelSize={40} valign={Gtk.Align.START} />] : []}

                <box orientation={Gtk.Orientation.VERTICAL} hexpand>
                    <label class="summary" xalign={0} wrap label={n.summary} />

                    {/* useMarkup porque o corpo aceita um subconjunto de markup
                        pelo protocolo (<b>, <i>, <a>). Sem isto o usuário lê as
                        tags cruas na tela. */}
                    {n.body ? [<label class="body" xalign={0} wrap useMarkup label={n.body} />] : []}
                </box>
            </box>

            {actions.length > 0 ? (
                <box class="actions">
                    {actions.map((action) => (
                        <button hexpand onClicked={() => n.invoke(action.id)}>
                            <label label={action.label} />
                        </button>
                    ))}
                </box>
            ) : (
                <box />
            )}
        </box>
        </revealer>
    )
}

export default function Notifications(gdkmonitor: Gdk.Monitor) {
    const notifd = AstalNotifd.get_default()

    // O AGS assume o papel do swaync: ele é o daemon de notificação agora.
    // ignoreTimeout entrega o controle do relógio para cá — é o que permite
    // segurar a notificação no hover e manter a crítica na tela.
    notifd.ignoreTimeout = true

    const [list, setList] = createState<AstalNotifd.Notification[]>([])

    notifd.connect("notified", (_, id: number) => {
        const n = notifd.get_notification(id)
        if (!n) return

        // O corte é aqui, não no CSS: widget fora da tela ainda custa
        // relógio e redesenho.
        setList((prev) => [n, ...prev.filter((p) => p.id !== id)].slice(0, MAX))
    })

    notifd.connect("resolved", (_, id: number) => {
        const drop = () => setList((prev) => prev.filter((n) => n.id !== id))
        const close = closers.get(id)

        // Sem fechador registrado (notificação já cortada pelo MAX, por
        // exemplo) não há o que animar: sai direto.
        if (!close) return drop()

        close()
        timeout(ANIM, drop)
    })

    const { TOP, RIGHT } = Astal.WindowAnchor

    return (
        <window
            visible={list((items) => items.length > 0)}
            name="notifications"
            class="NotificationPopups"
            gdkmonitor={gdkmonitor}
            exclusivity={Astal.Exclusivity.NORMAL}
            anchor={TOP | RIGHT}
            application={app}
        >
            <box class="notifications" orientation={Gtk.Orientation.VERTICAL}>
                <For each={list}>{(n: AstalNotifd.Notification) => <Notification n={n} />}</For>
            </box>
        </window>
    )
}
