# Som da fábrica (`audio/`)

Tudo aqui segue a regra do curso: **a voz manda**. As falas medidas decidem os tempos; ambiente,
efeitos e tensão se encaixam nelas. Nada é baixado: cada efeito é sintetizado do zero com numpy,
com semente, então a mesma linha do tempo sempre dá o mesmo som.

Ferramentas necessárias: Python 3 com `numpy`, e `ffmpeg`/`ffprobe` no PATH. Opcional: `faster-whisper`
(com o modelo baixado uma vez, com internet) para transcrever.

## Os scripts, na ordem em que a fábrica usa

| Script | O que faz | Entrada | Saída |
|---|---|---|---|
| `voz_falsa.py --episodio <dir>` | Vozes de TESTE (provedor `falso`), para rodar tudo sem chave de API. Não é fala de verdade. | `roteiro.json` | `audio/falas/fNN.wav`, `audio/falas/origem.json` |
| `medir_falas.py --episodio <dir>` | Mede cada fala: duração, início/fim da voz, RMS, pico, envelope de 50 ms (a boca segue isto) e transcreve se houver Whisper. Imprime a tabela do capítulo 50. | `audio/falas/*.wav` | `medidas.json` |
| `_linha_previa.py --episodio <dir> --saida x.json` | Linha do tempo PROVISÓRIA (as falas mandam, folga 0,35 s, deslocamento acumulado) e derivação de efeitos a partir dos eventos. A CLI tem a etapa oficial; isto serve para testar o som antes dela e exporta `derivar_efeitos()`. | `roteiro.json`, `medidas.json` | arquivo escolhido |
| `sintetizar.py --episodio <dir> [--linha-do-tempo x.json]` | Cria as camadas `ambiente`, `efeitos` e `tensao` (48 kHz, 24 bits). | `linha_do_tempo.json` | `audio/camadas/*.wav`, `camadas.json` |
| `filtros.py` | Filtros de voz `telefone`, `radio`, `alto_falante` (módulo usado pela mixagem; tem CLI para ouvir um arquivo). | WAV | WAV |
| `mixar.py --episodio <dir> --video video_mudo.mp4 --saida epNN.mp4` | Coloca as falas nos tempos medidos, iguala as vozes na faixa da voz (300–3000 Hz, de novo depois do filtro), abaixa o fundo durante a fala, soma o zumbido grave calibrado, garante o piso da voz (fala ≥ fundo + 6 dB na faixa da voz, o critério da prova), limita picos, normaliza para o alvo do canal (−14 LUFS / pico −1 dBTP) e junta com o vídeo. | linha do tempo, falas, camadas, vídeo mudo | `epNN.mp4`, `mix.wav`, `audio/mixagem.json` |
| `medir.py --arquivo epNN.mp4 --linha-do-tempo linha_do_tempo.json` | Formato, duração, LUFS, pico verdadeiro, volume médio e banda de voz com/sem fala. | MP4/WAV | terminal ou `--json` |
| `transcrever.py --arquivo epNN.mp4 --roteiro roteiro.json` | Prova por transcrição de que TODAS as falas estão no vídeo pronto, na ordem. | MP4 | terminal ou `--json` |

Todos aceitam `--json` para a CLI ler. Caminhos de episódio podem ser `episodios/ep01_x` ou só `ep01_x`.

## O que é medido e o que é hipótese

**Medido (número que sai do arquivo):** duração de cada fala, início e fim da voz, RMS e pico, envelope,
LUFS integrado, pico verdadeiro, energia da banda 300–3000 Hz com e sem fala, presença de cada fala na
transcrição.

**Hipótese (regra nossa, ajuste se o ouvido discordar):**
- vozes igualadas em -20 dBFS RMS (sussurro -22, grito -18);
- fundo cai 7 dB (ambiente) e 4 dB (tensão) enquanto alguém fala, ataque 150 ms, soltura 400 ms;
- ambiente em -26 dBFS RMS; "voz se destaca" quando a banda de voz com fala está 6 dB acima do resto;
- drone grave automático nos climas escalada (-30 dBFS) e clímax (-24 dBFS), que some na pergunta;
- nos `silencios` da linha do tempo, ambiente e tensão caem para 5 % (o silêncio é roteiro).

## Como os efeitos nascem da linha do tempo (regras de `derivar_efeitos`)

| Evento ou ação na linha | Efeito |
|---|---|
| `prop.X.estado=tocando` | `campainha` até o estado mudar (máx. 6 s) |
| `prop.X.estado=na_mao` / `parado` depois de tocar | `clique` |
| `prop.porta*.estado=aberta` / `fechada` | `porta_abrir` / `porta_fechar` |
| `prop.onibus.estado=chegando` / `parado` / `portas_abertas` | `motor_onibus` (até o próximo estado) / `freio_onibus` / `porta_abrir` |
| `celular.notificacao=i` | `celular_vibrar` + `notificacao` |
| `prop.painel.estado=alerta` / `alerta_forte` | `clique_triplo` / `lampada_estalo` |
| `prop.luz*.estado=fraca|apagada|normal` / `piscar` | `lampada_estalo` / `lampada_piscar` |
| `prop.lanchonete.estado=acesa` | `lampada_estalo` |
| `personagem.X.andar=marca` | `passos` (duração = distância entre marcas ÷ 1,1 m/s, ritmo lento) |
| ação `trabalhar` | `carimbo` a cada ~2,2 s (máx. 3 por linha) |
| ação `segurar:*`, `pegar_celular`, `guardar_celular` (quando muda) | `clique` baixo |
| campo livre `som` ("campainha", "vibra", "estalo", "passos", "porta", "freio", "motor", "papel"...) | só quando nenhum efeito igual já cobre aquele instante |
| `roteiro.efeitos_extra[]` (`grave_crescente`, `pancada`...) | copiados com o mesmo deslocamento das linhas |

Tipos de efeito disponíveis: `clique`, `clique_triplo`, `passos`, `porta_abrir`, `porta_fechar`, `batida`, `vidro`,
`celular_vibrar`, `notificacao`, `estatica_radio`, `lampada_estalo`, `lampada_piscar`, `grave_crescente`, `pancada`,
`freio_onibus`, `motor_onibus`, `sino`, `campainha`, `papel`, `carimbo`. Ambientes: `saguao_noite`, `rua_noite`,
`chuva`, `vento`, `silencio`. `grave_crescente` e `pancada` vão para a camada de tensão.

## Limites (leia antes de confiar)

- **O computador não ouve.** Ele mede volume e compara texto. Sotaque, interpretação e "ficou natural" são do
  seu ouvido: ouça com fones e no alto-falante do celular (capítulo 64).
- **Transcrição é alerta, não prova.** Uma diferença quer dizer "vá ouvir". E o contrário também: a transcrição
  não percebe sotaque errado.
- **Voz falsa não é publicável.** `origem.json` marca `provedor: "falso"`; a fábrica bloqueia a publicação.
- O Whisper precisa do modelo baixado uma vez com internet:
  `python3 -c "from faster_whisper import WhisperModel; WhisperModel('small')"`. Sem isso, os scripts devolvem
  `conferido_por: "nao_conferido"` e seguem.
- A duração das vozes reais costuma ser maior que a estimativa (palavras ÷ 2,5): por isso a linha do tempo é
  montada depois das medidas, nunca antes.
