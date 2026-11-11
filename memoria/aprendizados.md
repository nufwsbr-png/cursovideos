# Aprendizados (medido × hipótese)

Formato: `- [DATA] [MEDIDO|HIPÓTESE|REGRA] texto — motivo/fonte`

## Regras fixadas pelo dono
- [2026-11-08] [REGRA] Nunca copiar o canal do livro (Teco Sobrevive) nem o exemplo "Posto 24h": lugar, papel, crise, regra e visual são nossos — combinado da página 9.
- [2026-11-08] [REGRA] Voz falsa bloqueia publicação — só serve para testar a fábrica.
- [2026-11-08] [REGRA] Toda anotação separa medido de hipótese (capítulo 55).
- [2026-11-10] [REGRA] Dono aprovou "deixar o máximo parecido" com a referência: copiar toda a técnica e o acabamento medidos (Verdana Bold, legenda ancorada embaixo, cartões, selo, pergunta com véu e botões, câmera que anda sem corte seco, zumbido grave contínuo, −14 LUFS) e mudar só histórias e roteiros — porque o estudo de 2026-11-09 mostrou que o modelo de edição é a parte que funciona e a identidade continua nossa.
- [2026-11-10] [REGRA] Dono pediu voltar a 30 fps (a referência é 30 fps; 60 fps dobrava o tempo de render sem ganho visível).
- [2026-11-10] [REGRA] Dono escolheu "criar lugares novos já" (mundo com cabine, saguão, corredor de serviço e guarda-volumes, câmera que anda entre eles) e "história nova para o Epi. 01" (o piloto antigo foi arquivado sem publicar) — para o Epi. 01 já ter o trecho de ação sem fala andando por outro lugar que a referência usa.
- [2026-11-10] [REGRA] Dono pediu automação completa "com crítico visual por IA", no modelo de fábrica autônoma que colou: constituição, skills, portões, crítico com rubrica, manifesto publicável e invalidação por versão. Do texto colado usamos só as ideias gerais (a licença dele proíbe usar os arquivos). Implementado em F5/F6 (`docs/ARQUITETURA.md`).

## Medido (números com data)
_(preenchido pela fábrica: tempos de render, LUFS, durações; e pelo dono: números do Studio)_
- [2026-11-09] [MEDIDO] Referência (5 reels, `scripts/medir_referencia.py`): 1080x1920 a 30 fps; 0 cortes secos em 4 de 5 (1 no outro, para o preto final); muda a imagem só com giro, andar, aproximação e tela preta de 0,9–1,7 s; legenda com centro a 67–68 % da altura, contorno ≈ 5 px sem sombra, protagonista em branco; selo PARTE N ≈ 2,5 s; cartão final sobre a cena visível por 3,6–4,1 s com botão vermelho (arriscar) e azul (ficar) em 5 de 5; 51–90 palavras/min; 83–87 % da energia do som entre 20 e 80 Hz (zumbido grave contínuo, nunca silêncio). Detalhes em `estilo_visual.md` e `roteiro_regras.md`.

## Hipóteses para testar
- [2026-11-09] [HIPÓTESE] Seguir o modelo de edição da referência (≈ 70 palavras/min, um trecho de ação sem fala, câmera que anda entre lugares, cartão final com botões) melhora retenção e comentários. Medir no primeiro episódio feito assim contra o Epi. 01.
- [2026-11-09] [HIPÓTESE] Na referência o Epi. 2 fica com ≈ 40 % das views do Epi. 1 (7,4 mi → 3 mi; 4,5 mi → 1,8 mi). Usar como base, e não como alarme, quando lermos os nossos números.
- [2026-11-08] [HIPÓTESE] O primeiro sinal aos 5,6 s com clique no alto-falante + painel prende melhor que um sinal só visual — testar retenção nos primeiros 7 s do Epi. 01 contra o Epi. 02.
- [2026-11-08] [HIPÓTESE] A frase "Uma pra das três, por favor" dita no silêncio (67–70 s) é o pico de comentários — comparar comentários ÷ views com episódios sem silêncio.

