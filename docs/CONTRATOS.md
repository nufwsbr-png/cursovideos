# Contratos da fábrica (formatos de arquivo e comandos)

Este documento é a "cola" entre as partes da fábrica. Toda etapa lê e escreve
apenas os arquivos descritos aqui. Se algo precisar mudar, muda aqui primeiro.

Convenções gerais
- Tudo em UTF-8 sem BOM. Tempos em segundos (número decimal). Cores em hex.
- Pasta do episódio: `episodios/epNN_slug/` (ex.: `episodios/ep01_uma_pra_das_tres/`).
- O canal inteiro (nicho, elenco, cenários, estilo, vozes, plataformas) vive em
  `canal/canal.json`. Os episódios só referenciam ids definidos lá.
- Quadros são função do tempo: o mesmo `t` sempre gera a mesma imagem (sem estado
  escondido, sem aleatório sem semente). A semente padrão é `canal.estilo.semente`.

## 1. `canal/canal.json` (resumo dos campos usados pelo código)

**Séries (desde 2026-11-10).** O `canal.json` é o canal (nome, formato, estilo, áudio, publicação, IA) mais a série padrão.
`series: { padrao, ativa, lista: [{ id, nome, arquivo?, prefixo_pasta? }] }` lista as séries. Cada outra série tem um
arquivo (`canal/series/<id>.json`) que **substitui** as chaves que trouxer (protagonista, elenco, cenarios, mundos,
frase_do_canal...) e **funde** `estilo`; chaves com `_` são notas.

O canal efetivo de um episódio sai de `motor/canal_serie.js` (`canalDaSerie`, `canalDaPasta`); no Python, de
`carregar_canal(ep)` em `audio/_comum.py`. Fábrica, motor e áudio usam sempre o canal da série do episódio:
- pela chave `roteiro.serie`;
- senão, pelo prefixo da pasta (`72h-ep01_*`);
- senão, a série padrão.

Os números são por série. A série padrão fica em `epNN_*`, e as outras em `<prefixo>-epNN_*`. Na linha de comando:
- `--episodio 1` é o episódio 1 da série padrão;
- `--episodio 72h-1` ou `--serie 72horas --episodio 1` é o da 72 Horas;
- `episodio --novo` usa a série ativa.

Com várias séries, a capa mostra o nome da série, e os textos dizem "72 Horas · Epi. 01".

