// Etapa 6 — Render do vídeo mudo (capítulo 66). Só roda depois do revisor (5b) e do crítico visual aprovado (5c):
// quem decide é o orquestrador. Os stills e a folha saíram para a etapa 5b (quadros).
import path from "node:path";
import { PASTA_MOTOR, PASTA_MEMORIA } from "../config.js";
import { lerJson, atualizarEstado, anexarTexto } from "../util/arquivos.js";
import { executar } from "../util/exec.js";
import { log } from "../util/log.js";
import { etapaQuadros, problemasGraves } from "./05b_quadros.js";

export { problemasGraves };

const RENDERIZAR = path.join(PASTA_MOTOR, "renderizar.js");

export async function etapaRender({ canal, ep, escala = 1, semVideo = false, semStills = true, inicio = null, fim = null, rapido = false }) {
  // compatibilidade: render com stills = quadros + vídeo (o CLI antigo fazia tudo junto)
  if (!semStills) await etapaQuadros({ canal, ep, escala });
  if (semVideo) return;
  log.passo(`Etapa 6 — Render do episódio ${ep.ref ?? ep.roteiro.numero} (escala ${escala})`);
  const t0 = Date.now();
  const args = [RENDERIZAR, "--episodio", ep.dir, "--escala", String(escala), "--video"];
  if (inicio !== null) args.push("--inicio", String(inicio));
  if (fim !== null) args.push("--fim", String(fim));
  if (rapido) args.push("--formato", "jpg");
  log.info(`gerando o vídeo mudo (pode demorar: ${canal.formato?.fps ?? 30} quadros por segundo de vídeo)...`);
  await executar("node", args);
  const render = lerJson(path.join(ep.dir, "render.json"), {});
  const minutos = ((Date.now() - t0) / 60000).toFixed(1);
  const spq = render.segundos_por_quadro ? Number(render.segundos_por_quadro).toFixed(2) : "?";
  anexarTexto(path.join(PASTA_MEMORIA, "aprendizados.md"), `- [${new Date().toISOString().slice(0, 10)}] [MEDIDO] Render do ep${String(ep.roteiro.numero).padStart(2, "0")}: ${render.quadros ?? "?"} quadros, ${spq} s/quadro, ${minutos} min no total, escala ${escala}, renderer ${render.gpu ?? "?"}.\n`);
  log.ok(`video_mudo.mp4 pronto em ${minutos} min (${spq} s por quadro, ${render.gpu ?? "renderer desconhecido"}).`);
  atualizarEstado(ep.dir, { etapa: "render" });
}
