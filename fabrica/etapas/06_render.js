// Etapa 6 — Render: stills → folha → revisor → vídeo mudo (capítulos 56, 65, 66).
import fs from "node:fs";
import path from "node:path";
import { PASTA_MOTOR, PASTA_MEMORIA } from "../config.js";
import { lerJson, atualizarEstado, adicionarBloqueio, removerBloqueio, anexarTexto } from "../util/arquivos.js";
import { executar } from "../util/exec.js";
import { log } from "../util/log.js";

const RENDERIZAR = path.join(PASTA_MOTOR, "renderizar.js");
const REVISAR = path.join(PASTA_MOTOR, "revisar.js");

function temposImportantes(lt) {
  const ts = new Set();
  for (const l of lt.linhas ?? []) ts.add(Math.round(l.inicio_s * 10) / 10 + 0.3);
  for (const f of lt.falas ?? []) ts.add(Math.round(((f.inicio_s + f.fim_s) / 2) * 10) / 10);
  ts.add(0); ts.add(Math.max(0, lt.duracao_total_s - 1));
  return [...ts].filter((t) => t >= 0 && t < lt.duracao_total_s).sort((a, b) => a - b).map((t) => t.toFixed(1));
}

export async function etapaRender({ canal, ep, escala = 1, semVideo = false, semStills = false, inicio = null, fim = null, rapido = false }) {
  log.passo(`Etapa 6 — Render do episódio ${ep.roteiro.numero} (escala ${escala})`);
  const lt = lerJson(path.join(ep.dir, "linha_do_tempo.json"));
  const comuns = ["--episodio", ep.dir, "--escala", String(escala)];
  const t0 = Date.now();

  if (!semStills) {
    // Limpa stills de rodadas anteriores (podem estar em outra escala e confundir o revisor).
    fs.rmSync(path.join(ep.dir, "stills"), { recursive: true, force: true });
    const tempos = temposImportantes(lt);
    log.info(`stills em ${tempos.length} instantes...`);
    await executar("node", [RENDERIZAR, ...comuns, "--stills", tempos.join(",")]);
    await executar("node", [RENDERIZAR, ...comuns, "--folha"]);
    await executar("node", [REVISAR, "--episodio", ep.dir]);
    const revisao = lerJson(path.join(ep.dir, "revisao.json"), { graves: [], avisos: [] });
    const graves = revisao.graves ?? revisao.problemas_graves ?? [];
    if (graves.length) {
      adicionarBloqueio(ep.dir, `revisor: ${graves.length} problema(s) grave(s) nos quadros (veja revisao.json)`);
      for (const g of graves.slice(0, 10)) log.aviso(typeof g === "string" ? g : JSON.stringify(g));
    } else removerBloqueio(ep.dir, "revisor");
  }

  if (!semVideo) {
    const args = [RENDERIZAR, ...comuns, "--video"];
    if (inicio !== null) args.push("--inicio", String(inicio));
    if (fim !== null) args.push("--fim", String(fim));
    if (rapido) args.push("--formato", "jpg");
    log.info(`gerando o vídeo mudo (pode demorar: ${canal.formato?.fps ?? 60} quadros por segundo de vídeo)...`);
    await executar("node", args);
    const render = lerJson(path.join(ep.dir, "render.json"), {});
    const minutos = ((Date.now() - t0) / 60000).toFixed(1);
    const spq = render.segundos_por_quadro ? Number(render.segundos_por_quadro).toFixed(2) : "?";
    anexarTexto(path.join(PASTA_MEMORIA, "aprendizados.md"), `- [${new Date().toISOString().slice(0, 10)}] [MEDIDO] Render do ep${String(ep.roteiro.numero).padStart(2, "0")}: ${render.quadros ?? "?"} quadros, ${spq} s/quadro, ${minutos} min no total, escala ${escala}, renderer ${render.gpu ?? "?"}.\n`);
    log.ok(`video_mudo.mp4 pronto em ${minutos} min (${spq} s por quadro, ${render.gpu ?? "renderer desconhecido"}).`);
  }
  atualizarEstado(ep.dir, { etapa: "render" });
}
