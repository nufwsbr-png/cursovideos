// Etapa 4 — Conferir as vozes (capítulo 50): duração, volume, início/fim e transcrição (alerta, não prova).
import path from "node:path";
import { PASTA_AUDIO } from "../config.js";
import { lerJson, atualizarEstado } from "../util/arquivos.js";
import { executar, PYTHON } from "../util/exec.js";
import { log } from "../util/log.js";
import { etapaVozes } from "./03_vozes.js";

export async function etapaConferir({ canal, ep, regerar = true }) {
  log.passo(`Etapa 4 — Conferir vozes do episódio ${ep.ref ?? ep.roteiro.numero}`);
  await executar(PYTHON, [path.join(PASTA_AUDIO, "medir_falas.py"), "--episodio", ep.dir]);
  let medidas = lerJson(path.join(ep.dir, "medidas.json"));
  const origem = lerJson(path.join(ep.dir, "audio", "falas", "origem.json"), {});
  const diferentes = Object.entries(medidas).filter(([id, m]) => id.startsWith("f") && m && m.igual === false).map(([id]) => id);
  const regeraveis = diferentes.filter((id) => origem[id]?.provedor === "gemini" && (origem[id]?.tentativas ?? 1) < 2);
  if (regerar && regeraveis.length) {
    log.aviso(`Transcrição diferente em ${regeraveis.join(", ")}; regerando uma vez (capítulo 50: refaz só o que deu errado).`);
    await etapaVozes({ canal, ep, provedor: "gemini", so: regeraveis, forcar: true });
    await executar(PYTHON, [path.join(PASTA_AUDIO, "medir_falas.py"), "--episodio", ep.dir]);
    medidas = lerJson(path.join(ep.dir, "medidas.json"));
  }
  const aindaDiferentes = Object.entries(medidas).filter(([id, m]) => id.startsWith("f") && m && m.igual === false).map(([id]) => id);
  const avisos = [];
  if (aindaDiferentes.length) avisos.push(`transcrição diferente do texto em: ${aindaDiferentes.join(", ")} — vá ouvir (é alerta, não prova)`);
  const conferidoPor = medidas.conferido_por ?? "nao_conferido";
  if (conferidoPor === "nao_conferido") avisos.push("Whisper indisponível: falas não transcritas; conferir de ouvido");
  const longas = Object.entries(medidas).filter(([id, m]) => id.startsWith("f") && m?.duracao_s > 9).map(([id, m]) => `${id} (${m.duracao_s.toFixed(1)}s)`);
  if (longas.length) avisos.push(`falas longas: ${longas.join(", ")}`);
  atualizarEstado(ep.dir, { etapa: "conferido", avisos_vozes: avisos });
  for (const a of avisos) log.aviso(a);
  log.ok(`Medidas gravadas (${conferidoPor}).`);
  return { medidas, avisos };
}