## Problemas e soluções
_(a fábrica anexa aqui quando algo falha e é consertado)_
- [2026-11-08] [MEDIDO] Motor em CPU (SwiftShader, 4 núcleos): 0,17 s/quadro em meia escala e 0,71 s/quadro em 1080x1920 → episódio de 100 s ≈ 36 min. Com placa de vídeo (MOTOR_GPU=1) ainda não medido.
- [2026-11-08] [MEDIDO] Piloto com voz falsa: linha do tempo de 111,7 s (as vozes de teste saem 12,7 s mais longas que a estimativa de 2,5 palavras/s); mixagem -16,0 LUFS, pico -1,8 dBTP, voz 9,5 dB acima do fundo.
- [2026-11-08] [REGRA] Decisões do motor tomadas por falta de dado no canal.json (mudar só com pedido): giro de cabeça 0,6 s com ease; FOV base 72°, fecha até 30° em "aproximar"; andar a 1,1 m/s; boca fecha abaixo de 8 % do envelope; legenda some 0,15 s após a fala; cartão de notificação 3,2 s; selo PARTE 2 por 4,5 s; tela da pergunta 0,5 s após o clima "pergunta"; porta na parede do fundo vira abertura.
- [2026-11-08] [REGRA] Regras de som derivadas dos eventos do roteiro (audio/_linha_previa.py): telefone tocando → campainha; porta → rangido; ônibus chegando/parado → motor/freio; notificação → vibração; painel alerta → clique triplo; luz fraca → estalo; andar → passos; trabalhar → carimbo. O campo "som" da linha só vira efeito quando nenhum evento já cobre o instante.
- [2026-11-08] [HIPÓTESE] Pontos fracos vistos nos quadros do piloto: mãos de perto são blocos; o ônibus pela porta é só parede com janelas; Dalva limpando balança pouco. Melhorar no episódio 2, comparando com padrao_aprovado/quadros.
- [2026-11-08] [MEDIDO] Render do ep01: 3352 quadros, 0.61 s/quadro, 36.3 min no total, escala 1, renderer ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver).
- [2026-11-08] [MEDIDO] ep01: 111.7 s, 1080x1920, -16.01 LUFS, pico -1.71 dBTP, 119.2 MB.
- [2026-11-08] [REGRA] Dono reprovou o visual antigo (traço por cor + grão por pixel = "letras confusas e falhas de pixel") e pediu o estilo da referência: olho de peixe, traço grosso limpo, cores chapadas, bonecos de olhos grandes, legendas arredondadas coloridas, 60 fps. Motor refeito (`motor/cena/lente.js`). Técnica igual à referência; identidade (personagens, lugar, história) continua nossa.
- [2026-11-08] [MEDIDO] Visual novo em CPU (SwiftShader, 4 núcleos, 1080x1920): ≈ 0,85 s/quadro só de render; luzes pontuais custavam 2/3 da passada de cor (removidas); FXAA custa 0,25 s (desligado por padrão); G-buffer com filtro linear custa +0,15 s mas suaviza o traço (mantido).
- [2026-11-08] [REGRA] No G-buffer a distância tem de ser calculada por fragmento: interpolada por vértice ela erra em triângulos grandes (piso, paredes) e o traço aparece em volta de qualquer coisa apoiada neles.
- [2026-11-08] [REGRA] Olhos do protagonista a 1,48 m (43 cm acima do balcão) e cabeça com 10° de inclinação natural: é o que faz as mãos aparecerem de cima, grandes, nos cantos de baixo, como na referência.
- [2026-11-08] [MEDIDO] Vídeo a 60 fps em CPU (SwiftShader + FFmpeg x264 faster/2 threads): 1,44 s/quadro no trecho 70–72 s → episódio de 112 s ≈ 2,7 h. Clipe conferido com ffprobe: 1080x1920, 60/1, 120 quadros em 2 s.
- [2026-11-09] [MEDIDO] Render do ep01: 6704 quadros, 1.33 s/quadro, 153.8 min no total, escala 1, renderer ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver).
- [2026-11-09] [MEDIDO] ep01: 111.7 s, 1080x1920, -16.01 LUFS, pico -1.71 dBTP, 105.7 MB.
- [2026-11-09] [REGRA] Dono viu o Epi. 01 novo: "a faxineira fazia movimentos repetitivos em uma cadeira" e "os braços do personagem estavam bugados dentro da mesa". Causas: a marca `dalva_limpando` ficava dentro da fileira de bancos e a pose `limpando` era um balanço parado em loop; a manga do braço era um cilindro só, do punho até um "ombro" na altura do quadril, e mergulhava no tampo. Regras: (1) marca de quem limpa sempre em chão livre e a pose `limpando` desloca devagar em volta da marca, de lado para a câmera, rodo encostado no chão, retomando do mesmo ponto após pausas; (2) o braço POV tem cotovelo logo além da beira do tampo e nada do braço passa abaixo do tampo enquanto está sobre ele (o motor lê a altura e a beira do balcão do `guiche`). Conferido em stills (2, 2.6, 3.2, 3.8, 9.5, 25, 37.5, 56.5, 60, 104 s) antes de re-renderizar.
- [2026-11-09] [MEDIDO] Epi. 01 refeito inteiro com o visual novo a 60 fps (render → som → prova → capa) em 155,3 min nesta máquina (CPU SwiftShader, 4 núcleos): render 153,8 min (6704 quadros, 1,33 s/quadro, estimativa "faltam" do motor bateu com o real), som 54 s, prova 23 s, capas 11 s. Processos em paralelo não aceleram (já testado: 1,48 × 1,44 s/quadro); o caminho rápido é GPU (MOTOR_GPU=1), ainda não medido.
- [2026-11-09] [MEDIDO] Render do ep01: 6704 quadros, 1.37 s/quadro, 156.8 min no total, escala 1, renderer ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver).
- [2026-11-09] [MEDIDO] ep01: 111.7 s, 1080x1920, -16.01 LUFS, pico -1.71 dBTP, 108.6 MB.
- [2026-11-09] [MEDIDO] 2º re-render completo do Epi. 01 (com as correções da Dalva e dos braços): 158 min do render à capa (render 156,8 min a 1,37 s/quadro; som, prova e capas ≈ 1,5 min). Tempo igual ao 1º dentro da margem: o braço em três trechos e a varredura não pesam no render. Correções conferidas em 12 quadros do MP4 final; o dono ainda não viu.
- [2026-11-09] [REGRA] faster-whisper 1.2.1 + av 19 quebra ao abrir arquivo (`open() got an unexpected keyword argument 'metadata_errors'`). Solução: decodificar o áudio com ffmpeg (16 kHz mono f32) e passar o array. E **sem VAD** quando houver trilha por baixo: com VAD ele descartou 18 de 21 falas.
- [2026-11-09] [REGRA] O Instagram exige login para ver os reels. No computador do dono funciona: `node scripts/referencia_navegador.js <perfil>` abre um Chromium visível com perfil próprio em `referencias/.navegador`, o dono entra à mão, o script lista os reels e exporta `referencias/cookies.txt` para o `yt-dlp`. Tudo fica em `referencias/` (no .gitignore). A sessão desta máquina, no app do VS Code, não tem o navegador embutido.
- [2026-11-09] [REGRA] `scdet` só pega corte seco. Em vídeo de plano contínuo, medir mudança visual em janela de 0,5 s e brilho por quadro (giro, aproximação, tela preta). Em cena com céu vermelho o detector de cor do cartão final erra, então conferir na folha.
- [2026-11-10] [MEDIDO] Crítico visual na sessão, Epi. 01: rodada 1 reprovou (clareza_acao 5, acabamento 6) — a revelação da etiqueta não mostrava a etiqueta (a mala estava no chão, longe do armário 7, contra a bíblia; o avanço do corpo punha o braço na frente), o braço cobria a passagem no fim e a tela do celular mostrava "(inventado)". Patch de direção (avancar → aproximar nas linhas 15 e 26) + correções fora do patch (mala dentro do armário 7, nome do app "Recado", emoji de 85 px de tinta, cabeçalho do celular que cabe). Rodada 2 aprovou: 7/8/8/8/7/8. Nenhum desses defeitos o revisor automático pegou.
- [2026-11-10] [REGRA] A revelação de um texto pequeno (etiqueta, nome) pede `aproximar:` (a lente fecha) e o objeto na altura dos olhos; `avancar:` move o corpo e, de pé ou sentado no balcão, põe o braço na frente do alvo. Motivo: rodada 1 do crítico do Epi. 01.
- [2026-11-10] [REGRA] Objeto da bíblia tem de estar onde a bíblia diz (a mala "aparece no armário 7"): o crítico visual reprova quando a encenação contradiz o que a fala afirma.
- [2026-11-10] [REGRA] Nada de texto de bastidor na tela (ex.: "(inventado)" no nome do app): o que é inventado se marca na memória, não no quadro.
- [2026-11-10] [MEDIDO] Orquestrador no Epi. 01: depois do patch do crítico, revalidou o roteiro, pulou vozes e conferência e refez só tempo e quadros (`versoes --explicar` mostra "mudou: canal, roteiro"). Hash de código guardado por execução: as etapas não recalculam o hash do motor a cada pergunta.
- [2026-11-10] [REGRA] No Bash desta máquina, barra invertida dentro de heredoc às vezes some no caminho (um `\\n` virou quebra de linha num script Python). Para editar código com barra invertida, escrever o script com a ferramenta de arquivo, não por heredoc.
- [2026-11-10] [MEDIDO] Render do ep01: 2708 quadros, 3.18 s/quadro, 143.6 min no total, escala 1, renderer ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver).
- [2026-11-10] [MEDIDO] ep01: 90.3 s, 1080x1920, -14.01 LUFS, pico -1.76 dBTP, 78.9 MB (3 provas no dia; esta é a da mixagem final).
- [2026-11-10] [MEDIDO] Epi. 01 final contra a referência, medido com os mesmos scripts (`scripts/medir_referencia.py`, `scripts/medir_balanco.py`, prova, `render.json`):
  - **imagem:** 1080x1920 a 30 fps, 90,3 s; 0 cortes secos (scdet 12); um mergulho no preto de 52,9 a 53,9 s (a referência usa 0,9–1,7 s); 24,1 s de movimento forte (27 %; referência 9–53 %); mudança visual mediana 2,2 (referência 2,9–15,9: sentado, o nosso fica mais parado); balanço andando 2,93 Hz ±8,2 px em 1920 (referência 2,9 Hz, ±3–9 px);
  - **camada 2D:** base da última linha da legenda em 1344 e da de cima em 1286 (passo 58); Verdana Bold com 913 px contra 909 na frase-teste; cartões no tempo do roteiro ±1 quadro (alerta 6,70–10,17 s; mensagens 54,97–58,93 e 58,97–62,43 s, trocando no lugar); pergunta de 86,27 a 90,23 s (4,0 s, entra em 0,17 s);
  - **som:** −14,01 LUFS; pico −1,76 dBTP; LRA 2,1 (referência 5–8); 20–80 Hz com 0,854 da energia (referência 0,83–0,87); picos 45/68/92 Hz; nenhum trecho abaixo de −40 dB; fala − sem fala −0,6 dB (referência −0,5 a +1,1);
  - **fala:** 87 palavras em 90,3 s = 58 palavras/min (referência 51–90; meta do canal 60–90).
