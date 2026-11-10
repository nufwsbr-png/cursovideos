---
name: critico-visual
description: Faz o papel do crítico visual por IA de um episódio, na própria sessão do Claude Code, quando não há ANTHROPIC_API_KEY (ou quando o dono pede) — prepara a rodada, olha as folhas de quadros, escreve olhar.json e julgar.json e aplica. Use quando a produção parar em "crítico visual não rodou", quando o dono pedir para criticar/revisar os quadros de um episódio, ou antes do render de um episódio novo.
---

# Crítico visual na sessão

O crítico é o portão antes do render: 6 notas de 0 a 10 (`docs/criterios_visuais.md`), passa com **todas ≥ 7**,
no máximo 3 rodadas e 2 patches. O patch só mexe na **direção**; a história é intocável (a fábrica confere o hash).

## Ler antes
- `docs/criterios_visuais.md` (a rubrica — a única)
- `memoria/estilo_visual.md` (o que é o acabamento certo)

## Passos
1. `node fabrica/cli.js critico --preparar --episodio N`
   — refaz o que estiver velho até os quadros e renderiza a rodada em `episodios/<ep>/critico/rodada_K/`.
2. Abra `critico/rodada_K/pedido.md`. Leia **todas** as imagens listadas, na ordem (4 folhas 4×3 + 6 detalhes), com a
   ferramenta de leitura de arquivos.
3. Escreva `olhar.json` **antes** de ler a parte do roteiro no pedido: descreva só o que está na tela, quadro a quadro.
   Na sessão não é às cegas de verdade — a fábrica anota `cego: false`.
4. Escreva `julgar.json`: notas com evidência (ids dos quadros), os 3 piores defeitos, o patch (só os campos
   permitidos) e o veredito. Seja duro: só vale o que se vê.
5. `node fabrica/cli.js critico --aplicar --episodio N`
   - aprovado → siga para `producao` (render → entrega);
   - patch aplicado → volte ao passo 1 (rodada seguinte);
   - reprovado → o episódio fica bloqueado; a rotina diária descarta e refaz se travar de novo.
6. Defeito que o patch não alcança (motor, mundo, `canal.json`): corrija no código **só se não for identidade nem
   bíblia**, anote em `revisoes.md` ("Correções fora do patch") e rode a próxima rodada.

## Entrega
`critico.json` (rodadas, notas, status) e `revisoes.md` no episódio. Próxima skill: `producao`.

## Nunca
Dar nota sem citar quadro · aprovar o que não viu · mexer em fala, ato, dilema ou texto do celular pelo patch.
