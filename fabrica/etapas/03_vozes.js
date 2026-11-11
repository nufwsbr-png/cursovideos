// Etapa 3 — Vozes: uma fala por arquivo (capítulo 46), Gemini TTS ou voz falsa de teste.
import fs from "node:fs";
import path from "node:path";
import { PASTA_AUDIO, PASTA_EPISODIOS, personagemPorId } from "../config.js";
import { lerJson, gravarJson, listarEpisodios, atualizarEstado, definirBloqueios } from "../util/arquivos.js";
import { executar, PYTHON } from "../util/exec.js";
import { log } from "../util/log.js";
import { hashJson } from "../util/hash.js";
import { gerarFalaGemini, temGemini } from "../ia/gemini_tts.js";

export function estiloCompleto(canal, fala) {
  const p = personagemPorId(canal, fala.quem);
  return [canal.vozes?.prefixo_estilo, p?.voz?.estilo_base, fala.estilo].filter(Boolean).join(", ");
}

/** O que define o conteúdo de uma fala gravada: mudou isto, a fala é refeita (o provedor é tratado à parte). */
export function hashConteudoFala(canal, fala) {
  const p = personagemPorId(canal, fala.quem);
  return hashJson({ texto: fala.texto, estilo: estiloCompleto(canal, fala), voz: fala.voz || p?.voz?.nome || null, filtro: fala.filtro ?? null, reaproveitar_de: fala.reaproveitar_de ?? null });
}

function origemDoEpisodio(dir) {
  return lerJson(path.join(dir, "audio", "falas", "origem.json"), {});
}

function copiarReaproveitada(dir, fala) {
  const [ep, id] = String(fala.reaproveitar_de).split(":");
  const origem = listarEpisodios().find((e) => e.nome.startsWith(ep + "_") || e.nome === ep || `ep${String(e.numero).padStart(2, "0")}` === ep);
  if (!origem) throw new Error(`reaproveitar_de "${fala.reaproveitar_de}": episódio ${ep} não encontrado`);
  const de = path.join(origem.dir, "audio", "falas", `${id}.wav`);
  if (!fs.existsSync(de)) throw new Error(`reaproveitar_de "${fala.reaproveitar_de}": arquivo ${de} não existe`);
  fs.copyFileSync(de, path.join(dir, "audio", "falas", `${fala.id}.wav`));
  return origemDoEpisodio(origem.dir)[id] ?? { provedor: "desconhecido" };
}

/**
 * @param {object} p
 * @param {object} p.canal
 * @param {{dir:string, roteiro:object}} p.ep
 * @param {string} [p.provedor]  "gemini" | "falso" (padrão: gemini se houver chave, senão falso)
 * @param {string[]} [p.so]      só estes ids
 * @param {boolean} [p.forcar]   regera mesmo se já existir
 */
export async function etapaVozes({ canal, ep, provedor, so = null, forcar = false }) {
  log.passo(`Etapa 3 — Vozes do episódio ${ep.ref ?? ep.roteiro.numero}`);
  const dir = ep.dir;
  const pastaFalas = path.join(dir, "audio", "falas");
  fs.mkdirSync(pastaFalas, { recursive: true });
  provedor = provedor || (temGemini() ? canal.vozes?.provedor ?? "gemini" : "falso");
  if (provedor === "gemini" && !temGemini()) {
    log.aviso("Sem GEMINI_API_KEY: usando voz falsa (só para testar a fábrica; bloqueia publicação).");
    provedor = "falso";
  }
  const origem = origemDoEpisodio(dir);
  const falas = ep.roteiro.falas.filter((f) => !so || so.includes(f.id));
  const pendentesFalsas = [];
  let geradas = 0, reaproveitadas = 0, puladas = 0;

  for (const fala of falas) {
    const destino = path.join(pastaFalas, `${fala.id}.wav`);
    const hash = hashConteudoFala(canal, fala);
    const o = origem[fala.id];
    // pula só quando o arquivo existe, o conteúdo (texto, estilo, voz) é o mesmo e o provedor serve
    const mesmaFala = fs.existsSync(destino) && o && o.hash_conteudo === hash;
    if (mesmaFala && !forcar && (o.provedor === provedor || o.provedor === "gemini")) { puladas++; continue; }
    if (fala.reaproveitar_de) {
      const oo = copiarReaproveitada(dir, fala);
      origem[fala.id] = { ...oo, reaproveitada_de: fala.reaproveitar_de, hash_conteudo: hash, gerado_em: new Date().toISOString() };
      reaproveitadas++;
      continue;
    }
    if (provedor === "gemini") {
      const p = personagemPorId(canal, fala.quem);
      const voz = fala.voz || p?.voz?.nome;
      const estilo = estiloCompleto(canal, fala);
      log.info(`${fala.id} · ${fala.quem} · ${voz}: "${fala.texto}"`);
      const { wav, taxa, modelo } = await gerarFalaGemini({ texto: fala.texto, voz, estilo, modelo: canal.vozes?.modelo });
      fs.writeFileSync(destino, wav);
      origem[fala.id] = { provedor: "gemini", modelo, voz, taxa, estilo, texto: fala.texto, hash_conteudo: hash, gerado_em: new Date().toISOString(), tentativas: (origem[fala.id]?.tentativas ?? 0) + 1 };
      geradas++;
    } else {
      pendentesFalsas.push(fala.id);
    }
  }

  if (pendentesFalsas.length) {
    // estas falas precisam ser refeitas (novas ou mudaram): sempre com --forcar
    const args = [path.join(PASTA_AUDIO, "voz_falsa.py"), "--episodio", dir, "--so", pendentesFalsas.join(","), "--forcar"];
    await executar(PYTHON, args);
    const novaOrigem = origemDoEpisodio(dir);
    for (const id of pendentesFalsas) {
      const fala = ep.roteiro.falas.find((f) => f.id === id);
      origem[id] = { ...(novaOrigem[id] ?? { provedor: "falso", gerado_em: new Date().toISOString() }), texto: fala.texto, estilo: estiloCompleto(canal, fala), hash_conteudo: hashConteudoFala(canal, fala) };
    }
    geradas += pendentesFalsas.length;
  }
  // falas que saíram do roteiro: o arquivo vai para _orfas/ (não some, mas não confunde a mixagem)
  const ids = new Set(ep.roteiro.falas.map((f) => f.id));
  for (const n of fs.readdirSync(pastaFalas).filter((n) => /^f\d+\.wav$/.test(n))) {
    const id = n.replace(/\.wav$/, "");
    if (!ids.has(id)) {
      fs.mkdirSync(path.join(pastaFalas, "_orfas"), { recursive: true });
      fs.renameSync(path.join(pastaFalas, n), path.join(pastaFalas, "_orfas", n));
      delete origem[id];
    }
  }
  gravarJson(path.join(pastaFalas, "origem.json"), origem);

  const temFalsa = ep.roteiro.falas.some((f) => origem[f.id]?.provedor === "falso");
  definirBloqueios(dir, "vozes", temFalsa ? ["voz falsa: gere as vozes de verdade antes de publicar"] : []);
  atualizarEstado(dir, { etapa: "vozes" });
  log.ok(`Vozes: ${geradas} geradas, ${reaproveitadas} reaproveitadas, ${puladas} já existiam (provedor ${provedor}).`);
  return { provedor, geradas, reaproveitadas, puladas, temFalsa };
}
