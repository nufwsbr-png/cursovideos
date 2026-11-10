// Etapa 9b — Entrega: o portão final. Confere tudo de novo e grava entrega.json com `publicavel`, os motivos, cada
// checagem e o hash do MP4, da capa e dos textos. A publicação só aceita uma entrega publicável cujos arquivos ainda
// tenham o mesmo hash (mudou 1 byte do vídeo depois da entrega → recusa).
import fs from "node:fs";
import path from "node:path";
import { lerJson, gravarJson, atualizarEstado } from "../util/arquivos.js";
import { hashArquivo, posix } from "../util/hash.js";
import { log } from "../util/log.js";
import { situacao, PRODUCAO, nomeMp4 } from "./registro.js";
import { problemasGraves } from "./05b_quadros.js";
import { lerCritico, configCritico } from "../critico/critico.js";
import { VERSAO_REGRAS } from "../roteiro/nota.js";

const FONTES_DO_CRITICO_ACEITAS = ["api", "sessao_claude_code"];

function arquivoInfo(dir, nome) {
  const p = path.join(dir, nome);
  if (!fs.existsSync(p)) return { caminho: nome, hash: null, bytes: 0 };
  return { caminho: posix(nome), hash: hashArquivo(p), bytes: fs.statSync(p).size };
}

/** Monta a entrega (sem gravar). */
export function montarEntrega({ canal, ep, opcoes = {} }) {
  const dir = ep.dir;
  const r = ep.roteiro;
  const estado = lerJson(path.join(dir, "estado.json"), {});
  const checagens = {};

  const origem = lerJson(path.join(dir, "audio", "falas", "origem.json"), {});
  const falsas = (r.falas ?? []).filter((f) => origem[f.id]?.provedor === "falso").map((f) => f.id);
  const semAudio = (r.falas ?? []).filter((f) => !origem[f.id] || !fs.existsSync(path.join(dir, "audio", "falas", `${f.id}.wav`))).map((f) => f.id);
  checagens.voz_real = { ok: !falsas.length && !semAudio.length, detalhe: falsas.length ? `${falsas.length} fala(s) com voz falsa` : semAudio.length ? `sem áudio: ${semAudio.join(", ")}` : "todas as falas com voz de verdade" };

  const val = lerJson(path.join(dir, "validacao.json"), null);
  checagens.linter = { ok: val?.aprovado === true && (!val.versao_regras || val.versao_regras === VERSAO_REGRAS), nota: val?.nota ?? null, minimo: val?.nota_minima ?? null, detalhe: !val ? "sem validacao.json" : val.aprovado ? `nota ${val.nota}` : `nota ${val.nota}, ${val.erros?.length ?? 0} erro(s)` };

  const revisao = lerJson(path.join(dir, "revisao.json"), null);
  const graves = problemasGraves(revisao);
  checagens.revisor = { ok: Boolean(revisao) && !graves.length, graves: graves.length, detalhe: !revisao ? "revisor não rodou" : graves.length ? `${graves.length} problema(s) grave(s)` : "sem problemas graves" };

  const cfg = configCritico(canal);
  const critico = lerCritico(dir);
  const fonteCritico = critico?.rodadas?.at(-1)?.fonte ?? critico?.fonte ?? null;
  const criticoOk = !cfg.exigir || (critico?.aprovado === true && FONTES_DO_CRITICO_ACEITAS.includes(fonteCritico));
  checagens.critico = { ok: criticoOk, exigido: cfg.exigir, fonte: fonteCritico, notas: critico?.rodadas?.at(-1)?.notas ?? null, detalhe: !critico ? "crítico visual não rodou" : !critico.aprovado ? `não aprovado: ${critico.motivo}` : !FONTES_DO_CRITICO_ACEITAS.includes(fonteCritico) ? `aprovado por "${fonteCritico}" (IA falsa não vale para publicar)` : `aprovado (${fonteCritico})` };

  const mp4 = nomeMp4(r.numero);
  const prova = lerJson(path.join(dir, "prova.json"), null);
  const hashMp4 = hashArquivo(path.join(dir, mp4));
  const provaDoMesmo = prova?.arquivo_hash ? prova.arquivo_hash === hashMp4 : false;
  checagens.prova = { ok: Boolean(prova) && !(prova.bloqueios ?? []).length && provaDoMesmo, bloqueios: prova?.bloqueios ?? [], detalhe: !prova ? "prova não rodou" : !provaDoMesmo ? "a prova é de outro arquivo (o MP4 mudou depois da prova)" : (prova.bloqueios ?? []).length ? prova.bloqueios.join("; ") : "sem bloqueios" };

  const render = lerJson(path.join(dir, "render.json"), null);
  checagens.fontes = { ok: render?.fontes?.ok === true, detalhe: !render?.fontes ? "fontes não conferidas no render" : render.fontes.ok ? "Verdana Bold e emoji conferidos" : "fonte diferente da referência" };

  const bloqueios = estado.bloqueios ?? [];
  checagens.bloqueios = { ok: !bloqueios.length, lista: bloqueios, detalhe: bloqueios.length ? bloqueios.join("; ") : "nenhum" };

  const exigeDono = Boolean(canal.publicacao?.exigir_aprovacao_humana);
  const aprovado = Boolean(estado.aprovado) || fs.existsSync(path.join(dir, "APROVADO"));
  checagens.aprovacao = { ok: !exigeDono || aprovado, exigida: exigeDono, detalhe: !exigeDono ? "o canal não exige" : aprovado ? "aprovado pelo dono" : "aguardando o dono (crie APROVADO)" };

  const ctx = { canal, ep, dir, roteiro: r, opcoes };
  const velhas = PRODUCAO.filter((e) => e !== "entrega").map((e) => ({ etapa: e, s: situacao(e, ctx) })).filter((x) => !x.s.valida).map((x) => `${x.etapa} (${x.s.motivo})`);
  checagens.versoes = { ok: !velhas.length, invalidas: velhas, detalhe: velhas.length ? `etapas velhas: ${velhas.join("; ")}` : "todas as etapas em dia" };

  const arquivos = { video: arquivoInfo(dir, mp4), capa: arquivoInfo(dir, "capa.png"), textos: arquivoInfo(dir, "textos.json") };
  const faltam = Object.entries(arquivos).filter(([, a]) => !a.hash).map(([k]) => k);
  checagens.arquivos = { ok: !faltam.length, detalhe: faltam.length ? `faltam: ${faltam.join(", ")}` : "vídeo, capa e textos presentes" };

  const motivos = Object.entries(checagens).filter(([, c]) => !c.ok).map(([k, c]) => `${k}: ${c.detalhe}`);
  return { episodio: r.numero, titulo: r.titulo, publicavel: motivos.length === 0, motivos, checagens, arquivos, gerado_em: new Date().toISOString() };
}

