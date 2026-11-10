---
name: prova-e-entrega
description: Confere o vídeo pronto (prova), a capa e o manifesto entrega.json, e explica por que um episódio é ou não publicável. Use quando o dono perguntar "está pronto?", "pode publicar?", quando a entrega disser "não publicável", ou depois de mexer no som ou na capa.
---

# Prova e entrega

## Passos
1. `node fabrica/cli.js episodio --episodio N --de prova --ate entrega` (ou só `entrega`, que confere tudo de novo).
2. Leia `entrega.json`: `publicavel`, `motivos` e cada `checagens.*` (voz_real, linter, revisor, critico, prova,
   fontes, bloqueios, aprovacao, versoes, arquivos) e os hashes do MP4, da capa e dos textos.
3. Para cada motivo, use a tabela sintoma → causa → o que fazer do `CLAUDE.md`. Voz falsa e aprovação humana são do
   dono; o resto a fábrica resolve refazendo a etapa certa.
4. Leia `prova.json`: LUFS (−14 ±1,5), pico, zumbido grave 20–80 Hz (80–88 %), sem silêncio abaixo de −40 dB,
   transcrição, fontes. Separe MEDIDO de não conferido (ouvido, sotaque, celular na mão).

## Entrega
Um parágrafo para o dono: publicável sim/não, motivos em linguagem simples, o que só ele confere.
Próxima skill: `publicar-e-ler-numeros` (só se publicável).

## Nunca
Publicar sem `publicavel: true` · usar `--forcar` (é decisão humana e fica registrada) · editar o MP4 depois da entrega.
