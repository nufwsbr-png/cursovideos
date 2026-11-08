// Gera uma fala com a API do Gemini (o mesmo motor de voz do Google AI Studio), uma fala por arquivo.
// Documentação: https://ai.google.dev/gemini-api/docs/speech-generation
import { pcm16ParaWav } from "../util/wav.js";
import { env } from "../util/ambiente.js";
import { log } from "../util/log.js";

export function temGemini() {
  return Boolean(env("GEMINI_API_KEY") || env("GOOGLE_API_KEY"));
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {object} p
 * @param {string} p.texto   só o texto da fala, em português
 * @param {string} p.voz     nome da voz pré-definida (Kore, Puck, Gacrux...)
 * @param {string} p.estilo  instrução de estilo completa, em inglês (prefixo de sotaque + quem é + como está + como fala)
 * @param {string} [p.modelo]
 * @returns {Promise<{wav: Buffer, taxa: number, modelo: string}>}
 */
export async function gerarFalaGemini({ texto, voz, estilo, modelo }) {
  const chave = env("GEMINI_API_KEY") || env("GOOGLE_API_KEY");
  if (!chave) throw new Error("GEMINI_API_KEY não definida. Coloque no .env ou use --provedor-voz falso para testar.");
  modelo = modelo || env("GEMINI_TTS_MODELO", "gemini-2.5-flash-preview-tts");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;
  // O AI Studio recebe o estilo num campo separado; na API, o estilo vai no próprio texto, antes da fala.
  const prompt = `${estilo}.\nSay exactly the following line in Brazilian Portuguese, and nothing else:\n${texto}`;
  const corpo = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voz } } },
    },
  };
  let ultimoErro = null;
  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    const resposta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
      body: JSON.stringify(corpo),
    });
    if (resposta.ok) {
      const dados = await resposta.json();
      const parte = dados?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (!parte) {
        const motivo = dados?.candidates?.[0]?.finishReason || dados?.promptFeedback?.blockReason || "sem áudio na resposta";
        throw new Error(`Gemini não devolveu áudio para "${texto}" (${motivo}).`);
      }
      const mime = parte.inlineData.mimeType || "audio/L16;codec=pcm;rate=24000";
      const taxa = parseInt(/rate=(\d+)/.exec(mime)?.[1] ?? "24000", 10);
      const pcm = Buffer.from(parte.inlineData.data, "base64");
      return { wav: pcm16ParaWav(pcm, taxa, 1), taxa, modelo };
    }
    const textoErro = await resposta.text().catch(() => "");
    ultimoErro = new Error(`Gemini respondeu ${resposta.status}: ${textoErro.slice(0, 400)}`);
    if (resposta.status === 429 || resposta.status >= 500) {
      const espera = 15000 * tentativa;
      log.aviso(`Gemini ocupado ou sem cota (${resposta.status}); esperando ${espera / 1000}s (tentativa ${tentativa}/4).`);
      await dormir(espera);
      continue;
    }
    break;
  }
  if (/quota|RESOURCE_EXHAUSTED/i.test(String(ultimoErro?.message))) {
    throw new Error(`A cota do Gemini acabou por hoje. Espere, mude para o plano pago ou divida o trabalho (capítulo 51). Detalhe: ${ultimoErro.message}`);
  }
  throw ultimoErro;
}
