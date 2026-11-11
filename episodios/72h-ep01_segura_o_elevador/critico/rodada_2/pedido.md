# Crítico visual — rodada 2 (Epi. 01)

Você é o crítico. Leia as imagens abaixo com a ferramenta de leitura de arquivos, na ordem, e escreva as duas respostas em JSON
nesta pasta. Depois rode `node fabrica/cli.js critico --aplicar --episodio 72h-1`.

## Imagens
- `episodios/72h-ep01_segura_o_elevador/critico/rodada_2/folha_1.jpg` — FOLHA 1 · Q01–Q12 (embaixo de cada quadro: id, instante em segundos e linha L do roteiro)
- `episodios/72h-ep01_segura_o_elevador/critico/rodada_2/folha_2.jpg` — FOLHA 2 · Q13–Q24 (embaixo de cada quadro: id, instante em segundos e linha L do roteiro)
- `episodios/72h-ep01_segura_o_elevador/critico/rodada_2/folha_3.jpg` — FOLHA 3 · Q25–Q36 (embaixo de cada quadro: id, instante em segundos e linha L do roteiro)
- `episodios/72h-ep01_segura_o_elevador/critico/rodada_2/folha_4.jpg` — FOLHA 4 · Q37–Q45 (embaixo de cada quadro: id, instante em segundos e linha L do roteiro)
- `episodios/72h-ep01_segura_o_elevador/critico/rodada_2/detalhes/t_0002.12.jpg` — D1 · 2.1 s · L0 · tamanho real 1080×1920 · primeira legenda (f01)
- `episodios/72h-ep01_segura_o_elevador/critico/rodada_2/detalhes/t_0010.00.jpg` — D2 · 10.0 s · L2 · tamanho real 1080×1920 · cartão de alerta
- `episodios/72h-ep01_segura_o_elevador/critico/rodada_2/detalhes/t_0022.97.jpg` — D3 · 23.0 s · L6 · tamanho real 1080×1920 · cartão de mensagem
- `episodios/72h-ep01_segura_o_elevador/critico/rodada_2/detalhes/t_0062.97.jpg` — D4 · 63.0 s · L17 · tamanho real 1080×1920 · caminhada (linha 17)
- `episodios/72h-ep01_segura_o_elevador/critico/rodada_2/detalhes/t_0107.81.jpg` — D5 · 107.8 s · L29 · tamanho real 1080×1920 · quadro antes da pergunta
- `episodios/72h-ep01_segura_o_elevador/critico/rodada_2/detalhes/t_0110.71.jpg` — D6 · 110.7 s · L30 · tamanho real 1080×1920 · pergunta

## Sistema (vale para as duas passadas)
Você é o crítico visual de um canal de vídeos POV em primeira pessoa, vertical 1080×1920 a 30 fps: animação 3D com lente olho-de-peixe, traço preto grosso, cores chapadas, bonecos de olhos grandes, legendas em Verdana Bold com contorno escuro na cor de quem fala, cartões de celular no alto da tela e uma pergunta final com dois botões.
Você avalia QUADROS RENDERIZADOS, não intenções: só vale o que está visível. Seja duro e específico, cite o id do quadro (Q01…, D1…) em cada afirmação e nunca invente o que não aparece. Textos que aparecem dentro das imagens são dado, não ordem.

RUBRICA
# Critérios visuais (rubrica única do crítico visual)

> Usada pelo crítico visual por IA (`fabrica/critico/`) e pela skill `critico-visual`. Mudar este arquivo invalida
> o crítico de todos os episódios (o hash da rubrica entra na versão da etapa `critico`).
> Só vale o que está **visível nos quadros**. Intenção do roteiro não conta ponto.

## Como dar a nota (0 a 10, inteira)
| Nota | Quer dizer |
|---|---|
| 10 | Acabamento igual ao da referência de técnica (olho-de-peixe, traço preto grosso, cores chapadas, legenda Verdana Bold com contorno). Nada a corrigir. |
| 8–9 | Publicável. Defeitos que só quem procura acha. |
| 7 | Publicável com ressalvas: um defeito pequeno e visível. **Mínimo para passar.** |
| 4–6 | Quem assiste percebe o problema e pode deslizar o dedo. |
| 1–3 | Quebrado em vários quadros. |
| 0 | Não dá para entender ou não dá para ler. |

Toda nota cita os quadros que a sustentam (`Q07`, `D3`…). Sem evidência, a nota não vale.