- [2026-11-10] [HIPÓTESE] As vozes falsas falam devagar (≈ 1,7 palavra/s; a referência fala a 1,9–2,7): somam 50,9 s, contra 34,4 s estimados. Com as vozes do Gemini, o Epi. 01 deve cair para ≈ 83 s e ≈ 63 palavras/min. Conferir depois das vozes reais.
- [2026-11-10] [MEDIDO] Som antes da correção: 9 das 19 falas ficavam a menos de 6 dB do fundo na faixa da voz (3,1–4,7 dB). Causas, medidas reproduzindo a mixagem fora do repositório:
  - as falas eram igualadas pela faixa inteira, e as vozes graves deixam 2–4 dB fora de 300–3000 Hz;
  - o alto-falante saía 8 dB mais quente, porque o nível não era conferido depois do filtro, e o limitador segurava 5,6–6,7 dB aos 19–21 s;
  - no clímax o zumbido sobe +4 dB e passa do teto, e o limitador abaixa tudo 1,5–2 dB.

  Tentativas descartadas: baixar a crista do zumbido (fases, batimento) ganhou ≤ 0,5 dB; limitar só o leito resolveu a voz, mas derrubou 20–80 Hz para 0,80 e o loudness para −14,9.
- [2026-11-10] [REGRA] A voz é igualada pela faixa da voz (300–3000 Hz, a mesma da prova) e de novo depois do filtro. A mixagem garante o critério que a prova mede (fala ≥ fundo + 6 dB na faixa da voz), subindo a fala que faltar (até +4 dB, até 3 rodadas).
  - Motivo: medir de um jeito e garantir de outro deixava a prova avisando sem a mixagem corrigir. O plano da F3 já pedia esse piso, e ele tinha ficado de fora.
  - Resultado: 19 de 19 falas com margem ≥ 6,2 dB, 20–80 Hz em 0,854, −14,01 LUFS.
