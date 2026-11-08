// Orquestra a publicação de um episódio nas plataformas ativas e a leitura de métricas/comentários.
// Uso como módulo: publicarTudo, lerMetricasTudo, lerComentariosTudo, ADAPTADORES.
// Uso direto:
//   node fabrica/publicar/index.js --episodio episodios/ep01_x [--simular] [--plataformas tiktok,youtube] [--forcar]
//   node fabrica/publicar/index.js --metricas --episodio episodios/ep01_x [--simular]
//   node fabrica/publicar/index.js --comentarios --episodio episodios/ep01_x [--simular]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as tiktok from './tiktok.js';
import * as instagram from './instagram.js';
import * as facebook from './facebook.js';
import * as youtube from './youtube.js';
import * as kwai from './kwai.js';
import { criarRegistro } from './_http.js';
import { lerJson, escreverJson, existe, acharVideoFinal, carregarEnv, raizRepo, hojeISO, agoraISO, ErroPublicacao } from './_util.js';

export const ADAPTADORES = { tiktok, instagram, facebook, youtube, kwai };
export const ORDEM_PADRAO = ['tiktok', 'instagram', 'facebook', 'youtube', 'kwai'];

export function plataformasAtivas(canal, filtro) {
  const ativas = ORDEM_PADRAO.filter((p) => canal?.plataformas?.[p]?.ativo !== false);
  if (!filtro || !filtro.length) return ativas;
  return filtro.map((p) => p.trim().toLowerCase()).filter((p) => ADAPTADORES[p]);
}

/** Mescla um resultado novo em publicacao.json: só substitui a plataforma se ela ainda não tinha sucesso. */
export function mesclarPublicacao(anterior, resultados, { publicado_em = agoraISO() } = {}) {
  const base = anterior && typeof anterior === 'object' ? structuredClone(anterior) : {};
  base.plataformas = base.plataformas || {};
  base.pendencias_manuais = Array.isArray(base.pendencias_manuais) ? base.pendencias_manuais : [];
  for (const r of resultados) {
    const antigo = base.plataformas[r.plataforma];
    if (antigo?.ok && !r.ok) {
      // nunca apaga um sucesso anterior com uma falha nova
      base.plataformas[r.plataforma] = { ...antigo, ultima_tentativa: { em: publicado_em, erro: r.erro } };
      continue;
    }
    base.plataformas[r.plataforma] = { ok: !!r.ok, id: r.id ?? null, url: r.url ?? null, erro: r.erro ?? null, em: publicado_em, detalhes: r.detalhes || {} };
    for (const p of r.detalhes?.pendencias_manuais || []) if (!base.pendencias_manuais.includes(p)) base.pendencias_manuais.push(p);
  }
  if (!base.publicado_em && resultados.some((r) => r.ok)) base.publicado_em = publicado_em;
  base.atualizado_em = publicado_em;
  return base;
}

function carregarEpisodio(dirEpisodio) {
  const dir = path.resolve(dirEpisodio);
  if (!existe(dir)) throw new ErroPublicacao(`pasta do episódio não existe: ${dir}`);
  const roteiro = lerJson(path.join(dir, 'roteiro.json'), {});
  const textos = lerJson(path.join(dir, 'textos.json'), null) || {
    titulo: roteiro.titulos?.[0] || roteiro.titulo, descricao: roteiro.descricao, hashtags: roteiro.hashtags, comentario_fixado: roteiro.comentario_fixado, por_plataforma: {},
  };
  const estado = lerJson(path.join(dir, 'estado.json'), { etapa: 'desconhecida', aprovado: false, bloqueios: [] });
  const capa = ['capa.png', 'capa_1.png'].map((n) => path.join(dir, n)).find(existe) || null;
  const arquivo = acharVideoFinal(dir, roteiro);
  return { dir, roteiro, textos, estado, capa, arquivo };
}

/**
 * publicarTudo({ dirEpisodio, canal, env, simular, plataformas, forcar, registro })
 * → { ok, resultados, publicacao, registro, pendencias_manuais }
 */
