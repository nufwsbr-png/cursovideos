# Regras de roteiro (Parte 5 do livro, resumidas para a IA)

## Os 8 atos, sempre nesta ordem (capítulo 36)
1 Rotina (mãos fazendo algo banal; lugar reconhecível em 2 s; fala banal; nada de "olá pessoal") → 2 Primeiro sinal (**até 7 s**: luz, som, celular, pessoa, objeto) → 3 Negação (alguém minimiza com piada) → 4 Escalada (escada de provas que elimina desculpas) → 5 Autoridade (ordem curta e estranha que assusta mais que o problema) → 6 Desobediência/falsa segurança → 7 Dilema pessoal (alguém importante envolvido) → 8 Pergunta (duas opções, pedido de comentário; **nunca responder no mesmo vídeo**).
A cada poucos segundos algo piora ou muda (número em `canal/canal.json → roteiro.mudanca_a_cada_s`).

## As 7 regras de fala (capítulo 40)
Sem narrador · frases curtas (vírgula = provavelmente duas falas) · protagonista fala pouco · toda fala gera reação na imagem · linguagem falada de verdade ("cê", "tá") · nada de "como você sabe..." · não mostre a ameaça.
Ritmo: menos palavras e mais imagem (números em `canal/canal.json → roteiro`); silêncio de fala é roteiro.

## Teste do dilema (capítulo 39)
Os dois lados têm razão · os dois têm risco · cabe em poucas palavras · o vídeo termina antes da resposta.

## Episódio seguinte (capítulo 44)
Começa no último segundo do anterior, já no perigo · selo "PARTE N" na primeira linha · respeita o voto · os dois caminhos voltam à espinha em até um episódio · toda resposta traz uma pergunta pior · o que está fechado continua fechado.

## Formato de saída
Tabela (tempo, ato, imagem, fala, som) + direção estruturada (olhar, ação, clima, eventos) + lista de falas (id, quem, voz, texto, estilo) — ver `docs/CONTRATOS.md §2`. Só ids que existem em `canal/canal.json` (props, marcas, personagens).

## Lugar-comum proibido (capítulo 42)
Trocar sempre: "algo está errado", "precisamos sair daqui agora", "isso não é normal", "você não vai acreditar".

## Temas proibidos (capítulo 23)
Tragédia real, ataque em escola, doença/remédio, golpe/crime como tutorial, polícia/exército reais, política, religião, suicídio/automutilação, menores sexualizados ou agredidos, estereótipos. Medo sem violência: o que não se vê assusta mais.

## 30 tipos de virada (capítulo 45) — usar quando travar
Pessoas: quem ajudava sabia; quem parecia perigoso protegia; dois dizem a mesma coisa; chamam você por um nome; a voz é a sua; quem sumiu volta calmo; desconhecido conhece sua família; alguém pede para não ser salvo; o chefe tem a mesma marca; quem você ama é quem pede.
Regras: a regra era armadilha; quem escreveu foi você; a regra mudou sem aviso; seguir a regra piora; há segunda regra; a ameaça obedece a alguém; a ameaça imita; só funciona se alguém abrir; quem manda o alerta é o problema; a saída é a entrada.
Lugar/tempo: você já esteve aqui; passaram 3 dias; a foto mostra você lá ontem; o mapa não tem esse lugar; porta nova; mensagem de amanhã; relógios diferentes; o lugar é cópia; o barulho vem de dentro; a primeira cena volta com outro sentido.

## Títulos (capítulo 45/71)
Lugar + situação · frase memorável · escolha do público. Texto: "[Situação em uma frase] + Epi. XX + 2 a 4 hashtags". Nunca prometer o que o vídeo não mostra; "parte 2" só quando existir.

---

## Regras aprovadas em 2026-11-10 (modelo de edição do canal de referência; só técnica)
Os números destas regras moram em `canal/canal.json → roteiro` e chegam ao prompt pelo bloco "REGRAS NUMÉRICAS";
a nota automática (`fabrica/roteiro/nota.js`, mínimo 70) confere cada uma. O estudo que as originou está em
`docs/metodo/estudo_referencia.md` (não é lido pela IA).
- **Abertura:** a primeira fala entra no primeiro segundo, no meio de uma conversa (pergunta ou ordem). Nada de apresentação.
- **Episódio 1:** os 8 atos em ordem, sinal cedo, sem selo. **Episódio seguinte:** começa já no perigo, no segundo em que o anterior parou, com o selo PARTE N na primeira linha; a frase de contexto, se houver, sai da boca do protagonista e já é ação.
- **Fala curta:** a maioria das falas tem poucas palavras; muitas têm uma, duas ou três. Menos palavras por minuto do que um diálogo normal: a imagem conta a história.
- **Trecho de ação sem fala:** todo episódio tem um trecho sem nenhuma fala em que o protagonista levanta e anda ou corre por outro lugar do mundo (porta que abre, corredor, salas), ou mexe no celular. Sem fala não é silêncio: o zumbido grave e os efeitos continuam.
- **Lugares conectados:** o episódio pode passar por vários lugares do mesmo mundo; a câmera nunca corta: muda de lugar andando/correndo pelo caminho ou com um mergulho no preto (transicao:preto) para pular tempo ou lugar.
- **Informação de fora:** chega pelo celular na mão (pegar_celular) e por um cartão grande no alto: mensagem (de quem, o texto) ou alerta (rótulo inventado + ordem curta em caixa alta).
- **Fechamento:** a última fala é uma ordem, ameaça ou frase de duplo sentido; depois, sem fala, a câmera avança devagar até o objeto da decisão (avancar:<alvo>) e entra o cartão "O que você faria?" com dois botões: a opção de agir/arriscar no vermelho, a de ficar/esperar no azul, cada uma com um emoji.
- **Virada preferida do episódio 1:** "a primeira cena volta com outro sentido" — uma frase banal dos primeiros segundos volta no fim com outro peso.
- **Corpo e cena:** o protagonista começa sentado no guichê; trabalhar e segurar telefone/bloco só sentado; para sair, levantar (ou andar, que levanta antes); as portas das passagens abrem sozinhas quando ele passa (a da plataforma, não: precisa de evento).

## Regras aprendidas (automáticas)
_(a fábrica acrescenta aqui, com data, correções que se repetiram em 3 ou mais episódios — `fabrica/aprender.js`)_
