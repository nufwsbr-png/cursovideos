# Revisões do crítico visual — Epi. 01

Rubrica: `docs/criterios_visuais.md`. Passa com todas as notas ≥ 7; no máximo 3 rodadas.

## Rodada 1 — 2026-11-10 16:33 UTC (fonte: sessao_claude_code; às cegas: não)
| gancho | legibilidade | clareza_acao | continuidade | acabamento | dilema_final |
|---|---|---|---|---|---|
| 7 | 8 | 5 | 8 | 6 | 7 |

**Menor nota:** clareza_acao 5 (mínimo 7) → não passou nesta rodada.

**Defeitos:**
1. [Q21 · clareza_acao · gravidade 3] A revelação não mostra a etiqueta: a câmera olha o chão, o braço tapa a mala e o quadro está escuro; o nome que a legenda menciona não aparece. → Linha 15: aproximar:gv_mala_1 em vez de avancar (a lente fecha sem o corpo avançar e sem o braço na frente). Fora do patch: a mala tem de estar dentro do armário 7, na altura dos olhos, como diz a bíblia.
2. [D5 · dilema_final · gravidade 2] No avanço final o corpo inclina sobre o balcão e o braço cobre a passagem ('PLAT 7' cortado) e domina o quadro. → Linha 26: aproximar:impressora em vez de avancar (sem inclinar o corpo).
3. [D4 · acabamento · gravidade 2] A tela do celular mostra 'Zap da Família (inventado)': palavra de bastidor visível no vídeo. → Fora do patch (motor): trocar o nome do app na tela do celular por um nome de app que exista só no canal.

**História entendida só pelas imagens:** Um funcionário novato de guichê de rodoviária vê a impressora emitir sozinha uma passagem para as 03:00 na plataforma 7; uma colega manda rasgar, alguém no telefone manda levar ao guarda-volumes, ele vai até lá e diz que um nome é o da mãe dele — mas a imagem não mostra o nome. De volta ao guichê, a mãe manda mensagem dizendo que perdeu o ônibus e um senhor de casaco vem buscar a passagem dela.

**Patch:** aplicado: 2 mudança(s) aceita(s) (linha 15 acao → aproximar:gv_mala_1; linha 26 acao → aproximar:impressora). Nota do roteiro depois: 100

**Veredito:** Bem acabado e legível, mas a cena da etiqueta não mostra o nome e o braço cobre a passagem no fim: não passa ainda.

**Correções fora do patch entre a rodada 1 e a 2** (feitas no código e no mundo, não pelo crítico; mudam a versão do motor e do canal):
- `canal.json`: a mala `gv_mala_1` passou para dentro do armário 7 (altura 0,90–1,16 m, de frente para o nó `gv_armarios`), como diz a bíblia; antes estava no chão do outro lado da sala.
- `canal.json`: o nome do app de mensagens na tela do celular passou de "Zap da Família (inventado)" para "Recado".
- `motor/cena/sobreposicao.js`: o emoji dos botões da pergunta passou a medir 85 px de tinta (antes media 85 px de avanço da fonte, ≈ 62 px de desenho); o nome no topo da tela do celular diminui até caber ("Sistema Serra Azul" cortava).

## Rodada 2 — 2026-11-10 16:49 UTC (fonte: sessao_claude_code; às cegas: não)
| gancho | legibilidade | clareza_acao | continuidade | acabamento | dilema_final |
|---|---|---|---|---|---|
| 7 | 8 | 8 | 8 | 7 | 8 |

**Menor nota:** gancho 7 (mínimo 7) → APROVADO.

**Defeitos:**
1. [Q01 · gancho · gravidade 1] Os 2 primeiros segundos são quase o mesmo quadro e o estranho (a impressora imprimindo sozinha) só é dito, não mostrado. → Num próximo episódio, abrir já olhando o objeto estranho enquanto alguém fala (linha 0 com olhar no objeto).
2. [D5 · acabamento · gravidade 1] A manga do protagonista ocupa o terço de baixo nos quadros sentados de lado. → Fora do patch (motor): baixar um pouco os antebraços na pose apoiada quando a câmera vira de lado.
3. [Q13 · clareza_acao · gravidade 1] No telefonema o fone quase não aparece; quem fala se entende pela cor da legenda e pelo filtro de voz. → Fora do patch (motor): mostrar o fone um pouco mais à frente na pose segurar:telefone.

**História entendida só pelas imagens:** Um novato de guichê vê a impressora emitir sozinha uma passagem para as 03:00 na plataforma 7; mandam levar ao guarda-volumes, ele acha no armário uma mala com a etiqueta 'NEUSA F. 03:00' e diz que é a mãe dele. De volta ao guichê, a mãe avisa que está na estrada e um senhor de casaco vem buscar a passagem dela: entregar ou rasgar.

**Patch:** —

**Veredito:** Passa: a etiqueta e a passagem agora se leem só pela imagem; ficam ressalvas pequenas de acabamento.

**Resultado do ciclo:** APROVADO — todas as notas ≥ 7 na rodada 2
