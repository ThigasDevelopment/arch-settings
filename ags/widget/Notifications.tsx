import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { createState, For } from "ags"
import { timeout } from "ags/time"
import GLib from "gi://GLib"
import AstalNotifd from "gi://AstalNotifd"

const TIMEOUT = 5000

function Notification({ n }: { n: AstalNotifd.Notification }) {
    const actions = n.get_actions()

    return (
        <box class="notification" orientation={Gtk.Orientation.VERTICAL}>
            <box class="header">
                <label class="appName" label={n.appName || "sistema"} />
                <label
                    class="time"
                    hexpand
                    halign={Gtk.Align.END}
                    label={GLib.DateTime.new_from_unix_local(n.time).format("%H:%M") ?? ""}
                />
            </box>

            <label class="summary" xalign={0} wrap label={n.summary} />

            {n.body ? <label class="body" xalign={0} wrap label={n.body} /> : <box />}

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
    )
}

export default function Notifications(gdkmonitor: Gdk.Monitor) {
    const notifd = AstalNotifd.get_default()

    // O AGS assume o papel do swaync: ele é o daemon de notificação agora.
    notifd.ignoreTimeout = true

    const [list, setList] = createState<AstalNotifd.Notification[]>([])

    notifd.connect("notified", (_, id: number) => {
        const n = notifd.get_notification(id)
        if (!n) return

        setList((prev) => [n, ...prev])
        timeout(TIMEOUT, () => n.dismiss())
    })

    notifd.connect("resolved", (_, id: number) => {
        setList((prev) => prev.filter((n) => n.id !== id))
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
