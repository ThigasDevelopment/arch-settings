#!/usr/bin/env bash
# Folha de atalhos — Walker em modo dmenu, com busca ligada.
#
# A lista NÃO é escrita aqui: vem de `hyprctl binds -j`, ou seja, do próprio
# compositor. É o único jeito de ela não envelhecer — mudou o bind no
# hyprland.lua, mudou aqui, sem ninguém lembrar de atualizar duas listas.
#
# O que torna isso possível é cada hl.bind carregar `description`. Sem elas o
# hyprctl devolveria `dispatcher: "__lua"` e um índice opaco, porque a config
# é em Lua e a ação é um closure — o compositor sabe a TECLA, não o que ela faz.
#
# ARMADILHA, custou tempo: o `walker --gapplication-service` guarda os temas em
# CACHE ao subir. Criar um tema novo com o serviço no ar faz o Walker cair no
# tema padrão em silêncio — sem erro, sem aviso. Depois de mexer nos temas,
# reinicie o serviço. No boot normal isso não acontece: os temas já existem
# antes do serviço subir.
#
# Sem campo de busca, como o power e o network: é uma folha para varrer com o
# olho, não para consultar digitando. Se um dia a lista crescer a ponto de
# rolar demais, tire o --nosearch daqui e devolva o .search-container no CSS do
# tema — os dois andam juntos.

hyprctl binds -j | python3 -c '
import json, sys

# Ordem de exibição, não a ordem dos bits.
# O SUPER vira o logo do Arch — o mesmo glifo que abre a barra, à esquerda.
# Não é enfeite: essa tecla é a raiz de quase todo atalho aqui, e repetir a
# palavra "SUPER" 50 vezes numa coluna é ruído puro. O símbolo encurta a
# coluna inteira e amarra a folha à marca que já está na tela.
MODS = [(64, "\U000F08C7"), (4, "CTRL"), (8, "ALT"), (1, "SHIFT")]

# Nomes que o X11 usa e ninguém lê. Só os que existem nesta config.
BONITO = {
    "left": "←", "right": "→", "up": "↑", "down": "↓",
    "SPACE": "Espaço", "Escape": "Esc",
    "mouse_down": "Roda ↓", "mouse_up": "Roda ↑",
    "mouse:272": "Clique esq.", "mouse:273": "Clique dir.",
    "XF86AudioRaiseVolume": "Volume +", "XF86AudioLowerVolume": "Volume −",
    "XF86AudioMute": "Mudo", "XF86AudioMicMute": "Mudo do mic",
    "XF86MonBrightnessUp": "Brilho +", "XF86MonBrightnessDown": "Brilho −",
    "XF86AudioNext": "Faixa →", "XF86AudioPrev": "Faixa ←",
    "XF86AudioPlay": "Play", "XF86AudioPause": "Pause",
}

linhas = []
for b in json.load(sys.stdin):
    desc = b.get("description") or ""
    if not desc:
        continue
    partes = [nome for bit, nome in MODS if b["modmask"] & bit]
    tecla = b["key"] or ("code:" + str(b["keycode"]))
    partes.append(BONITO.get(tecla, tecla))
    linhas.append((" + ".join(partes), desc))

# Coluna da tecla com largura fixa: é o que faz as duas colunas alinharem.
# Só funciona porque o tema desta folha usa fonte monoespaçada.
largura = max(len(k) for k, _ in linhas) if linhas else 0
for combo, desc in linhas:
    print(f"{combo.ljust(largura)}   {desc}")
' | walker --dmenu --theme cheatsheet --nosearch --nohints >/dev/null

# Sem `case` de propósito: isto é uma referência, não um lançador. O Enter
# fecha e pronto — executar o atalho selecionado agiria sobre a janela errada,
# porque quem está em foco no momento da escolha é o próprio Walker.