```jsonc
{
  "nome_exibicao": "...", "arroba": "...", "idioma": "pt-BR",
  "frase_do_canal": "Você é [PAPEL] em [LUGAR] quando acontece [CRISE], e a regra é [REGRA].",
  "formato": { "largura": 1080, "altura": 1920, "fps": 60, "duracao_alvo_s": 100, "duracao_min_s": 65, "duracao_max_s": 130 },
  "protagonista": { "id": "eu", "como_chamam": "...", "pistas": {...}, "maos": { "pele": "#hex", "manga": "#hex", "detalhe": "..." }, "objetos": ["carimbo", "caneta", "celular"], "voz": {...} },
  "elenco": [ { "id": "dalva", "nome": "Dalva", "papel": "colega", "visivel": true, "visual": { "pele": "#", "cabelo": "#", "cabelo_estilo": "coque", "roupa_cima": "#", "roupa_baixo": "#", "acessorio": "colete", "altura": 1.58, "proporcao": "baixa_forte", "objeto": "rodo" }, "voz": { "nome": "Gacrux", "estilo_base": "..." , "filtro": null }, "cor_legenda": "#hex" } ],
  "cenarios": [ { "id": "saguao", "nome": "...", "camera_inicial": { "pos": [x,y,z], "olhar": "painel" }, "marcas": { "nome": [x,y,z] }, "props": [ { "id": "painel", "tipo": "painel", "pos": [..], "rot": [..], "tamanho": [..], "cor": "#", "texto": ["linha1", "linha2"], "estado": "normal" } ] } ],
  "estilo": { "semente": 7, "traco": { "espessura_px": 6, "espessura_min_px": 2.2, "cor": "#1a1410", "limiar_distancia": 0.035, "limiar_normal": 0.22 }, "lente": { "fov_vertical": 115, "anamorfico": 1.2, "aproximar_fov": 65, "inclinacao_base_graus": 10, "tamanho_face": 1536 }, "antialias": "nenhum|fxaa", "cores": { "c1": "#", "c2": "#", "c3": "#", "alerta": "#", "alerta_forte": "#" }, "sombra": { "degraus": 3, "intensidade": 0.3 }, "textura": "papel|nenhuma", "intensidade_textura": 0.06, "bonecos": { "cabeca": 1.0, "corpo": 1.0, "nariz": true }, "legenda": { "fonte": "Verdana POV", "peso": 700, "tamanho": 44, "contorno": "#141210", "espessura_contorno": 10, "sombra": false, "base_y": 0.70, "entrelinha_px": 58, "largura_max": 0.86, "x_centro": 0.5, "cores_por_personagem": { "eu": "#ffffff", "dalva": "#fcb46c" } }, "selo": { "cor": "#b1241e", "cor_texto": "#ffffff", "tamanho": 58, "altura_px": 88, "raio_px": 14, "borda_px": 5, "posicao": "alto|baixo", "inicio_s": 0.3, "fim_s": 3 }, "climas": { "rotina": {...}, "sinal": {...}, "escalada": {...}, "climax": {...}, "pergunta": {...} } },
  "vozes": { "provedor": "gemini", "modelo": "gemini-2.5-flash-preview-tts", "prefixo_estilo": "native Brazilian Portuguese speaker from Brazil, Brazilian accent, no English accent" },
  "plataformas": { "tiktok": {...}, "instagram": {...}, "facebook": {...}, "youtube": {...}, "kwai": {...} },
  "publicacao": { "fuso": "America/Sao_Paulo", "hora_local": "18:30", "hashtags_base": ["pov", "historia", "suspense"], "exigir_aprovacao_humana": false, "etiqueta_ia": true }
}
```

## 2. `roteiro.json` (saída da etapa 02, entrada de todo o resto)

```jsonc
{
  "numero": 1, "slug": "uma_pra_das_tres", "titulo": "Uma pra das três",
  "frase_memoravel": "Uma pra das três, por favor.",
  "ideia": "3 linhas: rotina, primeiro sinal, dilema",
  "cenario": "saguao",                     // id em canal.cenarios
  "lugares": ["saguao"],
  "parte_de": null,                        // número do episódio anterior quando é continuação
  "opcao_vencedora_anterior": null,        // "a" | "b" | null
  "linhas": [                               // a tabela do capítulo 41, em ordem de tempo
    { "t": 0, "ato": "rotina", "imagem": "texto livre para humanos", "fala": null, "som": "texto livre",
      "direcao": { "olhar": "maos", "acao": "trabalhar", "clima": "rotina", "eventos": [] } },
    { "t": 2, "ato": "rotina", "imagem": "...", "fala": "f01", "som": null,
      "direcao": { "olhar": "dalva", "acao": "parar", "clima": "rotina", "eventos": ["personagem.dalva.posicao=dalva_limpando", "personagem.dalva.pose=limpando"] } }
  ],
  "falas": [
    { "id": "f01", "quem": "dalva", "voz": "Gacrux", "texto": "Tá quieto hoje, hein, novato.", "estilo": "native Brazilian Portuguese speaker from Brazil, Brazilian accent, no English accent, woman in her fifties, hoarse, bored, teasing, fast", "filtro": null, "reaproveitar_de": null }
  ],
  "celular": [ { "t": 66, "de": "Mãe", "texto": "Filho, cê tá bem?", "tipo": "mensagem" } ],
  "dilema": { "pergunta": "O que você faria?", "opcao_a": "Vender a passagem", "opcao_b": "Fechar o guichê" },
  "comentario_fixado": "Votação aberta: VENDER ou FECHAR? A mais votada decide o Epi. 02.",
  "titulos": ["...", "...", "..."],
  "descricao": "Situação em uma frase · Epi. 01",
  "hashtags": ["pov", "historia", "suspense", "rodoviaria"],
  "capa": { "frase_gancho": "até 5 palavras", "t_quadro": 24.0 },
  "checagens": { "sinal_ate_7s": true, "dilema_divide": true, "ameaca_oculta": true, "frase_memoravel": true, "sem_narrador": true, "temas_proibidos": "nenhum" }
}
```

