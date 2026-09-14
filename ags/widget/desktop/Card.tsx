import { Gtk } from "ags/gtk4"
import { createState } from "ags"
import type { Accessor } from "ags"

/* O cartão — a parte padronizada dos widgets de desktop.
 *
 * Vive num arquivo só dele, e não dentro do Desktop.tsx, por uma razão
 * mecânica: o Desktop.tsx importa cada widget para montar o registro e cada
 * widget importa o Card. Com os dois no mesmo módulo isso seria um ciclo de
 * import — que em ESM não quebra sempre, mas quebra de um jeito difícil de
 * ler (o `Card` chega `undefined` na hora de renderizar, dependendo de quem
 * carregou primeiro). Aqui não há ciclo: Card não importa ninguém.
 */

export type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right"

/* O contrato. Um widget de desktop é isto e nada mais — quem quiser criar o
 * próximo (clima, agenda, recursos) exporta um objeto com estes quatro
 * campos e se registra no Desktop.tsx. */
export interface DesktopWidget {
    /** Estável: entra no nome da janela e serve de âncora no CSS. */
    id: string

    /** Em que canto da tela o cartão mora. */
    corner: Corner

    /* Quando isto é falso o cartão some — e, se for o último ativo do canto,
       a janela inteira deixa de existir. Isso não é economia de pixels: uma
       camada viva, mesmo transparente e vazia, continua recebendo clique no
       desktop. Um widget "invisível" que engole o clique do usuário é pior
       que um widget feio. */
    visible: Accessor<boolean>

    /** Chamado uma vez por monitor, na montagem da janela. */
    render: () => JSX.Element
}

/* Para o widget que não tem por que se esconder: leitura de sistema existe
   enquanto a máquina existe. Um Accessor constante e não `undefined` porque
   o contrato pede um — assim o Desktop.tsx não precisa de um caso especial
   para "este aqui sempre aparece". */
export const SEMPRE: Accessor<boolean> = createState(true)[0]

/* A moldura comum. É ela que faz os widgets parecerem do mesmo sistema:
 * mesmo fundo, mesma borda, mesmo respiro, mesmo cabeçalho de ícone +
 * título. O conteúdo de cada widget entra embaixo e não sabe nada disso. */
export function Card({
    icon,
    title,
    visible,
    children,
}: {
    icon: string
    title: string | Accessor<string>
    visible?: Accessor<boolean>
    children?: JSX.Element | JSX.Element[]
}) {
    return (
        <box
            class="DesktopCard"
            orientation={Gtk.Orientation.VERTICAL}
            visible={visible ?? true}
        >
            <box class="cardHead">
                <label class="cardIcon" label={icon} />
                {/* xalign={0} e não halign: num label que expande, o halign
                    move a CAIXA e o xalign move o TEXTO dentro dela. Com
                    ellipsize ligado a caixa precisa ocupar a linha toda,
                    senão não há o que cortar e o título empurra o cartão. */}
                <label class="cardTitle" hexpand xalign={0} ellipsize={3} label={title} />
            </box>
            {children}
        </box>
    )
}
