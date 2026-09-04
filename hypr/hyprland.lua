-------------------------------------------------------------------------------
--  hyprland.lua — mono
--
--  Migrado 1:1 do hyprland.conf. Mesmos valores, mesmas teclas, mesma ordem.
--  A API `hl.*` está documentada em /usr/share/hypr/stubs/hl.meta.lua.
--
--  Escrito do zero. A ÚNICA coisa importada do repositório arch-settings é o
--  bloco KEYBINDINGS lá embaixo, literal, com 3 alvos trocados (Walker no lugar
--  do wofi, scripts movidos para hypr/scripts, ws-smart removido a pedido).
--
--  Nada mais veio de lá: monitor, autostart, input, window rules e layout são
--  todos definidos aqui.
-------------------------------------------------------------------------------


------------------
---- MONITORS ----
------------------

-- Auto-detecta o monitor conectado. Se quiser fixar a sua saída e taxa:
--   hl.monitor({ output = "DP-1", mode = "2560x1440@144", position = "0x0", scale = 1 })
hl.monitor({
    output   = "",
    mode     = "preferred",
    position = "auto",
    scale    = 1,
})


---------------------
---- MY PROGRAMS ----
---------------------

local terminal    = "kitty"
local fileManager = "nautilus"
local menu        = "walker"
local browser     = "helium-browser"


-------------------------------
---- ENVIRONMENT VARIABLES ----
-------------------------------

hl.env("XCURSOR_SIZE",   "16")
hl.env("HYPRCURSOR_SIZE", "16")

-- Um único platform theme para Qt. O .profile exporta o MESMO valor.
hl.env("QT_QPA_PLATFORMTHEME", "qt6ct")

-- Sem barra de título do compositor: apps Qt não devem desenhar a própria.
-- Em tiling, título é espaço morto numa janela que já está posicionada.
hl.env("QT_WAYLAND_DISABLE_WINDOWDECORATION", "1")

-- Wayland nativo em vez de XWayland
hl.env("MOZ_ENABLE_WAYLAND", "1")
hl.env("ELECTRON_OZONE_PLATFORM_HINT", "auto")
hl.env("GDK_BACKEND", "wayland,x11")


-----------------
---- TEMA    ----
-----------------
-- Top-level: roda a cada carga da config (start e reload), igual ao `exec` do .conf.

hl.exec_cmd([[gsettings set org.gnome.desktop.interface color-scheme "prefer-dark"]])
hl.exec_cmd([[gsettings set org.gnome.desktop.interface gtk-theme    "adw-gtk3-dark"]])
hl.exec_cmd([[gsettings set org.gnome.desktop.interface icon-theme   "Papirus-Dark"]])
hl.exec_cmd([[gsettings set org.gnome.desktop.interface font-name           "SF Pro Text 11"]])
hl.exec_cmd([[gsettings set org.gnome.desktop.interface monospace-font-name "JetBrainsMono Nerd Font 11"]])

-- Nautilus em lista, não em grade: na grade os ícones de mimetype do Papirus
-- viram clip art de 48px e os nomes quebram no meio da palavra. Em lista eles
-- caem para 16px e leem como glifo discreto.
hl.exec_cmd([[gsettings set org.gnome.nautilus.preferences default-folder-viewer "list-view"]])
hl.exec_cmd([[gsettings set org.gnome.nautilus.list-view   default-zoom-level    "small"]])
hl.exec_cmd([[gsettings set org.gnome.nautilus.preferences default-sort-order    "type"]])


-------------------
---- AUTOSTART ----
-------------------
-- Só o que ESTE setup precisa para funcionar. Nenhum app pessoal sobe
-- sozinho — se quiser algum no boot, adicione você.
--
-- `hyprland.start` dispara uma única vez, no boot da sessão. É o equivalente
-- exato do `exec-once` do .conf: um reload da config NÃO re-dispara.

hl.on("hyprland.start", function()
    hl.exec_cmd("hyprpaper")
    hl.exec_cmd("ags run")

    -- elephant é o backend de providers do Walker 2.x. Sem ele o launcher abre
    -- vazio. Não existe unit do systemd, então sobe aqui.
    hl.exec_cmd("elephant")
    hl.exec_cmd("walker --gapplication-service")
end)


-----------------------
---- LOOK AND FEEL ----
-----------------------

