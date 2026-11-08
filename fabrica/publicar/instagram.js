// Publicador Instagram — Reels pela Instagram Graph API (conta profissional ligada a uma Página).
// NÃO CONFERIDO NA DOC nesta sessão (developers.facebook.com fora da rede permitida). Referências:
//   https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media   (container REELS)
//   https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media_publish
//   https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-container  (status_code)
//   https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-media/insights
// Fluxo: hospedar MP4 em URL pública → POST /{ig-user-id}/media (media_type=REELS, video_url, caption, share_to_feed)
//        → esperar status_code=FINISHED → POST /{ig-user-id}/media_publish (creation_id) → comentário da votação.
// A API não fixa comentários: o comentário é postado e a fixação fica como pendência manual.
import { chamar, esperarAte } from './_http.js';
import { ErroPublicacao, infoVideo, variaveisFaltando } from './_util.js';
import { validarArquivo } from './limites.js';
import { textoPara } from './textos.js';
import { hospedar, remover } from './hospedagem.js';
import { graphGet, graphPost, graphUrl, lerComentariosGraph } from './_meta.js';

const VARIAVEIS = ['META_PAGE_ACCESS_TOKEN', 'IG_USER_ID'];

export async function publicar({ arquivo, capa, textos, canal, env = process.env, simular = false, registro, roteiro }) {
  const avisos = [];
  const detalhes = { avisos };
  let referenciaHospedagem = null;
  try {
    const faltando = variaveisFaltando(env, VARIAVEIS);
    if (faltando.length) {
      if (!simular) throw new ErroPublicacao(`Instagram: faltam variáveis de ambiente: ${faltando.join(', ')}`);
      avisos.push(`variáveis ausentes (modo simulação): ${faltando.join(', ')}`);
    }
    const token = env.META_PAGE_ACCESS_TOKEN || 'simulado';
    const igUser = env.IG_USER_ID || 'IG_USER_ID';
    const info = infoVideo(arquivo);
    const validacao = validarArquivo('instagram', info);
    avisos.push(...validacao.avisos);
    if (!validacao.ok) throw new ErroPublicacao(`Instagram: arquivo recusado: ${validacao.erros.join('; ')}`);

    const t = textoPara('instagram', textos, canal);
    const nome = `${roteiro?.slug || 'episodio'}_${Date.now()}.mp4`;
    referenciaHospedagem = await hospedar({ arquivo, nome, canal, env, simular, registro });
    detalhes.hospedagem = { provedor: referenciaHospedagem.provedor, url: referenciaHospedagem.url };

    const cfg = canal?.plataformas?.instagram || {};
    const params = { media_type: 'REELS', video_url: referenciaHospedagem.url, caption: t.legenda, share_to_feed: cfg.compartilhar_no_feed === false ? 'false' : 'true' };
    if (roteiro?.capa?.t_quadro) params.thumb_offset = Math.round(roteiro.capa.t_quadro * 1000);
    const container = await graphPost({ env, caminho: `${igUser}/media`, params, token, plataforma: 'instagram', descricao: 'criar container REELS', simular, registro, simulado: () => ({ id: '17900000000000000' }) });
    if (!container.id) throw new ErroPublicacao('Instagram: container sem id', container);

    const espera = await esperarAte({
      ler: () => graphGet({ env, caminho: container.id, params: { fields: 'status_code,status' }, token, plataforma: 'instagram', descricao: 'status do container', simular, registro, simulado: () => ({ status_code: 'FINISHED' }) }),
      pronto: (s) => s.status_code === 'FINISHED',
      falhou: (s) => s.status_code === 'ERROR' || s.status_code === 'EXPIRED',
      intervalo_ms: 10000, limite_ms: 20 * 60 * 1000, simular,
    });
    if (!espera.ok) throw new ErroPublicacao(`Instagram: container não ficou pronto (${espera.estado?.status_code || 'sem status'}: ${espera.estado?.status || ''})`, espera.estado);

    const publicado = await graphPost({ env, caminho: `${igUser}/media_publish`, params: { creation_id: container.id }, token, plataforma: 'instagram', descricao: 'media_publish', simular, registro, simulado: () => ({ id: '18000000000000000' }) });
    const mediaId = publicado.id;
    if (!mediaId) throw new ErroPublicacao('Instagram: media_publish sem id', publicado);

    const midia = await graphGet({ env, caminho: mediaId, params: { fields: 'permalink' }, token, plataforma: 'instagram', descricao: 'permalink', simular, registro, simulado: () => ({ permalink: 'https://www.instagram.com/reel/SIMULADO/' }) });

    let comentario = { postado: false, fixado: false, id: null, texto: t.comentario_fixado };
    if (t.comentario_fixado) {
      try {
        const c = await graphPost({ env, caminho: `${mediaId}/comments`, params: { message: t.comentario_fixado }, token, plataforma: 'instagram', descricao: 'comentário da votação', simular, registro, simulado: () => ({ id: '17800000000000000' }) });
        comentario = { postado: true, fixado: false, id: c.id || null, texto: t.comentario_fixado };
      } catch (e) {
        avisos.push(`comentário não postado: ${e.message}`);
      }
    }
    await remover({ referencia: referenciaHospedagem, env, simular, registro });
    const pendencias = ['Instagram: fixar o comentário da votação no app (a API não fixa)'];
    if (canal?.publicacao?.etiqueta_ia !== false) pendencias.push('Instagram: conferir se o rótulo "Feito com IA" ficou ativo no Reel (a API não liga a etiqueta; o Instagram aplica a detecção automática)');
    return { plataforma: 'instagram', ok: true, id: mediaId, url: midia.permalink || null, detalhes: { ...detalhes, container_id: container.id, comentario_fixado: comentario, pendencias_manuais: pendencias, simulado: simular } };
  } catch (e) {
    await remover({ referencia: referenciaHospedagem, env, simular, registro });
    return { plataforma: 'instagram', ok: false, id: null, url: null, erro: e.message, detalhes: { ...detalhes, ...(e.detalhes || {}) } };
  }
}

