#!/usr/bin/env bash
set -euo pipefail

# Regera os PNGs do tema a partir do SVG oficial do Arch.
#
# Não precisa rodar para instalar: os PNGs já estão versionados em arch-mac/.
# Isto existe para você poder mudar cor ou resolução sem depender de editor
# de imagem, e para registrar DE ONDE os assets vieram.
#
# Por que não usar /usr/share/pixmaps/archlinux-logo.svg direto: aquele SVG
# tem três paths, e dois deles desenham um "™" minúsculo no canto direito.
# Na tela de boot ele vira três pixels de sujeira ao lado do logo. Aqui só o
# primeiro path (o logo em si) é aproveitado — é isso que logo-white.svg e
# logo-blue.svg guardam, já sem o trademark.
#
# Requer: librsvg (rsvg-convert) e imagemagick.

cd "$(dirname "${BASH_SOURCE[0]}")"

for bin in rsvg-convert magick; do
    command -v "$bin" >/dev/null || { echo "faltando: $bin"; exit 1; }
done

# 512px de altura: o tema reescala para a tela em tempo de boot, então a fonte
# precisa ser maior que qualquer alvo razoável. -trim tira a margem do viewBox,
# senão o "tamanho" do logo no script viraria tamanho da margem.
rsvg-convert -h 512 logo-white.svg | magick png:- -trim +repage PNG32:arch-mac/logo.png
rsvg-convert -h 512 logo-blue.svg  | magick png:- -trim +repage PNG32:arch-mac/logo-arch-blue.png

# Trilho e preenchimento da barra.
#
# Cores CHAPADAS de propósito: o tema reescala as duas para o tamanho final, e
# imagem sólida sobrevive a qualquer reescala sem borrar. Se isto aqui tivesse
# canto arredondado, a barra chegaria na tela com o canto esticado.
magick -size 1000x20 xc:'#303030' PNG32:arch-mac/track.png
magick -size 1000x20 xc:'#ffffff' PNG32:arch-mac/fill.png

echo "assets regerados em arch-mac/"