export async function etapaEntrega({ canal, ep }) {
  log.passo(`Etapa 9b — Entrega do episódio ${ep.roteiro.numero}`);
  const entrega = montarEntrega({ canal, ep });
  gravarJson(path.join(ep.dir, "entrega.json"), entrega);
  atualizarEstado(ep.dir, { etapa: "entrega", publicavel: entrega.publicavel });
  log.tabela(Object.entries(entrega.checagens).map(([item, c]) => ({ item, ok: c.ok ? "✔" : "✖", detalhe: String(c.detalhe).slice(0, 90) })));
  if (entrega.publicavel) log.ok("Publicável: sim.");
  else log.aviso(`Publicável: não — ${entrega.motivos.length} motivo(s).`);
  return entrega;
}

/**
 * Antes de publicar: a entrega gravada é publicável, os arquivos ainda têm o mesmo hash e a conferência refeita agora
 * continua publicável. → { ok, motivo?, entrega? }
 */
export function conferirEntrega({ canal, ep }) {
  const gravada = lerJson(path.join(ep.dir, "entrega.json"), null);
  if (!gravada) return { ok: false, motivo: "sem entrega.json: rode a etapa entrega (episodio --episodio N)" };
  if (!gravada.publicavel) return { ok: false, motivo: `a entrega não é publicável: ${gravada.motivos.join("; ")}` };
  for (const a of Object.values(gravada.arquivos ?? {})) {
    const atual = hashArquivo(path.join(ep.dir, a.caminho));
    if (atual !== a.hash) return { ok: false, motivo: `${a.caminho} mudou depois da entrega (hash diferente): rode a entrega de novo` };
  }
  const agora = montarEntrega({ canal, ep });
  if (!agora.publicavel) return { ok: false, motivo: `a conferência de agora não é publicável: ${agora.motivos.join("; ")}` };
  return { ok: true, entrega: gravada };
}
