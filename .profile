# Qt: UM único platform theme, o mesmo valor que o hyprland.conf exporta.
# Antes este arquivo dizia qt5ct e o hyprland.conf dizia qt6ct — um
# derrubava o outro conforme a ordem de leitura, e os apps Qt saíam
# destoando. Agora os dois dizem qt6ct.
export QT_QPA_PLATFORMTHEME=qt6ct

# QT_STYLE_OVERRIDE foi removido de propósito: ele força o estilo por
# fora e anula o `style=Fusion` do qt6ct.conf, junto com a paleta
# monocromática que o Fusion consome. Quem manda no estilo é o qt6ct.

# Apps só-Qt5 (raros) precisam do outro platform theme:
#   QT_QPA_PLATFORMTHEME=qt5ct <comando>
# O qt5ct.conf carrega a mesma paleta, então o visual é idêntico.
