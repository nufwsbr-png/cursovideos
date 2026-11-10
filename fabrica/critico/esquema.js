// Esquemas JSON das duas chamadas do crítico visual (structured outputs: todo objeto com additionalProperties false,
// sem mínimo/máximo numérico — os limites são conferidos aqui no código).
export const CRITERIOS = ["gancho", "legibilidade", "clareza_acao", "continuidade", "acabamento", "dilema_final"];

const texto = { type: "string" };
const listaTexto = { type: "array", items: texto };

/** 1ª chamada ("olhar"): descreve o que está na tela SEM o roteiro. */
export const ESQUEMA_OLHAR = {
  type: "object",
  additionalProperties: false,
  properties: {
    quadros: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { id: texto, o_que_se_ve: texto, texto_na_tela: texto, problemas: listaTexto },
        required: ["id", "o_que_se_ve", "texto_na_tela", "problemas"],
      },
    },
    historia_entendida: texto,
    impressao_geral: texto,
  },
  required: ["quadros", "historia_entendida", "impressao_geral"],
};

const NOTA = {
  type: "object",
  additionalProperties: false,
  properties: { nota: { type: "integer" }, evidencia: listaTexto, comentario: texto },
  required: ["nota", "evidencia", "comentario"],
};

export const CAMPOS_PATCH = ["olhar", "acao", "clima", "eventos_adicionar", "eventos_remover", "t", "duracao_s"];

const MUDANCA = {
  type: "object",
  additionalProperties: false,
  properties: {
    alvo: { type: "string", enum: ["linha", "celular"] },
    indice: { type: "integer" },
    campo: { type: "string", enum: CAMPOS_PATCH },
    valor: texto,
    motivo: texto,
  },
  required: ["alvo", "indice", "campo", "valor", "motivo"],
};

/** 2ª chamada ("julgar"): nota de 0 a 10 por critério, com evidência por quadro, os 3 piores defeitos e um patch só de direção. */
export const ESQUEMA_JULGAR = {
  type: "object",
  additionalProperties: false,
  properties: {
    notas: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(CRITERIOS.map((c) => [c, NOTA])),
      required: CRITERIOS,
    },
    defeitos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { quadro: texto, criterio: { type: "string", enum: CRITERIOS }, gravidade: { type: "integer" }, descricao: texto, correcao: texto },
        required: ["quadro", "criterio", "gravidade", "descricao", "correcao"],
      },
    },
    patch: {
      type: "object",
      additionalProperties: false,
      properties: { mudancas: { type: "array", items: MUDANCA } },
      required: ["mudancas"],
    },
    veredito: texto,
  },
  required: ["notas", "defeitos", "patch", "veredito"],
};

// Conferência leve do formato (a API já valida; a resposta escrita à mão na sessão do Claude Code não).
function conferir(obj, esquema, caminho, erros) {
  if (esquema.enum && !esquema.enum.includes(obj)) { erros.push(`${caminho}: "${obj}" fora de ${esquema.enum.join("|")}`); return; }
  const tipo = esquema.type;
  if (tipo === "object") {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) { erros.push(`${caminho}: esperava objeto`); return; }
    for (const k of esquema.required ?? []) if (!(k in obj)) erros.push(`${caminho}.${k}: faltou`);
    for (const k of Object.keys(obj)) {
      if (!esquema.properties?.[k]) { erros.push(`${caminho}.${k}: campo não previsto`); continue; }
      conferir(obj[k], esquema.properties[k], `${caminho}.${k}`, erros);
    }
  } else if (tipo === "array") {
    if (!Array.isArray(obj)) { erros.push(`${caminho}: esperava lista`); return; }
    obj.forEach((x, i) => conferir(x, esquema.items, `${caminho}[${i}]`, erros));
  } else if (tipo === "integer") {
    if (!Number.isInteger(obj)) erros.push(`${caminho}: esperava inteiro`);
  } else if (tipo === "string") {
    if (typeof obj !== "string") erros.push(`${caminho}: esperava texto`);
  }
}

export function conferirResposta(obj, esquema, nome = "resposta") {
  const erros = [];
  conferir(obj, esquema, nome, erros);
  if (esquema === ESQUEMA_JULGAR && obj?.notas) {
    for (const c of CRITERIOS) {
      const n = obj.notas[c]?.nota;
      if (Number.isInteger(n) && (n < 0 || n > 10)) erros.push(`${nome}.notas.${c}.nota: ${n} fora de 0–10`);
      if (Array.isArray(obj.notas[c]?.evidencia) && !obj.notas[c].evidencia.length) erros.push(`${nome}.notas.${c}.evidencia: cite ao menos um quadro`);
    }
    for (const [i, d] of (obj.defeitos ?? []).entries()) if (Number.isInteger(d.gravidade) && (d.gravidade < 1 || d.gravidade > 3)) erros.push(`${nome}.defeitos[${i}].gravidade: ${d.gravidade} fora de 1–3`);
  }
  return erros;
}
