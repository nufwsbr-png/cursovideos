# Arquitetura da fábrica: como ela cria e posta sozinha

> Para o dono do canal. Responde ao pedido de 2026-11-10: "veja como podemos fazer um sistema de geração de conteúdo
> automática e postagem automática parecido com esse". Usamos só as **ideias gerais** do modelo que você colou
> (constituição, skills, portões, crítico por IA, manifesto "publicável", versões). Nenhum arquivo, texto ou número
> daquele produto está aqui: tudo foi escrito para este canal, em cima do que a fábrica já fazia.

## A ideia em uma frase
**A IA pensa, o código executa, os portões decidem.** A IA escreve o roteiro, critica os quadros e lê os números. O
código faz o resto sempre do mesmo jeito: motor 3D, vozes, som, prova e publicação. Entre uma etapa e outra há um
portão que só deixa passar o que foi medido e aprovado.

## O caminho de um episódio
| # | Etapa | Quem faz | Portão (o que precisa para seguir) | Arquivo que sai |
|---|---|---|---|---|
| 1 | Público | código + IA (conta votos) | — | `votos.json`, `metricas/`, planilha |
| 2 | Roteiro | IA (Claude) | nota automática ≥ 70 e 0 erros (`fabrica/roteiro/nota.js`) | `roteiro.json`, `validacao.json` |
| 3 | Vozes | Gemini TTS (ou voz falsa de teste) | — (voz falsa trava só a publicação) | `audio/falas/*.wav`, `origem.json` |
| 4 | Conferir | código + Whisper | — | `medidas.json` |
| 5 | Tempo | código | duração dentro de 65–130 s | `linha_do_tempo.json` |
| 6 | Quadros | motor + revisor automático | revisor sem problema grave | `stills/`, `folha.png`, `revisao.json` |
| 7 | **Crítico visual** | IA (Claude, com imagens) | as 6 notas ≥ 7 (até 3 rodadas, patch só de direção) | `critico.json`, `revisoes.md` |
| 8 | Render | motor (30 fps) | só com o crítico aprovado | `video_mudo.mp4` |
| 9 | Som | código (zumbido grave, efeitos, mixagem −14 LUFS) | — | `epNN.mp4` |
| 10 | Prova | código + Whisper | formato, volume, zumbido, falas, fontes | `prova.json` |
| 11 | Capa e textos | código | — | `capa.png`, `textos.json` |
| 12 | **Entrega** | código | tudo acima de novo: `publicavel: true` | `entrega.json` (com hashes) |
| 13 | Publicar | código (APIs das redes) | entrega publicável e arquivos com o mesmo hash | `publicacao.json` |
| 14 | Memória | código | sempre roda, mesmo com erro | `memoria/*`, `BLOQUEADO.md` |

## As peças (ideia geral → onde está aqui)
| Ideia geral | Como fizemos | Onde |
|---|---|---|
| Constituição (o que a IA pode decidir sozinha e quando para) | regras fixas + autonomia + **lista fechada de quando parar** + tabela sintoma → causa → o que fazer | `CLAUDE.md` |
| Skills (uma receita por tipo de tarefa) | 8 skills em português, cada uma diz quando usar, o que ler, os passos, o arquivo que entrega e a skill seguinte | `.claude/skills/*/SKILL.md` |
| Portões de qualidade | nota do roteiro, revisor, crítico, prova e entrega; cada etapa é dona dos seus bloqueios | `fabrica/orquestrador.js` (`portao`), `estado.json → bloqueios_por_etapa` |
| Crítico visual por IA com rubrica | folhas 4×3 + 6 quadros em tamanho real; primeira passada às cegas, segunda com a rubrica; 6 notas com evidência por quadro; patch só de direção com o "hash da história" conferido | `fabrica/critico/`, `docs/criterios_visuais.md` |
| Manifesto "publicável" | `entrega.json` com cada checagem, os motivos e o hash do MP4, da capa e dos textos; a publicação confere de novo e recusa se 1 byte mudou | `fabrica/etapas/09b_entrega.js` |
| Invalidação por versão | cada etapa grava o hash do que entrou e do que saiu; mudou a direção → refaz do tempo em diante, sem refazer as vozes | `fabrica/etapas/registro.js`, `fabrica/util/versoes.js` |
| Provedor falso para testar sem gastar | `--ia falsa` (respostas fixas) e `--provedor-voz falso`; nada aprovado por eles vale para publicar | `fabrica/ia/falso.js`, `audio/voz_falsa.py` |
| Diário de aprendizado | correção que se repete em 3 de 5 episódios vira regra escrita e entra no próximo pedido de roteiro | `fabrica/aprender.js` → `memoria/roteiro_regras.md` |
| Agendador | GitHub Actions todo dia às 17:30 (Brasília) | `.github/workflows/fabrica-diaria.yml` |
| Saber quando chamar o humano | saída 3 + `BLOQUEADO.md`, só no 1º dia de cada bloqueio novo (o GitHub manda e-mail) | `fabrica/diario.js` |

## Dois jeitos de rodar
**1. Sozinha, todo dia (GitHub Actions).** Precisa dos segredos no GitHub (Settings → Secrets → Actions):
`ANTHROPIC_API_KEY` (roteiro e crítico), `GEMINI_API_KEY` (vozes) e as chaves de cada rede (ver `docs/CREDENCIAIS.md`).
A rotina: lê os números → produz o episódio de hoje até a entrega → publica se for publicável → adianta o próximo →
grava a memória no git. A mídia pesada (falas, vídeo) passa de um dia para o outro pelo cache do Actions, conferida
por hash (`fabrica/midia.js`).

**2. Comigo, numa sessão do Claude Code (sem chaves de API).** Eu faço o papel da IA: escrevo o roteiro à mão
(skill `roteiro-escrever`) e critico os quadros olhando as folhas (skill `critico-visual`). O resto é o mesmo código.
Foi assim que o Epi. 01 novo foi produzido em 2026-11-10.

## O que ainda depende de você
- **Chaves:** sem `GEMINI_API_KEY` as vozes são falsas e nada publica; sem `ANTHROPIC_API_KEY` o CI não escreve
  roteiro nem roda o crítico (na sessão comigo, sim).
- **Kwai:** não tem API pública: fica "pendente manual" com o pacote pronto em `fila_manual/kwai/`.
- **Ouvir e olhar no celular:** sotaque, interpretação e "ficou bom" a fábrica não mede (fica anotado como não conferido).
- **Identidade e bíblia:** mudar personagem, lugar ou regra do mundo é sempre com você.

## Custos e limites (configuráveis em `canal/canal.json`)
- No máximo 25 chamadas à IA por execução (`ia.max_chamadas_por_execucao`). Roteiro: 3 a 6 chamadas; crítico: 2 por
  rodada, no máximo 3 rodadas.
- Render em CPU: cerca de 1 h por episódio de 90 s a 30 fps (o CI tem 350 min por execução).
- Um episódio por dia (`publicacao.um_por_dia`), com um adiantado (`publicacao.episodios_adiantados`).

## Medido × não conferido (2026-11-10)
- **Medido aqui:** orquestrador, versões, portões, entrega, publicação simulada, patch e laço do crítico (73 testes
  automáticos + 6 de áudio); o crítico na sessão rodou 2 rodadas no Epi. 01 (reprovou na 1ª, aprovou na 2ª).
- **Não conferido:** as chamadas reais à API do Claude (roteiro e crítico pela API) e do Gemini: esta máquina não
  tem as chaves. O formato segue a documentação do SDK, mas só a primeira execução com chave confirma.
