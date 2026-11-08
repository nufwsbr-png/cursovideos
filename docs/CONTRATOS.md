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

```jsonc
{
  "nome_exibicao": "...", "arroba": "...", "idioma": "pt-BR",
  "frase_do_canal": "Você é [PAPEL] em [LUGAR] quando acontece [CRISE], e a regra é [REGRA].",
  "formato": { "largura": 1080, "altura": 1920, "fps": 30, "duracao_alvo_s": 100, "duracao_min_s": 65, "duracao_max_s": 130 },
  "protagonista": { "id": "eu", "como_chamam": "...", "pistas": {...}, "maos": { "pele": "#hex", "manga": "#hex", "detalhe": "..." }, "objetos": ["carimbo", "caneta", "celular"], "voz": {...} },
  "elenco": [ { "id": "dalva", "nome": "Dalva", "papel": "colega", "visivel": true, "visual": { "pele": "#", "cabelo": "#", "cabelo_estilo": "coque", "roupa_cima": "#", "roupa_baixo": "#", "acessorio": "colete", "altura": 1.58, "proporcao": "baixa_forte", "objeto": "rodo" }, "voz": { "nome": "Gacrux", "estilo_base": "..." , "filtro": null }, "cor_legenda": "#hex" } ],
  "cenarios": [ { "id": "saguao", "nome": "...", "camera_inicial": { "pos": [x,y,z], "olhar": "painel" }, "marcas": { "nome": [x,y,z] }, "props": [ { "id": "painel", "tipo": "painel", "pos": [..], "rot": [..], "tamanho": [..], "cor": "#", "texto": ["linha1", "linha2"], "estado": "normal" } ] } ],
  "estilo": { "semente": 7, "traco": { "espessura": 0.012, "cor": "#101820" }, "cores": { "c1": "#", "c2": "#", "c3": "#", "alerta": "#", "alerta_forte": "#" }, "sombra": { "degraus": 2 }, "lente": { "rotina": 0.3, "climax": 0.55 }, "textura": "papel", "bonecos": { "cabeca": 1.35, "corpo": 0.85, "nariz": false }, "legenda": { "fonte": "Anton", "tamanho": 64, "contorno": "#0b0b0b", "espessura_contorno": 10, "y_centro": 0.62, "largura_max": 0.78, "cores_por_personagem": { "eu": "#fff", "dalva": "#ffd166" } }, "climas": { "rotina": {...}, "sinal": {...}, "escalada": {...}, "climax": {...}, "pergunta": {...} } },
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
  "fps": 30, "duracao_total_s": 98.6,
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

## 6. Render (etapa 06 — `node motor/renderizar.js`)

```
node motor/renderizar.js --episodio episodios/ep01_x --stills 0,2,5,8,13,24     # salva stills/t_0005.00.png etc.
node motor/renderizar.js --episodio episodios/ep01_x --folha                    # folha.png (1 quadro a cada 2 s, tempo escrito)
node motor/renderizar.js --episodio episodios/ep01_x --video [--escala 0.5]     # video_mudo.mp4 (h264 yuv420p, fps do canal)
node motor/renderizar.js --episodio episodios/ep01_x --sequencia 23.5,25.5      # quadros próximos (a cada 0,1 s) para conferir giros
node motor/renderizar.js --teste-estilos --cenario saguao --saida padrao_aprovado/estilos  # 3 versões A/B/C do mesmo quadro
```
Entradas: `canal/canal.json`, `<ep>/roteiro.json`, `<ep>/linha_do_tempo.json`, `<ep>/medidas.json`.
Saídas: na pasta do episódio. O motor também grava `<ep>/render.json` com `{ "quadros": N, "segundos_por_quadro": x, "gpu": "...", "legendas": [ {"t": 2.0, "caixa": [x,y,w,h]} ] }`.
Área segura: nada importante abaixo de 80 % da altura nem nos 15 % à direita (botões do TikTok). Legenda centrada em `estilo.legenda.y_centro`.

## 7. Som e prova (etapas 07 e 08)

```
python3 audio/sintetizar.py --episodio <dir>         # cria audio/camadas/{ambiente,efeitos,tensao}.wav a partir da linha do tempo
python3 audio/mixar.py --episodio <dir> --video video_mudo.mp4 --saida ep01.mp4   # falas (com filtro) + camadas, loudnorm -16 LUFS, pico -1 dB
python3 audio/medir.py --arquivo ep01.mp4 --linha-do-tempo linha_do_tempo.json    # imprime JSON: duração, lufs, pico, banda de voz com/sem fala
python3 audio/transcrever.py --arquivo ep01.mp4 --roteiro roteiro.json           # imprime JSON: falas encontradas/faltando (ou "nao_conferido")
```
`prova.json` (etapa 08) junta tudo: formato, duração, LUFS, pico, falas conferidas, revisão de quadros, lista do revisor.

## 8. Capa e textos (etapa 09)

- `capa_1.png`, `capa_2.png`, `capa_3.png` (1080x1920; texto só entre 240 e 1680 px de altura). `capa.png` = escolhida.
- `textos.json`: `{ "titulo": "...", "descricao": "...", "hashtags": [...], "comentario_fixado": "...", "por_plataforma": { "tiktok": { "titulo": "..." }, "youtube": { "titulo": "...", "descricao": "...", "tags": [...] }, "instagram": { "legenda": "..." }, "facebook": { "descricao": "..." }, "kwai": { "legenda": "..." } } }`

## 9. Publicação (etapa 10 — `fabrica/publicar/`)

Cada adaptador exporta:
```js
export async function publicar({ arquivo, capa, textos, canal, env, simular }) // → { plataforma, ok, id, url, erro, detalhes }
export async function lerMetricas({ id, canal, env })                           // → { views, curtidas, comentarios, compartilhamentos, salvamentos, tempo_medio_s, origem } (campos ausentes = null)
export async function lerComentarios({ id, canal, env, limite })                // → [ { texto, curtidas, data } ]  (SEM nome de usuário)
```
`publicacao.json` no episódio: `{ "publicado_em": "ISO", "plataformas": { "tiktok": { "ok": true, "id": "...", "url": "..." }, ... } }`.
Credenciais só por variáveis de ambiente (`.env` local ou segredos do GitHub). Nunca no cérebro, nunca no git.

## 10. Estados do episódio (`estado.json`)

`{ "etapa": "roteiro|vozes|conferido|tempo|render|som|prova|capa|publicado", "aprovado": true|false, "bloqueios": ["voz falsa", ...] }`
A etapa de publicação recusa episódios com `bloqueios` não vazios, salvo `--forcar`.

## 11. Observações finais

- `falas[].estilo` guarda só a emoção e o ritmo daquela fala. Na geração, a fábrica monta a instrução completa:
  `"<vozes.prefixo_estilo>, <voz.estilo_base do personagem>, <falas[].estilo>"`.
- `roteiro.celular[]` é indexado por posição: `celular.tela=0` mostra a primeira mensagem.
- `roteiro.efeitos_extra[]` e `roteiro.silencios[]` são opcionais; a etapa 05 copia para a linha do tempo com o mesmo deslocamento das linhas.
- Quando `linha_do_tempo.json`/`medidas.json` ainda não existem, o motor pode trabalhar em modo prévia: usa os `t` nominais do roteiro,
  estima a duração de cada fala por `palavras / 2,5` e um envelope sintético. Isso serve para olhar quadros antes de gastar voz.
