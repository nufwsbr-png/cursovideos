// Mídia pesada fora do git, entre execuções do GitHub Actions: empacota em .cache/midia/ as saídas que as versões
// cobram (falas .wav, folha, vídeo mudo, MP4 final, mix, capas) dos episódios ainda não publicados por completo, com
// um manifesto de hashes. Ao restaurar, só devolve o arquivo cujo hash bate com o manifesto (e pula o que já está igual).
// Uso: node fabrica/cli.js midia --empacotar | --restaurar
import fs from "node:fs";
import path from "node:path";
import { RAIZ, PASTA_EPISODIOS } from "./config.js";
import { listarEpisodios, lerJson, gravarJson } from "./util/arquivos.js";
import { hashArquivo, posix } from "./util/hash.js";

export const PASTA_MIDIA = path.join(RAIZ, ".cache", "midia");

function itensDe(ep) {
  const n = String(ep.numero).padStart(2, "0");
  const fixos = ["folha.png", "video_mudo.mp4", `ep${n}.mp4`, "mix.wav", "capa_1.png", "capa_2.png", "capa_3.png", "capas_grade.png", "folha_video_pronto.png"];
  const pastaFalas = path.join(ep.dir, "audio", "falas");
  const falas = fs.existsSync(pastaFalas) ? fs.readdirSync(pastaFalas).filter((x) => x.endsWith(".wav")).sort().map((x) => `audio/falas/${x}`) : [];
  return [...fixos, ...falas].filter((rel) => fs.existsSync(path.join(ep.dir, rel)));
}

export function empacotar({ pasta = PASTA_MIDIA, episodios = listarEpisodios() } = {}) {
  fs.rmSync(pasta, { recursive: true, force: true });
  const manifesto = { gerado_em: new Date().toISOString(), episodios: {} };
  for (const ep of episodios.filter((e) => e.estado?.etapa !== "publicado")) {
    const arquivos = {};
    for (const rel of itensDe(ep)) {
      const de = path.join(ep.dir, rel), para = path.join(pasta, ep.nome, rel);
      fs.mkdirSync(path.dirname(para), { recursive: true });
      fs.copyFileSync(de, para);
      arquivos[posix(rel)] = { hash: hashArquivo(de), bytes: fs.statSync(de).size };
    }
    manifesto.episodios[ep.nome] = arquivos;
  }
  fs.mkdirSync(pasta, { recursive: true });
  gravarJson(path.join(pasta, "manifesto.json"), manifesto);
  return manifesto;
}

export function restaurar({ pasta = PASTA_MIDIA, pastaEpisodios = PASTA_EPISODIOS } = {}) {
  const m = lerJson(path.join(pasta, "manifesto.json"), null);
  if (!m) return { restaurados: 0, iguais: 0, recusados: [], motivo: "sem cache de mídia" };
  let restaurados = 0, iguais = 0;
  const recusados = [];
  for (const [nome, arquivos] of Object.entries(m.episodios ?? {})) {
    const dirEp = path.join(pastaEpisodios, nome);
    if (!fs.existsSync(dirEp)) continue; // o episódio saiu (descartado ou renomeado)
    for (const [rel, info] of Object.entries(arquivos)) {
      const de = path.join(pasta, nome, rel), para = path.join(dirEp, rel);
      if (!fs.existsSync(de)) { recusados.push(`${nome}/${rel}: falta no cache`); continue; }
      if (hashArquivo(de) !== info.hash) { recusados.push(`${nome}/${rel}: hash diferente do manifesto`); continue; }
      if (fs.existsSync(para) && hashArquivo(para) === info.hash) { iguais++; continue; }
      fs.mkdirSync(path.dirname(para), { recursive: true });
      fs.copyFileSync(de, para);
      restaurados++;
    }
  }
  return { restaurados, iguais, recusados };
}
