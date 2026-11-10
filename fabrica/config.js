// Caminhos e leitura do canal. Tudo parte da raiz do repositório.
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { canalDaSerie as canalDaSerieRaiz, canalDaPasta as canalDaPastaRaiz, infoSeries } from "../motor/canal_serie.js";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PASTA_EPISODIOS = path.join(RAIZ, "episodios");
export const PASTA_MEMORIA = path.join(RAIZ, "memoria");
export const PASTA_CANAL = path.join(RAIZ, "canal");
export const ARQUIVO_CANAL = path.join(PASTA_CANAL, "canal.json");
export const PASTA_MOTOR = path.join(RAIZ, "motor");
export const PASTA_AUDIO = path.join(RAIZ, "audio");
export const PASTA_PADRAO = path.join(RAIZ, "padrao_aprovado");

// A ordem da produção. "quadros" (stills + revisor), "critico" (crítico visual por IA) e "entrega" (portão final,
// entrega.json publicável) entraram em 2026-11-10. O orquestrador (fabrica/orquestrador.js) roda isto como um make.
export const ETAPAS = ["roteiro", "vozes", "conferir", "tempo", "quadros", "critico", "render", "som", "prova", "capa", "entrega", "publicar", "memoria"];

export function lerCanal() {
  const canal = JSON.parse(fs.readFileSync(ARQUIVO_CANAL, "utf8"));
  canal.formato ??= { largura: 1080, altura: 1920, fps: 30, duracao_alvo_s: 100, duracao_min_s: 65, duracao_max_s: 130 };
  canal.publicacao ??= {};
  canal.plataformas ??= {};
  return canal;
}

export function personagemPorId(canal, id) {
  if (id === canal.protagonista?.id || id === "eu") return { ...canal.protagonista, id: "eu", nome: canal.protagonista?.como_chamam ?? "Eu" };
  return (canal.elenco ?? []).find((p) => p.id === id) ?? null;
}

export function hojeNoFuso(canal) {
  const fuso = canal.publicacao?.fuso || "America/Sao_Paulo";
  return new Intl.DateTimeFormat("sv-SE", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// Séries do canal (desde 2026-11-10): o canal efetivo de um episódio é o canal.json com a série dele por cima
// (motor/canal_serie.js). `canal.serie` = { id, nome, prefixo_pasta, padrao, varias } fica fora do JSON.
export { infoSeries };
export const canalDaSerie = (canal, serieId) => canalDaSerieRaiz(canal, serieId, RAIZ);
export function canalDoEpisodio(canal, ep) {
  const serie = ep?.roteiro?.serie ?? ep?.serie;
  return serie ? canalDaSerieRaiz(canal, serie, RAIZ) : canalDaPastaRaiz(canal, ep?.dir ?? "", RAIZ);
}
