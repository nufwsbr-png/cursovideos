// Etapa 5 — Linha do tempo: as falas medidas mandam; a imagem se ajusta a elas (capítulo 62).
import fs from "node:fs";
import path from "node:path";
import { PASTA_AUDIO } from "../config.js";
import { lerJson, atualizarEstado, definirBloqueios } from "../util/arquivos.js";
import { executar, PYTHON } from "../util/exec.js";
import { log } from "../util/log.js";

function scriptLinhaDoTempo() {
  for (const nome of ["linha_do_tempo.py", "_linha_previa.py"]) {
    const p = path.join(PASTA_AUDIO, nome);
    if (fs.existsSync(p)) return p;
  }
  throw new Error("Não achei audio/linha_do_tempo.py nem audio/_linha_previa.py");
}

export async function etapaTempo({ canal, ep }) {
  log.passo(`Etapa 5 — Linha do tempo do episódio ${ep.roteiro.numero}`);
  const saida = path.join(ep.dir, "linha_do_tempo.json");
  await executar(PYTHON, [scriptLinhaDoTempo(), "--episodio", ep.dir, "--saida", saida]);
  const lt = lerJson(saida);
  const dur = lt.duracao_total_s;
  const { duracao_min_s: min, duracao_max_s: max } = canal.formato;
  definirBloqueios(ep.dir, "tempo", dur < min || dur > max ? [`duração ${dur.toFixed(1)}s fora de ${min}–${max}s: corte ou acrescente falas`] : []);
  atualizarEstado(ep.dir, { etapa: "tempo", duracao_s: dur });
  log.ok(`Duração total ${dur.toFixed(1)} s, ${lt.falas?.length ?? 0} falas, ${lt.efeitos?.length ?? 0} efeitos.`);
  return lt;
}
