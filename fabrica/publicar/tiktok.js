// Publicador TikTok — Content Posting API (Direct Post, FILE_UPLOAD em pedaços) + Display API (métricas).
// Documentação de referência (NÃO CONFERIDO NA DOC nesta sessão: developers.tiktok.com estava fora da rede permitida):
//   https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
//   https://developers.tiktok.com/doc/content-posting-api-get-started
//   https://developers.tiktok.com/doc/oauth-user-access-token-management
//   https://developers.tiktok.com/doc/display-api-get-started  (video.list / video.query)
// Regras do curso aplicadas: etiqueta de IA (is_aigc), comentários ativados, privacidade do canal,
// divulgação comercial (brand_organic_toggle / brand_content_toggle) quando o episódio marcar promoção.
// Aviso: um app ainda NÃO auditado pelo TikTok só consegue publicar como SELF_ONLY (privado) e com limites de contas.
import fs from 'node:fs';
import { chamar, esperarAte } from './_http.js';
import { ErroPublicacao, infoVideo, variaveisFaltando } from './_util.js';
import { LIMITES, validarArquivo } from './limites.js';
import { textoPara } from './textos.js';

const BASE = 'https://open.tiktokapis.com';
const VARIAVEIS = ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_REFRESH_TOKEN'];

/** Divide o arquivo em pedaços conforme as regras do TikTok (5–64 MB por pedaço, até 1000 pedaços, resto no último). */
export function calcularPedacos(tamanho, limites = LIMITES.tiktok) {
  if (!Number.isFinite(tamanho) || tamanho <= 0) throw new ErroPublicacao('tamanho de arquivo inválido para o TikTok');
  if (tamanho <= limites.pedaco_min_bytes) {
    return { chunk_size: tamanho, total_chunk_count: 1, pedacos: [{ inicio: 0, fim: tamanho - 1 }] };
  }
  let chunk = limites.pedaco_padrao_bytes;
  while (Math.floor(tamanho / chunk) > limites.pedacos_max && chunk < limites.pedaco_max_bytes) {
    chunk = Math.min(limites.pedaco_max_bytes, chunk * 2);
  }
  const total = Math.max(1, Math.floor(tamanho / chunk));
  const pedacos = [];
  for (let i = 0; i < total; i++) {
    const inicio = i * chunk;
    const fim = i === total - 1 ? tamanho - 1 : (i + 1) * chunk - 1;
    pedacos.push({ inicio, fim });
  }
  return { chunk_size: chunk, total_chunk_count: total, pedacos };
}

/** Renova o access token com o refresh token (o access token do TikTok dura 24 h). */
export async function obterToken({ env, simular, registro }) {
  if (env.TIKTOK_ACCESS_TOKEN && env.TIKTOK_ACCESS_TOKEN_VALIDO_ATE && Date.parse(env.TIKTOK_ACCESS_TOKEN_VALIDO_ATE) > Date.now() + 60_000) {
    return { access_token: env.TIKTOK_ACCESS_TOKEN, renovado: false };
  }
  const faltando = variaveisFaltando(env, VARIAVEIS);
  if (faltando.length && !simular) throw new ErroPublicacao(`TikTok: faltam variáveis de ambiente: ${faltando.join(', ')}`);
  const dados = await chamar({
    plataforma: 'tiktok', descricao: 'renovar access token', metodo: 'POST', url: `${BASE}/v2/oauth/token/`, tipo: 'form',
    corpo: { client_key: env.TIKTOK_CLIENT_KEY || '', client_secret: env.TIKTOK_CLIENT_SECRET || '', grant_type: 'refresh_token', refresh_token: env.TIKTOK_REFRESH_TOKEN || '' },
    simular, registro, simulado: () => ({ access_token: 'simulado_tiktok_token', expires_in: 86400, refresh_token: env.TIKTOK_REFRESH_TOKEN || 'simulado', open_id: 'simulado' }),
  });
  if (!dados.access_token) throw new ErroPublicacao('TikTok: resposta sem access_token ao renovar', { dados });
  return { access_token: dados.access_token, renovado: true, novo_refresh_token: dados.refresh_token || null, expires_in: dados.expires_in || null, faltando };
}

function cabecalhos(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' };
}

