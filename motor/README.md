# Motor de vídeos em primeira pessoa (three.js)

O motor desenha o episódio quadro a quadro dentro de um Chromium controlado por programa (Playwright) e o
FFmpeg junta os quadros em MP4. **Cada quadro depende só do tempo `t`**: gerar o segundo 10 agora ou
daqui a uma semana dá a mesma imagem. Não há aleatório sem semente (`estilo.semente` no `canal/canal.json`).

Formatos de entrada e saída: ver `docs/CONTRATOS.md` (seções 1, 2, 5, 6 e 10).

## Comandos

```
node motor/renderizar.js --episodio episodios/ep01_x --stills 0,2,5.6,24        # stills/t_0005.60.png ...
node motor/renderizar.js --episodio episodios/ep01_x --sequencia 23.5,25.5      # sequencia/: 1 quadro a cada 0,1 s (giros, portas)
node motor/renderizar.js --episodio episodios/ep01_x --folha [--passo 2]        # folha.png com o tempo e o clima em cada miniatura
node motor/renderizar.js --episodio episodios/ep01_x --video [--inicio 0 --fim 8] [--escala 0.5]   # video_mudo.mp4 (sem som)
node motor/renderizar.js --teste-estilos --cenario saguao --saida padrao_aprovado/estilos [--tempo-estilo 74]
node motor/revisar.js    --episodio episodios/ep01_x                            # revisao.json + resumo no terminal
node motor/servidor.js [porta]                                                  # abre o motor no navegador para olhar à mão
```

Opções: `--escala 0.5` renderiza na metade (rápido, só para olhar); `--formato jpg|png` para stills e sequência;
`MOTOR_GPU=1` tenta usar a placa de vídeo (padrão: SwiftShader, que funciona em qualquer máquina, mas é lento).

Saídas ficam na pasta do episódio. `render.json` guarda: quadros gerados, segundos por quadro, qual renderizador WebGL
foi usado (`gpu`), as caixas de todas as legendas desenhadas (para o revisor conferir a área segura) e avisos.

Sem `linha_do_tempo.json`/`medidas.json`, o motor entra em **modo prévia**: estima a duração de cada fala
(palavras ÷ 2,5 + 0,3 s), desliza as linhas seguintes e usa uma boca sintética. Serve para olhar quadros antes de gastar voz.
A prévia gerada fica em `linha_do_tempo_previa.json`.

## Como o motor é montado

| Arquivo | O que faz |
|---|---|
| `motor.js` | junta tudo: carrega canal e roteiro, monta a cena, renderiza o quadro de `t`, aplica o pós-processo e a sobreposição 2D |
| `cena/props.js` | biblioteca de objetos do cenário (sala, guichê, painel, porta, bancos, lanchonete, ônibus, exterior...). Tipo desconhecido vira caixa e é anotado em `render.json` |
| `cena/boneco.js` | o boneco 3D configurável: mesmo esqueleto, outra roupa, cabelo, proporção, expressão e boca por volume |
| `cena/corpo_pov.js` | as duas mãos e os antebraços em primeira pessoa, os objetos (carimbo, bloco, caneta, fone, celular) e as poses por ação |
| `cena/cabeca.js` | a câmera é a cabeça: giros suaves, inclinação, balanço ao andar, tremor, pancada, fade e aproximação |
| `cena/estado.js` | reproduz os eventos de todas as linhas até `t` (estado dos props, posição e pose do elenco, tela do celular) |
| `cena/sobreposicao.js` | legendas, cartão de notificação, selo "PARTE 2", tela da pergunta e a textura da tela do celular |
| `cena/estilo.js` | materiais em degraus (toon), texturas de texto e de ladrilho |
| `cena/linha_previa.js` | linha do tempo nominal do roteiro (modo prévia) |
| `renderizar.js` | Playwright + FFmpeg, todas as opções de linha de comando |
| `revisar.js` | o revisor automático |

## Os controles do estilo (em português simples)

Tudo fica em `canal/canal.json → estilo`. Mexer aqui muda o canal inteiro; mexer e aprovar é tarefa do capítulo 57.

- **`traco.espessura`** (0,008 a 0,025): grossura da linha preta em volta das coisas. O traço é desenhado comparando
  profundidade, inclinação e cor entre pixels vizinhos, então fica estável de um quadro para o outro (não "treme") e
  mais fino ao longe (personagem distante não vira borrão). `traco.cor` é a cor da linha. `acabamento: "irregular"` dá um
  tremido de xilogravura.
- **`sombra.degraus`** (1 a 4) e **`sombra.intensidade`**: quantos tons de sombra cada cor tem e quão escura é a parte
  escura. 1 degrau = chapado; 2 = nosso padrão; 3 = gibi.
