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
- [2026-11-08] [MEDIDO] Render do ep01: 3352 quadros, 0.61 s/quadro, 36.3 min no total, escala 1, renderer ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver).
- [2026-11-08] [MEDIDO] ep01: 111.7 s, 1080x1920, -16.01 LUFS, pico -1.71 dBTP, 119.2 MB.
- [2026-11-08] [REGRA] Dono reprovou o visual antigo (traço por cor + grão por pixel = "letras confusas e falhas de pixel") e pediu o estilo da referência: olho de peixe, traço grosso limpo, cores chapadas, bonecos de olhos grandes, legendas arredondadas coloridas, 60 fps. Motor refeito (`motor/cena/lente.js`). Técnica igual à referência; identidade (personagens, lugar, história) continua nossa.
- [2026-11-08] [MEDIDO] Visual novo em CPU (SwiftShader, 4 núcleos, 1080x1920): ≈ 0,85 s/quadro só de render; luzes pontuais custavam 2/3 da passada de cor (removidas); FXAA custa 0,25 s (desligado por padrão); G-buffer com filtro linear custa +0,15 s mas suaviza o traço (mantido).
- [2026-11-08] [REGRA] No G-buffer a distância tem de ser calculada por fragmento: interpolada por vértice ela erra em triângulos grandes (piso, paredes) e o traço aparece em volta de qualquer coisa apoiada neles.
- [2026-11-08] [REGRA] Olhos do protagonista a 1,48 m (43 cm acima do balcão) e cabeça com 10° de inclinação natural: é o que faz as mãos aparecerem de cima, grandes, nos cantos de baixo, como na referência.
- [2026-11-08] [MEDIDO] Vídeo a 60 fps em CPU (SwiftShader + FFmpeg x264 faster/2 threads): 1,44 s/quadro no trecho 70–72 s → episódio de 112 s ≈ 2,7 h. Clipe conferido com ffprobe: 1080x1920, 60/1, 120 quadros em 2 s.
