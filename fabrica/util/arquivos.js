// Leitura e gravação de arquivos e pastas de episódio.
import fs from "node:fs";
import path from "node:path";
import { RAIZ, PASTA_EPISODIOS, lerCanal, infoSeries } from "../config.js";

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

export function nomePastaEpisodio(numero, slugTitulo, prefixo = "") {
  return `${prefixo ? `${prefixo}-` : ""}ep${String(numero).padStart(2, "0")}_${slugTitulo}`;
}

// Pastas de episódio: "epNN_slug" (série padrão) ou "<prefixo>-epNN_slug" (outra série, ex.: "72h-ep01_...").
const RE_PASTA = /^(?:([a-z0-9]+)-)?ep(\d+)_/i;
function seriesDoCanal() {
  try { return infoSeries(lerCanal()); } catch { return infoSeries(null); }
}

/**
 * Lista as pastas de episódio com roteiro e estado lidos: { nome, dir, numero, serie, ref, roteiro, estado, publicacao }.
 * `ref` é como pedir o episódio na linha de comando ("1" na série padrão, "72h-1" nas outras). Ordem: a das séries no
 * canal, depois o número. `serie` filtra.
 */
export function listarEpisodios({ serie } = {}) {
  if (!fs.existsSync(PASTA_EPISODIOS)) return [];
  const info = seriesDoCanal();
  const ordem = (id) => { const i = info.lista.findIndex((s) => s.id === id); return i < 0 ? info.lista.length : i; };
  return fs.readdirSync(PASTA_EPISODIOS)
    .filter((n) => RE_PASTA.test(n) && fs.statSync(path.join(PASTA_EPISODIOS, n)).isDirectory())
    .map((n) => {
      const [, prefixo = "", num] = RE_PASTA.exec(n);
      const dir = path.join(PASTA_EPISODIOS, n);
      const roteiro = lerJson(path.join(dir, "roteiro.json"), null);
      const estado = lerJson(path.join(dir, "estado.json"), { etapa: roteiro ? "roteiro" : "vazio", aprovado: false, bloqueios: [] });
      const publicacao = lerJson(path.join(dir, "publicacao.json"), null);
      const numero = roteiro?.numero ?? parseInt(num, 10);
      const serie = roteiro?.serie ?? (prefixo ? info.lista.find((s) => s.prefixo_pasta === prefixo.toLowerCase())?.id : null) ?? info.padrao;
      const pref = info.lista.find((s) => s.id === serie)?.prefixo_pasta ?? prefixo.toLowerCase();
      return { nome: n, dir, numero, serie, ref: pref ? `${pref}-${numero}` : String(numero), roteiro, estado, publicacao };
    })
    .filter((e) => !serie || e.serie === serie)
    .sort((a, b) => ordem(a.serie) - ordem(b.serie) || a.numero - b.numero);
}

/**
 * Resolve uma referência: "3" ou "ep03" (série padrão, ou a de `opcoes.serie`), "72h-1" / "72h-ep01" (prefixo da série),
 * "72horas:1" (id da série), "ep03_x" (nome da pasta), um caminho, ou undefined (= último episódio).
 */
export function resolverEpisodio(ref, { serie } = {}) {
  const lista = listarEpisodios();
  const info = seriesDoCanal();
  if (ref === undefined || ref === null || ref === "" || ref === "ultimo") {
    const daSerie = serie ? lista.filter((e) => e.serie === serie) : lista;
    if (!daSerie.length) throw new Error(`Não há episódios em episodios/${serie ? ` da série ${serie}` : ""}.`);
    return daSerie[daSerie.length - 1];
  }
  if (fs.existsSync(String(ref)) && fs.statSync(String(ref)).isDirectory()) {
    const abs = path.resolve(String(ref));
    const roteiro = lerJson(path.join(abs, "roteiro.json"), null);
    return lista.find((e) => path.resolve(e.dir) === abs) ?? { nome: path.basename(abs), dir: abs, numero: roteiro?.numero ?? 0, serie: roteiro?.serie ?? info.padrao, ref: abs, roteiro, estado: lerJson(path.join(abs, "estado.json"), { etapa: "?", aprovado: false, bloqueios: [] }), publicacao: null };
  }
  const s = String(ref);
  let alvo = serie ?? info.padrao, n = null, m;
  const porPrefixo = (p) => info.lista.find((x) => x.prefixo_pasta && x.prefixo_pasta === p.toLowerCase());
  if ((m = /^([a-z0-9]+)-(?:ep)?(\d+)$/i.exec(s)) && porPrefixo(m[1])) { alvo = porPrefixo(m[1]).id; n = Number(m[2]); }
  else if ((m = /^([a-z0-9_]+):(?:ep)?(\d+)$/i.exec(s))) { alvo = m[1]; n = Number(m[2]); }
  else if ((m = /^(?:ep)?(\d+)$/i.exec(s))) n = Number(m[1]);
  if (n !== null) {
    const e = lista.find((x) => x.serie === alvo && x.numero === n);
    if (e) return e;
  }
  const porNome = lista.find((e) => e.nome === s || e.nome.endsWith(s));
  if (porNome) return porNome;
  throw new Error(`Episódio não encontrado: ${ref}${n !== null ? ` (série ${alvo})` : ""}`);
}

/** Próximo número da série (padrão: a série ativa do canal). */
export function proximoNumero(serie) {
  const lista = listarEpisodios({ serie: serie ?? seriesDoCanal().ativa });
  return lista.length ? Math.max(...lista.map((e) => e.numero)) + 1 : 1;
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

/**
 * Cada etapa é dona dos seus bloqueios: `bloqueios_por_etapa[etapa] = lista`, e `bloqueios` vira a união de todas.
 * Assim uma etapa (ex.: a prova) não apaga o bloqueio de outra (ex.: o revisor). Bloqueios antigos sem dono ficam em "legado".
 */
export function definirBloqueios(dir, etapa, lista) {
  const caminho = path.join(dir, "estado.json");
  const estado = lerJson(caminho, { etapa: "roteiro", aprovado: false, bloqueios: [] });
  const porEtapa = { ...(estado.bloqueios_por_etapa ?? {}) };
  if (!estado.bloqueios_por_etapa && (estado.bloqueios ?? []).length) porEtapa.legado = [...estado.bloqueios];
  porEtapa[etapa] = [...new Set(lista)];
  if (porEtapa.legado) {
    // um bloqueio legado some quando outra etapa já tem o mesmo motivo (mesmo começo de frase)
    // ou quando a etapa dona dele acabou de rodar (se ainda vale, ela mesma o pôs na própria lista)
    const prefixo = (b) => b.split(":")[0].trim();
    const atuais = new Set(Object.entries(porEtapa).filter(([k]) => k !== "legado").flatMap(([, v]) => v.map(prefixo)));
    porEtapa.legado = porEtapa.legado.filter((b) => !atuais.has(prefixo(b)) && DONO_LEGADO[prefixo(b)] !== etapa);
    if (!porEtapa.legado.length) delete porEtapa.legado;
  }
  const bloqueios = [...new Set(Object.values(porEtapa).flat())];
  return atualizarEstado(dir, { bloqueios, bloqueios_por_etapa: porEtapa });
}

// qual etapa responde por cada bloqueio antigo (para limpar o "legado" quando a etapa roda de novo)
const DONO_LEGADO = { "voz falsa": "vozes", revisor: "quadros", "duração": "tempo" };

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