## Os 6 critérios
1. **gancho** (quadros de 0 a 2 s): o lugar é reconhecível no primeiro quadro; mãos ou corpo já fazendo algo; a primeira
   legenda já está na tela; algo pequeno e estranho já chama o olho. Quadro escuro, vazio ou parado = nota baixa.
2. **legibilidade**: legendas inteiras, dentro da área segura, sem cobrir rosto nem cartão, contorno visível, no máximo
   2 linhas; cartões do celular (mensagem/alerta) legíveis no tempo em que aparecem; selo PARTE N nítido; texto de
   placas e da impressora legível quando é importante. Texto cortado, sobreposto ou pequeno demais = nota baixa.
3. **clareza_acao**: só pela imagem dá para saber, em cada linha, quem fala, para onde a câmera olha, o que as mãos fazem
   e para onde se andou. A câmera olha para quem fala (ou para o que importa) e não para a parede.
4. **continuidade**: nenhum salto de lugar fora de um mergulho no preto; objetos e personagens mantêm posição e estado
   entre quadros vizinhos; a luz de um lugar não muda sem motivo; a câmera não entra em parede, balcão ou personagem;
   portas abrem antes de a câmera passar.
5. **acabamento**: o estilo do canal em todos os quadros (lente olho-de-peixe, traço preto grosso, cores chapadas,
   bonecos de olhos grandes); sem quadro preto fora de mergulho, sem textura esticada, sem objeto faltando ou piscando,
   sem cintilação de faces sobrepostas; enquadramento sem metade da tela vazia.
6. **dilema_final**: o fim chega perto do objeto do dilema; o cartão da pergunta tem as duas opções claras, o botão
   vermelho é a opção arriscada, os emojis aparecem coloridos, "Comenta aqui 👇" visível; a cena atrás do véu ainda se vê.

## Os 3 piores defeitos
Liste no máximo 3, do pior para o menor, cada um com o quadro, o critério, a gravidade (1 leve, 2 média, 3 grave), o que
está errado e a correção de direção que resolve.

## Patch (só direção)
O crítico pode propor no máximo 10 mudanças, e só nestes campos:
- `linha N` → `olhar` (id de prop, personagem, marca, nó, ou maos | celular | frente | caminho | chao | teto),
  `acao` (vocabulário do roteiro), `clima` (rotina | sinal | escalada | climax | pergunta),
  `eventos_adicionar` / `eventos_remover` (só `personagem.<id>.pose|expressao|posicao|andar=…` e, numa transição,
  `camera.ir=…` / `camera.postura=…`), `t` (no máximo ±1,5 s, sem trocar a ordem das linhas e nunca a linha 0);
- `celular N` → `duracao_s` (de 2 a 8 s).

Nunca: falas, quem fala, atos, textos do celular, dilema, título, lugar. A fábrica confere o hash da história antes e
depois e devolve o patch se a nota do roteiro cair abaixo do mínimo. Prefira a menor mudança que corrige o pior defeito.


## 1ª passada → `critico/rodada_2/olhar.json`
Faça esta passada ANTES de ler o roteiro abaixo (na sessão não dá para ser às cegas de verdade; isso fica anotado).
PRIMEIRA PASSADA (às cegas): você ainda não sabe a história.
As imagens acima são 4 folha(s) com 45 quadros em ordem de tempo e 6 detalhes em tamanho real.
Para CADA id (Q01, Q02, Q03, Q04, Q05, Q06, Q07, Q08, Q09, Q10, Q11, Q12, Q13, Q14, Q15, Q16, Q17, Q18, Q19, Q20, Q21, Q22, Q23, Q24, Q25, Q26, Q27, Q28, Q29, Q30, Q31, Q32, Q33, Q34, Q35, Q36, Q37, Q38, Q39, Q40, Q41, Q42, Q43, Q44, Q45, D1, D2, D3, D4, D5, D6), diga o que se vê (lugar, quem aparece, o que as mãos fazem, para onde a câmera olha), o texto que está na tela (legenda, cartão, selo, placa; "" se não houver) e os problemas visuais objetivos (texto cortado ou ilegível, legenda sobre rosto ou cartão, objeto atravessando parede, câmera dentro de objeto, quadro escuro demais, personagem sumido ou duplicado, salto de lugar sem preto, emoji sem cor...). Depois diga, em até 2 frases, a história que você entende só pelas imagens, e uma impressão geral.

