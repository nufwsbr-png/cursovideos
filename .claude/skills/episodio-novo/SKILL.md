---
name: episodio-novo
description: Leva um episódio novo do zero até "publicável" (roteiro → produção → crítico → entrega), escolhendo o caminho certo com ou sem chaves de API. Use quando o dono pedir "faz o próximo episódio", "produz um episódio novo" ou "adianta o próximo".
---

# Episódio novo, de ponta a ponta

## Ler antes
`CLAUDE.md`, `memoria/estado_atual.md`, `memoria/aprendizados.md` e `node fabrica/cli.js status`.

## Passos
1. Confira se não há episódio anterior travado ou sem publicar (`status`, `BLOQUEADO.md`): o próximo só faz sentido
   depois do anterior (a continuação depende do voto).
2. Roteiro → skill `roteiro-escrever` (com chave: `node fabrica/cli.js episodio --novo` já escreve e produz).
3. Produção até os quadros → skill `producao` (`episodio --episodio N --ate quadros`).
4. Crítico visual → pela API (automático no `episodio`) ou skill `critico-visual` na sessão.
5. Render → entrega → skill `producao` de novo (`episodio --episodio N`).
6. Relate ao dono em poucas linhas: publicável sim/não, os motivos, o que foi medido e o que não foi conferido.

## Entrega
Pasta `episodios/epNN_<slug>/` com `entrega.json`. Próxima skill: `publicar-e-ler-numeros`.
