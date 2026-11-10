// Números das regras de roteiro: moram em canal.json → roteiro (e formato/estilo). O prompt, o validador e a nota
// leem daqui; nenhum número fica escrito à mão no texto do prompt. Medidos na referência em 2026-11-10
// (memoria/roteiro_regras.md e docs/metodo/estudo_referencia.md).
export function regrasNumericas(canal) {
  const r = canal.roteiro ?? {}, f = canal.formato ?? {};
  return {
    duracao_alvo_s: f.duracao_alvo_s ?? 100, duracao_min_s: f.duracao_min_s ?? 65, duracao_max_s: f.duracao_max_s ?? 130,
    falas_min: r.falas_min ?? 9, falas_max: r.falas_max ?? 34,
    ppm_min: r.palavras_por_minuto_min ?? 60, ppm_max: r.palavras_por_minuto_max ?? 90,
    mediana_max: r.palavras_por_fala_mediana_max ?? 6, fala_max: r.palavras_por_fala_max ?? 9,
    primeira_fala_ate_s: r.primeira_fala_ate_s ?? 1.0, sinal_ate_s: r.sinal_ate_s ?? 7, mudanca_a_cada_s: r.mudanca_a_cada_s ?? 10,
    sem_fala_min_s: r.trecho_sem_fala_min_s ?? 8, sem_fala_max_s: r.trecho_sem_fala_max_s ?? 15,
    final_min_s: r.ultima_fala_antes_pergunta_min_s ?? 1, final_max_s: r.ultima_fala_antes_pergunta_max_s ?? 4,
    pergunta_duracao_s: r.pergunta_duracao_s ?? 4, selo_duracao_s: r.selo_duracao_s ?? 2.5,
    lugares_max: r.lugares_max ?? 4, protagonista_max_pct: r.protagonista_max_pct ?? 30,
    dilema_palavras: r.dilema_opcao_palavras ?? [2, 6], alerta_palavras_max: r.alerta_palavras_max ?? 4,
    mensagem_palavras_max: r.mensagem_palavras_max ?? 10, cartao_duracao_s: r.cartao_duracao_s ?? [2, 8],
    atos_inicio_continuacao: r.atos_inicio_continuacao ?? ["escalada", "autoridade", "desobediencia"],
    nota_minima: r.nota_minima ?? 70, rodadas_correcao_max: r.rodadas_correcao_max ?? 3,
    pps: canal.vozes?.palavras_por_segundo_estimadas ?? 2.5,
  };
}

/** As regras numéricas em português, para o prompt (sempre com os números do canal, nunca fixos no código). */
export function textoRegras(canal, { continuacao = false, numero = null } = {}) {
  const n = regrasNumericas(canal);
  return `REGRAS NUMÉRICAS DO CANAL (medidas no canal de referência; a nota do roteiro confere cada uma):
- Duração final entre ${n.duracao_min_s} e ${n.duracao_max_s} s (alvo ${n.duracao_alvo_s} s), contando o tempo de andar/correr da câmera.
- Entre ${n.falas_min} e ${n.falas_max} falas; ${n.ppm_min} a ${n.ppm_max} palavras por minuto de vídeo; mediana de no máximo ${n.mediana_max} palavras por fala e nenhuma acima de ${n.fala_max} (muitas de 1 a 3 palavras). Voz estimada em ${n.pps} palavras/s.
- A primeira fala começa em até ${n.primeira_fala_ate_s} s, no meio de uma conversa (pergunta ou ordem), sem apresentação.
${continuacao ? `- Episódio seguinte (PARTE ${numero}): começa já no perigo (primeiro ato entre ${n.atos_inicio_continuacao.join(", ")}), com o evento tela.selo=PARTE ${numero} na primeira linha (o selo fica ${n.selo_duracao_s} s na tela); se houver frase de contexto, quem diz é o protagonista e ela já é ação.` : `- Episódio 1: os 8 atos em ordem, primeiro sinal até ${n.sinal_ate_s} s, sem selo de parte.`}
- Um trecho de ${n.sem_fala_min_s} a ${n.sem_fala_max_s} s sem nenhuma fala, cheio de ação na imagem (levantar, andar ou correr por outro lugar, porta, celular). A cada ${n.mudanca_a_cada_s} s algo muda.
- Até ${n.lugares_max} lugares conectados; troca de lugar só andando/correndo pelo caminho ou com transicao:preto (salto de tempo).
- O protagonista fala no máximo ${n.protagonista_max_pct}% das palavras.
- Informação de fora chega pelo celular na mão (acao pegar_celular) + cartão no alto: "mensagem" (até ${n.mensagem_palavras_max} palavras) ou "alerta" com rótulo inventado e ordem curta em caixa alta (até ${n.alerta_palavras_max} palavras); duracao_s de cada cartão entre ${n.cartao_duracao_s[0]} e ${n.cartao_duracao_s[1]} s.
- Fechamento: a última fala termina ${n.final_min_s} a ${n.final_max_s} s antes do cartão final; na linha antes da pergunta a câmera avança devagar (acao avancar:<alvo da decisão>) sem fala; o cartão dura ${n.pergunta_duracao_s} s.
- Dilema: duas opções de ${n.dilema_palavras[0]} a ${n.dilema_palavras[1]} palavras, cada uma com um emoji (emoji_a, emoji_b); "arriscada" diz qual é a opção de agir/arriscar (ela fica no botão vermelho; a outra, ficar/esperar, no azul).
- Virada preferida do episódio 1: "a primeira cena volta com outro sentido" — uma frase banal dos primeiros 5 s volta no fim com outro peso.`;
}