- **`cores`**: a paleta. `c1`, `c2`, `c3` são as três cores do canal; `alerta` e `alerta_forte` são as cores que contam a
  história no painel (âmbar normal → vermelho-tijolo quando o das 3h aparece).
- **`lente`** por clima (0 = reta, 0,6 = bem curva): curvatura das bordas, sensação de olho humano nervoso. Sobe nos
  climas de tensão.
- **`textura`** (`papel` | `reticula` | `nenhuma`) e **`intensidade_textura`**: o grão em cima da imagem.
- **`climas`**: para cada clima (`rotina`, `sinal`, `escalada`, `climax`, `pergunta`) a luz geral, a cor da luz, a vinheta
  (escurecimento das bordas) e o tremor da câmera. A transição entre climas é suave (1,2 s).
- **`bonecos`**: proporção da cabeça e do corpo do elenco, formato do rosto, se tem nariz.
- **`legenda`**: fonte, tamanho, contorno, altura do centro (`y_centro` 0,62 = acima da área dos botões), largura máxima e
  a cor por personagem. O motor nunca desenha abaixo de 80 % da altura nem nos 15 % da direita.
- **`celular`**: cor do aparelho, nome do aplicativo inventado, cor do aplicativo, trinca na tela.

## O que foi conferido neste piloto (ep01, modo prévia, SwiftShader)

- Stills nos momentos 0, 2, 5,6, 13,4, 24, 31, 51, 62,4, 67,4, 90 e 95 s (e vários outros), olhados um a um.
- Sequências 5→7 s e 62→64 s (0,1 s entre quadros): giro Dalva → mãos → painel sem tela preta nem quadro pulado; porta
  aberta com o ônibus visto por ela, sem ver o interior nem motorista.
- Vídeo 0→8 s em meia escala: 540x960, 30 fps, 240 quadros, yuv420p (ffprobe). Em escala 1 o MP4 sai 1080x1920.
- Folha do episódio inteiro (56 quadros) e `revisar.js`: nenhum problema objetivo (sem quadro preto fora da pergunta,
  legendas dentro da área segura, nenhum quadro faltando).
- Teste dos 3 estilos (A xilogravura, B gibi com retícula, C cartaz pintado) em `padrao_aprovado/estilos/`.
- Velocidade aqui (CPU, SwiftShader, 4 núcleos): **0,17 s/quadro em meia escala** e **0,71 s/quadro em 1080x1920**
  → episódio de 100 s (3 000 quadros) ≈ 36 min. Com placa de vídeo (`MOTOR_GPU=1`) a expectativa é bem menos; medir e anotar.

## O que ainda está fraco (anotar no cérebro e melhorar no episódio 2)

- As mãos são blocos simples; funcionam de longe, mas de perto o punho é "quadrado". Dedos são um bloco só com sulcos,
  de propósito (menos linhas entre os dedos).
- O ônibus é visto pela porta como uma parede cinza com janelas acesas. Cumpre "ameaça escondida", mas um letreiro
  maior ajudaria a ler "03:00".
- Dalva em `limpando` segura o rodo de frente; o balanço do corpo é sutil demais em miniatura.
- Em modo prévia a duração das falas é estimada; com vozes reais a linha do tempo muda e tudo precisa ser olhado de novo.
- A textura de papel e o traço são calculados em tela cheia: em SwiftShader isso é metade do tempo de cada quadro.
- O revisor só mede o que é objetivo (preto, uma cor só, escuro, área segura, quadros faltando, regressão contra
  `padrao_aprovado/quadros`). Movimento, som e se a história prende continuam sendo tarefa de gente.

## Decisões tomadas por falta de informação no `canal.json`

- Altura da câmera sentada: `cenarios[].camera_inicial.pos` (1,25 m). Olhar inicial: `camera_inicial.olhar`.
- Duração do giro de cabeça: 0,6 s com ease in/out; inclinação de até 2° no giro; FOV base 72°, fechando até 50° quando o
  alvo está a mais de 12 m e até 30° em `aproximar:`.
- Velocidade de andar do elenco e da câmera: 1,1 m/s; o andar da câmera para 0,9 m antes do alvo.
- Boca fecha abaixo de 8 % do envelope (evita abrir em ruído baixo).
- Legendas somem 0,15 s depois do fim da fala; empilham quando há duas ao mesmo tempo.
- Cartão de notificação dura 3,2 s no topo; selo "PARTE 2" dura 4,5 s.
- A tela da pergunta aparece 0,5 s depois do início do clima `pergunta`, com as opções 0,6 s depois.
- Portas na parede do fundo viram abertura na parede (senão a parede tapa a plataforma).
