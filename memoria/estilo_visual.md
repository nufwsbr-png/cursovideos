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

---

## Modelo de edição da referência (estudo de 2026-11-09)

**Fonte:** 5 reels do perfil de referência do Instagram (o mesmo das 3 capturas de estilo), baixados em `referencias/videos/`
(fora do git) e medidos com `python -I scripts/medir_referencia.py referencias/videos/<id>.mp4` (ffmpeg 9.0.2 + faster-whisper
small). Números brutos em `referencias/medidas/<id>.json`, folhas de 1 quadro/s em `referencias/medidas/<id>_folha.jpg`.
**Copiamos só técnica e acabamento.** Eles têm duas séries (uma sala de aula sob céu vermelho; um supermercado em alerta). Nada
disso (lugar, história, personagens, nomes, falas, objetos) entra no nosso canal.

| Papel no estudo | Id | Views (09/11 16:39 UTC) | Duração | 1ª legenda (visual) | Mudança visual mediana | s em movimento forte | Telas pretas | Cartão final (início / duração) | Selo |
|---|---|---|---|---|---|---|---|---|---|
| mais visto + início de série | DfekLxVKm3- | 7,4 mi | 94,9 s | 0,0 s | 10,9 | 36,7 s (39 %) | 44,7–45,6 (troca de lugar) e 93,2–94,8 (fim) | 89,9 s / 5,0 s (3,3 s + 1,7 s preto) | — |
| início da outra série + virada forte | Dfc_rs-Kr1W | 4,5 mi | 113,9 s | 0,0 s | 7,3 | 40,7 s (36 %) | 61,7–62,8 (salto de tempo) | 110,3 s / 3,6 s | — |
| meio de série | DffSsVWKd1m | 2,1 mi | 103,8 s | ≈ 2,0 s | 4,8 | 23,6 s (23 %) | — | ≈ 100 s / ≈ 4 s (visto na folha) | PARTE 3, embaixo |
| meio de série | Dfe9fCPKa75 | 2,2 mi | 123,3 s | 0,5 s | 2,9 | 10,9 s (9 %) | 61,5–63,2 (salto de tempo) | 119,7 s / 3,6 s | PARTE 03, no alto |
| perseguição (mais curto) | Dffe38TqD-Q | 1,4 mi | 63,0 s | 1,0 s | 15,9 | 33,6 s (53 %) | — | 58,9 s / 4,1 s | PARTE 4, embaixo |

"Mudança visual" = média |diferença| entre o quadro t e t-0,5 s em 54x96 cinza (0–255); "movimento forte" = mudança > 15.

