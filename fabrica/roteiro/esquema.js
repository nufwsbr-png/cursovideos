// Esquema JSON do roteiro (docs/CONTRATOS.md §2), usado como formato de saída do Claude.
const texto = { type: "string" };
const textoOuNulo = { type: ["string", "null"] };
const numero = { type: "number" };

// O que o público deve sentir em cada linha (regras de emoção, memoria/roteiro_regras.md; a nota confere).
export const EMOCOES = ["riso", "susto", "medo", "raiva", "indignacao", "compaixao", "curiosidade", "calafrio", "alivio", "tensao", "decisao"];

export const ESQUEMA_DIRECAO = {
  type: "object",
  additionalProperties: false,
  properties: {
    olhar: texto,
    acao: texto,
    clima: { type: "string", enum: ["rotina", "sinal", "escalada", "climax", "pergunta"] },
    eventos: { type: "array", items: texto },
  },
  required: ["olhar", "acao", "clima", "eventos"],
};

export const ESQUEMA_LINHA = {
  type: "object",
  additionalProperties: false,
  properties: {
    t: numero,
    ato: { type: "string", enum: ["rotina", "sinal", "negacao", "escalada", "autoridade", "desobediencia", "dilema", "pergunta"] },
    imagem: texto,
    fala: textoOuNulo,
    som: textoOuNulo,
    direcao: ESQUEMA_DIRECAO,
    emocao: { type: ["string", "null"], enum: [null, ...EMOCOES] },
  },
  required: ["t", "ato", "imagem", "fala", "som", "direcao", "emocao"],
};

export const ESQUEMA_FALA = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: texto,
    quem: texto,
    voz: texto,
    texto: texto,
    estilo: texto,
    filtro: { type: ["string", "null"], enum: [null, "telefone", "radio", "alto_falante"] },
    reaproveitar_de: textoOuNulo,
  },
  required: ["id", "quem", "voz", "texto", "estilo", "filtro", "reaproveitar_de"],
};

export const ESQUEMA_ROTEIRO = {
  type: "object",
  additionalProperties: false,
  properties: {
    titulo: texto,
    frase_memoravel: texto,
    ideia: texto,
    cenario: texto,
    lugares: { type: "array", items: texto },
    linhas: { type: "array", items: ESQUEMA_LINHA },
    falas: { type: "array", items: ESQUEMA_FALA },
    celular: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: { de: texto, texto: texto, tipo: { type: "string", enum: ["mensagem", "alerta", "audio", "ligacao"] }, hora: texto, rotulo: textoOuNulo, duracao_s: { type: ["number", "null"] } },
        required: ["de", "texto", "tipo", "hora", "rotulo", "duracao_s"],
      },
    },
    efeitos_extra: {
      type: "array",
      items: { type: "object", additionalProperties: false, properties: { t: numero, tipo: texto, duracao_s: { type: ["number", "null"] }, repeticoes: { type: ["integer", "null"] }, intervalo_s: { type: ["number", "null"] }, ganho_db: { type: ["number", "null"] } }, required: ["t", "tipo", "duracao_s", "repeticoes", "intervalo_s", "ganho_db"] },
    },
    silencios: {
      type: "array",
      items: { type: "object", additionalProperties: false, properties: { inicio_s: numero, fim_s: numero }, required: ["inicio_s", "fim_s"] },
    },
    dilema: {
      type: "object", additionalProperties: false,
      properties: { pergunta: texto, opcao_a: texto, opcao_b: texto, emoji_a: texto, emoji_b: texto, arriscada: { type: "string", enum: ["a", "b"] } },
      required: ["pergunta", "opcao_a", "opcao_b", "emoji_a", "emoji_b", "arriscada"],
    },
    por_que_o_dilema_divide: texto,
    comentario_fixado: texto,
    titulos: { type: "array", items: texto },
    descricao: texto,
    hashtags: { type: "array", items: texto },
    capa: {
      type: "object", additionalProperties: false,
      properties: { frase_gancho: texto, t_quadro: numero, alternativas_t: { type: "array", items: numero } },
      required: ["frase_gancho", "t_quadro", "alternativas_t"],
    },
    checagens: {
      type: "object", additionalProperties: false,
      properties: {
        sinal_ate_7s: { type: "boolean" }, mudanca_a_cada_10s: { type: "boolean" }, dilema_divide: { type: "boolean" },
        ameaca_oculta: { type: "boolean" }, frase_memoravel: { type: "boolean" }, sem_narrador: { type: "boolean" },
        lugares: { type: "integer" }, temas_proibidos: texto,
      },
      required: ["sinal_ate_7s", "mudanca_a_cada_10s", "dilema_divide", "ameaca_oculta", "frase_memoravel", "sem_narrador", "lugares", "temas_proibidos"],
    },
    proximo_episodio: {
      type: "object", additionalProperties: false,
      properties: { se_a: texto, se_b: texto },
      required: ["se_a", "se_b"],
    },
  },
  required: ["titulo", "frase_memoravel", "ideia", "cenario", "lugares", "linhas", "falas", "celular", "efeitos_extra", "silencios", "dilema", "por_que_o_dilema_divide", "comentario_fixado", "titulos", "descricao", "hashtags", "capa", "checagens", "proximo_episodio"],
};

export const ESQUEMA_IDEIAS = {
  type: "object",
  additionalProperties: false,
  properties: {
    ideias: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          titulo: texto, rotina: texto, primeiro_sinal: texto, escalada: texto,
          dilema_a: texto, dilema_b: texto, por_que_divide: texto, tipo_de_virada: texto,
        },
        required: ["titulo", "rotina", "primeiro_sinal", "escalada", "dilema_a", "dilema_b", "por_que_divide", "tipo_de_virada"],
      },
    },
    escolhida: { type: "integer" },
    motivo: texto,
    critica_dura: texto,
  },
  required: ["ideias", "escolhida", "motivo", "critica_dura"],
};

export const ESQUEMA_CRITICA = {
  type: "object",
  additionalProperties: false,
  properties: {
    segundo_em_que_deslizaria: { type: ["number", "null"] },
    problemas: {
      type: "array",
      items: { type: "object", additionalProperties: false, properties: { segundo: numero, problema: texto, correcao: texto }, required: ["segundo", "problema", "correcao"] },
    },
    roteiro_revisado: ESQUEMA_ROTEIRO,
  },
  required: ["segundo_em_que_deslizaria", "problemas", "roteiro_revisado"],
};

export const ESQUEMA_VOTOS = {
  type: "object",
  additionalProperties: false,
  properties: {
    votos_a: { type: "integer" }, votos_b: { type: "integer" }, sem_voto: { type: "integer" },
    teorias: { type: "array", items: texto }, pedidos: { type: "array", items: texto },
    criticas_visual: { type: "array", items: texto }, apelidos: { type: "array", items: texto },
    frases_repetidas: { type: "array", items: texto }, resumo: texto,
  },
  required: ["votos_a", "votos_b", "sem_voto", "teorias", "pedidos", "criticas_visual", "apelidos", "frases_repetidas", "resumo"],
};
