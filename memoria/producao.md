# Produção — como a fábrica funciona (Parte 7)

## A sequência de um episódio (capítulo 67), automatizada
| # | Etapa | Comando/arquivo | Saída |
|---|---|---|---|
| 1 | Público | `fabrica/etapas/01_publico.js` | `metricas/<data>.json`, `votos.json`, aprendizados (medido) |
| 2 | Roteiro (ideias → episódio → crítico → correção) | `02_roteiro.js` (Claude API) | `roteiro.json` |
| 3 | Vozes (uma fala por arquivo) | `03_vozes.js` (Gemini TTS ou falso) | `audio/falas/fNN.wav`, `origem.json` |
| 4 | Conferir (durações, volume, Whisper) | `04_conferir.js` → `audio/medir_falas.py` | `medidas.json` |
| 5 | Tempo (as falas mandam) | `05_tempo.js` → `audio/linha_do_tempo.py` | `linha_do_tempo.json` |
| 6 | Render (stills → folha → revisor → MP4 mudo) | `06_render.js` → `motor/renderizar.js`, `motor/revisar.js` | `stills/`, `folha.png`, `revisao.json`, `video_mudo.mp4` |
| 7 | Som (sintetizar camadas, mixar) | `07_som.js` → `audio/sintetizar.py`, `audio/mixar.py` | `epNN.mp4` |
| 8 | Prova (formato, LUFS, pico, transcrição, folha do vídeo pronto) | `08_prova.js` | `prova.json`, `estado.json` |
| 9 | Capa e textos | `09_capa_textos.js` | `capa_1..3.png`, `capa.png`, `textos.json` |
| 10 | Publicar (5 redes, etiqueta de IA) | `10_publicar.js` → `fabrica/publicar/` | `publicacao.json` |
| 11 | Memória | `11_memoria.js` | `memoria/*` atualizados |

## Regras do motor
- Quadro = função do tempo; semente fixa; o que é do episódio fica na pasta dele, o que é geral fica no motor.
- Testar com stills e folhas antes do vídeo inteiro (capítulo 65). A lista do revisor roda automaticamente (`revisao.json`), mas **o vídeo pronto deve ser assistido no celular**.
- Área segura: nada importante abaixo de 80 % da altura nem nos 15 % da direita.
- Motor renderiza em CPU (SwiftShader) quando não há GPU; na máquina do dono, use `MOTOR_GPU=1`.

## Bloqueios automáticos de publicação (estado.json)
Voz falsa · LUFS fora de -17..-14 · pico > -1 dBTP · fala faltando na transcrição (quando conferido) · formato errado · revisor com problema grave · duração fora de 65–130 s.

## Medições desta máquina (CPU, SwiftShader) — ver `aprendizados.md` (seção "Medido")
- Render (visual antigo, 30 fps): 0,71 s/quadro em 1080x1920. **Visual novo (olho de peixe, 60 fps):** ≈ 0,85 s/quadro só de render (cor 0,25 · G-buffer 0,05 · pós 0,55) e mais com o FFmpeg disputando CPU → 100 s de vídeo = 6 000 quadros = horas em CPU, minutos em GPU. Síntese de som ≈ 46 s; mixagem ≈ 20 s.
- Ordem de verificação que o livro pede e a fábrica segue: stills → sequências nos giros → folha → revisor → vídeo → prova → assistir no celular.

## Teste dos 3 estilos
`node fabrica/cli.js estilos` gera `padrao_aprovado/estilos/estilo_A.png` (traço 8 px, papel visível), `estilo_B.png` (traço 4 px, sem papel), `estilo_C.png` (a referência: 6 px) e a folha comparativa. O dono escolhe, refina em rodadas (capítulo 35) e anota os valores em `canal/canal.json → estilo` e em `estilo_visual.md`.

## Cópia de segurança
A pasta do canal é o maior bem: git + cópia semanal fora do computador (capítulo 53).
