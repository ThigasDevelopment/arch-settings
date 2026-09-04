# Carrega as variaveis de ambiente compartilhadas (QT_QPA_PLATFORMTHEME etc.)
[ -f ~/.profile ] && . ~/.profile

# Sobe o Hyprland automaticamente ao logar no tty1.
#
# IMPORTANTE: tem que ser .zprofile, nao .bash_profile. O install.sh manda
# rodar `chsh -s /usr/bin/zsh`, e a partir dai o login shell e o zsh — que
# le .zprofile/.zlogin e ignora .bash_profile por completo. Se o autostart
# ficar so no .bash_profile, o login no tty1 cai num prompt de shell e o
# Hyprland nunca sobe.
if [ "$(tty)" = "/dev/tty1" ] && [ -z "$WAYLAND_DISPLAY" ]; then
  export XDG_CURRENT_DESKTOP=Hyprland
  export XDG_SESSION_TYPE=wayland
  export XDG_SESSION_DESKTOP=Hyprland
  exec Hyprland
fi
