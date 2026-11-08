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
`MOTOR_GPU=1` tenta usar a placa de vídeo (padrão: SwiftShader, que funciona em qualquer máquina, mas é lento). O vídeo sai no fps do canal (60).

Saídas ficam na pasta do episódio. `render.json` guarda: quadros gerados, segundos por quadro, qual renderizador WebGL
foi usado (`gpu`), as caixas de todas as legendas desenhadas (para o revisor conferir a área segura) e avisos.

Sem `linha_do_tempo.json`/`medidas.json`, o motor entra em **modo prévia**: estima a duração de cada fala
(palavras ÷ 2,5 + 0,3 s), desliza as linhas seguintes e usa uma boca sintética. Serve para olhar quadros antes de gastar voz.
A prévia gerada fica em `linha_do_tempo_previa.json`.

## Como o motor é montado

| Arquivo | O que faz |
|---|---|
| `motor.js` | junta tudo: carrega canal e roteiro, monta a cena, renderiza o quadro de `t` pela lente e desenha a sobreposição 2D |
| `cena/lente.js` | **a lente olho-de-peixe e o traço**: duas câmeras (45° para cima e para baixo) → cor + G-buffer (normal do mundo e distância) → remapeamento equidistante → traço por salto de distância/normal → papel, vinheta, fade (→ FXAA opcional) |
| `cena/props.js` | biblioteca de objetos do cenário (sala com forro e rodapé, guichê com vidro e furinhos, painel, porta, bancos, lanchonete, ônibus, exterior...). Tipo desconhecido vira caixa e é anotado em `render.json` |
| `cena/boneco.js` | o boneco 3D configurável no estilo da referência: cabeça grande, olhos brancos enormes com pupila que acompanha o olhar, sobrancelha fina, nariz, cabelos, óculos; corpo em cápsulas; boca por volume |
| `cena/corpo_pov.js` | as duas mãos (palma arredondada, dedos em cápsulas, polegar) e as mangas com punho em primeira pessoa, os objetos (carimbo, bloco, caneta, fone, celular) e as poses por ação |
| `cena/cabeca.js` | a câmera é a cabeça: giros suaves, inclinação natural de 10° para baixo, balanço ao andar, tremor, pancada, fade e aproximação |
| `cena/estado.js` | reproduz os eventos de todas as linhas até `t` (estado dos props, posição e pose do elenco, tela do celular) |
| `cena/sobreposicao.js` | legendas (Baloo 2, cor de quem fala, contorno e sombra), cartão de notificação, selo "PARTE 2" vermelho, tela da pergunta e a textura da tela do celular |
| `cena/estilo.js` | materiais em degraus suaves (toon), texturas de texto nítidas (alta resolução + mipmaps), ladrilho, forro, parede, formas arredondadas |
| `cena/linha_previa.js` | linha do tempo nominal do roteiro (modo prévia) |
| `renderizar.js` | Playwright + FFmpeg, todas as opções de linha de comando |
| `revisar.js` | o revisor automático |

## Por que duas câmeras e um pós-processo (a lente)

A referência aprovada pelo dono é vista por uma lente olho-de-peixe de ~115° na vertical. Uma câmera comum não chega
nisso sem esticar as bordas; por isso a imagem é montada a partir de duas câmeras normais (94°×94°, uma inclinada 45° para
cima e outra 45° para baixo, penduradas na cabeça) e remapeada no pós-processo para a projeção equidistante. A costura das
duas cai no centro do quadro, onde ambas têm **mais** pixels por grau (é onde ficam rostos e mãos). Cada câmera gera a cor e
um G-buffer (normal do mundo + distância radial calculada por fragmento, as duas independentes da câmera: a costura não aparece).

O traço é decidido por pixel do quadro final: em 3 pares de direções opostas a uma distância R (6 px perto, 2,2 px longe),
a **segunda diferença da distância** (superfície plana, mesmo rasante, dá ~0; borda dá salto) e o **ângulo entre normais**
(quina). Nunca por diferença de cor: era isso que fazia ruído em textos e texturas. Depois: papel suave (textura de ruído
com semente, não grão por pixel), cor da luz do clima, vinheta, fade. Legendas e selos são 2D, retos, desenhados por cima.

## Os controles do estilo (em português simples)

Tudo fica em `canal/canal.json → estilo`. Mexer aqui muda o canal inteiro; mexer e aprovar é tarefa do capítulo 57.

- **`lente`**: `fov_vertical` (115 = a referência; 90 = mais comum; 140 = exagerado), `anamorfico` (1,2 alarga um pouco o
  campo horizontal), `aproximar_fov` (65: para onde a lente fecha na ação `aproximar:`), `inclinacao_base_graus` (10: a cabeça
  de quem está sentado fica um pouco baixa, por isso as mãos entram no quadro mesmo olhando para a frente), `tamanho_face`
  (1536: pixels de cada câmera interna; 1024 é mais rápido e um pouco mais mole no centro), `msaa` (0; 4 só com placa de vídeo).
- **`traco`**: `espessura_px` (6 em 1080 de largura, perto), `espessura_min_px` (2,2 ao longe), `distancia_referencia_m`,
  `cor`, `limiar_distancia` (0,035: quanto de salto relativo vira linha), `limiar_normal` (0,22 ≈ 38°: quanto de quina vira linha).