- [2026-11-10] [REGRA] No roteiro e na linha do tempo, `null` num campo opcional quer dizer "use o padrão" (o esquema da API exige o campo e manda null). Motivo: um `ganho_db: null` num efeito derrubou o som depois de 143 min de render.
- [2026-11-10] [MEDIDO] Transcrição:
  - faster-whisper 1.2.1 com PyAV 19 falhava (`open() got an unexpected keyword argument 'metadata_errors'`);
  - passando o áudio já decodificado (16 kHz mono), funciona: 63 s de um vídeo da referência em 42 s, 58 palavras;
  - voz falsa não é fala: a prova não transcreve falas com voz falsa (antes, todas sairiam "faltando" e bloqueariam por um motivo falso).
- [2026-11-10] [MEDIDO] Capa em Verdana Bold, a mesma das legendas: o gancho "A PASSAGEM SAIU SOZINHA" coube em 150, 147 e 120 px (diminui sozinho até caber). A alternativa de 52 s caía na tela preta; agora os quadros fogem dos mergulhos (54,6 s).
- [2026-11-10] [MEDIDO] Render por quadro do Epi. 01 novo (CPU SwiftShader, 4 núcleos): média de 3,18 s/quadro no vídeo inteiro (143,6 min, com testes rodando junto em parte do tempo); amostras de 1 s sem carga: sentado no balcão 2,59, corredor 2,19, guarda-volumes 1,83 s/quadro. O piloto antigo, também sentado no balcão, fazia 1,33–1,37. O custo subiu na cena de sempre, não nos lugares novos.
- [2026-11-10] [HIPÓTESE] O que pesa no balcão é o saguão: mais objetos visíveis desde a F2 (correção do pivô, módulos vizinhos) e a camada 2D nova. Medir com o motor (tempo por passada) antes de otimizar; o caminho rápido continua sendo GPU (`MOTOR_GPU=1`), ainda não medido.
- [2026-11-10] [MEDIDO] Rotina diária simulada (`diario --simular --ia falsa`): saída 3 e `BLOQUEADO.md` no 1º dia do bloqueio; saída 0 ("já avisado antes") ao repetir.
  - O aviso mandava o dono "ver o som" por causa da voz falsa repetida na prova.
  - Agora cada bloqueio da prova é uma causa, e causas com a mesma ação aparecem uma vez.
