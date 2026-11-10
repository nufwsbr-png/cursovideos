// Cliente do Claude (Anthropic SDK) para as etapas que escrevem roteiros, contam votos e criticam quadros.
// Pede sempre JSON com esquema (structured outputs), usa o fallback do servidor contra recusas,
// manda imagens em base64 (crítico visual) e marca o texto de sistema e as imagens para cache.
// Provedores: "claude" (padrão) ou "falsa" (respostas fixas, sem chave e sem gasto: --ia falsa ou FABRICA_IA=falsa).
// Limite de chamadas por execução: canal.ia.max_chamadas_por_execucao (configurarIA no início do CLI).
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../util/ambiente.js";
import { log } from "../util/log.js";
import { hashJson } from "../util/hash.js";
import { RAIZ } from "../config.js";

export const MODELO_PADRAO = "claude-opus-5-5";
const PASTA_CACHE = path.join(RAIZ, ".cache", "ia");

const CONFIG = { provedor: null, maxChamadas: 25, cache: false, chamadas: 0 };

/** Ajusta o provedor ("claude" | "falsa"), o limite de chamadas e o cache em disco (.cache/ia/). */
export function configurarIA({ provedor, maxChamadas, cache } = {}) {
  if (provedor !== undefined && provedor !== null) CONFIG.provedor = String(provedor);
  if (maxChamadas !== undefined && maxChamadas !== null) CONFIG.maxChamadas = Number(maxChamadas);
  if (cache !== undefined && cache !== null) CONFIG.cache = Boolean(cache);
  return { ...CONFIG };
}
export const chamadasFeitas = () => CONFIG.chamadas;
export function zerarContagem() { CONFIG.chamadas = 0; }

export function provedorIA() {
  return CONFIG.provedor || env("FABRICA_IA") || "claude";
}
export const iaFalsa = () => provedorIA() === "falsa";

/** Há quem responda? (chave do Claude, ou a IA falsa ligada). */
export function temClaude() {
  if (iaFalsa()) return true;
  return Boolean(env("ANTHROPIC_API_KEY") || env("ANTHROPIC_AUTH_TOKEN"));
}

export class ErroOrcamentoIA extends Error {}

let cliente = null;
function obterCliente() {
  if (!cliente) cliente = new Anthropic({ maxRetries: 3, timeout: 15 * 60 * 1000 });
  return cliente;
}

/** Bloco de imagem base64. `caminho` (png/jpg) ou `dados` (Buffer) + `tipo`. */
export function blocoImagem({ caminho, dados, tipo }) {
  const buf = dados ?? fs.readFileSync(caminho);
  const media_type = tipo ?? (/\.png$/i.test(caminho ?? "") ? "image/png" : "image/jpeg");
  return { type: "image", source: { type: "base64", media_type, data: buf.toString("base64") } };
}

/**
 * Conteúdo do pedido: imagens primeiro (cada uma com seu rótulo), o texto que muda por último.
 * O último bloco de imagem leva cache_control: duas chamadas seguidas com as mesmas imagens
 * (o "olhar" e o "julgar" do crítico) reaproveitam o prefixo.
 */
export function montarConteudo(usuario, imagens = []) {
  if (!imagens?.length) return usuario;
  const blocos = [];
  for (const img of imagens) {
    if (img.rotulo) blocos.push({ type: "text", text: img.rotulo });
    blocos.push(blocoImagem(img));
  }
  blocos[blocos.length - 1].cache_control = { type: "ephemeral" };
  blocos.push({ type: "text", text: usuario });
  return blocos;
}

export function montarParametros({ sistema, usuario, imagens = [], esquema, modelo, esforco = "high", maxTokens = 32000, comFallback = true }) {
  const p = {
    model: modelo || env("CLAUDE_MODELO", MODELO_PADRAO),
    max_tokens: maxTokens,
    // o texto de sistema é estável entre chamadas da mesma etapa: vira prefixo em cache
    system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: montarConteudo(usuario, imagens) }],
    output_config: { effort: esforco },
  };
  if (esquema) p.output_config.format = { type: "json_schema", schema: esquema };
  if (comFallback) {
    p.betas = ["server-side-fallback-2026-07-01"];
    p.fallbacks = "default";
  }
  return p;
}

