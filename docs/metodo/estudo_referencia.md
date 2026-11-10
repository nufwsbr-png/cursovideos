# Estudo da referência — ritmo e estrutura do roteiro (2026-11-09/10)

> **Nunca entra em prompt de IA.** Este arquivo descreve episódios de outro canal só para medir técnica (ritmo,
> estrutura, tempos). Nada de lugar, personagem, história, nome ou fala daqui vai para os nossos roteiros.
> As regras que saíram deste estudo estão, sem as histórias, em `memoria/roteiro_regras.md` e os números em
> `canal/canal.json → roteiro`.

## Modelo de edição da referência: o que o roteiro precisa prever (estudo de 2026-11-09)

Medido em 5 reels do perfil de referência (detalhes, método e números de imagem em `memoria/estilo_visual.md → Modelo de
edição da referência`). Fala transcrita com faster-whisper small **sem VAD**: com VAD ele perdeu 18 de 21 falas no Mercado
Epi. 03. A transcrição ainda erra palavras, mas os tempos batem com as legendas vistas nas folhas.
**Regra fixa:** copiamos a técnica (ritmo, estrutura, acabamento). As histórias deles (escola sob céu vermelho, supermercado
em alerta), as falas e os personagens não entram.

| Id | Papel | Duração | 1ª fala | Falas | Palavras | Palavras/min do vídeo | Palavras/s falando | Palavras por fala (mediana) | Maior trecho sem fala | Última fala → cartão |
|---|---|---|---|---|---|---|---|---|---|---|
| DfekLxVKm3- | Epi. 1, o mais visto | 94,9 s | 0,0 s (legenda no quadro 0; Whisper pegou só 1,4 s) | 34 | 142 | 89,8 | 2,53 | 4 | 4,4 s | 0,7 s |
| Dfc_rs-Kr1W | Epi. 1 | 113,9 s | 0,0 s | 30 | 124 | 65,3 | 2,02 | 4 | 13,4 s | 4,0 s |
| DffSsVWKd1m | Epi. 3 | 103,8 s | 1,6 s | 24 | 137 | 79,2 | 2,70 | 5 | 12,3 s | ≈ 1,5 s |
| Dfe9fCPKa75 | Epi. 3 | 123,3 s | 0,0 s | 21 | 105 | 51,1 | 2,51 | 5 | 18,5 s | 1,1 s |
| Dffe38TqD-Q | Epi. 4 | 63,0 s | 0,0 s | 9 | 59 | 56,2 | 1,89 | 7 | 12,8 s | 1,9 s |

