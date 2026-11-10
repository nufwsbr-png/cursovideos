# Produção — como a fábrica funciona (Parte 7)

## A sequência de um episódio, automatizada (atualizada em 2026-11-10)
Quem roda é o orquestrador (`fabrica/orquestrador.js`), como um `make`: pula o que está em dia (mesma versão),
refaz a partir da primeira etapa velha e para nos portões. `node fabrica/cli.js episodio --episodio N`.

| # | Etapa | Arquivo | Saída | Portão para seguir |
|---|---|---|---|---|
| 1 | Público | `etapas/01_publico.js` | `metricas/<data>.json`, `votos.json`, planilha (leitura ≥ 44 h) | — |
| 2 | Roteiro (escrever pela IA / validar) | `etapas/02_roteiro.js`, `roteiro/nota.js` | `roteiro.json`, `validacao.json` | nota ≥ 70, 0 erros |
| 3 | Vozes (uma fala por arquivo) | `etapas/03_vozes.js` (Gemini ou falso) | `audio/falas/fNN.wav`, `origem.json` | — |
| 4 | Conferir (durações, volume, Whisper) | `etapas/04_conferir.js` | `medidas.json` | — |
| 5 | Tempo (falas + caminhadas mandam) | `etapas/05_tempo.js` → `motor/montar_linha.js` | `linha_do_tempo.json` | duração 65–130 s |
| 6 | Quadros (stills → folha → revisor) | `etapas/05b_quadros.js` | `stills/`, `folha.png`, `revisao.json` | sem problema grave |
| 7 | Crítico visual (IA olha os quadros) | `etapas/05c_critico.js` → `fabrica/critico/` | `critico.json`, `revisoes.md` | 6 notas ≥ 7 |
| 8 | Render (vídeo mudo, 30 fps) | `etapas/06_render.js` | `video_mudo.mp4` | — |
| 9 | Som (zumbido, efeitos, voz na faixa da voz + piso, −14 LUFS) | `etapas/07_som.js` | `epNN.mp4`, `audio/mixagem.json` | — |
| 10 | Prova | `etapas/08_prova.js` | `prova.json` (com o hash do MP4) | — (bloqueios vão para a entrega) |
| 11 | Capa e textos | `etapas/09_capa_textos.js` | `capa_1..3.png`, `capa.png`, `textos.json` | — |
| 12 | Entrega | `etapas/09b_entrega.js` | `entrega.json` (`publicavel`, motivos, hashes) | publicável |
| 13 | Publicar | `etapas/10_publicar.js` → `fabrica/publicar/` | `publicacao.json` | entrega publicável e mesmos hashes |
| 14 | Memória | `etapas/11_memoria.js`, `fabrica/aprender.js` | `memoria/*` | sempre roda |

## Versões (por que uma etapa refaz)
Cada etapa grava em `estado.json → versoes` o hash da entrada, por partes, e o hash das saídas:
- vozes ← texto, estilo, voz e filtro de cada fala, e o provedor;
- tempo ← roteiro, medidas, canal e código da linha do tempo;
- quadros, crítico e render ← roteiro, linha do tempo, medidas, canal e motor;
- som ← linha do tempo, falas, vídeo e código do áudio.

Mudar a direção do roteiro refaz do tempo em diante e **não** refaz as vozes. `versoes --explicar` diz o motivo;
`versoes --adotar` marca como em dia as saídas de um episódio feito antes do registro, sem rodar.

## Crítico visual
- Pela API (com `ANTHROPIC_API_KEY`): automático dentro do `episodio`. São 2 chamadas por rodada, primeiro "olhar" às
  cegas e depois "julgar" com a rubrica, até 3 rodadas.
- Na sessão do Claude Code: skill `critico-visual` (`critico --preparar` → ler as folhas → `olhar.json`/`julgar.json`
  → `critico --aplicar`). Fica anotado como não às cegas.
- O patch só mexe na direção. O que o patch não alcança (motor, mundo) o desenvolvedor corrige e anota em
  `revisoes.md`, em "Correções fora do patch".

## Som (desde 2026-11-10)
- Cada fala é igualada pela **faixa da voz** (300–3000 Hz), não pela faixa inteira, e de novo depois do filtro (antes o
  alto-falante saía 8 dB mais quente e as vozes graves ficavam 2–4 dB mais baixas).
- **Piso da voz:** a mixagem garante o critério que a prova mede (fala ≥ fundo sem fala + 6 dB na faixa da voz), subindo
  a fala que faltar (até +4 dB, até 3 rodadas). O que subiu fica em `audio/mixagem.json → piso_voz`.
- A prova transcreve (Whisper) só as falas com voz de verdade: voz falsa não é fala.

## Regras do motor
- Quadro = função do tempo; semente fixa. O que é do episódio fica na pasta dele, o que é geral fica no motor.
- Testar com stills e folhas antes do vídeo inteiro (capítulo 65). O revisor e o crítico rodam sozinhos, mas **o vídeo
  pronto deve ser assistido no celular**.
- Área segura: nada importante abaixo de 80 % da altura nem nos 4 % das bordas.
- O motor renderiza em CPU (SwiftShader) quando não há GPU; na máquina do dono, use `MOTOR_GPU=1`.
- Não mexa no motor enquanto um render roda: a versão registrada no fim seria a do código novo.

## Bloqueios e portões (ver `docs/CONTRATOS.md §10–14`)
- **Bloqueia a publicação:** voz falsa; roteiro reprovado; revisor com problema grave; crítico não aprovado (ou só pela
  IA falsa); LUFS fora de −14 ±1,5; pico > −0,9 dBTP; zumbido grave ausente; silêncio abaixo de −40 dB antes do fim
  da pergunta; fala faltando na transcrição (só as falas com voz de verdade são transcritas); formato ou fps errado; fonte diferente da referência;
  etapa velha.
- **Rotina diária:** saída 3 + `BLOQUEADO.md` quando precisa do dono (só no 1º dia de cada bloqueio). Travado 2 vezes
  por causa que a IA corrige → descarta e refaz uma vez.

## Medições desta máquina (CPU, SwiftShader) — ver `aprendizados.md` ("Medido")
- Render 30 fps 1080×1920 do Epi. 01 novo (2026-11-10): 143,6 min no vídeo inteiro (3,18 s/quadro, com testes junto em parte do tempo); sem carga, 2,59 s/quadro sentado no balcão, 2,19 no corredor e 1,83 no guarda-volumes (o piloto antigo fazia 1,33). Stills do crítico: 0,5 de escala para as folhas e 1,0 para os 6 detalhes.
- Ordem de verificação que o livro pede e a fábrica segue: stills → folha → revisor → crítico visual → vídeo → prova →
  entrega → assistir no celular.

## Teste dos 3 estilos
`node fabrica/cli.js estilos` gera `padrao_aprovado/estilos/estilo_A.png`, `estilo_B.png`, `estilo_C.png` e a folha
comparativa. O dono escolhe e os valores vão para `canal/canal.json → estilo` e `estilo_visual.md`.

## Como refazer o que foi feito em 2026-11-10 (Epi. 01 novo)
```
node fabrica/cli.js episodio --episodio 1 --provedor-voz falso --ate quadros
node fabrica/cli.js critico --preparar --episodio 1      # olhar as folhas, escrever olhar.json e julgar.json
node fabrica/cli.js critico --aplicar --episodio 1       # repetir até aprovar (foram 2 rodadas)
node fabrica/cli.js episodio --episodio 1                # render → som → prova → capa → entrega
```

## Cópia de segurança
A pasta do canal é o maior bem: git + cópia semanal fora do computador (capítulo 53).
