# Limites por plataforma (usados por `fabrica/publicar/limites.js`)

> ⚠️ Estes números vêm do conhecimento das APIs oficiais até 2025 e **não foram conferidos na documentação nesta sessão**
> (os sites developers.tiktok.com, developers.facebook.com e developers.google.com estavam fora da rede permitida).
> Regra do livro (cap. 2 e 84): tudo que envolve regra, requisito ou dinheiro precisa ser conferido na fonte oficial antes de você contar com isso.
> Quando um número mudar, ajuste `LIMITES` em `fabrica/publicar/limites.js` e esta página.

| Plataforma | Duração | Tamanho | Proporção / resolução | Texto | Observações |
|---|---|---|---|---|---|
| **TikTok** (Content Posting API, Direct Post) | 3 s até o valor de `creator_info.max_video_post_duration_sec` (costuma ser 600 s; a fábrica consulta antes de cada post) | até 4 GB | vertical 9:16 recomendado; mp4/mov/webm | título (descrição + hashtags) até 2200 caracteres | pedaços de 5 a 64 MB, até 1000 pedaços, resto no último; `is_aigc` marca conteúdo de IA; app **sem auditoria** só publica `SELF_ONLY` |
| **Instagram Reels** (Graph API) | 3 s a 15 min | até 1 GB | 9:16 recomendado, largura mínima 540 px, 23–60 fps; mp4/mov | legenda até 2200 caracteres, até 30 hashtags | precisa de **URL pública** do vídeo; limite de 50 publicações por API em 24 h; conta profissional ligada a uma Página |
| **Facebook Reels** (Video API) | 3 s a **90 s** | até 1 GB | 9:16, mínimo 540x960, 24–60 fps | descrição até 2200 caracteres | acima de 90 s a fábrica publica como **vídeo comum da Página** (`/{page}/videos`), que aceita até 240 min e 10 GB |
| **YouTube Shorts** (Data API v3) | Shorts: até 3 min vertical/quadrado | até 256 GB | 9:16 para Shorts | título até 100 caracteres (com `#Shorts`), descrição até 5000 bytes, tags até 500 caracteres no total | `containsSyntheticMedia: true` = etiqueta de conteúdo alterado/sintético; cada upload gasta 1600 unidades da cota diária (10 000 padrão = ~6 vídeos/dia) |
| **Kwai** | palpite: até 10 min | palpite: até 1 GB | 9:16 | legenda: a fábrica corta em 1000 caracteres | **sem API pública**: fila manual ou modo navegador (sessão sua) |

## O que a fábrica faz com os limites

- `validarArquivo(plataforma, info)` recusa (erro) formato errado, arquivo grande demais e duração fora da faixa dura; avisa (aviso) quando o vídeo é horizontal, longo demais para Shorts/Reels etc.
- `cortarTexto(texto, max)` corta no último espaço e **nunca deixa uma hashtag ou menção pela metade**.
- `cortarBytes(texto, maxBytes)` é usado na descrição do YouTube, que conta bytes UTF-8.
- O comentário fixado da votação é **postado** no Instagram, Facebook e YouTube; **fixar** não existe em nenhuma API, por isso vira pendência manual em `publicacao.json` → `pendencias_manuais`. No TikTok e no Kwai não há API de comentários.

## Comportamentos que valem dinheiro ou conta (confira na fonte)

- TikTok: regras do Programa de Recompensas (cap. 79) e a etiqueta de IA oficial (cap. 12). A API liga `is_aigc`; confira no app se o rótulo apareceu.
- YouTube: a política de conteúdo inautêntico e em massa (cap. 79). Varie histórias; a fábrica publica um episódio por dia, nunca versões quase iguais.
- Meta: a divulgação de conteúdo de marca é feita no app (a API de Reels não tem o campo); se houver promoção, marque à mão antes de publicar outro vídeo.
