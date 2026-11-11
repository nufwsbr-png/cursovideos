# Revisões do crítico visual — Epi. 01

Rubrica: `docs/criterios_visuais.md`. Passa com todas as notas ≥ 7; no máximo 3 rodadas.

## Rodada 1 — 2026-11-11 00:05 UTC (fonte: sessao_claude_code; às cegas: não)
| gancho | legibilidade | clareza_acao | continuidade | acabamento | dilema_final |
|---|---|---|---|---|---|
| 7 | 6 | 8 | 8 | 8 | 8 |

**Menor nota:** legibilidade 6 (mínimo 7) → não passou nesta rodada.

**Defeitos:**
1. [Q13 · legibilidade · gravidade 2] O mostrador do elevador, que mostra o elevador descendo sozinho até o S2, nunca se lê. É um painel pequeno com '▼' e 'S1/S2' em duas linhas, a 6 m. A linha 8 aproxima, mas a linha 9 volta a abrir a câmera em 1 s, e em Q13 o mostrador vira um ponto laranja. → Linha 9: olhar elevador_social e acao aproximar:elevador_social, para segurar o zoom da linha 8 enquanto o mostrador troca para S2; a senhora fica no quadro, ao lado. Fora do patch: um mostrador maior, numa linha só ('▼ S2').
2. [Q15 · legibilidade · gravidade 2] Em 'Isso é água. Água até o teto.', a imagem da câmera do S2 é um quarto da pilha de monitores, e os galões são retângulos miúdos: não se reconhece água. A linha 10 aproxima, e a linha 11 abre de novo justo na fala. → Linha 11: acao aproximar:monitores, para segurar o zoom da linha 10. Fora do patch: desenhar na câmera do S2 galões maiores, com gargalo e tampa, até o alto da tela.
3. [Q31 · legibilidade · gravidade 1] As etiquetas 'ESTOCADO EM MAIO' ainda estão pequenas no quadro da fala 'Maio...'. A aproximação da linha 21 começa com a fala, e as letras só crescem depois. → Conferir na próxima rodada, quando o zoom da linha 21 tiver avançado; se continuar pequeno, olhar caixas_comida já na caminhada da linha 20.

**História entendida só pelas imagens:** Um porteiro de prédio vê uma moradora estocando galões quando um relógio REINÍCIO EM 72 HORAS toma todas as telas e a luz cai; pelo rádio o zelador diz que é boato e a síndica manda esconder a água e desligar a câmera do S2, onde o monitor mostra água estocada. Ele desce de elevador ao S2, acha caixas 'ESTOCADO EM MAIO' e, na porta trancada, uma lista em que porteiro e zelador estão fora; a síndica aparece atrás dele e a pergunta é abrir o estoque para todos ou seguir a lista.

**Patch:** aplicado: 3 mudança(s) aceita(s) (linha 9 olhar → elevador_social; linha 9 acao → aproximar:elevador_social; linha 11 acao → aproximar:monitores). Nota do roteiro depois: 100

**Veredito:** Reprovado só na legibilidade (6): o mostrador do elevador e a imagem da água na câmera do S2 ficam pequenos justo nas falas que dependem deles; o patch segura o zoom nas linhas 9 e 11, e o motor ganha um mostrador maior e galões reconhecíveis na câmera.

### Correções fora do patch (motor e canal, entre as rodadas 1 e 2)
Guichê 3: 0 pixel diferente nos stills medidos antes e depois.

Antes da rodada 1, vistas nos stills da etapa quadros:
- etiqueta das caixas cortada ("TOCADO EM MA"): o texto agora encolhe até caber;
- lista da porta passando da borda: as linhas encolhem juntas;
- celular com a mensagem do grupo dentro da conversa da mãe: a tela mostra só a conversa de quem mandou;
- manga do braço esquerdo no canto quando a câmera vira para a síndica: em pé, o corpo acompanha a cabeça além de ~35°;
- pernas "transparentes" no facho: o clarão passou de `screen` para `soft-light`;
- rádio = caixa preta: tipo `radio_base`, cujo visor mostra SÍNDICA ou ZELADOR enquanto a pessoa fala;
- revisor comparando com os quadros do Guichê 3: o padrão aprovado agora é por série.

Depois da rodada 1:
- o mostrador do elevador passou a 0,5 m, numa linha só ("▼ S2");
- a câmera do S2 mostra galões grandes, com gargalo e tampa.

## Rodada 2 — 2026-11-11 00:12 UTC (fonte: sessao_claude_code; às cegas: não)
| gancho | legibilidade | clareza_acao | continuidade | acabamento | dilema_final |
|---|---|---|---|---|---|
| 7 | 8 | 8 | 8 | 8 | 8 |

**Menor nota:** gancho 7 (mínimo 7) → APROVADO.

**Defeitos:**
1. [Q01 · gancho · gravidade 1] Os dois primeiros segundos são parados: mãos em repouso, a senhora e o carrinho pequenos no quadro, e o visor 'CANAL 1' cortado na borda direita puxa o olho para o canto. → Para os próximos episódios: no primeiro quadro, mãos fazendo algo e quem fala maior no quadro. Neste, a nota passa.
2. [Q13 · clareza_acao · gravidade 1] Com a lente fechada no mostrador, a senhora que diz 'Sem luz? Como?' fica cortada pela borda direita. → Aceitável: o mostrador é o que importa na linha, e a cor da legenda identifica quem fala. Num próximo mundo, uma marca entre o mostrador e a personagem permitiria enquadrar os dois.
3. [Q31 · legibilidade · gravidade 1] As etiquetas 'ESTOCADO EM MAIO' ainda estão pequenas no instante da fala 'Maio...' e só crescem com a aproximação. → Aceitável: as caixas da frente já se leem. Se o dono achar pouco, olhar caixas_comida já na caminhada da linha 20.

**História entendida só pelas imagens:** Um porteiro de prédio vê uma moradora estocando galões quando um relógio REINÍCIO EM 72 HORAS toma todas as telas e a luz cai; pelo rádio o zelador diz que é boato e a síndica manda esconder a água e desligar a câmera do S2, onde o monitor mostra água estocada. Ele desce de elevador ao S2, acha caixas 'ESTOCADO EM MAIO' e, na porta trancada, uma lista em que porteiro e zelador estão fora; a síndica aparece atrás dele e a pergunta é abrir o estoque para todos ou seguir a lista.

**Patch:** —

**Veredito:** Aprovado na rodada 2 (7/8/8/8/8/8): os textos de que as falas dependem agora se leem; restam ressalvas pequenas no início parado, na senhora cortada pela borda em Q13 e nas etiquetas no limite em Q31.

**Resultado do ciclo:** APROVADO — todas as notas ≥ 7 na rodada 2
