// Cliente do Claude (Anthropic SDK) para as etapas que escrevem e criticam roteiros.
// Pede sempre JSON com esquema (structured outputs) e usa o fallback do servidor contra recusas.
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../util/ambiente.js";
import { log } from "../util/log.js";

export const MODELO_PADRAO = "claude-opus-5-5";

export function temClaude() {
  return Boolean(env("ANTHROPIC_API_KEY") || env("ANTHROPIC_AUTH_TOKEN"));
}

let cliente = null;
function obterCliente() {
  if (!cliente) cliente = new Anthropic({ maxRetries: 3, timeout: 15 * 60 * 1000 });
  return cliente;
}

function montarParametros({ sistema, usuario, esquema, modelo, esforco, maxTokens, comFallback }) {
  const p = {
    model: modelo || env("CLAUDE_MODELO", MODELO_PADRAO),
    max_tokens: maxTokens,
    system: sistema,
    messages: [{ role: "user", content: usuario }],
    output_config: { effort: esforco },
  };
  if (esquema) p.output_config.format = { type: "json_schema", schema: esquema };
  if (comFallback) {
    p.betas = ["server-side-fallback-2026-07-01"];
    p.fallbacks = "default";
  }
  return p;
}

/**
 * Envia um pedido e devolve o texto final. Com `esquema`, devolve o objeto JSON já validado pela API.
 * Em caso de recusa (stop_reason "refusal") lança erro explicando a categoria.
 */
export async function pedir({ sistema, usuario, esquema = null, modelo, esforco = "high", maxTokens = 32000, rotulo = "pedido" }) {
  if (!temClaude()) throw new Error("ANTHROPIC_API_KEY não definida. Coloque no .env para a fábrica escrever roteiros.");
  const client = obterCliente();
  let comFallback = env("CLAUDE_SEM_FALLBACK") !== "1";
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const params = montarParametros({ sistema, usuario, esquema, modelo, esforco, maxTokens, comFallback });
    try {
      const inicio = Date.now();
      const stream = client.beta.messages.stream(params);
      const msg = await stream.finalMessage();
      const segundos = ((Date.now() - inicio) / 1000).toFixed(0);
      log.info(`Claude (${rotulo}): ${msg.model}, ${msg.usage?.input_tokens ?? "?"} tokens de entrada, ${msg.usage?.output_tokens ?? "?"} de saída, ${segundos}s`);
      if (msg.stop_reason === "refusal") {
        const cat = msg.stop_details?.category ?? "sem categoria";
        throw new Error(`O Claude recusou o pedido "${rotulo}" (categoria: ${cat}). Reveja o tema do episódio: ${msg.stop_details?.explanation ?? ""}`);
      }
      if (msg.stop_reason === "max_tokens") throw new Error(`Resposta do Claude cortada por tamanho em "${rotulo}". Aumente maxTokens.`);
      const texto = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      if (!esquema) return texto;
      try {
        return JSON.parse(texto);
      } catch (e) {
        throw new Error(`O Claude não devolveu JSON válido em "${rotulo}": ${e.message}\n${texto.slice(0, 500)}`);
      }
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
