import app from "ags/gtk4/app"
import style from "./style.css"
import Bar from "./widget/Bar"
import Notifications from "./widget/Notifications"
import Desktop, { togglePeek } from "./widget/Desktop"

app.start({
    css: style,

    /* Porta de entrada para o mundo de fora: `ags request <texto>` chega
       aqui. É por onde um atalho do Hyprland fala com a barra sem precisar
       de um socket próprio nem de reiniciar nada. */
    requestHandler(argv: string[], res: (r: string) => void) {
        if (argv[0] === "peek") return res(togglePeek() ? "on" : "off")
        res(`comando desconhecido: ${argv.join(" ")}`)
    },

    main() {
        app.get_monitors().map((monitor) => {
            Bar(monitor)
            Notifications(monitor)
            Desktop(monitor)
        })
    },
})