const METRICAS_REELS = ['views', 'reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions', 'ig_reels_avg_watch_time'];
const METRICAS_MINIMAS = ['reach', 'likes', 'comments', 'saved', 'shares'];

async function lerInsights({ env, id, token, metricas, simular, registro }) {
  const r = await chamar({
    plataforma: 'instagram', descricao: `insights (${metricas.join(',')})`, metodo: 'GET',
    url: graphUrl(env, `${id}/insights`, { metric: metricas.join(','), access_token: token }), tipo: 'nenhum', simular, registro,
    simulado: () => ({ data: metricas.map((m) => ({ name: m, values: [{ value: 0 }] })) }),
  });
  const saida = {};
  for (const item of r.data || []) {
    const valor = item.values?.[0]?.value ?? item.total_value?.value ?? null;
    saida[item.name] = typeof valor === 'number' ? valor : null;
  }
  return saida;
}

export async function lerMetricas({ id, env = process.env, simular = false, registro }) {
  const vazio = { views: null, curtidas: null, comentarios: null, compartilhamentos: null, salvamentos: null, tempo_medio_s: null, origem: null };
  const token = env.META_PAGE_ACCESS_TOKEN || 'simulado';
  let m;
  try { m = await lerInsights({ env, id, token, metricas: METRICAS_REELS, simular, registro }); }
  catch { m = await lerInsights({ env, id, token, metricas: METRICAS_MINIMAS, simular, registro }); }
  let basico = {};
  try { basico = await graphGet({ env, caminho: id, params: { fields: 'like_count,comments_count' }, token, plataforma: 'instagram', descricao: 'contadores básicos', simular, registro, simulado: () => ({ like_count: 0, comments_count: 0 }) }); } catch { /* opcional */ }
  return {
    ...vazio,
    views: m.views ?? m.plays ?? null,
    alcance: m.reach ?? null,
    curtidas: m.likes ?? basico.like_count ?? null,
    comentarios: m.comments ?? basico.comments_count ?? null,
    compartilhamentos: m.shares ?? null,
    salvamentos: m.saved ?? null,
    tempo_medio_s: m.ig_reels_avg_watch_time != null ? Math.round(m.ig_reels_avg_watch_time) / 1000 : null,
    origem: null,
    observacao: 'origem das views e retenção segundo a segundo só no app (Insights)',
  };
}

export async function lerComentarios({ id, env = process.env, simular = false, registro, limite = 100 }) {
  const token = env.META_PAGE_ACCESS_TOKEN || 'simulado';
  return lerComentariosGraph({ env, caminho: id, token, campos: ['text', 'like_count', 'timestamp'], plataforma: 'instagram', simular, registro, limite });
}
