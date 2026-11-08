# Estado atual

_Atualizado automaticamente pela etapa `memoria` e à mão pelo dono do canal._

## Onde paramos
- Fábrica construída do zero (motor, som, roteiro por IA, vozes, prova, capas, publicação em 5 redes, agendamento diário).
- Canal ativo: **canal-exemplo "Guichê 3"** (original, criado para a fábrica rodar). O dono ainda **não** fez a investigação da Parte 3 nem a entrevista. Status: `A DECIDIR` se mantém este canal ou cria o seu.
- Episódio 01 ("Uma pra das três") escrito à mão como piloto. Produzido aqui com **voz falsa** (sem chave do Gemini), portanto marcado como **não publicável** até gerar as vozes de verdade.

## O que está pronto
- Pipeline completo roda offline com voz falsa (`node fabrica/cli.js episodio --episodio 1 --provedor-voz falso`).
- Publicação em modo `--simular` nas 5 plataformas.

## O que falta (nesta ordem)
1. Dono: assinar o combinado (não copiar), fazer a investigação e o cartão do canal, ou aceitar o canal-exemplo.
2. Preencher `.env` (ANTHROPIC_API_KEY, GEMINI_API_KEY e credenciais das redes; ver `docs/CREDENCIAIS.md`).
3. Casting de vozes (capítulo 48): ouvir 5 ou 6 vozes por personagem e fixar em `canal/canal.json`.
4. Teste dos 3 estilos (capítulo 35/57): `node fabrica/cli.js estilos` e escolher.
5. Gerar o Epi. 01 com vozes reais, assistir no celular, aprovar, publicar.
6. Ligar o agendamento diário (GitHub Actions ou agendador do computador).

## Medido / não conferido
- Medido: nada de público ainda (nenhum vídeo publicado).
- Não conferido: sotaque e interpretação das vozes (só o ouvido humano confere); render em GPU real (aqui foi CPU).

## Como refazer o que foi feito hoje
`npm install && pip install -r requirements.txt && node fabrica/cli.js episodio --episodio 1 --provedor-voz falso --escala 0.5`

<!-- auto:inicio (gerado pela fábrica; edite acima desta linha) -->
## Painel automático (2026-11-08 17:15 UTC)
| Ep | Título | Etapa | Bloqueios | Publicado | Redes | Voto |
|---|---|---|---|---|---|---|
| 01 | Uma pra das três | capa | voz falsa: gere as vozes de verdade antes de publicar | — | — | — |

**Próximo passo da fábrica:** terminar o episódio 1 (está em "capa", bloqueado por: voz falsa: gere as vozes de verdade antes de publicar).

**Como outro chat continua:** leia CLAUDE.md, rode `node fabrica/cli.js status` e depois `node fabrica/cli.js diario` (ou `episodio --novo` para só produzir).
<!-- auto:fim -->
