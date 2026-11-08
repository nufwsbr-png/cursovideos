# Vozes (Parte 6)

## Leis
1. Cada personagem tem sempre a mesma voz. 2. Cada fala tem a sua emoção (uma fala por arquivo). 3. Toda voz é ouvida e conferida por uma pessoa antes de entrar no vídeo.

## Prefixo obrigatório de todo estilo (capítulo 49)
`native Brazilian Portuguese speaker from Brazil, Brazilian accent, no English accent` + quem é + como está + como fala (em inglês, curto).

## Elenco de vozes (A CONFIRMAR no casting do capítulo 48: 1 frase calma + 1 nervosa em 5 ou 6 vozes, olhos fechados)
| Personagem | Voz (Gemini) | Estilo base | Filtro |
|---|---|---|---|
| Eu (protagonista) | Iapetus | young man, early twenties, nervous, short sentences, slightly shaky | — |
| Dalva | Gacrux | woman mid-fifties, hoarse, fast, teasing, dry humor | — |
| Seu Amaral | Algenib | man in his sixties, deep gravelly, tired, firm, never raises voice | telefone |
| Alto-falante | Erinome | female announcer, flat, cold, slow, old PA recording | alto_falante |
| Passageiro do Casaco | Schedar | elderly man, polite, strangely calm, soft, unhurried | — |

## Ajustes que o livro ensina (capítulo 49)
Parece leitura → "caught by surprise" · exagerada → "subtle, realistic, understated" · pausas estranhas → mude a pontuação (reticências dão hesitação) · rápida demais → "unhurried" ou encurte · palavra errada → escreva como se fala.

## Os 5 defeitos para conferir (capítulo 50)
Muda o texto · repete · muda o sotaque · fica longa · fica muito baixa/trava. A transcrição automática é **alerta**, não prova.

## Provedor
Gemini TTS (`gemini-2.5-flash-preview-tts`) via API com `GEMINI_API_KEY` (custo e cota: conferir no site antes). Sem chave: provedor `falso` (só para testar a fábrica; bloqueia publicação).
Economia: só gerar com roteiro aprovado; reaproveitar falas iguais (`reaproveitar_de`); refazer só o que mudou.
