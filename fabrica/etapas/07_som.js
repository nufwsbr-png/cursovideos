// Etapa 7 — Som: sintetizar as camadas do zero e mixar com a voz mandando (capítulo 64).
import fs from "node:fs";
import path from "node:path";
import { PASTA_AUDIO } from "../config.js";
import { atualizarEstado } from "../util/arquivos.js";
import { executar, PYTHON } from "../util/exec.js";
import { log } from "../util/log.js";

export const nomeMp4 = (numero) => `ep${String(numero).padStart(2, "0")}.mp4`;

export async function etapaSom({ canal, ep }) {
  log.passo(`Etapa 7 — Som do episódio ${ep.ref ?? ep.roteiro.numero}`);
  await executar(PYTHON, [path.join(PASTA_AUDIO, "sintetizar.py"), "--episodio", ep.dir]);
  const video = path.join(ep.dir, "video_mudo.mp4");
  const saida = nomeMp4(ep.roteiro.numero);
  const args = [path.join(PASTA_AUDIO, "mixar.py"), "--episodio", ep.dir, "--saida", saida];
  if (fs.existsSync(video)) args.push("--video", "video_mudo.mp4");
  else log.aviso("video_mudo.mp4 não existe: gerando só a mixagem de áudio (mix.wav).");
  await executar(PYTHON, args);
  atualizarEstado(ep.dir, { etapa: "som" });
  log.ok(fs.existsSync(path.join(ep.dir, saida)) ? `${saida} pronto.` : "mix.wav pronta (sem vídeo).");
  return path.join(ep.dir, saida);
}
