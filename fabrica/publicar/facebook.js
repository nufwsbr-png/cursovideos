// Publicador Facebook — Reels da Página (Video API) com queda para vídeo comum quando o episódio passa de 90 s.
// NÃO CONFERIDO NA DOC nesta sessão (developers.facebook.com fora da rede permitida). Referências:
//   https://developers.facebook.com/docs/video-api/guides/reels-publishing  (video_reels start → rupload → finish)
//   https://developers.facebook.com/docs/video-api/guides/publishing          (POST /{page-id}/videos com `source`)
//   https://developers.facebook.com/docs/graph-api/reference/video/video_insights
// Permissões: pages_manage_posts, pages_read_engagement, pages_show_list, pages_read_user_content (token de Página).
import fs from 'node:fs';
import { chamar, esperarAte } from './_http.js';
import { ErroPublicacao, infoVideo, variaveisFaltando } from './_util.js';
import { LIMITES, validarArquivo } from './limites.js';
import { textoPara } from './textos.js';
import { graphGet, graphPost, graphUrl, versaoGraph, lerComentariosGraph } from './_meta.js';

const VARIAVEIS = ['META_PAGE_ACCESS_TOKEN', 'META_PAGE_ID'];

async function publicarReels({ arquivo, info, t, env, token, pageId, simular, registro }) {
  const inicio = await graphPost({ env, caminho: `${pageId}/video_reels`, params: { upload_phase: 'start' }, token, plataforma: 'facebook', descricao: 'video_reels start', simular, registro, simulado: () => ({ video_id: '1230000000000000', upload_url: `https://rupload.facebook.com/video-upload/${versaoGraph(env)}/1230000000000000` }) });
  const videoId = inicio.video_id;
  if (!videoId) throw new ErroPublicacao('Facebook: start sem video_id', inicio);
  const uploadUrl = inicio.upload_url || `https://rupload.facebook.com/video-upload/${versaoGraph(env)}/${videoId}`;
  await chamar({
    plataforma: 'facebook', descricao: 'enviar binário (rupload)', metodo: 'POST', url: uploadUrl, tipo: 'binario',
    headers: { Authorization: `OAuth ${token}`, offset: '0', file_size: String(info.tamanho_bytes), 'Content-Type': 'application/octet-stream' },
    corpo: simular ? Buffer.alloc(0) : fs.readFileSync(arquivo), simular, registro, tentativas: 2, simulado: () => ({ success: true }),
  });
  const fim = await graphPost({ env, caminho: `${pageId}/video_reels`, params: { upload_phase: 'finish', video_id: videoId, video_state: 'PUBLISHED', description: t.descricao, title: t.titulo }, token, plataforma: 'facebook', descricao: 'video_reels finish (PUBLISHED)', simular, registro, simulado: () => ({ success: true, post_id: `${pageId}_1230000000000000` }) });
  const espera = await esperarAte({
    ler: () => graphGet({ env, caminho: videoId, params: { fields: 'status' }, token, plataforma: 'facebook', descricao: 'status do vídeo', simular, registro, simulado: () => ({ status: { video_status: 'ready' } }) }),
    pronto: (s) => s.status?.video_status === 'ready' || s.status?.publishing_phase?.status === 'complete',
    falhou: (s) => s.status?.video_status === 'error' || s.status?.processing_phase?.status === 'error',
    intervalo_ms: 10000, limite_ms: 20 * 60 * 1000, simular,
  });
  if (!espera.ok) throw new ErroPublicacao(`Facebook: Reel não ficou pronto (${JSON.stringify(espera.estado?.status || {}).slice(0, 300)})`, espera.estado);
  return { videoId, postId: fim.post_id || null, tipo: 'REELS' };
}

async function publicarVideoComum({ arquivo, t, env, token, pageId, simular, registro }) {
  const r = await chamar({
    plataforma: 'facebook', descricao: 'POST /{page}/videos (multipart source)', metodo: 'POST', url: graphUrl(env, `${pageId}/videos`), tipo: 'multipart',
    corpo: { access_token: token, description: t.descricao, title: t.titulo, source: { arquivo: 'video.mp4', dados: simular ? Buffer.alloc(0) : fs.readFileSync(arquivo), tipo: 'video/mp4' } },
    simular, registro, tentativas: 2, simulado: () => ({ id: '1240000000000000' }),
  });
  if (!r.id) throw new ErroPublicacao('Facebook: upload de vídeo sem id', r);
  return { videoId: r.id, postId: null, tipo: 'VIDEO' };
}