async function consultarCriador({ token, simular, registro }) {
  const r = await chamar({
    plataforma: 'tiktok', descricao: 'creator_info/query (obrigatório antes de postar)', metodo: 'POST',
    url: `${BASE}/v2/post/publish/creator_info/query/`, headers: cabecalhos(token), tipo: 'nenhum',
    simular, registro,
    simulado: () => ({ data: { creator_username: 'simulado', privacy_level_options: ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'], comment_disabled: false, duet_disabled: false, stitch_disabled: false, max_video_post_duration_sec: 600 }, error: { code: 'ok' } }),
  });
  if (r.error && r.error.code && r.error.code !== 'ok') throw new ErroPublicacao(`TikTok creator_info: ${r.error.code} ${r.error.message || ''}`, r.error);
  return r.data || {};
}

function montarPostInfo({ titulo, canal, criador, textos, avisos }) {
  const cfg = canal?.plataformas?.tiktok || {};
  const opcoes = criador.privacy_level_options || [];
  let privacidade = cfg.privacidade || 'PUBLIC_TO_EVERYONE';
  if (opcoes.length && !opcoes.includes(privacidade)) {
    avisos.push(`privacidade ${privacidade} não disponível para esta conta/app (opções: ${opcoes.join(', ')}); usando ${opcoes[0]}. App sem auditoria só publica privado.`);
    privacidade = opcoes[0];
  }
  const promocao = textos?.promocao || {};
  const postInfo = {
    title: titulo,
    privacy_level: privacidade,
    disable_comment: criador.comment_disabled ? true : !(cfg.comentarios !== false),
    disable_duet: criador.duet_disabled ? true : !(cfg.dueto === true),
    disable_stitch: criador.stitch_disabled ? true : !(cfg.stitch === true),
    video_cover_timestamp_ms: Math.max(0, Math.round((textos?.capa_t_s ?? 1) * 1000)),
  };
  if (canal?.publicacao?.etiqueta_ia !== false && cfg.etiqueta_ia !== false) postInfo.is_aigc = true;
  if (promocao.ativa) {
    if (promocao.propria !== false) postInfo.brand_organic_toggle = true;
    if (promocao.terceiros) postInfo.brand_content_toggle = true;
    if (postInfo.brand_content_toggle && privacidade === 'SELF_ONLY') avisos.push('conteúdo de marca de terceiros não pode ser privado no TikTok');
  }
  return postInfo;
}

async function enviarPedacos({ arquivo, uploadUrl, plano, simular, registro }) {
  const total = plano.pedacos[plano.pedacos.length - 1].fim + 1;
  const fd = simular ? null : fs.openSync(arquivo, 'r');
  try {
    for (const [i, p] of plano.pedacos.entries()) {
      const tamanho = p.fim - p.inicio + 1;
      let corpo = null;
      if (!simular) {
        corpo = Buffer.alloc(tamanho);
        fs.readSync(fd, corpo, 0, tamanho, p.inicio);
      }
      await chamar({
        plataforma: 'tiktok', descricao: `enviar pedaço ${i + 1}/${plano.pedacos.length}`, metodo: 'PUT', url: uploadUrl, tipo: 'binario',
        headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(tamanho), 'Content-Range': `bytes ${p.inicio}-${p.fim}/${total}` },
        corpo: corpo || Buffer.alloc(0), resposta: 'nenhuma', simular, registro, tentativas: 3, simulado: () => ({ status: i === plano.pedacos.length - 1 ? 201 : 206 }),
      });
    }
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
}

async function lerStatus({ token, publishId, simular, registro }) {
  const r = await chamar({
    plataforma: 'tiktok', descricao: 'status/fetch', metodo: 'POST', url: `${BASE}/v2/post/publish/status/fetch/`,
    headers: cabecalhos(token), corpo: { publish_id: publishId }, simular, registro,
    simulado: () => ({ data: { status: 'PUBLISH_COMPLETE', publicaly_available_post_id: ['7000000000000000000'] }, error: { code: 'ok' } }),
  });
  return r.data || {};
}

/** publicar({ arquivo, capa, textos, canal, env, simular, registro }) → { plataforma, ok, id, url, erro, detalhes } */
export async function publicar({ arquivo, textos, canal, env = process.env, simular = false, registro, roteiro }) {
  const avisos = [];
  const detalhes = { avisos };
  try {
    const info = infoVideo(arquivo);
    const { access_token: token, faltando, novo_refresh_token } = await obterToken({ env, simular, registro });
    if (faltando?.length) avisos.push(`variáveis ausentes (modo simulação): ${faltando.join(', ')}`);
    if (novo_refresh_token && novo_refresh_token !== env.TIKTOK_REFRESH_TOKEN) detalhes.novo_refresh_token = 'o TikTok devolveu um refresh token novo: atualize TIKTOK_REFRESH_TOKEN no .env/segredos';

    const criador = await consultarCriador({ token, simular, registro });
    const validacao = validarArquivo('tiktok', info, { duracao_max_s: criador.max_video_post_duration_sec });
    avisos.push(...validacao.avisos);
    if (!validacao.ok) throw new ErroPublicacao(`TikTok: arquivo recusado: ${validacao.erros.join('; ')}`);

    const t = textoPara('tiktok', textos, canal);
    const plano = calcularPedacos(info.tamanho_bytes);
    const postInfo = montarPostInfo({ titulo: t.titulo, canal, criador, textos: { ...textos, capa_t_s: roteiro?.capa?.t_quadro }, avisos });
    const init = await chamar({
      plataforma: 'tiktok', descricao: 'video/init (Direct Post)', metodo: 'POST', url: `${BASE}/v2/post/publish/video/init/`,
      headers: cabecalhos(token), simular, registro,
      corpo: { post_info: postInfo, source_info: { source: 'FILE_UPLOAD', video_size: info.tamanho_bytes, chunk_size: plano.chunk_size, total_chunk_count: plano.total_chunk_count } },
      simulado: () => ({ data: { publish_id: 'v_pub_file~simulado', upload_url: 'https://open-upload.tiktokapis.com/video/?upload_id=simulado' }, error: { code: 'ok' } }),
    });
    if (init.error && init.error.code && init.error.code !== 'ok') throw new ErroPublicacao(`TikTok init: ${init.error.code} ${init.error.message || ''}`, init.error);
    const publishId = init.data?.publish_id;
    const uploadUrl = init.data?.upload_url;
    if (!publishId || !uploadUrl) throw new ErroPublicacao('TikTok init sem publish_id/upload_url', init);

    await enviarPedacos({ arquivo, uploadUrl, plano, simular, registro });

    const espera = await esperarAte({
      ler: () => lerStatus({ token, publishId, simular, registro }),
      pronto: (s) => s.status === 'PUBLISH_COMPLETE' || s.status === 'SEND_TO_USER_INBOX',
      falhou: (s) => s.status === 'FAILED',
      intervalo_ms: 5000, limite_ms: 15 * 60 * 1000, simular,
    });
    const estado = espera.estado || {};
    if (!espera.ok) throw new ErroPublicacao(`TikTok: publicação não concluída (${estado.status || 'sem status'} ${estado.fail_reason || ''})`.trim(), estado);
    if (estado.status === 'SEND_TO_USER_INBOX') avisos.push('vídeo enviado para a caixa de entrada do app; precisa ser finalizado manualmente no TikTok');

    const postId = (estado.publicaly_available_post_id || [])[0] || null;
    const url = postId && criador.creator_username ? `https://www.tiktok.com/@${criador.creator_username}/video/${postId}` : null;
    const pendencias = ['TikTok: fixar o comentário da votação manualmente (a API não cria nem fixa comentários)'];
    if (postInfo.privacy_level === 'SELF_ONLY') pendencias.push('TikTok: vídeo publicado como privado (app sem auditoria?); tornar público no app');
    return { plataforma: 'tiktok', ok: true, id: postId || publishId, url, detalhes: { ...detalhes, publish_id: publishId, post_id: postId, privacidade: postInfo.privacy_level, is_aigc: !!postInfo.is_aigc, pedacos: plano.total_chunk_count, status: estado.status, simulado: simular, comentario_fixado: { postado: false, texto: t.comentario_fixado }, pendencias_manuais: pendencias } };
  } catch (e) {
    return { plataforma: 'tiktok', ok: false, id: null, url: null, erro: e.message, detalhes: { ...detalhes, ...(e.detalhes || {}) } };
  }
}

/** lerMetricas({ id, canal, env }) — id é o post id público (não o publish_id). */
export async function lerMetricas({ id, env = process.env, simular = false, registro }) {
  const vazio = { views: null, curtidas: null, comentarios: null, compartilhamentos: null, salvamentos: null, tempo_medio_s: null, origem: null };
  if (!id || String(id).startsWith('v_pub')) return { ...vazio, observacao: 'sem post id público ainda (o TikTok só devolve o id depois de PUBLISH_COMPLETE em vídeo público)' };
  const { access_token: token } = await obterToken({ env, simular, registro });
  const campos = 'id,title,view_count,like_count,comment_count,share_count,share_url,create_time,duration';
  const r = await chamar({
    plataforma: 'tiktok', descricao: 'video/query (métricas)', metodo: 'POST', url: `${BASE}/v2/video/query/?fields=${campos}`,
    headers: cabecalhos(token), corpo: { filters: { video_ids: [String(id)] } }, simular, registro,
    simulado: () => ({ data: { videos: [{ id, view_count: 0, like_count: 0, comment_count: 0, share_count: 0 }] }, error: { code: 'ok' } }),
  });
  const v = (r.data?.videos || [])[0];
  if (!v) return { ...vazio, observacao: 'vídeo não encontrado na Display API (escopo video.list concedido?)' };
  return { ...vazio, views: v.view_count ?? null, curtidas: v.like_count ?? null, comentarios: v.comment_count ?? null, compartilhamentos: v.share_count ?? null, url: v.share_url || null, observacao: 'salvamentos, tempo médio e origem só no TikTok Studio' };
}

/** A API pública do TikTok não dá acesso aos comentários (só o Research API, restrito). */
export async function lerComentarios() {
  return Object.assign([], { observacao: 'TikTok não expõe comentários na API pública: leia e conte os votos no TikTok Studio e registre em memoria/aprendizados.md' });
}