### MEDIDO
- **Arquivo entregue:** 1080x1920, **30 fps**, VP9 + AAC estéreo 44,1 kHz; loudness integrado −14,1 LUFS nos 5 (normalização da plataforma), LRA 5–8 LU, pico até +2,0 dBTP.
- **Cortes secos:** **zero** em 4 vídeos e 1 no outro (93,17 s, para a tela preta final), pelo filtro `scdet` (limiar 12, 0–100). Fora isso a câmera nunca corta: tudo é um plano contínuo em primeira pessoa.
- **Como a imagem muda sem cortar:** giro de cabeça, andar/correr (corredor, escada, calçada), aproximação (fechar a lente num rosto, ex. 21→22 s do mais visto) e **tela preta de 0,9–1,7 s** para pular tempo ou lugar (3 de 5 vídeos, sempre entre 40 e 63 s). Picos de mudança por vídeo: 3 a 24.
- **Lugares por episódio:** os dois episódios 1 passam por 3–4 lugares (sala → corredor → escada → subsolo; caixa → corredores → depósito), andando de um para o outro.
- **Legenda** (medida em pixels no quadro 0 do mais visto e conferida nos outros): bloco centralizado em x = 540; **centro do bloco a 67–68 % da altura** (2 linhas entre y 1252 e 1352); largura até 84 % (x 86–995); maiúscula com ≈ 37 px de altura (fonte ≈ 52–54 px); entrelinha 58 px; **contorno quase preto de ≈ 5 px, sem sombra**; caixa alta e baixa; uma fala por vez, 1–2 linhas.
- **Cor da legenda por quem fala:** protagonista **branco** (#fcfcfc, 3 amostras); demais em tons claros: amarelo #f4d151 (professor), laranja #fcb46c (colega), azul-claro #b4ccfc (policial), lilás (cliente, visto).
- **Selo "PARTE N":** retângulo vermelho de 331×87 px, borda escura, texto branco em caixa alta; **visível de ≈ 0,0–0,5 s até ≈ 3,0 s** (≈ 2,5 s) e some; no alto (y 8,7 %) numa série e embaixo (y 85 %) na outra. O episódio 1 não tem selo.
- **Cartão no alto da tela** (x 55–1023, y 96–273, 90 % da largura, cantos arredondados, borda escura grossa), aparece junto do celular na mão:
  - mensagem: fundo creme-branco, remetente em verde negrito pequeno + texto preto negrito grande ("Pai / Cadê você?"); ficou 1,7 + 7,9 s e 3,9 s;
  - alerta: fundo vermelho, triângulo branco com "!", rótulo em caixa alta pequeno + ordem em caixa alta grande; ficou 2,8 s e 4,0 s.
- **Fechamento (5 de 5):** última fala termina 0,7–4 s antes do cartão; nesse intervalo a câmera **aproxima devagar** do objeto/pessoa da decisão (porta, rosto, ônibus). O cartão entra em 0,1–0,2 s **por cima da cena, que continua visível** (brilho médio cai 20–35 %), e fica **3,6–4,1 s** até o fim: título branco em caixa alta "O QUE VOCÊ FARIA?" (4/5) ou "E AGORA, O QUE EU FAÇO?" (1/5); **dois botões** arredondados com borda escura, emoji + texto de 2 linhas em caixa alta; **vermelho = sair/arriscar/agir** e **azul = ficar/esperar/se abrigar** (5 de 5); embaixo "Comenta aqui 👇" em amarelo. Sem letras A/B, sem chamada para "parte 2".
- **Som:** nenhum trecho abaixo de −40 dB em nenhum vídeo (nunca há silêncio de verdade). **83–87 % da energia entre 20 e 80 Hz**, picos em 45–47, 68–70 e 92–94 Hz, nível quase constante do início ao fim (p10–p90 dentro de ≈ 8 dB): um **zumbido grave contínuo**, igual nos 5. A voz tem o mesmo RMS dos trechos sem fala (diferença −0,5 a +1,1 dB). Por cima: efeitos pontuais visíveis no espectrograma (bipes triplos ≈ 1,6 kHz no alerta, batidas na porta a ≈ 1 por segundo, ruído largo na corrida).
- **Comparação com o nosso Epi. 01:** legenda a 62 % com contorno 9 px + sombra (deles 68 %, 5 px, sem sombra); protagonista em azul-claro (deles branco); selo até o fim (deles ≈ 2,5 s); cartão de notificação escuro, pequeno, 3,2 s fixos (deles grande, claro, legível, o tempo da mensagem); tela da pergunta quase preta com A/B (deles cena visível + botões com emoji); 60 fps (deles 30 fps); protagonista sentado num lugar só (deles anda por 3–4).

### HIPÓTESE (não medido)
- A fonte das legendas e cartões parece uma sem-serifa larga e pesada (estilo Verdana/DejaVu Sans Bold), menos arredondada que a nossa Baloo 2. Conferir lado a lado antes de trocar.
- 30 fps pode ser conversão da plataforma, e não escolha do criador. Mesmo assim é o que o público vê no Instagram.
- O zumbido grave mantém a tensão sem disputar a faixa da voz (200 Hz–4 kHz). Por isso a voz fica no mesmo RMS do fundo e continua clara.
- Plano contínuo + andar entre lugares dá a sensação de "eu estou lá" e segura a retenção melhor que câmera parada. Testar contra o nosso Epi. 01 parado no balcão.
- Botão vermelho = ação arriscada puxa o voto e o comentário.

### Ajustes propostos no motor (AGUARDANDO O DONO; nada foi mudado ainda)
Em ordem de custo/benefício. Os itens 1–5 só mudam valores no `canal.json` e o desenho 2D em `motor/cena/sobreposicao.js`;
o 6 mexe na mixagem; o 7 é uma mudança grande de câmera e cenário.
1. **Legenda:** `y_centro` 0,62 → 0,68; `espessura_contorno` 9 → 5; `sombra` false; `tamanho` 58 → 54; `largura_max` 0,78 → 0,82, centralizada em x = 0,5 (hoje centraliza na área segura, em 0,455). Protagonista em **branco** (`eu` #bfe0ff → #ffffff; a Neusa, hoje branca, passa para um tom claro próprio). Fonte: fazer um quadro de teste Baloo 2 × sem-serifa larga pesada (Nunito 900 já instalada) e o dono escolhe.
2. **Selo PARTE N:** `duracao_s` null → 2,5 (entra em 0,3 s, sai em 0,5 s). A posição continua no alto (8 %).
3. **Cartão do alto no padrão da referência:** dois tipos, `mensagem` (fundo creme, remetente verde, texto preto grande) e `alerta` (vermelho, triângulo, rótulo + ordem em caixa alta); 90 % da largura, y 5–14 %, borda escura grossa; **fica o tempo da mensagem** (campo `duracao_s` no evento `celular.notificacao`, padrão 4 s) em vez de 3,2 s fixos.
4. **Tela da pergunta:** a cena continua (véu preto ≈ 0,35 em vez de apagar até o preto); entra em 0,2 s; dura 4 s; botões vermelho (arriscar) e azul (ficar) com emoji e texto em caixa alta de 2 linhas; sem A/B; "Comenta aqui 👇" em amarelo. Nos 1–4 s antes do cartão, aproximação lenta automática do alvo do último `olhar`. Risco: conferir se o Chromium do render desenha emoji (no Windows tem Segoe UI Emoji; no Linux da nuvem pode faltar a fonte).
5. **30 fps** (`canal.json → fps` 60 → 30): é o que a referência entrega. Corta o render pela metade (hipótese: ≈ 78 min em vez de 157 min nesta CPU).
6. **Som:** camada de zumbido grave contínuo (síntese nossa, 40–50 Hz com harmônicos, nunca some) por baixo do ambiente; o ducking da tensão fica mais leve, porque o grave não disputa a faixa da voz. Bipe triplo no alerta e batidas já existem como efeitos.
7. **Câmera que anda entre lugares** (o maior ganho de "estar lá", também o maior trabalho): permitir 2–4 lugares por episódio ligados por trechos de caminhada/corrida em primeira pessoa e um salto por tela preta de ≈ 1 s. Exige cenários novos e o movimento `ir_para` entre marcas de lugares diferentes. Fazer depois de 1–6, num episódio-teste.