export async function publicar({ arquivo, textos, canal, env = process.env, simular = false, registro }) {
  const avisos = [];
  const detalhes = { avisos };
  try {
    const faltando = variaveisFaltando(env, VARIAVEIS);
    if (faltando.length) {
      if (!simular) throw new ErroPublicacao(`Facebook: faltam variáveis de ambiente: ${faltando.join(', ')}`);
      avisos.push(`variáveis ausentes (modo simulação): ${faltando.join(', ')}`);
    }
    const token = env.META_PAGE_ACCESS_TOKEN || 'simulado';
    const pageId = env.META_PAGE_ID || 'META_PAGE_ID';
    const info = infoVideo(arquivo);
    const validacao = validarArquivo('facebook', info);
    avisos.push(...validacao.avisos);
    if (!validacao.ok) throw new ErroPublicacao(`Facebook: arquivo recusado: ${validacao.erros.join('; ')}`);

    const t = textoPara('facebook', textos, canal);
    const cfg = canal?.plataformas?.facebook || {};
    const cabeComoReels = info.duracao_s === null || info.duracao_s <= LIMITES.facebook.reels.duracao_max_s;
    const usarReels = cfg.tipo === 'VIDEO' ? false : cabeComoReels;
    if (!usarReels && cfg.tipo !== 'VIDEO') avisos.push(`episódio com ${Math.round(info.duracao_s)} s: publicado como vídeo comum da Página (Reels da API aceita até ${LIMITES.facebook.reels.duracao_max_s} s)`);

    const resultado = usarReels
      ? await publicarReels({ arquivo, info, t, env, token, pageId, simular, registro })
      : await publicarVideoComum({ arquivo, t, env, token, pageId, simular, registro });

    let comentario = { postado: false, fixado: false, id: null, texto: t.comentario_fixado };
    if (t.comentario_fixado) {
      try {
        const c = await graphPost({ env, caminho: `${resultado.videoId}/comments`, params: { message: t.comentario_fixado }, token, plataforma: 'facebook', descricao: 'comentário da votação', simular, registro, simulado: () => ({ id: '1250000000000000_1' }) });
        comentario = { postado: true, fixado: false, id: c.id || null, texto: t.comentario_fixado };
      } catch (e) {
        avisos.push(`comentário não postado: ${e.message}`);
      }
    }
    const url = resultado.tipo === 'REELS' ? `https://www.facebook.com/reel/${resultado.videoId}` : `https://www.facebook.com/${pageId}/videos/${resultado.videoId}`;
    const pendencias = ['Facebook: fixar o comentário da votação (a API não fixa)', 'Facebook: marcar o rótulo "IA" no post se a Meta pedir (a API não envia a etiqueta de IA)'];
    return { plataforma: 'facebook', ok: true, id: resultado.videoId, url, detalhes: { ...detalhes, tipo: resultado.tipo, post_id: resultado.postId, comentario_fixado: comentario, pendencias_manuais: pendencias, simulado: simular } };
  } catch (e) {
    return { plataforma: 'facebook', ok: false, id: null, url: null, erro: e.message, detalhes: { ...detalhes, ...(e.detalhes || {}) } };
  }
}

const METRICAS_REELS = ['blue_reels_play_count', 'fb_reels_total_plays', 'post_video_avg_time_watched', 'post_video_social_actions', 'post_impressions_unique'];
const METRICAS_VIDEO = ['total_video_views', 'total_video_avg_time_watched', 'total_video_impressions_unique'];

async function lerInsightsVideo({ env, id, token, metricas, simular, registro }) {
  const r = await chamar({
    plataforma: 'facebook', descricao: `video_insights (${metricas.join(',')})`, metodo: 'GET',
    url: graphUrl(env, `${id}/video_insights`, { metric: metricas.join(','), access_token: token }), tipo: 'nenhum', simular, registro,
    simulado: () => ({ data: metricas.map((m) => ({ name: m, values: [{ value: 0 }] })) }),
  });
  const saida = {};
  for (const item of r.data || []) {
    const valor = item.values?.[0]?.value;
    saida[item.name] = typeof valor === 'number' ? valor : (valor && typeof valor === 'object' ? valor : null);
  }
  return saida;
}

export async function lerMetricas({ id, env = process.env, simular = false, registro }) {
  const vazio = { views: null, curtidas: null, comentarios: null, compartilhamentos: null, salvamentos: null, tempo_medio_s: null, origem: null };
  const token = env.META_PAGE_ACCESS_TOKEN || 'simulado';
  let m = {};
  try { m = await lerInsightsVideo({ env, id, token, metricas: METRICAS_REELS, simular, registro }); } catch { /* tenta vídeo comum */ }
  if (Object.keys(m).length === 0) { try { m = await lerInsightsVideo({ env, id, token, metricas: METRICAS_VIDEO, simular, registro }); } catch { /* sem insights */ } }
  let basico = {};
  try { basico = await graphGet({ env, caminho: id, params: { fields: 'likes.summary(true),comments.summary(true)' }, token, plataforma: 'facebook', descricao: 'contadores', simular, registro, simulado: () => ({ likes: { summary: { total_count: 0 } }, comments: { summary: { total_count: 0 } } }) }); } catch { /* opcional */ }
  const acoes = m.post_video_social_actions && typeof m.post_video_social_actions === 'object' ? m.post_video_social_actions : {};
  const tempoMs = m.post_video_avg_time_watched ?? m.total_video_avg_time_watched;
  return {
    ...vazio,
    views: m.fb_reels_total_plays ?? m.blue_reels_play_count ?? m.total_video_views ?? null,
    alcance: m.post_impressions_unique ?? m.total_video_impressions_unique ?? null,
    curtidas: basico.likes?.summary?.total_count ?? acoes.LIKE ?? null,
    comentarios: basico.comments?.summary?.total_count ?? acoes.COMMENT ?? null,
    compartilhamentos: acoes.SHARE ?? null,
    tempo_medio_s: typeof tempoMs === 'number' ? Math.round(tempoMs) / 1000 : null,
    observacao: 'salvamentos e origem não vêm pela API do Facebook',
  };
}

export async function lerComentarios({ id, env = process.env, simular = false, registro, limite = 100 }) {
  const token = env.META_PAGE_ACCESS_TOKEN || 'simulado';
  return lerComentariosGraph({ env, caminho: id, token, campos: ['message', 'like_count', 'created_time'], plataforma: 'facebook', simular, registro, limite });
}
