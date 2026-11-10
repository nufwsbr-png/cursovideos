// `node fabrica/cli.js doctor [--rapido] [--json]` — confere o ambiente inteiro antes de produzir.
// Nunca imprime o valor de segredos. Saída: 0 tudo ok · 2 só avisos · 1 alguma falha crítica.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { RAIZ, PASTA_MOTOR, lerCanal } from "./config.js";
import { executar, PYTHON } from "./util/exec.js";
import { acharBinario, garantirFfmpegNoPath } from "./util/binarios.js";
import { carregarEnv } from "./util/ambiente.js";
import { listarEpisodios } from "./util/arquivos.js";

const require = createRequire(import.meta.url);

const CHAVES_POR_PLATAFORMA = {
  tiktok: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REFRESH_TOKEN"],
  instagram: ["META_PAGE_ACCESS_TOKEN", "IG_USER_ID"],
  facebook: ["META_PAGE_ACCESS_TOKEN", "META_PAGE_ID"],
  youtube: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"],
  kwai: [],
};

async function rodar(cmd, args, opcoes = {}) {
  try { return await executar(cmd, args, { capturar: true, ...opcoes }); } catch (e) { return { erro: e, saida: e.saida ?? "", codigo: e.codigo ?? -1 }; }
}

/** Cada checagem devolve {item, estado: "ok"|"aviso"|"falha", detalhe, resolver?}. */
export async function checarAmbiente({ rapido = false } = {}) {
  const r = [];
  const add = (item, estado, detalhe, resolver) => r.push({ item, estado, detalhe, ...(resolver ? { resolver } : {}) });

  // Node e dependências
  const [maior] = process.versions.node.split(".").map(Number);
  add("node", maior >= 20 ? "ok" : "falha", `v${process.versions.node}`, maior >= 20 ? null : "instale Node 20 ou mais novo");
  const faltam = ["playwright", "three", "@anthropic-ai/sdk"].filter((m) => { try { require.resolve(m, { paths: [RAIZ] }); return false; } catch { return true; } });
  add("dependências npm", faltam.length ? "falha" : "ok", faltam.length ? `faltam: ${faltam.join(", ")}` : "node_modules completo", faltam.length ? "npm install (ou npm ci)" : null);

  // Python
  const py = await rodar(PYTHON, ["-I", "-c", "import json,sys\nok={}\nfor m in ['numpy','PIL','faster_whisper']:\n  try:\n    __import__(m); ok[m]=True\n  except Exception: ok[m]=False\nprint(json.dumps({'versao':sys.version.split()[0],'mod':ok}))"]);
  if (py.erro) add("python", "falha", `não consegui rodar "${PYTHON}"`, "instale Python 3.10+ (ou defina PYTHON)");
  else {
    const j = JSON.parse(py.saida.trim().split("\n").pop());
    const [a, b] = j.versao.split(".").map(Number);
    add("python", a === 3 && b >= 10 ? "ok" : "aviso", j.versao);
    for (const [m, ok] of Object.entries(j.mod)) add(`python: ${m}`, ok ? "ok" : m === "faster_whisper" ? "aviso" : "falha", ok ? "instalado" : "falta", ok ? null : "pip install -r requirements.txt");
  }

  // ffmpeg
  const pasta = garantirFfmpegNoPath();
  const ff = acharBinario("ffmpeg"), fp = acharBinario("ffprobe");
  if (!ff || !fp) add("ffmpeg/ffprobe", "falha", "não encontrados", process.platform === "win32" ? "winget install Gyan.FFmpeg (ou defina FFMPEG_DIR)" : "apt-get install ffmpeg");
  else {
    const v = await rodar(ff, ["-hide_banner", "-version"]);
    add("ffmpeg/ffprobe", "ok", `${(v.saida.split("\n")[0] || "").replace(/Copyright.*/, "").trim()}${pasta && !String(process.env.PATH).startsWith(pasta) ? "" : ""}`);
    const fil = await rodar(ff, ["-hide_banner", "-filters"]);
    const enc = await rodar(ff, ["-hide_banner", "-encoders"]);
    const falta = ["loudnorm", "ebur128"].filter((x) => !fil.saida.includes(" " + x + " ")).concat(enc.saida.includes("libx264") ? [] : ["libx264"]);
    add("ffmpeg: filtros", falta.length ? "falha" : "ok", falta.length ? `faltam ${falta.join(", ")}` : "loudnorm, ebur128, libx264");
  }

  // Chromium do Playwright + fontes (autoteste do motor)
  try {
    const { chromium } = require("playwright");
    const exe = process.env.CHROME_PATH || chromium.executablePath();
    add("chromium (playwright)", fs.existsSync(exe) ? "ok" : "falha", fs.existsSync(exe) ? path.basename(path.dirname(exe)) : "não instalado", fs.existsSync(exe) ? null : "npx playwright install chromium");
  } catch (e) { add("chromium (playwright)", "falha", e.message.split("\n")[0], "npm install && npx playwright install chromium"); }
  if (!rapido) {
    const t = await rodar("node", [path.join(PASTA_MOTOR, "renderizar.js"), "--autoteste"]);
    const ini = t.saida.indexOf("{"), fim = t.saida.lastIndexOf("}");
    if (ini < 0) add("fontes (Verdana e emoji)", "aviso", "autoteste do motor não respondeu", "node motor/renderizar.js --autoteste");
    else {
      const j = JSON.parse(t.saida.slice(ini, fim + 1));
      const f = j.fontes ?? {};
      add("fonte Verdana Bold", f.verdana?.ok ? "ok" : "falha", f.verdana ? `frase-teste ${f.verdana.largura_px?.toFixed?.(1) ?? "?"} px (alvo 909 ±2 %)` : "sem medida", f.verdana?.ok ? null : process.platform === "win32" ? "a Verdana vem com o Windows: confira se não foi removida" : "apt-get install ttf-mscorefonts-installer (aceitar a licença) && fc-cache -f");
      add("fonte de emoji", f.emoji?.ok ? "ok" : "falha", f.emoji ? `${f.emoji.pixels_coloridos ?? "?"} pixels coloridos` : "sem medida", f.emoji?.ok ? null : "apt-get install fonts-noto-color-emoji && fc-cache -f");
      if (j.gpu) add("WebGL", "ok", String(j.gpu).slice(0, 90));
    }
  }

  // Whisper (modelo offline)
  const modelo = process.env.WHISPER_MODELO || "small";
  const hf = path.join(process.env.HF_HOME || path.join(os.homedir(), ".cache", "huggingface"), "hub", `models--Systran--faster-whisper-${modelo}`);
  add(`modelo Whisper (${modelo})`, fs.existsSync(hf) ? "ok" : "aviso", fs.existsSync(hf) ? "baixado" : "não baixado: a transcrição fica \"não conferida\"", fs.existsSync(hf) ? null : `python -c "from faster_whisper import WhisperModel; WhisperModel('${modelo}')"`);

  // Credenciais (só ok/falta) e segredos fora do git
  carregarEnv();
  const temEnv = fs.existsSync(path.join(RAIZ, ".env"));
  add(".env", temEnv ? "ok" : "aviso", temEnv ? "existe" : "não existe (copie .env.example)");
  for (const k of ["ANTHROPIC_API_KEY", "GEMINI_API_KEY"]) add(k, process.env[k] ? "ok" : "aviso", process.env[k] ? "definida" : "falta", process.env[k] ? null : "coloque no .env (ver docs/CREDENCIAIS.md)");
  let canal = null;
  try { canal = lerCanal(); } catch (e) { add("canal.json", "falha", e.message.split("\n")[0]); }
  if (canal) {
    for (const [p, chaves] of Object.entries(CHAVES_POR_PLATAFORMA)) {
      if (canal.plataformas?.[p]?.ativo === false) continue;
      const faltam = chaves.filter((k) => !process.env[k]);
      add(`credenciais ${p}`, faltam.length ? "aviso" : "ok", faltam.length ? `faltam ${faltam.join(", ")}` : "completas", faltam.length ? `node fabrica/cli.js conectar ${p === "instagram" || p === "facebook" ? "meta" : p}` : null);
    }
  }
  const rastreado = await rodar("git", ["ls-files", ".env"]);
  if (!rastreado.erro && rastreado.saida.trim()) add(".env no git", "falha", ".env está versionado!", "git rm --cached .env");
  const vaz = await rodar("git", ["grep", "-nIE", "sk-ant-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}", "--", ".", ":!node_modules"]);
  add("chaves em arquivos do git", vaz.saida.trim() ? "falha" : "ok", vaz.saida.trim() ? `${vaz.saida.trim().split("\n").length} ocorrência(s) (não mostradas)` : "nenhuma", vaz.saida.trim() ? "tire a chave do arquivo e troque-a no provedor" : null);

  // canal.json: coerência básica
  if (canal) {
    const ro = canal.roteiro ?? {};
    const prob = [];
    if (ro.falas_min > ro.falas_max) prob.push("falas_min > falas_max");
    if (ro.palavras_por_minuto_min > ro.palavras_por_minuto_max) prob.push("palavras_por_minuto_min > max");
    const ids = [canal.protagonista?.id ?? "eu", ...(canal.elenco ?? []).map((e) => e.id)];
    if (new Set(ids).size !== ids.length) prob.push("ids repetidos no elenco");
    const cores = canal.estilo?.legenda?.cores_por_personagem ?? {};
    const semCor = ids.filter((id) => !cores[id] && !(canal.elenco ?? []).find((e) => e.id === id)?.cor_legenda);
    if (semCor.length) prob.push(`sem cor de legenda: ${semCor.join(", ")}`);
    if (![24, 25, 30, 60].includes(canal.formato?.fps)) prob.push(`fps ${canal.formato?.fps}`);
    add("canal.json", prob.length ? "aviso" : "ok", prob.length ? prob.join("; ") : `fps ${canal.formato?.fps}, ${ids.length} personagens`);
  }

  // git e disco
  const remoto = await rodar("git", ["remote", "get-url", "origin"]);
  add("git remote", remoto.erro ? "aviso" : "ok", remoto.erro ? "sem origin" : "origin configurado");
  try {
    const st = fs.statfsSync(RAIZ);
    const livreGb = (st.bavail * st.bsize) / 1e9;
    add("disco livre", livreGb >= 5 ? "ok" : "aviso", `${livreGb.toFixed(1)} GB`, livreGb >= 5 ? null : "libere espaço (cada episódio usa ~1 GB durante o render)");
  } catch { /* statfs indisponível */ }

  // episódios em andamento
  for (const e of listarEpisodios().filter((x) => !x.publicacao)) {
    const bl = e.estado?.bloqueios ?? [];
    add(`ep${String(e.numero).padStart(2, "0")}`, bl.length ? "aviso" : "ok", `etapa "${e.estado?.etapa ?? "?"}"${bl.length ? ` · bloqueios: ${bl.join("; ")}` : ""}`);
  }
  return r;
}

export async function doctor({ rapido = false, json = false } = {}) {
  const r = await checarAmbiente({ rapido });
  const falhas = r.filter((x) => x.estado === "falha").length, avisos = r.filter((x) => x.estado === "aviso").length;
  if (json) console.log(JSON.stringify({ falhas, avisos, itens: r }, null, 2));
  else {
    const simb = { ok: "✔", aviso: "!", falha: "✖" };
    for (const x of r) console.log(`${simb[x.estado]} ${x.item.padEnd(28)} ${x.detalhe}${x.resolver ? `\n    → ${x.resolver}` : ""}`);
    console.log(`\n${falhas} falha(s), ${avisos} aviso(s).`);
  }
  process.exitCode = falhas ? 1 : avisos ? 2 : 0;
  return { falhas, avisos, itens: r };
}
