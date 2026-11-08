// Leitura e gravação de arquivos e pastas de episódio.
import fs from "node:fs";
import path from "node:path";
import { RAIZ, PASTA_EPISODIOS } from "../config.js";

export const existe = (p) => fs.existsSync(p);

export function lerJson(caminho, padrao = undefined) {
  if (!fs.existsSync(caminho)) {
    if (padrao !== undefined) return padrao;
    throw new Error(`Arquivo não encontrado: ${caminho}`);
  }
  return JSON.parse(fs.readFileSync(caminho, "utf8"));
}

export function gravarJson(caminho, dados) {
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, JSON.stringify(dados, null, 2) + "\n", "utf8");
}

export function lerTexto(caminho, padrao = "") {
  return fs.existsSync(caminho) ? fs.readFileSync(caminho, "utf8") : padrao;
}

export function gravarTexto(caminho, texto) {
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.writeFileSync(caminho, texto, "utf8");
}

export function anexarTexto(caminho, texto) {
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  fs.appendFileSync(caminho, texto, "utf8");
}

export function slug(texto) {
  return texto
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

export function nomePastaEpisodio(numero, slugTitulo) {
  return `ep${String(numero).padStart(2, "0")}_${slugTitulo}`;
}

/** Lista as pastas de episódio em ordem numérica, com o roteiro e o estado lidos. */
export function listarEpisodios() {
  if (!fs.existsSync(PASTA_EPISODIOS)) return [];
  return fs.readdirSync(PASTA_EPISODIOS)
    .filter((n) => /^ep\d+_/.test(n) && fs.statSync(path.join(PASTA_EPISODIOS, n)).isDirectory())
    .map((n) => {
      const dir = path.join(PASTA_EPISODIOS, n);
      const roteiro = lerJson(path.join(dir, "roteiro.json"), null);
      const estado = lerJson(path.join(dir, "estado.json"), { etapa: roteiro ? "roteiro" : "vazio", aprovado: false, bloqueios: [] });
      const publicacao = lerJson(path.join(dir, "publicacao.json"), null);
      const numero = roteiro?.numero ?? parseInt(n.slice(2), 10);
      return { nome: n, dir, numero, roteiro, estado, publicacao };
    })
    .sort((a, b) => a.numero - b.numero);
}

/** Resolve "3", "ep03_x", um caminho ou undefined (= último episódio) para a pasta do episódio. */
export function resolverEpisodio(ref) {
  const lista = listarEpisodios();
  if (ref === undefined || ref === null || ref === "" || ref === "ultimo") {
    if (!lista.length) throw new Error("Não há episódios em episodios/.");
    return lista[lista.length - 1];
  }
  if (fs.existsSync(ref) && fs.statSync(ref).isDirectory()) {
    const abs = path.resolve(ref);
    return lista.find((e) => path.resolve(e.dir) === abs) ?? { nome: path.basename(abs), dir: abs, numero: 0, roteiro: lerJson(path.join(abs, "roteiro.json"), null), estado: lerJson(path.join(abs, "estado.json"), { etapa: "?", aprovado: false, bloqueios: [] }), publicacao: null };
  }
  const n = parseInt(String(ref).replace(/^ep/, ""), 10);
  const porNumero = lista.find((e) => e.numero === n);
  if (porNumero) return porNumero;
  const porNome = lista.find((e) => e.nome === ref || e.nome.endsWith(ref));
  if (porNome) return porNome;
  throw new Error(`Episódio não encontrado: ${ref}`);
}

export function proximoNumero() {
  const lista = listarEpisodios();
  return lista.length ? lista[lista.length - 1].numero + 1 : 1;
}

export function atualizarEstado(dir, mudancas) {
  const caminho = path.join(dir, "estado.json");
  const atual = lerJson(caminho, { etapa: "roteiro", aprovado: false, bloqueios: [], avisos: [], historico: [] });
  const novo = { ...atual, ...mudancas };
  if (mudancas.bloqueios) novo.bloqueios = [...new Set(mudancas.bloqueios)];
  novo.atualizado_em = new Date().toISOString();
  novo.historico = [...(atual.historico ?? []), { em: novo.atualizado_em, etapa: novo.etapa }].slice(-50);
  gravarJson(caminho, novo);
  return novo;
}

export function adicionarBloqueio(dir, motivo) {
  const estado = lerJson(path.join(dir, "estado.json"), { etapa: "roteiro", aprovado: false, bloqueios: [] });
  const bloqueios = [...new Set([...(estado.bloqueios ?? []), motivo])];
  return atualizarEstado(dir, { bloqueios });
}

export function removerBloqueio(dir, prefixo) {
  const estado = lerJson(path.join(dir, "estado.json"), { etapa: "roteiro", aprovado: false, bloqueios: [] });
  const bloqueios = (estado.bloqueios ?? []).filter((b) => !b.startsWith(prefixo));
  return atualizarEstado(dir, { bloqueios });
}

export const relativo = (p) => path.relative(RAIZ, p);
