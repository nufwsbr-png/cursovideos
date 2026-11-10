# Estado atual

_A parte de cima é escrita à mão ao fechar cada sessão; o painel no fim é da etapa `memoria` (rotina diária)._

## Onde paramos (2026-11-10)
- Canal ativo: **canal-exemplo "Guichê 3"** (original, criado para a fábrica rodar). O dono ainda não fez a entrevista
  (`node fabrica/cli.js entrevista`): status `A DECIDIR` se mantém este canal ou cria o seu.
- 2026-11-08/09: motor refeito no estilo da referência que o dono mandou; estudo do modelo de edição do canal de
  referência (5 reels medidos, MEDIDO × HIPÓTESE em `estilo_visual.md` e `roteiro_regras.md`).
- 2026-11-10: o dono aprovou **"deixar o máximo parecido"** (técnica e acabamento; só a história é nossa), **30 fps**,
  **lugares novos já**, **história nova para o Epi. 01** e a **fábrica autônoma inteira com crítico visual por IA**.
  Feito em 8 fases, cada uma com commit na branch `claude/fervent-feynman-o9ml4y`:
  - **F0**: ffmpeg achado sozinho, hash canônico, vocabulário único e `doctor`;
  - **F1**: 30 fps e camada 2D igual à referência (Verdana Bold, legenda ancorada, cartões, selo, pergunta com botões);
  - **F2**: mundo com cabine, saguão, corredor de serviço e guarda-volumes, e câmera que anda;
  - **F3**: som igual à referência (zumbido grave contínuo, −14 LUFS);
  - **F4**: regras de roteiro com números e nota 0–100; Epi. 01 novo, com o piloto antigo arquivado sem publicar;
  - **F5**: orquestrador com versões, portões, crítico visual, `entrega.json`, rotina diária e CI;
  - **F6**: `CLAUDE.md` com autonomia e lista fechada, 8 skills e `docs/ARQUITETURA.md`;
  - **F7**: Epi. 01 produzido e medido contra a referência.
- **Epi. 01 "A passagem que saiu sozinha"** (`episodios/ep01_a_passagem_que_saiu_sozinha/`):
  - roteiro com nota 100, produzido inteiro a 30 fps com **voz falsa** (90,3 s);
  - crítico visual feito na sessão: reprovou a rodada 1 (mala fora do armário 7, braço cobrindo a etiqueta,
    "(inventado)" na tela do celular) e aprovou a rodada 2 (notas 7/8/8/8/7/8). Defeitos e correções em `revisoes.md`;
  - entrega **não publicável só por voz falsa** (`BLOQUEADO.md` diz o que fazer).

## O que está pronto
- Produção inteira sem chave: `node fabrica/cli.js episodio --episodio N` pula o que está em dia e para nos portões. Sem
  `ANTHROPIC_API_KEY`, o crítico visual roda na sessão do Claude Code (skill `critico-visual`).
- Rotina diária (`diario`):
  - publica só o que é publicável e roda a memória sempre;
  - escreve `BLOQUEADO.md` e sai com 3 só no 1º dia de cada bloqueio;
  - descarta e refaz uma vez o episódio que travou 2 vezes por motivo que a IA corrige;
  - o CI dela está em `.github/workflows/fabrica-diaria.yml`.
- Publicação nas 5 redes em modo `--simular`. Kwai fica em fila manual (`pendente_manual`).
- Testes: 73 de JS (`npm run testes`) e 10 de áudio (`npm run testes:audio`), todos passando.

## O que falta (nesta ordem)
1. **Dono:** pôr a `GEMINI_API_KEY` no `.env` e rodar `node fabrica/cli.js episodio --episodio 1`.
   - Refaz só as falas falsas e o que depende da duração delas: tempo, quadros, crítico e render (≈ 2,5 h em CPU).
   - Sem a `ANTHROPIC_API_KEY`, o crítico para e pede a sessão (skill `critico-visual`).
2. **Dono:** assistir o Epi. 01 no celular, com e sem som (sotaque, interpretação, "ficou igual à referência?").
3. **Dono:** `ANTHROPIC_API_KEY` (roteiro e crítico automáticos) e as credenciais das redes (`docs/CREDENCIAIS.md`,
   `node fabrica/cli.js conectar <rede>`); depois, publicar o Epi. 01 (`publicar --episodio 1`).
