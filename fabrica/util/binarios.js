// Acha ffmpeg/ffprobe mesmo quando o PATH do shell é antigo (Windows + WinGet instala sem reabrir o terminal).
// Ordem: PATH → FFMPEG_DIR → pastas do WinGet (Gyan.FFmpeg) → atalhos do WinGet. A pasta achada entra no PATH
// do processo, e os filhos (python, motor) herdam.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const EXT = process.platform === "win32" ? ".exe" : "";

function noPath(nome) {
  for (const d of (process.env.PATH ?? process.env.Path ?? "").split(path.delimiter)) {
    if (d && fs.existsSync(path.join(d, nome + EXT))) return d;
  }
  return null;
}

function pastasCandidatas() {
  const lista = [];
  if (process.env.FFMPEG_DIR) lista.push(process.env.FFMPEG_DIR);
  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
    const pacotes = path.join(local, "Microsoft", "WinGet", "Packages");
    try {
      for (const p of fs.readdirSync(pacotes).filter((n) => /^Gyan\.FFmpeg/i.test(n)).sort()) {
        const base = path.join(pacotes, p);
        for (const sub of fs.readdirSync(base).filter((n) => /^ffmpeg-/i.test(n)).sort().reverse()) lista.push(path.join(base, sub, "bin"));
      }
    } catch { /* sem WinGet */ }
    lista.push(path.join(local, "Microsoft", "WinGet", "Links"));
  }
  return lista;
}

/** Caminho completo do binário (ffmpeg, ffprobe) ou null. */
export function acharBinario(nome) {
  const d = noPath(nome);
  if (d) return path.join(d, nome + EXT);
  for (const c of pastasCandidatas()) if (fs.existsSync(path.join(c, nome + EXT))) return path.join(c, nome + EXT);
  return null;
}

/** Garante ffmpeg e ffprobe no PATH deste processo. Devolve a pasta usada ou null se não achou. */
export function garantirFfmpegNoPath() {
  if (noPath("ffmpeg") && noPath("ffprobe")) return noPath("ffmpeg");
  for (const c of pastasCandidatas()) {
    if (fs.existsSync(path.join(c, "ffmpeg" + EXT)) && fs.existsSync(path.join(c, "ffprobe" + EXT))) {
      process.env.PATH = c + path.delimiter + (process.env.PATH ?? process.env.Path ?? "");
      return c;
    }
  }
  return null;
}
