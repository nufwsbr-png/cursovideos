---
name: roteiro-escrever
description: Escreve ou corrige o roteiro.json de um episódio (pela API com a fábrica, ou à mão na sessão quando não há chave), seguindo as regras do canal e a nota automática. Use quando o dono pedir um episódio/roteiro novo, uma continuação, ou quando a produção parar em "roteiro reprovado".
---

# Escrever o roteiro

## Ler antes
- `memoria/roteiro_regras.md` (regras aprovadas e aprendidas), `memoria/biblia_e_mapa.md`, `memoria/personagens.md`
- `node fabrica/cli.js roteiro --regras` (os números do canal: palavras por minuto, trecho sem fala, cartão…)
- `docs/CONTRATOS.md §2` e `fabrica/roteiro/esquema.js` (o formato)
- Para continuação: `votos.json` do episódio anterior e `proximo_episodio` dele

## Passos
- **Com chave:** `node fabrica/cli.js roteiro --numero N` (ideias → episódio → crítico → até 3 correções pela nota).
- **Sem chave (na sessão):** escreva `episodios/epNN_<slug>/roteiro.json` à mão no mesmo esquema, usando só ids que
  existem em `canal/canal.json` (props, marcas, nós do caminho, personagens) e o vocabulário de direção.
- Valide: `node fabrica/cli.js roteiro --validar --episodio N` — 0 erros e nota ≥ 70. Corrija o maior desconto primeiro.

## Regras que não se negociam
Nunca copiar nome, personagem, história, cena ou visual de outro criador (a técnica e o acabamento seguem a referência;
a história é nossa). Temas proibidos: `canal.json → roteiro.temas_proibidos`. Continuação começa no perigo, com
`tela.selo=PARTE N`, e respeita o voto. Mudar a bíblia ou a identidade = parar e perguntar ao dono.

## Entrega
`roteiro.json` + `validacao.json` aprovados. Próxima skill: `producao`.
