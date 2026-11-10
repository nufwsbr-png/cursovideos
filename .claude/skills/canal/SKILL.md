---
name: canal
description: Cria ou troca o canal (nicho, personagem, lugar, cartela, vozes) pela entrevista da fábrica e mantém canal.json e a memória coerentes. Use quando o dono quiser criar o próprio canal, trocar o canal-exemplo, mudar personagem/lugar/estilo ou revisar a identidade.
---

# O canal (identidade)

Mudar a identidade é decisão do dono: proponha, mostre, e só grave com o sim dele.

## Ler antes
`memoria/canal_e_nicho.md`, `memoria/personagens.md`, `memoria/vozes.md`, `memoria/estilo_visual.md`,
`memoria/biblia_e_mapa.md` e `canal/canal.json`.

## Passos
1. `node fabrica/cli.js entrevista` (ou `--respostas arquivo.json`): gera o canal novo e guarda o antigo em
   `canal/canal.anterior.*.json`.
2. Confira `node fabrica/cli.js doctor` (consistência do canal) e `node fabrica/cli.js estilos` (3 versões do visual).
3. Atualize a memória (`canal_e_nicho.md`, `personagens.md`, `biblia_e_mapa.md`) e anote a decisão do dono em
   `aprendizados.md` com a data.
4. Mudou o mundo (`mundos`, cenários, props)? Rode os testes (`npm run testes`) e um episódio-teste do motor.

## Nunca
Copiar nome, personagem, história, cena ou visual de outro criador · trocar a identidade sem o dono.
Próxima skill: `episodio-novo`.