// chave do cache em disco: o pedido inteiro, com cada imagem trocada pelo hash dos seus bytes
function chaveCache(params) {
  const semImagens = JSON.parse(JSON.stringify(params, (k, v) => (k === "data" && typeof v === "string" && v.length > 200 ? hashJson(v) : v)));
  delete semImagens.betas; delete semImagens.fallbacks;
  return hashJson(semImagens).replace("sha256:", "");
}

function lerCache(chave) {
  const p = path.join(PASTA_CACHE, chave + ".json");
  if (!fs.existsSync(p)) return undefined;
  try { return JSON.parse(fs.readFileSync(p, "utf8")).resultado; } catch { return undefined; }
}

function gravarCache(chave, rotulo, resultado) {
  fs.mkdirSync(PASTA_CACHE, { recursive: true });
  fs.writeFileSync(path.join(PASTA_CACHE, chave + ".json"), JSON.stringify({ rotulo, gravado_em: new Date().toISOString(), resultado }, null, 1));
}

function contarChamada(rotulo) {
  if (CONFIG.chamadas >= CONFIG.maxChamadas) {
    throw new ErroOrcamentoIA(`limite de ${CONFIG.maxChamadas} chamadas à IA nesta execução atingido em "${rotulo}" (canal.ia.max_chamadas_por_execucao)`);
  }
  CONFIG.chamadas++;
}

/**
 * Envia um pedido e devolve o texto final. Com `esquema`, devolve o objeto JSON já validado pela API.
 * `imagens`: [{ caminho | dados, tipo?, rotulo? }]. Em caso de recusa (stop_reason "refusal") lança erro com a categoria.
 */
export async function pedir({ sistema, usuario, imagens = [], esquema = null, modelo, esforco = "high", maxTokens = 32000, rotulo = "pedido" }) {
  if (iaFalsa()) {
    contarChamada(rotulo);
    const { responder } = await import("./falso.js");
    return responder({ rotulo, sistema, usuario, imagens, esquema });
  }
  if (!temClaude()) throw new Error("ANTHROPIC_API_KEY não definida. Coloque no .env (ou nos segredos do GitHub) para a fábrica usar o Claude.");
  const usarCache = CONFIG.cache || env("FABRICA_IA_CACHE") === "1";
  let comFallback = env("CLAUDE_SEM_FALLBACK") !== "1";
  const chave = usarCache ? chaveCache(montarParametros({ sistema, usuario, imagens, esquema, modelo, esforco, maxTokens, comFallback: false })) : null;
  if (chave) {
    const guardado = lerCache(chave);
    if (guardado !== undefined) { log.info(`Claude (${rotulo}): resposta do cache .cache/ia/${chave.slice(0, 12)}…`); return guardado; }
  }
  contarChamada(rotulo);
  const client = obterCliente();
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const params = montarParametros({ sistema, usuario, imagens, esquema, modelo, esforco, maxTokens, comFallback });
    try {
      const inicio = Date.now();
      const stream = client.beta.messages.stream(params);
      const msg = await stream.finalMessage();
      const segundos = ((Date.now() - inicio) / 1000).toFixed(0);
      const u = msg.usage ?? {};
      log.info(`Claude (${rotulo}): ${msg.model}, ${u.input_tokens ?? "?"} tokens de entrada (+${u.cache_read_input_tokens ?? 0} do cache), ${u.output_tokens ?? "?"} de saída, ${segundos}s`);
      if (msg.stop_reason === "refusal") {
        const cat = msg.stop_details?.category ?? "sem categoria";
        throw new Error(`O Claude recusou o pedido "${rotulo}" (categoria: ${cat}). Reveja o tema do episódio: ${msg.stop_details?.explanation ?? ""}`);
      }
      if (msg.stop_reason === "max_tokens") throw new Error(`Resposta do Claude cortada por tamanho em "${rotulo}". Aumente maxTokens.`);
      const texto = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      let resultado = texto;
      if (esquema) {
        try { resultado = JSON.parse(texto); } catch (e) { throw new Error(`O Claude não devolveu JSON válido em "${rotulo}": ${e.message}\n${texto.slice(0, 500)}`); }
      }
      if (chave) gravarCache(chave, rotulo, resultado);
      return resultado;
    } catch (e) {
      const msgErro = String(e?.message ?? e);
      if (comFallback && tentativa === 1 && (e?.status === 400 || /fallback/i.test(msgErro))) {
        log.aviso("A API não aceitou o parâmetro de fallback; repetindo sem ele.");
        comFallback = false;
        continue;
      }
      throw e;
    }
  }
}