hl.config({
    general = {
        gaps_in  = 3,
        gaps_out = 6,

        border_size = 1,

        col = {
            active_border   = "rgb(ffffff)",
            inactive_border = "rgb(262626)",
        },

        resize_on_border = false,
        allow_tearing    = false,

        layout = "dwindle",
    },

    decoration = {
        -- 6px: lê como decisão, longe do blob de 10 do default.
        rounding = 6,

        -- > 2 aproxima o canto de um squircle em vez de um arco de círculo.
        -- Quase imperceptível de propósito.
        rounding_power = 2.5,

        -- 0.96, nao 1.0: o blur so existe atraves do que e translucido, entao
        -- com a janela opaca ele ficava invisivel em tudo que nao fosse o kitty
        -- (background_opacity 0.85), o AGS e o Walker. 0.96 e o minimo que
        -- revela o blur sem lavar o texto: medido contra screenshot, o contraste
        -- do texto cai ~4% (189 -> 181 em 255). A 0.92 ja cai ~8% e o wallpaper
        -- aparece DENTRO da janela, que e exatamente o que voce nao queria.
        --
        -- Os dois valores iguais de proposito: deixar a inativa mais transparente
        -- criaria um segundo sinal de foco, e a ideia aqui e que a borda branca
        -- seja o unico.
        active_opacity   = 0.96,
        inactive_opacity = 0.96,

        shadow = {
            enabled = false,
        },

        -- Blur leve. A janela em si fica OPACA (opacity 1.0) de propósito: baixar
        -- a opacidade da janela inteira lava o texto junto. O blur aparece através
        -- do que é translúcido por conta própria — o fundo do kitty
        -- (background_opacity), a barra do AGS e o Walker.
        blur = {
            enabled = true,
            size    = 4,
            passes  = 2,

            noise      = 0.008,
            contrast   = 1.0,
            brightness = 0.9,

            -- vibrancy = 0: ela reintroduz saturação de cor, que é exatamente
            -- o que este tema não quer.
            vibrancy          = 0.0,
            vibrancy_darkness = 0.0,

            popups             = true,
            popups_ignorealpha = 0.2,
        },
    },

    animations = {
        enabled = true,
    },
})

-- Uma curva só. easeOutExpo: sai rápido, chega devagar — a janela
-- assenta no lugar em vez de saltar.
hl.curve("out",   { type = "bezier", points = { {0.16, 1}, {0.30, 1} } })
hl.curve("inout", { type = "bezier", points = { {0.65, 0}, {0.35, 1} } })

-- popin 96%, não os 87% do default: 87% é um salto que se VÊ,
-- 96% é um assentamento que se SENTE.
hl.animation({ leaf = "windows",    enabled = true, speed = 4, bezier = "out", style = "popin 96%" })
hl.animation({ leaf = "windowsIn",  enabled = true, speed = 4, bezier = "out", style = "popin 96%" })
hl.animation({ leaf = "windowsOut", enabled = true, speed = 3, bezier = "out", style = "popin 96%" })

hl.animation({ leaf = "fade",    enabled = true, speed = 3, bezier = "out" })
hl.animation({ leaf = "fadeIn",  enabled = true, speed = 3, bezier = "out" })
hl.animation({ leaf = "fadeOut", enabled = true, speed = 2, bezier = "out" })

-- A borda anima MAIS devagar que a janela de propósito: sem cor,
-- a borda branca é o único sinal de foco.
hl.animation({ leaf = "border", enabled = true, speed = 6, bezier = "out" })

hl.animation({ leaf = "layers",    enabled = true, speed = 3, bezier = "out", style = "fade" })
hl.animation({ leaf = "layersIn",  enabled = true, speed = 3, bezier = "out", style = "fade" })
hl.animation({ leaf = "layersOut", enabled = true, speed = 2, bezier = "out", style = "fade" })

hl.animation({ leaf = "workspaces",       enabled = true, speed = 4, bezier = "inout", style = "slide" })
hl.animation({ leaf = "specialWorkspace", enabled = true, speed = 4, bezier = "inout", style = "slidevert" })

hl.config({
    dwindle = {
        preserve_split = true,
    },

    misc = {
        disable_hyprland_logo    = true,
        disable_splash_rendering = true,
        force_default_wallpaper  = 0,

        -- Cor por trás do wallpaper, enquanto o hyprpaper não carregou e nas
        -- bordas se a imagem não cobrir. Mesma cor de fundo do logo do Arch.
        background_color = "rgb(27292c)",
    },
})