### MEDIDO
- **Duração:** 63–123 s (mediana 104 s). O perfil inteiro (11 reels) vai de 63 a 179 s.
- **Densidade de fala:** **51–90 palavras por minuto de vídeo** (média 68), bem abaixo das nossas ~105. Quando alguém fala, o ritmo é 1,9–2,7 palavras/s (a nossa estimativa de 2,5 bate).
- **Falas curtas:** mediana de 4–5 palavras e ≈ 2 s por fala; 9 a 34 falas por vídeo. Muitas são de 1–3 palavras ("Ei!", "Senta!", "Urgente.", "Não abre.").
- **Trechos sem fala:** 4 de 5 vídeos têm um trecho de 12–18 s sem nenhuma fala, sempre com ação ou movimento (correr pelos corredores, esperar no depósito, perseguição). Sem fala não quer dizer silêncio: o zumbido grave e os efeitos continuam.
- **Abertura:** fala e legenda em ≤ 2 s em 5 de 5 (no quadro 0 em 3 de 5). A primeira fala é diálogo no meio da situação, nunca apresentação: uma pergunta de cliente, a professora ditando, um pedido desesperado na porta, uma constatação ("Ele tá olhando… mas não vem.").
- **Primeiro sinal nos episódios 1:** 3,6 s ("olha o céu", com a luz caindo aos 2 s) e 7,3 s (cartão vermelho de alerta no alto). Os dois cabem no nosso limite de 7 s.
- **Episódios seguintes:** começam já dentro do perigo, sem rotina; selo PARTE N por ≈ 2,5 s. A frase de contexto, quando existe, sai da boca do protagonista e já é ação ("Ele foi pra escola atrás de mim… e eu vim atrás dele.").
- **Informação de fora** (pai, alerta oficial) chega pelo celular na mão + cartão grande no alto, com texto curto ("Vem pra casa. URGENTE." / "PROCURE ABRIGO AGORA" / "NÃO ABRA PARA NINGUÉM").
- **Salto de tempo/lugar:** tela preta de ≈ 1 s no meio do vídeo (40–63 s) em 3 de 5.
- **Fechamento:** a última fala é uma ordem, ameaça ou frase de duplo sentido; depois vêm 1–4 s sem fala com aproximação lenta do objeto da decisão e o cartão "O QUE VOCÊ FARIA?" por 3,6–4,1 s. As duas opções têm 2–6 palavras em caixa alta com emoji; **a vermelha é sempre sair/arriscar/agir, a azul é ficar/esperar/se abrigar** (5 de 5).
- **Virada forte (Dfc_rs-Kr1W, 8.148 comentários, o maior número do perfil):** a frase banal do início ("minha compra ainda não passou") volta no fim, dita por quem está do lado de fora da porta que não pode ser aberta. É a virada "a primeira cena volta com outro sentido", que já está na nossa lista de 30.
- **Números do perfil (09/11 16:39 UTC; views pela grade, curtidas e comentários pelos metadados):**
  - Série A: Epi. 1 7,4 mi → Epi. 2 3 mi → Epi. 3 2,1 mi → Epi. 4 1,4 mi → Epi. 5 1,3 mi.
  - Série B: Epi. 1 4,5 mi → Epi. 2 1,8 mi → Epi. 3 2,2 mi → Epi. 4 1,1 mi.
  - O Epi. 2 fica com 40 % das views do Epi. 1.
  - Ritmo: 11 reels em ≈ 44 h, alternando as duas séries.

### HIPÓTESE
- Menos palavras (≈ 70/min) e trechos longos de ação sem fala deixam a imagem contar a história e seguram a atenção melhor que diálogo contínuo. Testar um episódio nosso a ≈ 70 palavras/min.
- Botões com emoji, sem A/B, rendem mais comentário que "Responde A ou B".
- A queda de 60 % entre Epi. 1 e Epi. 2 parece o normal do formato e não falha do episódio. Usar como base quando lermos os nossos números.

### Ajustes que foram propostos ao dono (aprovados em 2026-11-10 e já implementados)
1. **Ritmo de fala:** meta de **60–90 palavras por minuto de vídeo** (hoje ~105). Falas de 2–7 palavras, muitas de 1–3. `falas_max` 22 → 32.
2. **Um trecho de 8–15 s sem fala** com ação na imagem (andar, correr, esperar, olhar o celular), marcado na tabela como `(sem fala: ação)`.
3. **Abertura:** a primeira fala começa em ≤ 1 s, no meio de uma conversa (pergunta ou ordem). Episódios seguintes começam no perigo; selo PARTE N 2,5 s; a frase de contexto, se houver, sai da boca do protagonista e já é ação.
4. **Pergunta final:** última fala 1–4 s antes do cartão (com aproximação lenta). Duas opções de 2–6 palavras, cada uma com emoji: `opcao_a` = a ação arriscada (botão vermelho), `opcao_b` = ficar/esperar (botão azul). Novos campos `emoji_a` / `emoji_b` no `dilema`.
5. **Celular/alerta:** quando a informação vem de fora, usar `celular.notificacao` com `tipo` (`mensagem` | `alerta`) e texto curto (alerta em caixa alta, até 4 palavras).
6. **Virada preferida para o Epi. 1:** "a primeira cena volta com outro sentido". Plantar uma frase banal nos primeiros 5 s e repeti-la no fim com outro peso.
