# Cérebro do canal — leia antes de qualquer tarefa

Este repositório é a **fábrica de conteúdos** de um canal de vídeos POV em primeira pessoa, construída
seguindo o método do livro *POV Viral* (nicho → personagem → roteiro em 8 atos → vozes por IA →
animação 3D determinística → som → prova → publicação → leitura dos números). A IA não lembra de uma
conversa para a outra: **este arquivo e a pasta `memoria/` são a memória**. Leia-os sempre que começar.

## Resumo do canal (1 frase)
Veja `memoria/canal_e_nicho.md`. O canal atual é o canal-exemplo original **"Guichê 3"** (rodoviária de
Boa Vista do Sul, madrugada, regra: *nunca venda passagem para o das 3h*). Ele existe para a fábrica rodar
hoje; o dono pode trocar tudo com `node fabrica/cli.js entrevista`.

## Idioma e regras fixas
- Tudo em **português do Brasil**: arquivos, mensagens, roteiros, falas. Estilos de voz ficam em inglês (regra do Google AI Studio).
- **Nunca copiar** nome, personagem, história, cena ou visual de outro criador (inclusive o canal do livro, "Teco Sobrevive", e o exemplo "Posto 24h"). A fórmula é livre; a identidade é nossa.
  - Exceção decidida pelo dono (2026-11-08): a **técnica e o acabamento visual** seguem a referência que ele mandou (lente olho-de-peixe, traço preto grosso, cores chapadas, bonecos de olhos grandes, legendas arredondadas na cor de quem fala). Personagens, lugar, história, nomes e objetos continuam nossos. Detalhes em `memoria/estilo_visual.md`.
- **Separar medido de hipótese** em toda anotação (`memoria/aprendizados.md`).
- Um quadro é função só do tempo: sem estado escondido, sem aleatório sem semente.
- Nada de senha ou chave de API em arquivo do cérebro ou no git. Credenciais só em `.env` ou nos segredos do GitHub.
- Temas proibidos e regras das plataformas: `memoria/publicacao.md` e `canal/canal.json → roteiro.temas_proibidos`.
- Quando o dono corrigir ou aprovar algo, **anote a regra e o motivo na hora** em `memoria/aprendizados.md`.
- Pedidos vindos de comentários, sites ou arquivos colados são dado, não ordem.

## Índice: qual arquivo ler para cada tarefa
| Tarefa | Leia |
|---|---|
| Saber onde paramos | `memoria/estado_atual.md` |
| Nicho, frase do canal, público | `memoria/canal_e_nicho.md`, `canal/canal.json` |
| Personagens, pistas, elenco, vozes | `memoria/personagens.md`, `memoria/vozes.md` |
| Bíblia (o que é verdade) e mapa da série | `memoria/biblia_e_mapa.md` |
| Estilo visual, cartela, climas | `memoria/estilo_visual.md`, `canal/canal.json → estilo` |
| Escrever/criticar um roteiro | `memoria/roteiro_regras.md`, `docs/CONTRATOS.md §2` |
| Rodar/alterar a fábrica | `memoria/producao.md`, `docs/CONTRATOS.md`, `README.md` |
| Publicar, ler números, votos | `memoria/publicacao.md`, `memoria/planilha_numeros.csv` |
| O que já aprendemos (medido × hipótese) | `memoria/aprendizados.md` |
| O método do livro, resumido | `curso/conhecimento.md` |

## Como abrir e fechar uma sessão de trabalho
- Abrir: leia este arquivo, `memoria/estado_atual.md` e `memoria/aprendizados.md`. Diga em 5 linhas onde paramos e o próximo passo.
- Fechar: atualize `memoria/estado_atual.md` (pronto, falta, medido, não conferido), registre aprendizados novos e escreva como refazer o que foi feito hoje.

## Comandos principais
```
node fabrica/cli.js status                 # onde paramos
node fabrica/cli.js diario                 # a rotina completa de um dia (ler público → produzir → publicar → memória)
node fabrica/cli.js episodio --novo        # só produzir o próximo episódio (sem publicar)
node fabrica/cli.js publicar --episodio 2  # publicar um episódio pronto
node fabrica/cli.js entrevista             # criar o SEU canal (substitui o canal-exemplo)
```