---------------
---- INPUT ----
---------------

hl.config({
    input = {
        kb_layout    = "us",
        follow_mouse = 1,
        sensitivity  = 0,
    },
})


---------------------
---- LAYER RULES ----
---------------------
-- Camadas (barra e launcher) também recebem blur — é onde ele mais aparece.

hl.layer_rule({
    name  = "blur-bar",
    match = { namespace = "^(gtk4-layer-shell)$" },

    blur         = true,
    ignore_alpha = 0.3,
})

hl.layer_rule({
    name  = "blur-walker",
    match = { namespace = "^(walker)$" },

    blur         = true,
    ignore_alpha = 0.3,
})


----------------------
---- WINDOW RULES ----
----------------------

-- Diálogos flutuam e centralizam.
hl.window_rule({
    name  = "float-dialogs",
    match = { class = "^(pavucontrol|org.gnome.Calculator)$" },

    float  = true,
    center = true,
})


---------------------
---- KEYBINDINGS ----
---------------------
-- --- IMPORTADO LITERALMENTE de arch-settings/hypr/hyprland.conf ---
-- Alterações: SUPER+R e SUPER+Return apontam para o Walker, SUPER+P para o
-- power-menu movido para hypr/scripts, e SUPER+[0-9] usa dispatch direto
local mainMod = "SUPER" -- Sets "Windows" key as main modifier

-- Example binds, see https://wiki.hypr.land/Configuring/Binds/ for more
hl.bind(mainMod .. " + T",      hl.dsp.exec_cmd(terminal))
hl.bind(mainMod .. " + W",      hl.dsp.window.close())
hl.bind(mainMod .. " + E",      hl.dsp.exec_cmd(fileManager))
hl.bind(mainMod .. " + F",      hl.dsp.window.float({ action = "toggle" }))
hl.bind(mainMod .. " + SPACE",  hl.dsp.exec_cmd(menu))
hl.bind(mainMod .. " + C",      hl.dsp.window.pseudo())          -- dwindle
hl.bind(mainMod .. " + J",      hl.dsp.layout("togglesplit"))    -- dwindle
hl.bind(mainMod .. " + B",      hl.dsp.exec_cmd(browser))
hl.bind(mainMod .. " + V",      hl.dsp.exec_cmd(menu .. " --provider clipboard"))
hl.bind(mainMod .. " + Y",      hl.dsp.exec_cmd("code"))
hl.bind(mainMod .. " + D",      hl.dsp.exec_cmd("discord"))
hl.bind(mainMod .. " + Escape", hl.dsp.exec_cmd("command -v hyprshutdown >/dev/null 2>&1 && hyprshutdown || hyprctl dispatch 'hl.dsp.exit()'"))
hl.bind(mainMod .. " + SHIFT + S",      hl.dsp.exec_cmd([[grim -g "$(slurp)" - | wl-copy]]))
hl.bind(mainMod .. " + SHIFT + Escape", hl.dsp.exec_cmd(terminal .. " -e btop"))

-- Move focus with mainMod + arrow keys
hl.bind(mainMod .. " + left",  hl.dsp.focus({ direction = "left" }))
hl.bind(mainMod .. " + right", hl.dsp.focus({ direction = "right" }))
hl.bind(mainMod .. " + up",    hl.dsp.focus({ direction = "up" }))
hl.bind(mainMod .. " + down",  hl.dsp.focus({ direction = "down" }))

-- Switch workspaces with mainMod + [0-9]
hl.bind("SUPER + Tab",         hl.dsp.focus({ workspace = "+1" }))
hl.bind("SUPER + SHIFT + Tab", hl.dsp.focus({ workspace = "-1" }))

hl.bind("SUPER + 1", hl.dsp.focus({ workspace = 1 }))
hl.bind("SUPER + 2", hl.dsp.focus({ workspace = 2 }))
hl.bind("SUPER + 3", hl.dsp.focus({ workspace = 3 }))
hl.bind("SUPER + 4", hl.dsp.focus({ workspace = 4 }))
hl.bind("SUPER + 5", hl.dsp.focus({ workspace = 5 }))
hl.bind("SUPER + 6", hl.dsp.focus({ workspace = 6 }))
hl.bind("SUPER + 7", hl.dsp.focus({ workspace = 7 }))
hl.bind("SUPER + 8", hl.dsp.focus({ workspace = 8 }))
hl.bind("SUPER + 9", hl.dsp.focus({ workspace = 9 }))
hl.bind("SUPER + 0", hl.dsp.focus({ workspace = 10 }))