Vocabulário de `direcao` (o motor implementa exatamente isto):
- `olhar`: id de prop, id de personagem, nome de marca, ou `maos` | `celular` | `frente` | `chao` | `teto`.
- `acao`: `trabalhar` | `parar` | `pegar_celular` | `guardar_celular` | `andar:<marca|prop|personagem>` | `segurar:<objeto>` | `fade` | `aproximar:<alvo>` | `tremor:<0..1>` | `voltar`.
- `clima`: `rotina` | `sinal` | `escalada` | `climax` | `pergunta`.
- `eventos`: lista de `alvo.campo=valor`. Campos conhecidos:
  - `prop.<id>.estado=<valor>` (ex.: painel: `normal|alerta|alerta_forte|apagado`; luz: `normal|piscar|fraca|apagada`; porta: `fechada|aberta`; onibus: `ausente|chegando|parado|portas_abertas`; lanchonete: `fechada|acesa`)
  - `prop.<id>.texto=<linha1|linha2|...>` (texto do painel/placa; `|` separa linhas)
  - `personagem.<id>.visivel=true|false`, `personagem.<id>.posicao=<marca>`, `personagem.<id>.pose=em_pe|sentado|andando|apontando|segurando|limpando|parado_de_costas`, `personagem.<id>.expressao=normal|medo|raiva|calma|surpresa`, `personagem.<id>.andar=<marca>` (anda até a marca a partir de t)
  - `celular.tela=<indice>` (mostra a mensagem `celular[indice]`), `celular.notificacao=<indice>`
  - `tela.selo=PARTE 2` (selo no canto superior nos primeiros segundos da continuação)
- A fala em uma linha faz a câmera olhar para quem fala automaticamente, salvo `olhar` explícito.

## 3. `falas/` e `audio/` (etapa 03)

- `audio/falas/f01.wav`, `f02.wav`... (PCM 16 bit, mono, 24 kHz ou 48 kHz). Uma fala por arquivo.
- `audio/falas/origem.json`: `{ "f01": { "provedor": "gemini|falso", "modelo": "...", "voz": "Gacrux", "gerado_em": "ISO" } }`
- Reaproveitamento: se `reaproveitar_de` = `"ep01:f09"`, copia o arquivo em vez de gerar.

## 4. `medidas.json` (etapa 04 — `python3 audio/medir_falas.py --episodio <dir>`)

```jsonc
{
  "f01": { "arquivo": "audio/falas/f01.wav", "duracao_s": 1.84, "inicio_voz_s": 0.06, "fim_voz_s": 1.71,
           "rms_dbfs": -21.3, "pico_dbfs": -4.0, "envelope_passo_s": 0.05, "envelope": [0.0, 0.12, ...],   // 0..1 normalizado
           "transcricao": "tá quieto hoje hein novato" | null, "igual": true | false | null, "diferencas": "..." | null }
}
```
`envelope` é a amplitude RMS por janela de 50 ms, normalizada pelo pico da fala (usado pela boca).
`transcricao`/`igual` ficam `null` quando o Whisper não está disponível (campo `conferido_por` = `"whisper"` | `"nao_conferido"`).

## 5. `linha_do_tempo.json` (etapa 05)