- [2026-11-10] [REGRA] Dono assistiu o Epi. 01 a 30 fps (com vozes falsas) e aprovou: "Ficou bom."
- [2026-11-10] [REGRA] Dono decidiu: o protagonista tem **pele branca** (era morena escura, #7a4a28 → #f2c4a2 em `canal.json → protagonista.maos.pele`). Motivo: escolha do dono para o personagem dele. O Epi. 01 pega a cor nova quando for refeito (com as vozes de verdade, o tempo, os quadros, o crítico e o render já refazem).
- [2026-11-10] [REGRA] Dono pediu outros cenários e uma história que prenda mais a atenção; ideias em discussão (ver `estado_atual.md`).
- [2026-11-10] [REGRA] Dono decidiu: o canal passa a se chamar **ToquinhoVivo**, um perfil só com as séries (as contas nas redes ainda não existem). Aplicar em `canal.json` junto com o suporte a mais de uma série.
- [2026-11-10] [REGRA] Dono escolheu uma série nova sobre "3 dias de apagão" e um "reset no sistema", pedindo uma história que parta das notícias do momento. É ficção numa cidade inventada: sem data real, sem órgão, empresa, militar ou pessoa reais, sem profecia religiosa e sem conspiração política (temas proibidos e regra de desinformação das plataformas).
- [2026-11-10] [MEDIDO] Notícias de 10/11/2026:
  - a Defesa Civil recomendou um kit de 72 h em 6/11 (prevenção, sem alerta);
  - viralizou o boato de "apagão mundial de 3 dias em 17/11", que é falso (no dia 17 há só um teste de alerta nos EUA);
  - o Reino Unido lançou a campanha "Be Ready" (3 dias de estoque) em 22/10;
  - a Fox News divulgou em 25/10 o plano FORTRESS do Pentágono (bases com 90 dias de autonomia), que as redes leram como "estocar 90 dias";
  - há relatos de mães estocando comida e do custo disso para famílias pobres; nenhuma corrida aos mercados foi confirmada.
- [2026-11-10] [HIPÓTESE] O medo que prende não é o apagão: é "quem sabe de algo está estocando, e escolhe quem entra". Dividir ou obedecer rende comentário.
- [2026-11-10] [REGRA] Avisado de que o nome lembra o cantor Toquinho e o padrão de "Teco Sobrevive", o dono manteve **ToquinhoVivo**. Decisão dele, registrada.
- [2026-11-10] [REGRA] Dono pediu que os roteiros despertem emoção e vontade de assistir, estudando as estratégias de atenção: "Eles precisam ter raiva de algum personagem".
- [2026-11-10] [REGRA] Dono aprovou o Epi. 01 de "72 HORAS": portaria do Edifício Aurora; a síndica Celina é a vilã (mente no grupo, esconde água no subsolo, humilha o porteiro, deixa os empregados fora da lista); a primeira frase volta na boca dela. O mapa de emoção está em `docs/metodo/emocoes_e_atencao.md`.
- [2026-11-10] [REGRA] Dono aprovou as estratégias de emoção como regra de **todos** os roteiros, com a nota automática conferindo. Na primeira resposta disse "só o vilão"; pediu para refazer a pergunta e escolheu "virar regra".
- [2026-11-10] [REGRA] Marca do canal: o personagem da marca é **humano** (o protagonista), não um mascote. Eu tinha proposto um "toquinho de árvore vivo" para a foto de perfil e o dono corrigiu: "O personagem é humano, não um toquinho de árvore". Motivo: a marca mostra quem o público é nos vídeos. Custo do erro: ≈ 11,5 créditos do Higgsfield em artes descartadas. Nos episódios o protagonista continua sem rosto (bíblia); se a foto de perfil mostra o rosto dele é decisão do dono (foram feitas as duas opções).
- [2026-11-10] [MEDIDO] S3 (motor do Edifício Aurora: monitores com o relógio, elevador, interfone, apagão, lanterna, elevador entre lugares, sorriso da vilã):
  - 0 pixel diferente em 4 stills do Guichê 3 antes e depois;
  - mundo `edificio_aurora` válido (o elevador conta na ligação);
  - roteiro 72h-1 com nota 100/100;
  - quadros com vozes falsas: 112,2 s, revisor sem problema grave.
- [2026-11-10] [MEDIDO] O revisor comparava todo episódio com `padrao_aprovado/quadros` (quadros do Guichê 3) e acusou "21 % de diferença" no 72h-1: alarme falso de série nova. Agora o padrão é por série (`padrao_aprovado/<série>/quadros`); sem a pasta, não compara.
- [2026-11-10] [MEDIDO] Cinco defeitos vistos nos stills do 72h-1 antes do crítico, corrigidos no motor (depois: 0 pixel diferente em 8 stills do Guichê 3, 6 deles em pé):
  1. a etiqueta das caixas saía cortada ("TOCADO EM MA"), justo a pista "MAIO". Agora o texto encolhe até caber (`texturaTexto({ ajustar: true })`), e a lista da porta faz o mesmo;
  2. o celular na mão mostrava a mensagem do grupo da síndica dentro da conversa da "Mãe". Agora a tela mostra só a conversa de quem mandou a mensagem atual;
  3. um "toco" escuro no canto, quando a câmera virava para a Celina, atrás dele. Com os braços pintados de cores diferentes, deu a manga do braço esquerdo: a cabeça girava 180° e o corpo continuava virado para a porta. Agora, em pé, o corpo acompanha a cabeça quando ela passa de ~35°;
  4. as pernas de quem estava no facho pareciam transparentes: o clarão em `screen` levava o preto do traço a ~45 % de cinza. Agora o clarão é `soft-light`, e o traço fica escuro;
  5. o rádio da portaria era uma caixa preta sem forma, e as falas da síndica pelo rádio não tinham dono na imagem. Agora o tipo `radio_base` tem um visor que mostra "SÍNDICA" ou "ZELADOR" enquanto a pessoa fala, e um led que pisca.
- [2026-11-10] [HIPÓTESE] Voz sem corpo (rádio, telefone, alto-falante) precisa de um objeto que diga quem fala. Sem ele, o crítico desconta clareza, porque só a cor da legenda identifica a pessoa.
- [2026-11-10] [MEDIDO] Crítico visual do 72h-1, rodada 1 (na sessão): gancho 7, legibilidade **6**, clareza 8, continuidade 8, acabamento 8, dilema 8.
  - O que reprovou: texto importante pequeno justo na fala que depende dele. O mostrador do elevador ("▼ S1/S2", duas linhas num painel de 0,34 m a 6 m) nunca se lia, e a água na câmera do S2 eram retângulos miúdos.
  - Causa da direção: o `aproximar` só fecha a lente durante a própria linha. Na linha seguinte, com `parar`, a lente volta a 115° em 1 s.
  - Correção: patch nas linhas 9 e 11 (repetir o `aproximar`). Fora do patch: mostrador de 0,5 m numa linha só e galões grandes, com gargalo e tampa, na câmera do S2. Guichê 3: 0 pixel diferente.
