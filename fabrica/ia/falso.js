// IA falsa (--ia falsa ou FABRICA_IA=falsa): respostas fixas e determinísticas para testar a fábrica inteira sem chave
// e sem gasto. Nada que ela "aprova" vale para publicar: o crítico falso grava a fonte "ia_falsa" e a entrega recusa.
import fs from "node:fs";
import path from "node:path";
import { RAIZ } from "../config.js";
import { CRITERIOS } from "../critico/esquema.js";

const ROTEIRO_MODELO = path.join(RAIZ, "fabrica", "testes", "fixtures", "roteiro_ep1_modelo.json");
const ESTADO = { julgamentos: [], indice: 0, chamadas: [] };

/** Para os testes: fila de julgamentos do crítico. Cada item: { notas: número | {criterio: número}, defeitos?, patch? }. */
export function configurarFalsa({ julgamentos = [] } = {}) {
  ESTADO.julgamentos = julgamentos;
  ESTADO.indice = 0;
  ESTADO.chamadas = [];
}
export const chamadasFalsas = () => ESTADO.chamadas;

export function responder({ rotulo, imagens }) {
  ESTADO.chamadas.push({ rotulo, imagens: imagens?.length ?? 0 });
  if (/olhar/.test(rotulo)) return { quadros: [], historia_entendida: "IA falsa: não olha as imagens.", impressao_geral: "IA falsa" };
  if (/julgar/.test(rotulo)) {
    const j = ESTADO.julgamentos[ESTADO.indice++] ?? { notas: 8 };
    const nota = (c) => (typeof j.notas === "number" ? j.notas : j.notas?.[c] ?? 8);
    return {
      notas: Object.fromEntries(CRITERIOS.map((c) => [c, { nota: nota(c), evidencia: ["Q01"], comentario: "IA falsa" }])),
      defeitos: j.defeitos ?? [],
      patch: j.patch ?? { mudancas: [] },
      veredito: "IA falsa",
    };
  }
  if (/votos/.test(rotulo)) return { votos_a: 0, votos_b: 0, sem_voto: 0, teorias: [], pedidos: [], criticas_visual: [], apelidos: [], frases_repetidas: [], resumo: "IA falsa: não contou votos" };
  const modelo = JSON.parse(fs.readFileSync(ROTEIRO_MODELO, "utf8"));
  if (/ideias/.test(rotulo)) {
    return { ideias: [{ titulo: modelo.titulo, rotina: "—", primeiro_sinal: "—", escalada: "—", dilema_a: modelo.dilema.opcao_a, dilema_b: modelo.dilema.opcao_b, por_que_divide: "—", tipo_de_virada: "—" }], escolhida: 0, motivo: "IA falsa", critica_dura: "IA falsa" };
  }
  if (/cr[ií]tico/.test(rotulo)) return { segundo_em_que_deslizaria: null, problemas: [], roteiro_revisado: modelo };
  return modelo; // "episódio" e "correção N"
}