```jsonc
{
  "fps": 60, "duracao_total_s": 98.6,
  "falas": [ { "id": "f01", "quem": "dalva", "inicio_s": 2.0, "fim_s": 3.84, "filtro": null } ],
  "linhas": [ { "indice": 0, "t_nominal": 0, "inicio_s": 0.0, "fim_s": 2.0, "ato": "rotina", "fala": null, "direcao": {...} } ],
  "climas": [ { "inicio_s": 0, "clima": "rotina" }, { "inicio_s": 5.2, "clima": "sinal" } ],
  "celular": [ { "inicio_s": 68.1, "de": "Mãe", "texto": "...", "tipo": "mensagem" } ],
  "efeitos": [ { "t": 5.2, "tipo": "clique" }, { "t": 86.0, "tipo": "grave_crescente", "duracao_s": 8 }, { "t": 92.0, "tipo": "pancada" } ],
  "ambiente": [ { "inicio_s": 0, "fim_s": 98.6, "tipo": "saguao_noite", "ganho_db": -26 } ],
  "silencios": [ { "inicio_s": 88.0, "fim_s": 91.0 } ],
  "pergunta": { "inicio_s": 94.0, "fim_s": 98.6, "pergunta": "...", "opcao_a": "...", "opcao_b": "..." }
}
```
Regra: as falas mandam. Cada linha começa no `t` nominal deslocado pelo acúmulo de atraso das falas anteriores
(se uma voz dura mais que o previsto, tudo depois dela desliza). Entre falas há folga mínima de 0,35 s.

Tipos de efeito reconhecidos pelo sintetizador: `clique`, `clique_triplo`, `passos` (`duracao_s`, `ritmo`), `porta_abrir`,
`porta_fechar`, `batida`, `vidro`, `celular_vibrar`, `notificacao`, `estatica_radio`, `lampada_estalo`, `lampada_piscar`,
`grave_crescente` (`duracao_s`), `pancada`, `freio_onibus`, `motor_onibus` (`duracao_s`), `sino`, `campainha`, `papel`, `carimbo`.
Tipos de ambiente: `saguao_noite` (zumbido de lâmpada + ventilador + grilos longe), `rua_noite`, `chuva`, `vento`, `silencio`.
Filtros de voz: `null`, `telefone`, `radio`, `alto_falante`.

## 6. Quadros e render (etapas 05b e 06 — `node motor/renderizar.js`)

A etapa **quadros** (05b) faz stills nos instantes importantes + folha + revisor; a etapa **render** (06) faz só o
vídeo mudo e roda depois do crítico visual aprovado. Opções novas do renderizador: `--pasta <rel>` (stills noutra
pasta do episódio, usada pelo crítico e pela capa) e `--sem-registro` (não mexe no `render.json`).

```
node motor/renderizar.js --episodio episodios/ep01_x --stills 0,2,5,8,13,24     # salva stills/t_0005.00.png etc.
node motor/renderizar.js --episodio episodios/ep01_x --folha                    # folha.png (1 quadro a cada 2 s, tempo escrito)
node motor/renderizar.js --episodio episodios/ep01_x --video [--escala 0.5]     # video_mudo.mp4 (h264 yuv420p, fps do canal)
node motor/renderizar.js --episodio episodios/ep01_x --sequencia 23.5,25.5      # quadros próximos (a cada 0,1 s) para conferir giros
node motor/renderizar.js --teste-estilos --cenario saguao --saida padrao_aprovado/estilos [--tempo-estilo 74]  # 3 versões A/B/C do mesmo quadro
node motor/renderizar.js --episodio episodios/ep01_x --folha --passo 2          # 1 miniatura a cada 2 s, com tempo e clima escritos
node motor/revisar.js --episodio episodios/ep01_x                               # revisao.json (problemas, avisos, aprovado, nao_conferido)
```
Entradas: `canal/canal.json`, `<ep>/roteiro.json`, `<ep>/linha_do_tempo.json`, `<ep>/medidas.json`.
Saídas: na pasta do episódio (`stills/`, `sequencia/`, `folha.png`, `video_mudo.mp4`; em modo prévia também `linha_do_tempo_previa.json`). O motor também grava `<ep>/render.json` com `{ "quadros": N, "segundos_por_quadro": x, "gpu": "...", "legendas": [ {"t": 2.0, "caixa": [x,y,w,h]} ] }`.
Área segura: nada importante abaixo de 80 % da altura nem nos 15 % à direita (botões do TikTok). Legenda centrada em `estilo.legenda.y_centro`.

