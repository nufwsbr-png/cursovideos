# Estado atual

_A parte de cima é escrita à mão ao fechar cada sessão; o painel no fim é da etapa `memoria` (rotina diária)._

## Onde paramos (2026-11-10, noite)
- Canal **ToquinhoVivo** (decisão do dono) com duas séries:
  - **Guichê 3**: série padrão; o Epi. 01 está pronto, com voz falsa.
  - **72 Horas**: série ativa; `canal/series/72horas.json`, episódios em `episodios/72h-epNN_*`.
- **72 Horas, Epi. 01 "Segura o elevador"** (`episodios/72h-ep01_segura_o_elevador/`):
  - fases S0–S3 com commit: decisões do dono; nota das regras de emoção; canal com séries; motor do Edifício Aurora;
  - roteiro com nota 100; quadros com voz falsa (112,2 s); revisor sem aviso;
  - crítico visual na sessão: a rodada 1 reprovou a legibilidade (mostrador do elevador e câmera do S2 pequenos); a
    rodada 2 aprovou, com notas 7/8/8/8/8/8. Detalhes em `revisoes.md`;
  - **produzido inteiro em 2026-11-11** (`ep01.mp4`, 1:52, −14,0 LUFS, 3 capas). Entrega **não publicável só por voz
    falsa**. Com a `GEMINI_API_KEY`, `episodio --episodio 72h-1` refaz as falas e o que depende delas (≈ 1,5 h na tomada).
  - ouvir a fala f15 ("Maio..."): a prova avisa voz possivelmente encoberta (5,9 dB contra o critério de 6).
- Os stills tirados antes do crítico mostraram cinco defeitos de motor, corrigidos com 0 pixel diferente no Guichê 3
  (lista em `aprendizados.md`).
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

## Marca e produto (2026-11-10, sessão paralela à produção do vídeo)
- **Marca do canal** em `marca/` (`MARCA.md` = tamanhos, bios, destaques, link da bio, posts fixados):
  - fotos de perfil A (protagonista com rosto) e B (POV, mãos com celular); capa do YouTube A e B, capa do Facebook,
    6 capas de destaque, tudo em `marca/final/` (refazer: `python -I marca/montar_final.py`);
  - `A DECIDIR` pelo dono: foto A ou B (nos episódios ele continua sem rosto), @ livre nas redes.
- **Produto "Fábrica POV"** em `produto/` (`OFERTA.md` = promessa, módulos, preço R$ 197 `A DECIDIR`, garantia 7 dias,
  regras de venda honesta); landing em `produto/landing/` (`index.html` para hospedar; prévia privada em
  https://claude.ai/artifact/XnUwAtiU2DB6MKB58BrT4x); criativos em `produto/criativos/final/` e roteiros de vídeo em
  `produto/criativos/roteiros_video.md` (refazer: `python -I produto/montar_criativos.py`).
- Falta (dono): link do checkout (`CHECKOUT_URL` na landing), gravar as aulas, decidir se o motor 3D entra no kit,
  hospedar a página, orçamento de anúncio. Trocar os quadros da landing pelos do render novo (pele branca).
- Gasto Higgsfield: 34,75 créditos (1.000 → 965,25), dos quais ≈ 11,5 descartados (mascote reprovado pelo dono).

## O que está pronto
- Produção inteira sem chave: `node fabrica/cli.js episodio --episodio N` pula o que está em dia e para nos portões. Sem
  `ANTHROPIC_API_KEY`, o crítico visual roda na sessão do Claude Code (skill `critico-visual`).
- Rotina diária (`diario`):
  - publica só o que é publicável e roda a memória sempre;
  - escreve `BLOQUEADO.md` e sai com 3 só no 1º dia de cada bloqueio;
  - descarta e refaz uma vez o episódio que travou 2 vezes por motivo que a IA corrige;
  - o CI dela está em `.github/workflows/fabrica-diaria.yml`.
- Publicação nas 5 redes em modo `--simular`. Kwai fica em fila manual (`pendente_manual`).
- Testes: 80 de JS (`npm run testes`) e 12 de áudio (`npm run testes:audio`), todos passando em 2026-11-10.

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
6. Decisões do dono que seguem abertas:
   - um vilão para o Guichê 3 antes do Epi. 02 (a regra de emoção exige um em todo episódio);
   - a bio do perfil;
   - confirmar que @toquinhovivo está livre nas redes;
   - foto de perfil A ou B (`marca/`).
7. Janela do boato: o "apagão de 3 dias" circula até 17/11. Publicar o 72h-1 antes disso depende das chaves (voz real) e
   das credenciais das redes.

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