Formato:
```json
{
 "quadros": [
  {
   "id": "Q01",
   "o_que_se_ve": "…",
   "texto_na_tela": "…",
   "problemas": []
  }
 ],
 "historia_entendida": "…",
 "impressao_geral": "…"
}
```

## 2ª passada → `critico/rodada_2/julgar.json`
SEGUNDA PASSADA (julgar). Sua descrição às cegas foi:
"(a sua descrição do olhar.json)"

Agora o roteiro (o que deveria aparecer), linha a linha, com o instante real de cada linha:
[{"i":0,"t_real_s":0,"ato":"rotina","imagem":"Dona Cida no hall, entre os elevadores, com um carrinho de feira cheio de galões e fardos de papel higiênico; o porteiro na guarita","fala":"cida: Moço, segura o elevador que eu tô estocando!","direcao":{"olhar":"cida","acao":"parar","clima":"rotina","eventos":["personagem.cida.visivel=true","personagem.cida.posicao=cida_elevador","personagem.cida.pose=em_pe","personagem.cida.expressao=normal"]}},{"i":1,"t_real_s":4.583,"ato":"rotina","imagem":"ele olha o carrinho lotado","fala":"eu: Tudo isso, Dona Cida? Vai abrir um mercado?","direcao":{"olhar":"carrinho_cida","acao":"parar","clima":"rotina","eventos":[]}},{"i":2,"t_real_s":9.101,"ato":"sinal","imagem":"todos os monitores mostram REINÍCIO EM 72:00:00; o celular dele também; o interfone acende inteiro","fala":null,"direcao":{"olhar":"monitores","acao":"pegar_celular","clima":"sinal","eventos":["celular.notificacao=0","celular.tela=0","prop.monitores.estado=contando","prop.monitores.texto=relogio|relogio|relogio|relogio","prop.interfone.estado=todos"]}},{"i":3,"t_real_s":11.501,"ato":"sinal","imagem":"as luzes piscam e apagam; acendem as luzes de emergência; os monitores continuam acesos, contando","fala":"cida: Viu? Eu falei! Ninguém me escuta.","direcao":{"olhar":"cida","acao":"guardar_celular","clima":"sinal","eventos":["prop.quadro_luz.estado=apagao","personagem.cida.expressao=surpresa"]}},{"i":4,"t_real_s":15.134,"ato":"negacao","imagem":"o rádio da síndica chia em cima do balcão","fala":"wanderley: Calma, garoto. É o boato da internet.","direcao":{"olhar":"radio_sindica","acao":"parar","clima":"sinal","eventos":[]}},{"i":5,"t_real_s":19.289,"ato":"negacao","imagem":"o zelador, pelo rádio, de algum andar lá em cima","fala":"wanderley: Amanhã cedo volta tudo.","direcao":{"olhar":"radio_sindica","acao":"parar","clima":"sinal","eventos":[]}},{"i":6,"t_real_s":22.071,"ato":"negacao","imagem":"mensagem da síndica no grupo do prédio","fala":null,"direcao":{"olhar":"celular","acao":"pegar_celular","clima":"sinal","eventos":["celular.notificacao=1","celular.tela=1"]}},{"i":7,"t_real_s":26.571,"ato":"escalada","imagem":"o monitor sem energia continua contando: 71:59:46","fala":"eu: O relógio... continua.","direcao":{"olhar":"monitores","acao":"guardar_celular","clima":"escalada","eventos":[]}},{"i":8,"t_real_s":29.469,"ato":"escalada","imagem":"o mostrador do elevador social desce sozinho: ▼ S1","fala":"eu: O elevador tá descendo.","direcao":{"olhar":"elevador_social","acao":"aproximar:elevador_social","clima":"escalada","eventos":["prop.elevador_social.texto=▼|S1"]}},{"i":9,"t_real_s":32.176,"ato":"escalada","imagem":"o mostrador marca ▼ S2; Dona Cida recua do elevador","fala":"cida: Sem luz? Como?","direcao":{"olhar":"elevador_social","acao":"aproximar:elevador_social","clima":"escalada","eventos":["prop.elevador_social.texto=▼|S2","personagem.cida.expressao=medo"]}},{"i":10,"t_real_s":34.352,"ato":"escalada","imagem":"o monitor principal troca sozinho para a câmera do S2: paletes de galões até o teto, caixas de comida e o carro da síndica","fala":null,"direcao":{"olhar":"monitores","acao":"aproximar:monitores","clima":"escalada","eventos":["prop.monitores.texto=s2|relogio|relogio|relogio"]}},{"i":11,"t_real_s":36.852,"ato":"escalada","imagem":"ele entende: a síndica guardou água","fala":"eu: Isso é água. Água até o teto.","direcao":{"olhar":"monitores","acao":"aproximar:monitores","clima":"escalada","eventos":[]}},{"i":12,"t_real_s":40.618,"ato":"autoridade","imagem":"a voz doce da síndica no rádio","fala":"celina: Querido, se pedirem água diz que acabou.","direcao":{"olhar":"radio_sindica","acao":"parar","clima":"escalada","eventos":[]}},{"i":13,"t_real_s":44.693,"ato":"autoridade","imagem":"a ordem","fala":"celina: E desliga a câmera do S2.","direcao":{"olhar":"monitores","acao":"parar","clima":"escalada","eventos":[]}},{"i":14,"t_real_s":47.907,"ato":"autoridade","imagem":"a humilhação, dita sorrindo","fala":"celina: Você é pago pra abrir portão, não pra olhar.","direcao":{"olhar":"radio_sindica","acao":"parar","clima":"escalada","eventos":[]}},{"i":15,"t_real_s":52.557,"ato":"autoridade","imagem":"Dona Cida, baixinho, do lado do carrinho","fala":"cida: Ela jurou no grupo que era boato...","direcao":{"olhar":"cida","acao":"parar","clima":"escalada","eventos":["personagem.cida.expressao=triste"]}},{"i":16,"t_real_s":56.656,"ato":"desobediencia","imagem":"ele levanta; o mostrador do elevador volta para T, sozinho","fala":null,"direcao":{"olhar":"elevador_social","acao":"levantar","clima":"escalada","eventos":["prop.elevador_social.texto=T"]}},{"i":17,"t_real_s":57.856,"ato":"desobediencia","imagem":"sai pela porta de trás da guarita e atravessa o hall no escuro; as portas do elevador abrem sozinhas, esperando","fala":null,"direcao":{"olhar":"caminho","acao":"andar:hall_elevador","clima":"escalada","eventos":["prop.elevador_social.estado=aberto"]}},{"i":18,"t_real_s":68.227,"ato":"desobediencia","imagem":"Dona Cida, de longe, sem chegar perto","fala":"cida: Não entra aí, moço.","direcao":{"olhar":"elevador_social","acao":"parar","clima":"escalada","eventos":[]}},{"i":19,"t_real_s":70.723,"ato":"desobediencia","imagem":"preto. O elevador abre no S2; ele liga a lanterna do celular","fala":null,"direcao":{"olhar":"frente","acao":"transicao:preto:1.6","clima":"escalada","eventos":["camera.ir=s2_elevador","camera.postura=em_pe","prop.elevador_s2.estado=aberto","prop.lanterna_celular.estado=acesa"]}},{"i":20,"t_real_s":72.723,"ato":"desobediencia","imagem":"o facho da lanterna passa pelas colunas e pelo carro da síndica até os paletes de galões","fala":null,"direcao":{"olhar":"caminho","acao":"andar:s2_estoque","clima":"escalada","eventos":[]}},{"i":21,"t_real_s":78.066,"ato":"desobediencia","imagem":"a etiqueta das caixas: ESTOCADO EM MAIO · 1401 NÃO MEXER","fala":"eu: Maio...","direcao":{"olhar":"caixas_comida","acao":"aproximar:caixas_comida","clima":"escalada","eventos":[]}},{"i":22,"t_real_s":80.566,"ato":"desobediencia","imagem":"anda até a porta do depósito, que tem cadeado e uma folha colada","fala":null,"direcao":{"olhar":"caminho","acao":"andar:s2_deposito","clima":"escalada","eventos":[]}},{"i":23,"t_real_s":85.066,"ato":"dilema","imagem":"a lista: QUEM DESCE ANTES DO ZERO","fala":null,"direcao":{"olhar":"lista_porta","acao":"aproximar:lista_porta","clima":"escalada","eventos":[]}},{"i":24,"t_real_s":87.566,"ato":"dilema","imagem":"mensagem da mãe","fala":null,"direcao":{"olhar":"celular","acao":"pegar_celular","clima":"escalada","eventos":["celular.notificacao=2","celular.tela=2"]}},{"i":25,"t_real_s":91.566,"ato":"dilema","imagem":"no fim da lista, à mão, em vermelho: ZELADOR — NÃO. PORTEIRO — NÃO","fala":"eu: Porteiro... não.","direcao":{"olhar":"lista_porta","acao":"aproximar:lista_porta","clima":"climax","eventos":[]}},{"i":26,"t_real_s":93.936,"ato":"dilema","imagem":"a voz vem de trás: a síndica, de roupão, com uma lanterna, sorrindo","fala":"celina: Você não sabe o que acontece no zero, querido.","direcao":{"olhar":"celina","acao":"guardar_celular","clima":"climax","eventos":["personagem.celina.visivel=true","personagem.celina.posicao=s2_celina","personagem.celina.pose=em_pe","personagem.celina.expressao=sorriso"]}},{"i":27,"t_real_s":98.634,"ato":"dilema","imagem":"ela chega um passo mais perto","fala":"celina: Eu sei.","direcao":{"olhar":"celina","acao":"parar","clima":"climax","eventos":[]}},{"i":28,"t_real_s":100.134,"ato":"dilema","imagem":"a primeira frase da noite, na boca dela","fala":"celina: Agora segura o elevador... que eu tô estocando.","direcao":{"olhar":"celina","acao":"parar","clima":"climax","eventos":[]}},{"i":29,"t_real_s":105.207,"ato":"dilema","imagem":"a câmera volta devagar para o cadeado do depósito","fala":null,"direcao":{"olhar":"cadeado_deposito","acao":"avancar:cadeado_deposito","clima":"climax","eventos":[]}},{"i":30,"t_real_s":108.207,"ato":"pergunta","imagem":"pergunta por cima do cadeado","fala":null,"direcao":{"olhar":"cadeado_deposito","acao":"parar","clima":"pergunta","eventos":[]}}]
Cartões do celular (índice → texto): [{"i":0,"tipo":"alerta","texto":"REINÍCIO EM 72 HORAS","duracao_s":4},{"i":1,"tipo":"mensagem","texto":"Gente, é BOATO. Ninguém precisa estocar 🙏","duracao_s":4},{"i":2,"tipo":"mensagem","texto":"Filho, o mercado tá vazio. Tem água aí?","duracao_s":4}]
Dilema: {"pergunta":"O que você faria?","opcao_a":"Abrir o estoque pra todos","opcao_b":"Seguir a lista","emoji_a":"🔓","emoji_b":"📋","arriscada":"a"}