export async function publicarTudo({ dirEpisodio, canal, env = process.env, simular = false, plataformas, forcar = false, registro = criarRegistro(), log = console.log }) {
  const ep = carregarEpisodio(dirEpisodio);
  const bloqueios = Array.isArray(ep.estado.bloqueios) ? ep.estado.bloqueios : [];
  if (bloqueios.length && !forcar) {
    throw new ErroPublicacao(`episódio com bloqueios (${bloqueios.join('; ')}); resolva ou use --forcar`, { bloqueios });
  }
  if (canal?.publicacao?.exigir_aprovacao_humana && !ep.estado.aprovado && !forcar) {
    throw new ErroPublicacao('o canal exige aprovação humana e estado.json não tem "aprovado": true', { estado: ep.estado });
  }
  if (!ep.arquivo) throw new ErroPublicacao(`nenhum MP4 final encontrado em ${ep.dir} (esperado ep${String(ep.roteiro.numero || 0).padStart(2, '0')}.mp4)`);

  const caminhoPublicacao = path.join(ep.dir, 'publicacao.json');
  const anterior = lerJson(caminhoPublicacao, {});
  const alvo = plataformasAtivas(canal, plataformas).filter((p) => forcar || !anterior?.plataformas?.[p]?.ok);
  const puladas = plataformasAtivas(canal, plataformas).filter((p) => !alvo.includes(p));
  if (puladas.length) log(`já publicado antes, pulando: ${puladas.join(', ')}`);

  const resultados = [];
  for (const nome of alvo) {
    log(`→ ${nome}${simular ? ' (simulação)' : ''}`);
    const adaptador = ADAPTADORES[nome];
    let r;
    try {
      r = await adaptador.publicar({ arquivo: ep.arquivo, capa: ep.capa, textos: ep.textos, canal, env, simular, registro, roteiro: ep.roteiro });
    } catch (e) {
      r = { plataforma: nome, ok: false, id: null, url: null, erro: e.message, detalhes: e.detalhes || {} };
    }
    resultados.push(r);
    log(r.ok ? `  ✔ ${nome}: ${r.url || r.id}` : `  ✘ ${nome}: ${r.erro}`);
    for (const aviso of r.detalhes?.avisos || []) log(`    aviso: ${aviso}`);
  }
  const publicacao = mesclarPublicacao(anterior, resultados);
  if (!simular) escreverJson(caminhoPublicacao, publicacao);
  else escreverJson(path.join(ep.dir, 'publicacao.simulada.json'), { ...publicacao, simulado: true, requisicoes: registro.itens });
  const ok = resultados.length > 0 && resultados.every((r) => r.ok);
  return { ok, resultados, publicacao, registro, pendencias_manuais: publicacao.pendencias_manuais, arquivo: ep.arquivo };
}

function caminhoMetricas(dir, data = hojeISO()) {
  return path.join(dir, 'metricas', `${data}.json`);
}

/** Lê métricas de todas as plataformas publicadas e grava metricas/<data>.json. */
export async function lerMetricasTudo({ dirEpisodio, canal, env = process.env, simular = false, registro = criarRegistro(), data = hojeISO() }) {
  const ep = carregarEpisodio(dirEpisodio);
  const publicacao = lerJson(path.join(ep.dir, 'publicacao.json'), simular ? lerJson(path.join(ep.dir, 'publicacao.simulada.json'), {}) : {});
  const arquivo = caminhoMetricas(ep.dir, data);
  const saida = lerJson(arquivo, { lido_em: null, plataformas: {}, comentarios: {} });
  for (const [nome, info] of Object.entries(publicacao.plataformas || {})) {
    if (!info?.ok || !ADAPTADORES[nome]) continue;
    try {
      const id = info.detalhes?.post_id || info.id;
      saida.plataformas[nome] = { id, ...(await ADAPTADORES[nome].lerMetricas({ id, canal, env, simular, registro })) };
    } catch (e) {
      saida.plataformas[nome] = { id: info.id, erro: e.message };
    }
  }
  saida.lido_em = agoraISO();
  saida.episodio = ep.roteiro.numero ?? null;
  saida.publicado_em = publicacao.publicado_em || null;
  escreverJson(arquivo, saida);
  return { arquivo, metricas: saida.plataformas, registro };
}