## 7. Som e prova (etapas 07 e 08)

```
python3 audio/sintetizar.py --episodio <dir>         # cria audio/camadas/{ambiente,efeitos,tensao}.wav a partir da linha do tempo
python3 audio/mixar.py --episodio <dir> --video video_mudo.mp4 --saida ep01.mp4   # falas (com filtro) + camadas + zumbido grave, loudnorm -14 LUFS, pico -1 dB
python3 audio/medir.py --arquivo ep01.mp4 --linha-do-tempo linha_do_tempo.json    # imprime JSON: duração, lufs, pico, banda de voz com/sem fala
python3 audio/transcrever.py --arquivo ep01.mp4 --roteiro roteiro.json [--so f01,f02]   # JSON: falas encontradas/faltando (ou "nao_conferido")
```
Voz na mixagem (desde 2026-11-10): cada fala é igualada pela **faixa da voz** (300–3000 Hz, só onde há voz; alvo
−22 dBFS, sussurro −24, grito −20) e de novo depois do filtro. O **piso da voz** usa o mesmo critério da prova
(`medir.banda_de_voz`): toda fala fica ao menos 6 dB acima do fundo sem fala na faixa da voz; a que fica abaixo sobe o
que falta (até +4 dB por fala, até 3 rodadas). `audio/mixagem.json` registra `voz` (nivelamento e alvo), `piso_voz`
(`criterio_db`, `ajustes_db` por fala, `ainda_abaixo`, `por_fala` com `margem_db`), o zumbido (ganho, fração 20–80 Hz) e
o loudnorm. A transcrição só confere as falas com voz de verdade (`--so`): voz falsa não é fala, então com todas falsas
ela fica "não conferida" e não roda. O áudio vai para o Whisper já decodificado (16 kHz mono), sem depender do PyAV.
`prova.json` (etapa 08) junta tudo: formato, duração, LUFS, pico, bandas (20–80 Hz, trechos abaixo de −40 dB), falas
conferidas, fontes, revisão de quadros, lista do revisor e `arquivo_hash` (o hash do MP4 medido: a entrega confere que
a prova é do mesmo arquivo).

## 8. Capa e textos (etapa 09)

- `capa_1.png`, `capa_2.png`, `capa_3.png` (1080x1920; texto só entre 240 e 1680 px de altura). `capa.png` = escolhida.
  A fonte é a da camada 2D (Verdana Bold, por `local()`; sem ela, Baloo 2 embutida e um aviso). O gancho diminui até
  caber na largura e acima do próximo texto. Os quadros fogem das falas e dos mergulhos no preto.
- `capa.json`: `{ "fonte": "Verdana Bold", "escolhida": 1, "variantes": [ { "variante": 1, "gancho_px": 150, "cabe": true, "area_segura": true, "caixas": { "gancho": [x0,y0,x1,y1], "epi": [...], "canal": [...] } } ] }`.
- `textos.json`: `{ "titulo": "...", "descricao": "...", "hashtags": [...], "comentario_fixado": "...", "por_plataforma": { "tiktok": { "titulo": "..." }, "youtube": { "titulo": "...", "descricao": "...", "tags": [...] }, "instagram": { "legenda": "..." }, "facebook": { "descricao": "..." }, "kwai": { "legenda": "..." } } }`

## 9. Publicação (etapa 10 — `fabrica/publicar/`)

