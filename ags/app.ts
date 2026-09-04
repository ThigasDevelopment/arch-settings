import app from "ags/gtk4/app"
import style from "./style.css"
import Bar from "./widget/Bar"
import Notifications from "./widget/Notifications"

app.start({
    css: style,
    main() {
        app.get_monitors().map((monitor) => {
            Bar(monitor)
            Notifications(monitor)
        })
    },
})
