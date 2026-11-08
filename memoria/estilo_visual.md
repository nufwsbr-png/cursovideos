# Estilo visual — cartela de identidade (capítulo 34)

**Decisão do dono (2026-11-08):** o visual deve ser *igual ao da referência* que ele mandou (três capturas de um canal
POV de desenho 3D: lente olho-de-peixe, traço preto grosso e limpo, cores chapadas e vivas, bonecos de cabeça grande com
olhos brancos enormes, legendas arredondadas na cor de quem fala). O que copiamos é a **técnica e o acabamento**; os
personagens, o lugar, a história, os nomes e os objetos continuam nossos (regra do livro: a fórmula é livre, a identidade é nossa).

| Item | Decisão (valores em `canal/canal.json → estilo`) |
|---|---|
| Em uma frase | "desenho 3D de traço preto grosso, cores vivas e chapadas, visto por uma lente olho-de-peixe, com legendas arredondadas na cor de quem fala" |
| Lente | olho de peixe equidistante, 115° na vertical, 1,2 de alongamento horizontal (`lente.fov_vertical`, `anamorfico`); a cabeça tem 10° de inclinação natural para baixo (`inclinacao_base_graus`); `aproximar:` fecha para 65° |
| Traço | 6 px em 1080 de largura perto, afinando até 2,2 px ao longe; cor #1a1410; desenhado por salto de distância e de normal (nunca por cor) |
| Cor 1, 2, 3 | #1f5f8a azul (bancos, faixa das paredes, placas) · #f3ead8 creme (paredes) · #e07b2a laranja (colete, lanchonete) |
| Cor de alerta | #ffb000 âmbar do painel; vira #c0392b vermelho quando o das 3h aparece |
| Sombra e textura | 3 degraus suaves, intensidade 0,30; papel leve (0,06), sem grão por pixel |
| Luz | chapada e clara: céu/chão + 1 direcional + preenchimento frio; **sem luzes pontuais** (o que brilha é emissivo) |
| Bonecos | cabeça ≈ 1/4 da altura, olhos brancos grandes quase colados com pupila preta que segue o olhar, sobrancelha fina, nariz pequeno, orelhas, corpo em cápsulas, cós e punhos desenhados; cabelos: coque, curto, curto_penteado, cacheado, careca; óculos opcionais |
| Mãos do protagonista | palma arredondada, 4 dedos em cápsulas (duas falanges) + polegar, esparadrapo no indicador esquerdo; manga #a9c7e8 com punho #bdd5ee; apoiadas no balcão nos cantos de baixo, antebraço deitado em diagonal |
| Olhos do protagonista | 1,48 m sentado (43 cm acima do balcão) — é isso que faz as mãos aparecerem de cima como na referência |
| Fonte e cores da legenda | Baloo 2 peso 800, 58 px, caixa alta e baixa, contorno #1a1410 9 px + sombra; cor = cor da roupa de quem fala (eu azul-claro, Dalva laranja-claro, Amaral cinza-azulado, alto-falante cinza, passageiro lilás) |
| Selo "PARTE N" | retângulo vermelho arredondado com borda escura e texto branco, centralizado a 8 % do topo; fica até o fim |
| O que nunca pode aparecer | sangue, arma, rosto do protagonista, logotipo/marca/brasão/farda reais |

## Como o motor faz isso (resumo; detalhes em `motor/README.md`)
Duas câmeras comuns (45° para cima e 45° para baixo) renderizam cor e um G-buffer (normal do mundo + distância por fragmento);
o pós-processo remapeia para olho de peixe, desenha o traço (segunda diferença da distância em 3 pares de direções + ângulo
entre normais), aplica papel, vinheta e fade. Legendas e selos são 2D, retos, por cima.

## O clima conta a história
Rotina (luz normal) → Sinal (painel âmbar pisca) → Escalada (luz cai, painel vermelho) → Clímax (quase sem luz) → Pergunta (tela escura).

## Teste dos 3 estilos (capítulo 35/57)
`node fabrica/cli.js estilos` gera A (traço 8 px, papel visível), B (traço 4 px, sem papel) e C (a referência: 6 px).
O padrão do canal é o C. Se o dono preferir outro, anotar aqui e no canal.json.

## Padrão aprovado
Quando o Epi. 01 for aprovado pelo dono, copiar quadros para `padrao_aprovado/quadros/` (o revisor compara contra eles).