Cada adaptador exporta:
```js
export async function publicar({ arquivo, capa, textos, canal, env, simular }) // → { plataforma, ok, id, url, erro, detalhes }
export async function lerMetricas({ id, canal, env })                           // → { views, curtidas, comentarios, compartilhamentos, salvamentos, tempo_medio_s, origem } (campos ausentes = null)
export async function lerComentarios({ id, canal, env, limite })                // → [ { texto, curtidas, data } ]  (SEM nome de usuário)
```
`publicacao.json` no episódio: `{ "publicado_em": "ISO", "plataformas": { "tiktok": { "ok": true, "estado": "publicado|pendente_manual|falhou", "pendente_manual": false, "id": "...", "url": "..." }, ... }, "pendencias_manuais": [...] }`.
- `pendente_manual`: o pacote está pronto mas falta alguém postar (Kwai em `fila_manual`); não conta como publicado e
  não é refeito a cada rotina.
- O resultado `ok` de `publicarTudo` = todas as `canal.publicacao.plataformas_obrigatorias` pedidas publicadas;
  `completo` = todas as obrigatórias do canal. Sem `completo`, o episódio fica em `publicacao_parcial` e a próxima
  rotina tenta só o que falta (`--republicar` tenta de novo até o que já deu certo).
- A etapa 10 só publica com `entrega.json` publicável e os arquivos com o mesmo hash; `--forcar` (humano) pula isso e
  fica em `estado.json → publicacao_forcada`.
Credenciais só por variáveis de ambiente (`.env` local ou segredos do GitHub). Nunca no cérebro, nunca no git.

## 10. Estados do episódio (`estado.json`)

```json
{ "etapa": "roteiro|vozes|conferido|tempo|quadros|critico|render|som|prova|capa|entrega|publicacao_parcial|publicado",
  "aprovado": false, "publicavel": false,
  "bloqueios": ["voz falsa: ..."],                       // a união das listas abaixo
  "bloqueios_por_etapa": { "vozes": ["voz falsa: ..."], "quadros": [], "critico": [], "prova": [] },
  "versoes": { "<etapa>": { "entrada": { "hash": "sha256:...", "partes": { "roteiro": "sha256:...", "motor": "sha256:..." } },
                             "saidas": { "linha_do_tempo.json": "sha256:..." }, "em": "ISO" } },
  "travado": { "assinatura": "sha256:...", "vezes": 1, "desde": "AAAA-MM-DD", "causas": ["..."] },
  "aviso_dono": { "assinatura": "sha256:...", "em": "ISO" },
  "refeito_de": "episodios/_descartados/..." }
```
Cada etapa é dona dos seus bloqueios (`definirBloqueios`). Uma etapa está **em dia** quando a entrada recalculada tem o
mesmo hash e as saídas continuam iguais (`fabrica/etapas/registro.js`); o orquestrador refaz a partir da primeira velha.

## 11. `validacao.json` (etapa roteiro)

`{ "versao_regras", "nota" (0–100), "nota_minima", "aprovado", "itens": [{ "id", "tipo": "erro|desconto", "pontos", "mensagem" }], "erros", "avisos", "medidas": {...}, "rodadas": [{ "rodada", "nota", "erros", "itens": [ids] }] }`.
Aprovado = 0 erros e nota ≥ `canal.roteiro.nota_minima`. `rodadas` guarda as correções pedidas durante a escrita
(é o que `fabrica/aprender.js` conta para promover regra).

## 12. `critico.json` e `revisoes.md` (etapa critico)

```json
{ "status": "em_andamento|aprovado|reprovado", "aprovado": true, "motivo": "...", "fonte": "api|sessao_claude_code|ia_falsa",
  "nota_minima": 7, "rodadas_max": 3, "rubrica": "docs/criterios_visuais.md", "rubrica_hash": "sha256:...",
  "rodadas": [{ "n": 1, "fonte": "...", "cego": true, "notas": { "gancho": 7, "legibilidade": 8, "clareza_acao": 5, "continuidade": 8, "acabamento": 6, "dilema_final": 7 },
                "evidencias": {...}, "minima": 5, "pior": "clareza_acao", "aprovado": false, "defeitos": [...],
                "patch": { "aplicado": true, "aplicadas": [...], "recusadas": [...], "nota_roteiro": 100, "hash_historia": "...", "hash_historia_depois": "..." } }],
  "ciclos_anteriores": [...], "hash_roteiro": "sha256:..." }
```
Quadros de cada rodada em `critico/rodada_N/` (folhas, detalhes, `mapa.json`; na sessão também `pedido.md`,
`olhar.json`, `julgar.json`). O patch só aceita: `linha N` → `olhar`, `acao`, `clima`, `eventos_adicionar`/`eventos_remover`
(personagem.<id>.pose|expressao|posicao|andar, camera.ir|postura), `t` (±1,5 s); `celular N` → `duracao_s` (2–8 s).
A fonte `ia_falsa` nunca vale para publicar.

