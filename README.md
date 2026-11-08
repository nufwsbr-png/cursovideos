# Fábrica de conteúdos POV Viral

Uma fábrica que faz, **todo dia e sozinha**, o que o livro *POV Viral* ensina: lê o público, escreve o próximo
episódio em 8 atos, gera as vozes (uma fala por arquivo), anima em 3D com a câmera no lugar dos olhos,
sintetiza o som, prova o vídeo, faz capa e textos e **publica no TikTok, Instagram, Kwai, Facebook e YouTube**.
Tudo o que ela decide fica registrado no **cérebro** (`CLAUDE.md` + `memoria/`), separando medido de hipótese.

> O canal que vem configurado ("Guichê 3", rodoviária de madrugada) é um **canal-exemplo original**, criado só
> para a fábrica funcionar hoje. O livro insiste: o canal precisa ser **seu**. Faça a investigação da Parte 3 e rode
> `node fabrica/cli.js entrevista` para trocar nicho, personagens, bíblia e estilo. Nada aqui copia o canal do livro.

## O que acontece em um dia (`node fabrica/cli.js diario`)

| # | Etapa | O que faz | Do livro |
|---|---|---|---|
| 1 | Público | Lê views, curtidas, comentários; conta o voto A×B; separa teorias e pedidos; registra medido | cap. 44, 73–76 |
| 2 | Roteiro | Claude escreve 10 ideias → episódio em 8 atos → crítico impaciente → correção → validador | cap. 36–45 |
| 3 | Vozes | Gemini TTS, uma fala por arquivo, mesmo elenco de vozes sempre, estilo com sotaque brasileiro | cap. 46–49 |
| 4 | Conferir | Mede duração, volume, início/fim; transcreve com Whisper e compara (alerta, não prova); refaz só o que deu errado | cap. 50 |
| 5 | Tempo | A voz manda: linha do tempo pelas durações medidas | cap. 62 |
| 6 | Render | three.js determinístico: stills → folha → revisor automático → MP4 mudo 1080×1920 60 fps | cap. 56–61, 65 |
| 7 | Som | Ambiente, efeitos e tensão sintetizados do zero; mixagem com ducking; −16 LUFS, pico < −1 dB | cap. 64 |
| 8 | Prova | Formato, duração, LUFS, pico, banda de voz, transcrição do vídeo pronto, folha, lista do revisor | cap. 66 |
| 9 | Capa e textos | 3 capas com área segura (texto entre 240 e 1680 px), gancho ≤ 5 palavras, textos por plataforma | cap. 70–71 |
| 10 | Publicar | 5 redes, etiqueta de IA ligada, comentários ativados, comentário da votação | cap. 72, 84 |
| 11 | Memória | Atualiza `memoria/estado_atual.md`, `episodios.md`, `aprendizados.md`, planilha | cap. 54–55 |

Regras de segurança embutidas: um episódio por dia; nunca publica com **voz falsa**, volume fora da faixa,
formato errado, fala faltando ou problema grave nos quadros (`estado.json → bloqueios`); opção
`exigir_aprovacao_humana` para o dono liberar cada vídeo (`node fabrica/cli.js aprovar --episodio N`).

## Instalação (uma vez)

Requisitos: Node 20+, Python 3.10+, FFmpeg, Chromium (o Playwright baixa), chaves de API.

```bash
npm install
npx playwright install chromium          # na sua máquina (aqui já havia um Chromium)
pip install -r requirements.txt
python3 -c "from faster_whisper import WhisperModel; WhisperModel('small')"   # baixa o modelo de transcrição (opcional)
cp .env.example .env                     # preencha as chaves (veja docs/CREDENCIAIS.md)
node fabrica/cli.js status
```

Credenciais por rede (como obter, permissões, validade): **`docs/CREDENCIAIS.md`**. Ajuda para o OAuth:
`node fabrica/cli.js conectar youtube | tiktok | meta | kwai`.

## Comandos