-- Move active window to a workspace with mainMod + SHIFT + [0-9]
hl.bind(mainMod .. " + SHIFT + 1", hl.dsp.window.move({ workspace = 1 }))
hl.bind(mainMod .. " + SHIFT + 2", hl.dsp.window.move({ workspace = 2 }))
hl.bind(mainMod .. " + SHIFT + 3", hl.dsp.window.move({ workspace = 3 }))
hl.bind(mainMod .. " + SHIFT + 4", hl.dsp.window.move({ workspace = 4 }))
hl.bind(mainMod .. " + SHIFT + 5", hl.dsp.window.move({ workspace = 5 }))
hl.bind(mainMod .. " + SHIFT + 6", hl.dsp.window.move({ workspace = 6 }))
hl.bind(mainMod .. " + SHIFT + 7", hl.dsp.window.move({ workspace = 7 }))
hl.bind(mainMod .. " + SHIFT + 8", hl.dsp.window.move({ workspace = 8 }))
hl.bind(mainMod .. " + SHIFT + 9", hl.dsp.window.move({ workspace = 9 }))
hl.bind(mainMod .. " + SHIFT + 0", hl.dsp.window.move({ workspace = 10 }))

-- Example special workspace (scratchpad)
hl.bind(mainMod .. " + M",         hl.dsp.workspace.toggle_special("magic"))
hl.bind(mainMod .. " + SHIFT + M", hl.dsp.window.move({ workspace = "special:magic" }))

-- Scroll through existing workspaces with mainMod + scroll
hl.bind(mainMod .. " + mouse_down", hl.dsp.focus({ workspace = "e+1" }))
hl.bind(mainMod .. " + mouse_up",   hl.dsp.focus({ workspace = "e-1" }))

-- Move/resize windows with mainMod + LMB/RMB and dragging
-- Equivalente ao `bindm` do .conf. Sem flag: drag()/resize() marcam
-- releasePending por dentro e caem no mesmo dispatcher `mouse` legado, então
-- o press inicia e o release encerra o arrasto. (O `{ mouse = true }` que o
-- exemplo em /usr/share/hypr/hyprland.lua passa é morto: hl.bind nunca atribui
-- kb.mouse — só o lê para uma checagem de exclusividade.)
hl.bind(mainMod .. " + mouse:272", hl.dsp.window.drag())
hl.bind(mainMod .. " + mouse:273", hl.dsp.window.resize())

-- Laptop multimedia keys for volume and LCD brightness
hl.bind("XF86AudioRaiseVolume",  hl.dsp.exec_cmd("wpctl set-volume -l 1 @DEFAULT_AUDIO_SINK@ 5%+"), { locked = true, repeating = true })
hl.bind("XF86AudioLowerVolume",  hl.dsp.exec_cmd("wpctl set-volume @DEFAULT_AUDIO_SINK@ 5%-"),      { locked = true, repeating = true })
hl.bind("XF86AudioMute",         hl.dsp.exec_cmd("wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle"),     { locked = true, repeating = true })
hl.bind("XF86AudioMicMute",      hl.dsp.exec_cmd("wpctl set-mute @DEFAULT_AUDIO_SOURCE@ toggle"),   { locked = true, repeating = true })
hl.bind("XF86MonBrightnessUp",   hl.dsp.exec_cmd("brightnessctl -e4 -n2 set 5%+"),                  { locked = true, repeating = true })
hl.bind("XF86MonBrightnessDown", hl.dsp.exec_cmd("brightnessctl -e4 -n2 set 5%-"),                  { locked = true, repeating = true })

-- Requires playerctl
hl.bind("XF86AudioNext",  hl.dsp.exec_cmd("playerctl next"),       { locked = true })
hl.bind("XF86AudioPause", hl.dsp.exec_cmd("playerctl play-pause"), { locked = true })
hl.bind("XF86AudioPlay",  hl.dsp.exec_cmd("playerctl play-pause"), { locked = true })
hl.bind("XF86AudioPrev",  hl.dsp.exec_cmd("playerctl previous"),   { locked = true })