## 13. `entrega.json` (etapa entrega)

`{ "episodio", "titulo", "publicavel", "motivos": ["voz_real: ..."], "checagens": { "voz_real", "linter", "revisor", "critico", "prova", "fontes", "bloqueios", "aprovacao", "versoes", "arquivos" }, "arquivos": { "video": { "caminho", "hash", "bytes" }, "capa": {...}, "textos": {...} }, "gerado_em" }`.
Cada checagem: `{ "ok", "detalhe", ... }`. A publicação refaz a conferência e recusa se algum hash mudou.

## 14. Rotina diária (`fabrica/diario.js`) e mídia do CI (`fabrica/midia.js`)

- Saída: 0 ok · 1 erro · 3 precisa do dono (só no 1º dia de cada bloqueio novo). Aviso em `BLOQUEADO.md` na raiz.
- Travado 2 vezes pela mesma causa que a IA corrige (roteiro, duração, revisor, crítico) → o episódio vai para
  `episodios/_descartados/` (com `DESCARTADO.md`) e é refeito uma vez com o mesmo número.
- `.cache/midia/manifesto.json`: `{ "episodios": { "<pasta>": { "<arquivo relativo>": { "hash", "bytes" } } } }`;
  `midia --restaurar` só devolve arquivo com o hash do manifesto.

## 15. Observações finais

- `falas[].estilo` guarda só a emoção e o ritmo daquela fala. Na geração, a fábrica monta a instrução completa:
  `"<vozes.prefixo_estilo>, <voz.estilo_base do personagem>, <falas[].estilo>"`.
- `roteiro.celular[]` é indexado por posição: `celular.tela=0` mostra a primeira mensagem.
- `linhas[].emocao` (desde 2026-11-10): o que o público deve sentir na linha (`riso`, `susto`, `medo`, `raiva`, `indignacao`, `compaixao`, `curiosidade`, `calafrio`, `alivio`, `tensao`, `decisao` ou `null`). A nota cobra o vilão do elenco (`papel: "vilao"`) em cena e com 2 falas ou mais (senão é erro), riso nos primeiros 10 s, 3 golpes de raiva entre 15 e 50 s, uma compaixão e a última fala do vilão repetindo a primeira frase. `regras_emocao: false` dispensa só roteiros feitos e aprovados antes da regra (o Epi. 01 do Guichê 3); a IA nunca escreve esse campo.
- `roteiro.efeitos_extra[]` e `roteiro.silencios[]` são opcionais; a etapa 05 copia para a linha do tempo com o mesmo deslocamento das linhas.
- O esquema da IA exige todos os campos e manda os opcionais como `null` (ex.: `repeticoes`, `intervalo_s`, `ganho_db`):
  **`null` = use o padrão** em todo código que lê o roteiro ou a linha do tempo (no Epi. 01, um `ganho_db: null` derrubou
  o som depois de 143 min de render; desde 2026-11-10 o `sintetizar.py` tira os nulos antes de usar).
- Quando `linha_do_tempo.json`/`medidas.json` ainda não existem, o motor pode trabalhar em modo prévia: usa os `t` nominais do roteiro,
  estima a duração de cada fala por `palavras / 2,5` e um envelope sintético. Isso serve para olhar quadros antes de gastar voz.
