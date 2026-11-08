// Carrega variáveis do arquivo .env (sem dependências) e oferece acesso seguro a elas.
import fs from "node:fs";
import path from "node:path";
import { RAIZ } from "../config.js";

let carregado = false;

export function carregarEnv() {
  if (carregado) return;
  carregado = true;
  const arquivo = path.join(RAIZ, ".env");
  if (!fs.existsSync(arquivo)) return;
  const texto = fs.readFileSync(arquivo, "utf8");
  for (const linhaBruta of texto.split(/\r?\n/)) {
    const linha = linhaBruta.trim();
    if (!linha || linha.startsWith("#")) continue;
    const i = linha.indexOf("=");
    if (i < 0) continue;
    const nome = linha.slice(0, i).trim();
    let valor = linha.slice(i + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    if (process.env[nome] === undefined) process.env[nome] = valor;
  }
}

export function env(nome, padrao = undefined) {
  carregarEnv();
  const v = process.env[nome];
  return v === undefined || v === "" ? padrao : v;
}

export function temEnv(...nomes) {
  carregarEnv();
  return nomes.every((n) => process.env[n] && process.env[n] !== "");
}
