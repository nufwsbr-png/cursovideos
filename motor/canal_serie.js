// Canal efetivo da série de um episódio (desde 2026-11-10 o canal ToquinhoVivo tem mais de uma série).
// canal/canal.json = o canal (nome, formato, estilo, áudio, publicação...) + a série padrão (Guichê 3).
// Cada outra série tem um arquivo (canal/series/<id>.json) que SUBSTITUI as chaves que trouxer (protagonista, elenco,
// cenarios, mundos, frase_do_canal...) e FUNDE "estilo" (só o que mudar, ex.: cores da legenda e climas).
// Usado pela fábrica (fabrica/config.js) e pelos scripts do motor (renderizar, montar_linha, revisar).
import fs from 'node:fs';
import path from 'node:path';

const ehObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function fundir(a, b) {
  if (!ehObj(a) || !ehObj(b)) return b;
  const o = { ...a };
  for (const [k, v] of Object.entries(b)) o[k] = ehObj(v) && ehObj(a[k]) ? fundir(a[k], v) : v;
  return o;
}

/** { padrao, ativa, lista: [{ id, nome, arquivo?, prefixo_pasta? }] } — sem `series` no canal, uma série só. */
export function infoSeries(canal) {
  const s = canal?.series ?? {};
  const padrao = s.padrao ?? 'padrao';
  const lista = Array.isArray(s.lista) && s.lista.length ? s.lista : [{ id: padrao, nome: canal?.nome_exibicao ?? padrao }];
  return { padrao, ativa: s.ativa ?? padrao, lista };
}

/** Base + série: tudo substitui, menos "estilo" (fundido); chaves que começam com "_" são notas para humanos. */
export function mesclarSerie(base, sobre) {
  const out = { ...base };
  for (const [k, v] of Object.entries(sobre ?? {})) {
    if (k.startsWith('_')) continue;
    out[k] = k === 'estilo' ? fundir(base.estilo ?? {}, v) : v;
  }
  return out;
}

/** Série de uma pasta de episódio: `roteiro.serie`; senão o prefixo da pasta ("72h-ep01_..."); senão a padrão. */
export function serieDaPasta(dirEp, canal) {
  const info = infoSeries(canal);
  try {
    const r = JSON.parse(fs.readFileSync(path.join(dirEp, 'roteiro.json'), 'utf8'));
    if (r?.serie) return r.serie;
  } catch { /* sem roteiro: decide pela pasta */ }
  const m = /^([a-z0-9]+)-ep\d+_/i.exec(path.basename(String(dirEp)));
  if (m) {
    const s = info.lista.find((x) => x.prefixo_pasta === m[1].toLowerCase());
    if (s) return s.id;
  }
  return info.padrao;
}

/**
 * O canal efetivo da série. `canal.serie` = { id, nome, prefixo_pasta, padrao, varias } e `canal.__base` ficam FORA do
 * JSON (não enumeráveis): não entram em hash nem vão para a página do motor. A série padrão sem arquivo devolve uma
 * cópia igual ao canal.json (as versões dos episódios dela não mudam).
 */
export function canalDaSerie(canal, serieId, raiz) {
  const info = infoSeries(canal);
  const id = serieId || info.padrao;
  if (canal?.serie?.id === id) return canal;
  const base = canal.__base ?? canal;
  const meta = info.lista.find((x) => x.id === id);
  if (!meta) throw new Error(`série "${id}" não existe em canal.json → series.lista (${info.lista.map((x) => x.id).join(', ')})`);
  const efetivo = meta.arquivo ? mesclarSerie(base, JSON.parse(fs.readFileSync(path.join(raiz, meta.arquivo), 'utf8'))) : { ...base };
  Object.defineProperty(efetivo, 'serie', {
    value: { id, nome: meta.nome ?? base.nome_exibicao, prefixo_pasta: meta.prefixo_pasta ?? '', padrao: id === info.padrao, varias: info.lista.length > 1 },
    enumerable: false,
  });
  Object.defineProperty(efetivo, '__base', { value: base, enumerable: false });
  return efetivo;
}

/** O canal efetivo do episódio de uma pasta. */
export function canalDaPasta(canal, dirEp, raiz) {
  return canalDaSerie(canal, serieDaPasta(dirEp, canal), raiz);
}