4. Casting de vozes (capítulo 48): ouvir 5 ou 6 vozes por personagem e fixar em `canal/canal.json`.
5. Ligar a rotina diária: segredos no GitHub e workflow, ou o agendador do computador.
   - Antes, medir o tempo no runner: em repositório privado, o runner gratuito tem 2 núcleos (aqui são 4).
   - O render pode passar de 4 h; o limite do job é 350 min.
6. Opcional: entrevista do canal, para trocar o canal-exemplo pelo canal do dono.

## Medido / não conferido
- **Medido:** Epi. 01 final contra a referência, com os mesmos scripts (tabela em `estilo_visual.md`, detalhes em
  `aprendizados.md`). Iguais:
  - 0 cortes secos, 30 fps, tela preta de 1,0 s;
  - balanço de 2,93 Hz;
  - legenda Verdana Bold com última base em 1344;
  - cartões no tempo (±1 quadro) e pergunta de 4,0 s;
  - −14,0 LUFS; 85 % da energia em 20–80 Hz, com picos em 45/68/92 Hz; nunca abaixo de −40 dB.

  Diferenças:
  - mudança visual mediana 2,2 (referência 2,9–15,9: sentado, o nosso fica mais parado);
  - LRA 2,1 (referência 5–8);
  - 58 palavras/min, por causa das vozes falsas, que são lentas.
- **Medido:** render a 30 fps nesta máquina (CPU SwiftShader): 143,6 min, 3,18 s/quadro. O trecho mais caro é o de sempre, sentado no balcão (2,59 s/quadro, contra 1,33 do piloto); os lugares novos custam menos (1,83–2,19). Próximo passo: medir por passada no motor ou usar GPU (`MOTOR_GPU=1`).
- **Medido:** nada de público ainda (nenhum vídeo publicado).
- **Não conferido:**
  - crítico e roteiro pela API (sem chave, nenhuma chamada real foi feita);
  - vozes reais;
  - publicação real e CI no GitHub (o workflow nunca rodou);
  - render em GPU;
  - o vídeo assistido inteiro no celular;
  - sotaque e interpretação (só o ouvido do dono).

## Como refazer o que foi feito hoje
```
npm run testes ; npm run testes:audio ; node fabrica/cli.js doctor
node fabrica/cli.js episodio --episodio 1 --provedor-voz falso --ate quadros
node fabrica/cli.js critico --preparar --episodio 1     # olhar as folhas, escrever olhar.json e julgar.json
node fabrica/cli.js critico --aplicar --episodio 1      # repetir até aprovar (foram 2 rodadas)
node fabrica/cli.js episodio --episodio 1               # render → som → prova → capa → entrega (≈ 2,5 h em CPU)
python -I scripts/medir_referencia.py episodios/ep01_a_passagem_que_saiu_sozinha/ep01.mp4
python -I scripts/medir_balanco.py episodios/ep01_a_passagem_que_saiu_sozinha/video_mudo.mp4 --inicio 41.0 --duracao 6.5
node fabrica/cli.js diario --simular --ia falsa         # 1º dia: saída 3 + BLOQUEADO.md; repetido: saída 0
```

<!-- auto:inicio (gerado pela fábrica; edite acima desta linha) -->
## Painel automático (2026-11-10 21:15 UTC)
| Ep | Título | Etapa | Bloqueios | Publicado | Redes | Voto |
|---|---|---|---|---|---|---|
| 01 | A passagem que saiu sozinha | entrega | voz falsa: gere as vozes de verdade antes de publicar | — | — | — |

**Próximo passo da fábrica:** terminar o episódio 1 (está em "entrega", bloqueado por: voz falsa: gere as vozes de verdade antes de publicar).

**Resumo da última rotina:** público: 0 episódio(s) lidos · não publicado: ep01_a_passagem_que_saiu_sozinha — voz_real: 19 fala(s) com voz falsa

**Como outro chat continua:** leia CLAUDE.md, rode `node fabrica/cli.js status` e depois `node fabrica/cli.js diario` (ou `episodio --novo` para só produzir).
<!-- auto:fim -->
