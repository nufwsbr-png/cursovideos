// Executa programas externos (python, ffmpeg, node) mostrando a saída ou capturando.
import { spawn } from "node:child_process";
import { RAIZ } from "../config.js";

export function executar(comando, args = [], { cwd = RAIZ, capturar = false, env = process.env, silencioso = false } = {}) {
  return new Promise((resolver, rejeitar) => {
    const proc = spawn(comando, args, { cwd, env, stdio: capturar ? ["ignore", "pipe", "pipe"] : silencioso ? "ignore" : "inherit", shell: false });
    let saida = "", erro = "";
    if (capturar) {
      proc.stdout.on("data", (d) => (saida += d.toString()));
      proc.stderr.on("data", (d) => (erro += d.toString()));
    }
    proc.on("error", (e) => rejeitar(new Error(`Não consegui executar ${comando}: ${e.message}`)));
    proc.on("close", (codigo) => {
      if (codigo === 0) resolver({ codigo, saida, erro });
      else rejeitar(Object.assign(new Error(`${comando} ${args.join(" ")} terminou com código ${codigo}${erro ? "\n" + erro.slice(-2000) : ""}`), { codigo, saida, erro }));
    });
  });
}

export async function executarJson(comando, args, opcoes = {}) {
  const { saida } = await executar(comando, args, { ...opcoes, capturar: true });
  const inicio = saida.indexOf("{");
  const fim = saida.lastIndexOf("}");
  if (inicio < 0 || fim < 0) throw new Error(`${comando} não devolveu JSON. Saída: ${saida.slice(-500)}`);
  return JSON.parse(saida.slice(inicio, fim + 1));
}

export const PYTHON = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
