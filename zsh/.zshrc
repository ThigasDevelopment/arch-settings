# Binds
bindkey "^[[H" beginning-of-line
bindkey "^[[F" end-of-line
bindkey "^[[3~" delete-char
bindkey "^H" backward-kill-word
bindkey "^[[3;5~" kill-word
bindkey "^[[1;5C" forward-word
bindkey "^[[1;5D" backward-word

# Histórico
#
# Sem isto o zsh não persiste NADA entre sessões: o padrão é HISTFILE vazio e
# SAVEHIST=0, então cada terminal novo nasce em branco. Três coisas dependiam
# disso e pareciam quebradas por motivos diferentes:
#
#   - o zsh-autosuggestions sugere a partir do histórico. Sem histórico ele
#     roda e não tem o que sugerir — o sintoma é "o autocomplete não funciona"
#   - Ctrl+R não achava nada
#   - seta ↑ não trazia o comando do terminal anterior
#
# SHARE_HISTORY para os terminais se enxergarem em tempo real, já que aqui é
# comum ter três kitty abertos ao mesmo tempo.
HISTFILE="$HOME/.zsh_history"
HISTSIZE=50000
SAVEHIST=50000

setopt SHARE_HISTORY          # terminais trocam histórico entre si, na hora
setopt INC_APPEND_HISTORY     # grava ao executar, não só ao sair — sobrevive a crash
setopt HIST_IGNORE_ALL_DUPS   # um comando repetido não ocupa dez linhas
setopt HIST_IGNORE_SPACE      # linha começando com espaço não entra no histórico
setopt HIST_REDUCE_BLANKS
setopt HIST_VERIFY            # expansão de !! aparece na linha antes de rodar

# Completação
#
# Sem `compinit` o sistema de completação do zsh simplesmente NÃO existe: o Tab
# cai no expand-or-complete cru, que só completa nome de arquivo. Era por isso
# que `ssh hype<Tab>` não oferecia nada, mesmo com hype-vm1 e hype-vm2
# declarados no ~/.ssh/config.
#
# Vem ANTES do fzf de propósito: o `fzf --zsh` instala um fzf-completion que
# depende do compsys já estar carregado.
autoload -Uz compinit
compinit

# Menu navegável com as setas, em vez de só despejar a lista
zstyle ':completion:*' menu select

# Casa maiúscula com minúscula nos dois sentidos: "VM" acha "vm" e vice-versa
zstyle ':completion:*' matcher-list 'm:{a-zA-Z}={A-Za-z}'

# Agrupa por tipo com um título por grupo. O %F{8} é o cinza escuro da paleta
# do kitty (#505050) — cabeçalho legível sem competir com os itens.
zstyle ':completion:*' group-name ''
zstyle ':completion:*:descriptions' format '%F{8}%d%f'

# Plugins
source /usr/share/zsh/plugins/zsh-autosuggestions/zsh-autosuggestions.zsh
source /usr/share/zsh/plugins/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh

# FZF
source <(fzf --zsh)

# Starship
eval "$(starship init zsh)"
export PATH="$HOME/.local/bin:$PATH"
