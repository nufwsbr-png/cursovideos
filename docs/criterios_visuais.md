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