- **`sombra.degraus`** (1 a 4) e **`sombra.intensidade`**: a referência usa 3 degraus suaves com intensidade 0,3.
- **`cores`**: a paleta. `c1`, `c2`, `c3` são as três cores do canal; `alerta` e `alerta_forte` contam a história no painel.
- **`textura`** (`papel` | `nenhuma`) e **`intensidade_textura`** (0,06): o grão suave em cima da imagem.
- **`antialias`** (`nenhum` | `fxaa`): o FXAA custa ~0,25 s por quadro em CPU e quase nada em GPU; as faces já saem superamostradas no centro.
- **`climas`**: para cada clima (`rotina`, `sinal`, `escalada`, `climax`, `pergunta`) a luz geral, a cor da luz, a vinheta e o tremor. A transição é suave (1,2 s).
- **`bonecos`**: proporção da cabeça e do corpo do elenco, se tem nariz. Cabelo, óculos e roupa ficam em `elenco[].visual`
  (`cabelo_estilo`: coque | curto | curto_penteado | cacheado | careca; `oculos: true`; `roupa_camisa` sob o colete).
- **`legenda`**: `fonte` (Baloo 2), `peso` (800), `tamanho` (58), `contorno`, `espessura_contorno` (9), `sombra`, `y_centro`
  (0,62 = acima da área dos botões), `largura_max` e a cor por personagem (regra da referência: a cor da roupa de quem fala).
  O motor nunca desenha abaixo de 80 % da altura nem nos 15 % da direita.
- **`selo`**: cor, cor do texto, tamanho, altura (`y` 0,08) e `duracao_s` (null = até o fim) do selo "PARTE N".
- **`celular`**: cor do aparelho, nome do aplicativo inventado, cor do aplicativo, trinca na tela.
- **`cenarios[].camera_inicial.pos`**: altura dos olhos (1,48 m sentado; o balcão fica a 1,05). É essa diferença que faz as mãos
  aparecerem de cima, como na referência.

Variáveis de ambiente úteis: `MOTOR_GPU=1` (usa a placa de vídeo), `MOTOR_FACE=1024` (faces menores, mais rápido),
`MOTOR_SEM_FXAA=0|1`, `MOTOR_PERFIL=1` (tempos por etapa no log do vídeo), `MOTOR_DEPURAR=normais|distancia` (mostra o G-buffer nos stills).

## O que foi conferido com o visual novo (ep01, SwiftShader, 2026-11-08)

- Stills em 2, 20, 24, 36, 56,5, 64, 70, 76, 90, 99, 104 e 108 s e a folha inteira (56 quadros), olhados um a um: lente, traço,
  cores e legendas iguais em todos os quadros; sem ruído por pixel; textos das placas, do painel e do bloco legíveis.
- Achado e corrigido: interpolar a distância por vértice no G-buffer errava em triângulos grandes (piso, paredes, tampo) e
  desenhava contorno falso nas manchas do chão. Agora a distância é calculada por fragmento.
- Achado e corrigido: luzes pontuais custavam ~2/3 da passada de cor; viraram "luzes falsas" (só cor/intensidade para a história).
- Velocidade aqui (CPU, SwiftShader, 4 núcleos, 1080x1920, faces de 1536): ≈ 0,85 s por quadro só de render
  (cor 0,25 · G-buffer ~0,05 · pós 0,55); no vídeo, com o FFmpeg disputando CPU, ver `render.json → segundos_por_quadro`.
  A 60 fps um episódio de 100 s tem 6 000 quadros: **conte horas em CPU; minutos com placa de vídeo (`MOTOR_GPU=1`)**. Medir e anotar.

## O que ainda está fraco (anotar no cérebro e melhorar no episódio 2)

- As mãos de perto convencem; a mão segurando o celular ainda é dura (dedos retos).
- O ônibus é visto pela porta a 12 m: pequeno demais sem `aproximar:`; o roteiro deve pedir a aproximação ou a porta mais perto.
- Os bonecos têm braços soltos (cápsulas sem ombro arredondado) e pernas curtas escondidas pelo balcão.
- Em modo prévia a duração das falas é estimada; com vozes reais a linha do tempo muda e tudo precisa ser olhado de novo.
- O revisor só mede o que é objetivo (preto, uma cor só, escuro, área segura, quadros faltando, regressão contra
  `padrao_aprovado/quadros`). Movimento, som e se a história prende continuam sendo tarefa de gente.

## Decisões tomadas por falta de informação no `canal.json`

- Altura da câmera sentada: `cenarios[].camera_inicial.pos` (1,25 m). Olhar inicial: `camera_inicial.olhar`.
- Duração do giro de cabeça: 0,6 s com ease in/out; inclinação de até 2° no giro; a lente não muda com a distância do alvo
  (como na referência); `aproximar:` fecha de 115° para 65°.
- Velocidade de andar do elenco e da câmera: 1,1 m/s; o andar da câmera para 0,9 m antes do alvo.
- Boca fecha abaixo de 8 % do envelope (evita abrir em ruído baixo).
- Legendas somem 0,15 s depois do fim da fala; empilham quando há duas ao mesmo tempo.
- Cartão de notificação dura 3,2 s no topo; selo "PARTE 2" fica até o fim (ou `estilo.selo.duracao_s`).
- A tela da pergunta aparece 0,5 s depois do início do clima `pergunta`, com as opções 0,6 s depois.
- Portas na parede do fundo viram abertura na parede (senão a parede tapa a plataforma).