```bash
node fabrica/cli.js status                                   # onde paramos
node fabrica/cli.js diario                                   # a rotina completa (produz e publica 1 episódio)
node fabrica/cli.js diario --simular                         # tudo, menos enviar às redes
node fabrica/cli.js episodio --novo                          # escreve e produz o próximo episódio, sem publicar
node fabrica/cli.js episodio --episodio 1 --provedor-voz falso --escala 0.5   # teste rápido do piloto, sem chaves
node fabrica/cli.js episodio --episodio 2 --de render --ate prova            # refaz só um trecho da linha
node fabrica/cli.js publicar --episodio 2 --simular --plataformas tiktok,youtube
node fabrica/cli.js metricas                                 # lê números e comentários, conta votos
node fabrica/cli.js estilos                                  # teste dos 3 estilos (A/B/C) do capítulo 35/57
node fabrica/cli.js entrevista                               # cria o SEU canal
node motor/renderizar.js --episodio episodios/ep01_uma_pra_das_tres --stills 0,5.6,24 --escala 0.5   # olhar quadros
npm run testes                                               # testes automatizados
```

## Agendamento diário

- **GitHub Actions** (recomendado: não depende do seu computador ligado): `.github/workflows/fabrica-diaria.yml`
  roda todo dia (cron) ou à mão (*Run workflow*). Cadastre as chaves em *Settings → Secrets and variables → Actions*
  com os mesmos nomes do `.env.example`. O vídeo do dia fica como artefato e a memória é salva no repositório.
  Render em CPU demora (sem placa de vídeo): a 60 fps, conte 2 a 3 horas por episódio (≈ 1 s por quadro); com placa de vídeo (`MOTOR_GPU=1`), minutos.
  Para olhar rápido, use `--escala 0.5` ou troque `formato.fps` para 30 no `canal/canal.json`.
- **Windows**: `powershell -ExecutionPolicy Bypass -File scripts\agendar-windows.ps1 -Hora 17:30`
- **Linux/Mac**: `bash scripts/agendar-linux.sh 17:30`

## Pastas

```
CLAUDE.md, memoria/        o cérebro (leia antes de tudo; a IA também lê)
curso/conhecimento.md      o método do livro resumido
canal/canal.json           TUDO do canal: nicho, elenco, cenários, estilo, vozes, plataformas
episodios/epNN_slug/       roteiro.json, audio/, medidas.json, linha_do_tempo.json, stills/, folha.png, epNN.mp4, prova.json, capa*.png, textos.json, publicacao.json, votos.json, metricas/
fabrica/                   CLI, etapas, IA (Claude/Gemini), publicadores das 5 redes, testes
motor/                     motor three.js (render determinístico, revisor, teste de estilos)
audio/                     voz falsa, medições, linha do tempo, síntese de som, mixagem, transcrição
docs/                      CONTRATOS.md (formatos), CREDENCIAIS.md, LIMITES_PLATAFORMAS.md
padrao_aprovado/           quadros de referência (o revisor compara)
scripts/, .github/         agendamento
```

## O que é medido e o que não é

- A fábrica **mede**: formato, duração, LUFS, pico, banda de voz, tempos de render, quadros pretos, legendas fora da área segura, (com Whisper) se cada fala está no vídeo pronto.
- A fábrica **não ouve nem assiste**: sotaque, interpretação, se o efeito soou natural, se o giro enjoou. O livro é claro (cap. 64 e 66): **assista inteiro no celular, com e sem som**, antes de confiar. Para isso existe `publicacao.exigir_aprovacao_humana: true`.
- Os números de público valem mais que qualquer teoria: compare os seus vídeos entre si (`memoria/planilha_numeros.csv`) e mude **uma coisa por episódio**.

## Limites conhecidos desta versão

- Os endpoints das redes foram escritos a partir da documentação pública conhecida, mas **não puderam ser conferidos on-line** nesta máquina (rede restrita). Teste primeiro com `--simular` e depois com um vídeo de teste privado.
- TikTok só publica como público depois da **auditoria do app** na plataforma de desenvolvedores; antes disso, o vídeo entra privado.
- Instagram exige URL pública do MP4: configure Supabase Storage (ou GitHub Release) em `.env`.
- Kwai não tem API pública de publicação: modo `fila_manual` (pacote pronto em `fila_manual/kwai/`) ou `navegador` (sessão própria, só na sua máquina; leia os termos do Kwai).
- Sem `GEMINI_API_KEY` a fábrica usa **voz falsa** para testar e **bloqueia a publicação**.
- O render aqui foi medido em CPU (SwiftShader). Com placa de vídeo use `MOTOR_GPU=1`.
- O visual (lente olho-de-peixe, traço, bonecos, legendas) segue a referência aprovada pelo dono; os controles estão em `canal/canal.json → estilo` e explicados em `motor/README.md`.
