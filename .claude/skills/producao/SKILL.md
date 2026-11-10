---
name: producao
description: Produz um episódio que já tem roteiro, do roteiro até a entrega, com o orquestrador (pula o que está em dia, para nos portões). Use quando o dono pedir para produzir, refazer, renderizar ou terminar um episódio, quando algo "não rodou", ou para entender por que uma etapa está velha.
---

# Produção (orquestrador)

A IA pensa, o código executa, os portões decidem. Nunca rode etapas na mão fora de ordem para "passar" um portão.

## Ler antes
- `memoria/estado_atual.md` (onde paramos) e `memoria/producao.md`
- `node fabrica/cli.js status`

## Passos
1. `node fabrica/cli.js versoes --explicar --episodio N` — o que está em dia e o motivo de cada etapa velha.
2. `node fabrica/cli.js episodio --episodio N` — roda de `roteiro` até `entrega`, pulando o que está em dia:
   roteiro (nota ≥ 70) → vozes → conferir → tempo → quadros (revisor) → crítico visual → render → som → prova → capa → entrega.
3. Parou num portão? Leia o motivo e use a tabela sintoma → causa → o que fazer do `CLAUDE.md`.
   - "crítico visual não rodou" → skill `critico-visual`.
   - "roteiro reprovado" → skill `roteiro-escrever`.
4. Sem chave do Gemini, use `--provedor-voz falso` para testar (a entrega fica "não publicável: voz falsa").
5. Render em CPU leva ~1 h por episódio a 30 fps: rode em segundo plano e não mexa no motor enquanto renderiza.

## Opções úteis
`--de etapa --ate etapa` · `--refazer quadros,critico` · `--escala 0.5` (teste; muda a versão do render) ·
`versoes --adotar --ate tempo` (episódio feito antes do registro de versões: marca como em dia sem rodar).

## Entrega
`entrega.json` com `publicavel` e os motivos. Próxima skill: `prova-e-entrega` (se não publicável) ou `publicar-e-ler-numeros`.