/** Lê comentários (texto, curtidas, data — nunca nome de usuário) e grava no mesmo metricas/<data>.json. */
export async function lerComentariosTudo({ dirEpisodio, canal, env = process.env, simular = false, registro = criarRegistro(), limite = 200, data = hojeISO() }) {
  const ep = carregarEpisodio(dirEpisodio);
  const publicacao = lerJson(path.join(ep.dir, 'publicacao.json'), simular ? lerJson(path.join(ep.dir, 'publicacao.simulada.json'), {}) : {});
  const arquivo = caminhoMetricas(ep.dir, data);
  const saida = lerJson(arquivo, { lido_em: null, plataformas: {}, comentarios: {} });
  saida.comentarios = saida.comentarios || {};
  for (const [nome, info] of Object.entries(publicacao.plataformas || {})) {
    if (!info?.ok || !ADAPTADORES[nome]) continue;
    try {
      const id = info.detalhes?.post_id || info.id;
      const lista = await ADAPTADORES[nome].lerComentarios({ id, canal, env, simular, registro, limite });
      saida.comentarios[nome] = { quantidade: lista.length, observacao: lista.observacao || null, itens: lista.map((c) => ({ texto: c.texto, curtidas: c.curtidas ?? null, data: c.data ?? null })) };
    } catch (e) {
      saida.comentarios[nome] = { quantidade: 0, erro: e.message, itens: [] };
    }
  }
  saida.lido_em = agoraISO();
  escreverJson(arquivo, saida);
  return { arquivo, comentarios: saida.comentarios, registro };
}

// ---------- uso direto pela linha de comando ----------
function argumentos(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (item.startsWith('--')) {
      const chave = item.slice(2);
      const proximo = argv[i + 1];
      if (proximo && !proximo.startsWith('--')) { a[chave] = proximo; i++; } else a[chave] = true;
    } else a._.push(item);
  }
  return a;
}

const executadoDireto = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (executadoDireto) {
  const args = argumentos(process.argv.slice(2));
  const env = carregarEnv(raizRepo());
  const canal = lerJson(path.join(raizRepo(), 'canal', 'canal.json'));
  const dirEpisodio = args.episodio || args._[0];
  if (!dirEpisodio) {
    console.error('uso: node fabrica/publicar/index.js --episodio <pasta> [--simular] [--plataformas a,b] [--forcar] | --metricas | --comentarios');
    process.exit(2);
  }
  const simular = !!args.simular;
  try {
    if (args.metricas) {
      const r = await lerMetricasTudo({ dirEpisodio, canal, env, simular });
      console.log(JSON.stringify(r.metricas, null, 2));
      console.log(`gravado em ${r.arquivo}`);
    } else if (args.comentarios) {
      const r = await lerComentariosTudo({ dirEpisodio, canal, env, simular });
      for (const [p, c] of Object.entries(r.comentarios)) console.log(`${p}: ${c.quantidade} comentário(s)${c.observacao ? ' · ' + c.observacao : ''}`);
      console.log(`gravado em ${r.arquivo}`);
    } else {
      const plataformas = args.plataformas ? String(args.plataformas).split(',') : undefined;
      const r = await publicarTudo({ dirEpisodio, canal, env, simular, plataformas, forcar: !!args.forcar });
      if (simular) {
        console.log('\nRequisições que seriam feitas:');
        console.log(r.registro.resumo());
      }
      if (r.pendencias_manuais?.length) {
        console.log('\nPendências manuais:');
        for (const p of r.pendencias_manuais) console.log(` - ${p}`);
      }
      console.log(`\n${r.ok ? 'tudo publicado' : 'houve falhas'}${simular ? ' (simulação)' : ''}`);
      process.exit(r.ok ? 0 : 1);
    }
  } catch (e) {
    console.error(`erro: ${e.message}`);
    if (e.detalhes && Object.keys(e.detalhes).length) console.error(JSON.stringify(e.detalhes, null, 2).slice(0, 2000));
    process.exit(1);
  }
}