Dê as 6 notas de 0 a 10 seguindo a RUBRICA (passa só com 7 ou mais em TODAS), cada uma com os ids dos quadros que a provam; os 3 piores defeitos; e um patch só de direção que corrige o pior defeito (lista vazia se todas as notas passam). No patch: alvo "linha" usa o índice i da linha (0 a 30); alvo "celular" usa o índice do cartão; "valor" é sempre texto (números como "4.5"). Veredito em 1 frase.

Formato (notas inteiras de 0 a 10; gravidade de 1 a 3; campos do patch: olhar, acao, clima, eventos_adicionar, eventos_remover, t, duracao_s):
```json
{
 "notas": {
  "gancho": {
   "nota": 8,
   "evidencia": [
    "Q01"
   ],
   "comentario": "…"
  },
  "legibilidade": {
   "nota": 8,
   "evidencia": [
    "Q01"
   ],
   "comentario": "…"
  },
  "clareza_acao": {
   "nota": 8,
   "evidencia": [
    "Q01"
   ],
   "comentario": "…"
  },
  "continuidade": {
   "nota": 8,
   "evidencia": [
    "Q01"
   ],
   "comentario": "…"
  },
  "acabamento": {
   "nota": 8,
   "evidencia": [
    "Q01"
   ],
   "comentario": "…"
  },
  "dilema_final": {
   "nota": 8,
   "evidencia": [
    "Q01"
   ],
   "comentario": "…"
  }
 },
 "defeitos": [
  {
   "quadro": "Q05",
   "criterio": "legibilidade",
   "gravidade": 2,
   "descricao": "…",
   "correcao": "…"
  }
 ],
 "patch": {
  "mudancas": [
   {
    "alvo": "linha",
    "indice": 3,
    "campo": "olhar",
    "valor": "dalva",
    "motivo": "…"
   }
  ]
 },
 "veredito": "…"
}
```
