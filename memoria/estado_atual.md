# Estado atual

_Atualizado automaticamente pela etapa `memoria` e à mão pelo dono do canal._

## Onde paramos
- Fábrica construída do zero (motor, som, roteiro por IA, vozes, prova, capas, publicação em 5 redes, agendamento diário).
- Canal ativo: **canal-exemplo "Guichê 3"** (original, criado para a fábrica rodar). O dono ainda **não** fez a investigação da Parte 3 nem a entrevista. Status: `A DECIDIR` se mantém este canal ou cria o seu.
- Episódio 01 ("Uma pra das três") escrito à mão como piloto. Produzido aqui com **voz falsa** (sem chave do Gemini), portanto marcado como **não publicável** até gerar as vozes de verdade.
- 2026-11-08 (tarde): o dono viu os quadros, reprovou o visual antigo (letras confusas, falhas de pixel, estilo diferente) e mandou 3 capturas de referência. **Motor refeito**: lente olho-de-peixe, traço limpo, bonecos e mãos no estilo da referência, legendas Baloo 2 coloridas, 60 fps. Stills e folha do ep01 conferidos com o visual novo.
- 2026-11-09 00:05 UTC: **Epi. 01 re-renderizado inteiro** com o visual novo (`episodios/ep01_uma_pra_das_tres/ep01.mp4`, 1080x1920, 60 fps, 6704 quadros, 111,7 s, 105,7 MB). Render levou 153,8 min em CPU (1,33 s/quadro). Prova: só o bloqueio **voz falsa** (voz de teste); transcrição não conferida (Whisper indisponível). Capas refeitas com quadros do motor novo.
- 2026-11-09 00:38 UTC: o dono apontou dois erros no vídeo (Dalva presa num movimento repetido em cima de uma cadeira; braços do protagonista dentro do balcão). **Corrigidos** (marca de Dalva em chão livre + varredura com deslocamento e rodo no chão; braço POV em três trechos que nunca entra no tampo) e conferidos em stills.
- 2026-11-09 03:16 UTC: **Epi. 01 re-renderizado pela 2ª vez, com as correções** (`episodios/ep01_uma_pra_das_tres/ep01.mp4`, 1080x1920, 60 fps, 6704 quadros, 111,7 s, 108,6 MB). Render levou 156,8 min em CPU (1,37 s/quadro); do render à capa, 158 min. Prova: só o bloqueio **voz falsa**; transcrição não conferida (Whisper indisponível). Conferido em 12 quadros do MP4 final: Dalva varre no chão livre (posição muda ao longo do tempo, rodo no piso) e os antebraços ficam apoiados no tampo, sem manga abaixo do balcão. **Aguardando o dono assistir** e aprovar ou apontar o próximo ajuste.
- 2026-11-09 03:40 UTC: o dono pediu para **aprender o modelo de edição** do canal de referência (perfil do Instagram `tecoazarado`, o mesmo das 3 capturas de estilo): cortes, ritmo, legendas, abertura e fechamento. Na nuvem não deu: o Instagram exige login e barra acesso automático. **Decisão do dono: continuar no computador dele**, onde o navegador embutido do aplicativo Claude permite entrar no Instagram. **Próximo passo (na sessão local):** abrir o perfil no navegador embutido, assistir 4 ou 5 reels variados (um início de série, um do meio, um com virada forte, o mais visto), salvar os vídeos em `referencias/` (pasta fora do git se forem arquivos grandes), medir com ffmpeg: duração, número de cortes e intervalo entre cortes, instante da primeira legenda, tamanho e posição das legendas, falas por minuto, como abre e como fecha. Anotar em `memoria/estilo_visual.md` e `memoria/roteiro_regras.md` separando medido de hipótese, e só então ajustar motor e regras de roteiro. Regra: copiar técnica e acabamento, nunca personagem, lugar, história ou nome.

## O que está pronto
- Pipeline completo roda offline com voz falsa (`node fabrica/cli.js episodio --episodio 1 --provedor-voz falso`).
- Publicação em modo `--simular` nas 5 plataformas.

## O que falta (nesta ordem)
1. Dono: assinar o combinado (não copiar), fazer a investigação e o cartão do canal, ou aceitar o canal-exemplo.
2. Preencher `.env` (ANTHROPIC_API_KEY, GEMINI_API_KEY e credenciais das redes; ver `docs/CREDENCIAIS.md`).
3. Casting de vozes (capítulo 48): ouvir 5 ou 6 vozes por personagem e fixar em `canal/canal.json`.
4. Teste dos 3 estilos (capítulo 35/57): `node fabrica/cli.js estilos` e escolher (C = a referência; é o padrão).
5. Gerar o Epi. 01 com vozes reais, assistir no celular, aprovar, publicar.
6. Ligar o agendamento diário (GitHub Actions ou agendador do computador).

## Medido / não conferido
- Medido: nada de público ainda (nenhum vídeo publicado).
- Medido: Epi. 01 inteiro a 60 fps com o visual novo — 155,3 min (1º) e 158 min (2º, com as correções) do render à capa em CPU (ver `aprendizados.md`); -16,01 LUFS, pico -1,71 dBTP.
- Não conferido: sotaque e interpretação das vozes (só o ouvido humano confere); render em GPU real (aqui foi CPU); o MP4 assistido inteiro no celular (só 12 quadros amostrados do arquivo final e a folha de 56 quadros).

## Como refazer o que foi feito hoje
`npm install && pip install -r requirements.txt && node fabrica/cli.js episodio --episodio 1 --provedor-voz falso --escala 0.5`

Re-render completo do Epi. 01 com o visual novo (o que rodou em 2026-11-08/09, ~2 h 35 min em CPU; minutos com GPU):
`node fabrica/cli.js episodio --episodio 1 --de render --ate capa`

<!-- auto:inicio (gerado pela fábrica; edite acima desta linha) -->
## Painel automático (2026-11-09 03:17 UTC)
| Ep | Título | Etapa | Bloqueios | Publicado | Redes | Voto |
|---|---|---|---|---|---|---|
| 01 | Uma pra das três | capa | voz falsa: gere as vozes de verdade antes de publicar | — | — | — |

**Próximo passo da fábrica:** terminar o episódio 1 (está em "capa", bloqueado por: voz falsa: gere as vozes de verdade antes de publicar).

**Como outro chat continua:** leia CLAUDE.md, rode `node fabrica/cli.js status` e depois `node fabrica/cli.js diario` (ou `episodio --novo` para só produzir).
<!-- auto:fim -->
