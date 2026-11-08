# Aprendizados (medido × hipótese)

Formato: `- [DATA] [MEDIDO|HIPÓTESE|REGRA] texto — motivo/fonte`

## Regras fixadas pelo dono
- [2026-11-08] [REGRA] Nunca copiar o canal do livro (Teco Sobrevive) nem o exemplo "Posto 24h": lugar, papel, crise, regra e visual são nossos — combinado da página 9.
- [2026-11-08] [REGRA] Voz falsa bloqueia publicação — só serve para testar a fábrica.
- [2026-11-08] [REGRA] Toda anotação separa medido de hipótese (capítulo 55).

## Medido (números com data)
_(preenchido pela fábrica: tempos de render, LUFS, durações; e pelo dono: números do Studio)_

## Hipóteses para testar
- [2026-11-08] [HIPÓTESE] O primeiro sinal aos 5,6 s com clique no alto-falante + painel prende melhor que um sinal só visual — testar retenção nos primeiros 7 s do Epi. 01 contra o Epi. 02.
- [2026-11-08] [HIPÓTESE] A frase "Uma pra das três, por favor" dita no silêncio (67–70 s) é o pico de comentários — comparar comentários ÷ views com episódios sem silêncio.

## Problemas e soluções
_(a fábrica anexa aqui quando algo falha e é consertado)_
- [2026-11-08] [MEDIDO] Motor em CPU (SwiftShader, 4 núcleos): 0,17 s/quadro em meia escala e 0,71 s/quadro em 1080x1920 → episódio de 100 s ≈ 36 min. Com placa de vídeo (MOTOR_GPU=1) ainda não medido.
- [2026-11-08] [MEDIDO] Piloto com voz falsa: linha do tempo de 111,7 s (as vozes de teste saem 12,7 s mais longas que a estimativa de 2,5 palavras/s); mixagem -16,0 LUFS, pico -1,8 dBTP, voz 9,5 dB acima do fundo.
- [2026-11-08] [REGRA] Decisões do motor tomadas por falta de dado no canal.json (mudar só com pedido): giro de cabeça 0,6 s com ease; FOV base 72°, fecha até 30° em "aproximar"; andar a 1,1 m/s; boca fecha abaixo de 8 % do envelope; legenda some 0,15 s após a fala; cartão de notificação 3,2 s; selo PARTE 2 por 4,5 s; tela da pergunta 0,5 s após o clima "pergunta"; porta na parede do fundo vira abertura.
- [2026-11-08] [REGRA] Regras de som derivadas dos eventos do roteiro (audio/_linha_previa.py): telefone tocando → campainha; porta → rangido; ônibus chegando/parado → motor/freio; notificação → vibração; painel alerta → clique triplo; luz fraca → estalo; andar → passos; trabalhar → carimbo. O campo "som" da linha só vira efeito quando nenhum evento já cobre o instante.
- [2026-11-08] [HIPÓTESE] Pontos fracos vistos nos quadros do piloto: mãos de perto são blocos; o ônibus pela porta é só parede com janelas; Dalva limpando balança pouco. Melhorar no episódio 2, comparando com padrao_aprovado/quadros.
