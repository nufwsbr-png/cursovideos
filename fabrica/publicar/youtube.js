// Publicador YouTube — Data API v3 (upload resumível) + comentários + estatísticas + Analytics (opcional).
// NÃO CONFERIDO NA DOC nesta sessão (developers.google.com fora da rede permitida). Referências:
//   https://developers.google.com/youtube/v3/docs/videos/insert       (POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status)
//   https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
//   https://developers.google.com/youtube/v3/docs/thumbnails/set
//   https://developers.google.com/youtube/v3/docs/commentThreads/insert e /list
//   https://developers.google.com/youtube/analytics/reference/reports/query
// Shorts: vídeo vertical de até 3 minutos com #Shorts no título. Etiqueta de IA: status.containsSyntheticMedia = true.
// Não existe "fixar comentário" na API: o comentário da votação é postado e a fixação fica como pendência manual.
// Escopos: youtube.upload, youtube.force-ssl (comentários) e, opcional, yt-analytics.readonly (tempo médio).
import fs from 'node:fs';
import { chamar } from './_http.js';
import { ErroPublicacao, infoVideo, variaveisFaltando, dormir } from './_util.js';
import { validarArquivo } from './limites.js';
import { textoPara } from './textos.js';

const VARIAVEIS = ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN'];
const UPLOAD = 'https://www.googleapis.com/upload/youtube/v3';
const API = 'https://www.googleapis.com/youtube/v3';

export async function obterToken({ env, simular, registro }) {
  const faltando = variaveisFaltando(env, VARIAVEIS);
  if (faltando.length && !simular) throw new ErroPublicacao(`YouTube: faltam variáveis de ambiente: ${faltando.join(', ')}`);
  const r = await chamar({
    plataforma: 'youtube', descricao: 'renovar access token (refresh_token)', metodo: 'POST', url: 'https://oauth2.googleapis.com/token', tipo: 'form',
    corpo: { client_id: env.YOUTUBE_CLIENT_ID || '', client_secret: env.YOUTUBE_CLIENT_SECRET || '', refresh_token: env.YOUTUBE_REFRESH_TOKEN || '', grant_type: 'refresh_token' },
    simular, registro, simulado: () => ({ access_token: 'simulado_youtube_token', expires_in: 3599 }),
  });
  if (!r.access_token) throw new ErroPublicacao('YouTube: resposta sem access_token', r);
  return { access_token: r.access_token, faltando };
}

function montarRecurso({ t, canal, info }) {
  const cfg = canal?.plataformas?.youtube || {};
  const recurso = {
    snippet: { title: t.titulo, description: t.descricao, tags: t.tags, categoryId: String(cfg.categoria || '24'), defaultLanguage: 'pt-BR', defaultAudioLanguage: 'pt-BR' },
    status: { privacyStatus: cfg.privacidade || 'public', selfDeclaredMadeForKids: cfg.feito_para_criancas === true, embeddable: true },
  };
  if (cfg.conteudo_alterado_ou_sintetico !== false && canal?.publicacao?.etiqueta_ia !== false) recurso.status.containsSyntheticMedia = true;
  if (cfg.publicar_em) { recurso.status.privacyStatus = 'private'; recurso.status.publishAt = cfg.publicar_em; }
  return recurso;
}

async function iniciarUploadResumivel({ token, recurso, info, simular, registro }) {
  const r = await chamar({
    plataforma: 'youtube', descricao: 'iniciar upload resumível', metodo: 'POST', url: `${UPLOAD}/videos?uploadType=resumable&part=snippet,status`,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(info.tamanho_bytes) },
    corpo: recurso, resposta: 'completa', simular, registro, simulado: () => ({ status: 200, ok: true, headers: { location: 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=simulado' } }),
  });
  if (!r.ok) throw new ErroPublicacao(`YouTube: início do upload falhou (HTTP ${r.status}) ${r.texto?.slice(0, 300) || ''}`, r);
  const url = r.headers?.location || r.headers?.Location;
  if (!url) throw new ErroPublicacao('YouTube: início do upload sem cabeçalho Location', r);
  return url;
}

async function enviarArquivo({ token, urlUpload, arquivo, info, simular, registro }) {
  const corpo = simular ? Buffer.alloc(0) : fs.readFileSync(arquivo);
  let r = await chamar({
    plataforma: 'youtube', descricao: 'enviar vídeo (PUT único)', metodo: 'PUT', url: urlUpload, tipo: 'binario',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'video/mp4', 'Content-Length': String(info.tamanho_bytes) },
    corpo, resposta: 'completa', simular, registro, timeout_ms: 60 * 60 * 1000, simulado: () => ({ status: 200, ok: true, json: { id: 'SIMULADO0001' } }),
  });
  // retomada simples: pergunta ao servidor quanto já chegou e manda o resto (até 3 vezes)
  for (let tentativa = 0; tentativa < 3 && !r.ok && !simular; tentativa++) {
    await dormir(3000 * (tentativa + 1));
    const sonda = await chamar({ plataforma: 'youtube', descricao: 'consultar progresso', metodo: 'PUT', url: urlUpload, tipo: 'binario', headers: { Authorization: `Bearer ${token}`, 'Content-Length': '0', 'Content-Range': `bytes */${info.tamanho_bytes}` }, corpo: Buffer.alloc(0), resposta: 'completa', simular, registro });
    if (sonda.ok && sonda.json?.id) return sonda.json;
    const faixa = sonda.headers?.range || sonda.headers?.Range || '';
    const recebido = faixa ? Number(faixa.split('-')[1]) + 1 : 0;
    r = await chamar({
      plataforma: 'youtube', descricao: `retomar upload a partir de ${recebido}`, metodo: 'PUT', url: urlUpload, tipo: 'binario',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'video/mp4', 'Content-Length': String(info.tamanho_bytes - recebido), 'Content-Range': `bytes ${recebido}-${info.tamanho_bytes - 1}/${info.tamanho_bytes}` },
      corpo: corpo.subarray(recebido), resposta: 'completa', simular, registro, timeout_ms: 60 * 60 * 1000,
    });
  }
  if (!r.ok) throw new ErroPublicacao(`YouTube: upload falhou (HTTP ${r.status}) ${r.texto?.slice(0, 300) || ''}`, r);
  return r.json || {};
}

export async function publicar({ arquivo, capa, textos, canal, env = process.env, simular = false, registro }) {
  const avisos = [];
  const detalhes = { avisos };
  try {
    const { access_token: token, faltando } = await obterToken({ env, simular, registro });
    if (faltando?.length) avisos.push(`variáveis ausentes (modo simulação): ${faltando.join(', ')}`);
    const info = infoVideo(arquivo);
    const validacao = validarArquivo('youtube', info);
    avisos.push(...validacao.avisos);
    if (!validacao.ok) throw new ErroPublicacao(`YouTube: arquivo recusado: ${validacao.erros.join('; ')}`);

    const t = textoPara('youtube', textos, canal);
    const recurso = montarRecurso({ t, canal, info });
    const urlUpload = await iniciarUploadResumivel({ token, recurso, info, simular, registro });
    const video = await enviarArquivo({ token, urlUpload, arquivo, info, simular, registro });
    const videoId = video.id;
    if (!videoId) throw new ErroPublicacao('YouTube: upload terminou sem id de vídeo', video);

    if (capa && fs.existsSync(capa)) {
      try {
        await chamar({ plataforma: 'youtube', descricao: 'thumbnail (ignora falha)', metodo: 'POST', url: `${UPLOAD}/thumbnails/set?videoId=${videoId}&uploadType=media`, tipo: 'binario', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' }, corpo: simular ? Buffer.alloc(0) : fs.readFileSync(capa), simular, registro, simulado: () => ({}) });
        detalhes.thumbnail = true;
      } catch (e) {
        avisos.push(`thumbnail não enviada (conta sem verificação de telefone?): ${e.message.slice(0, 160)}`);
      }
    }

    let comentario = { postado: false, fixado: false, id: null, texto: t.comentario_fixado };
    if (t.comentario_fixado) {
      try {
        const c = await chamar({ plataforma: 'youtube', descricao: 'comentário da votação (commentThreads.insert)', metodo: 'POST', url: `${API}/commentThreads?part=snippet`, headers: { Authorization: `Bearer ${token}` }, corpo: { snippet: { videoId, topLevelComment: { snippet: { textOriginal: t.comentario_fixado } } } }, simular, registro, simulado: () => ({ id: 'Ugz_simulado' }) });
        comentario = { postado: true, fixado: false, id: c.id || null, texto: t.comentario_fixado };
      } catch (e) {
        avisos.push(`comentário não postado (escopo youtube.force-ssl?): ${e.message.slice(0, 160)}`);
      }
    }
    const pendencias = ['YouTube: fixar o comentário da votação no YouTube Studio (a API não fixa)'];
    return { plataforma: 'youtube', ok: true, id: videoId, url: `https://www.youtube.com/shorts/${videoId}`, detalhes: { ...detalhes, titulo: t.titulo, privacidade: recurso.status.privacyStatus, containsSyntheticMedia: !!recurso.status.containsSyntheticMedia, comentario_fixado: comentario, pendencias_manuais: pendencias, simulado: simular } };
  } catch (e) {
    return { plataforma: 'youtube', ok: false, id: null, url: null, erro: e.message, detalhes: { ...detalhes, ...(e.detalhes || {}) } };
  }
}

export async function lerMetricas({ id, env = process.env, simular = false, registro }) {
  const vazio = { views: null, curtidas: null, comentarios: null, compartilhamentos: null, salvamentos: null, tempo_medio_s: null, origem: null };
  const { access_token: token } = await obterToken({ env, simular, registro });
  const r = await chamar({ plataforma: 'youtube', descricao: 'videos.list statistics', metodo: 'GET', url: `${API}/videos?part=statistics,contentDetails&id=${encodeURIComponent(id)}`, headers: { Authorization: `Bearer ${token}` }, tipo: 'nenhum', simular, registro, simulado: () => ({ items: [{ statistics: { viewCount: '0', likeCount: '0', commentCount: '0' } }] }) });
  const s = r.items?.[0]?.statistics || {};
  const saida = { ...vazio, views: s.viewCount != null ? Number(s.viewCount) : null, curtidas: s.likeCount != null ? Number(s.likeCount) : null, comentarios: s.commentCount != null ? Number(s.commentCount) : null };
  // tempo médio pelo YouTube Analytics (precisa do escopo yt-analytics.readonly; falha em silêncio)
  try {
    const fim = new Date().toISOString().slice(0, 10);
    const inicio = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const a = await chamar({ plataforma: 'youtube', descricao: 'youtubeAnalytics (tempo médio)', metodo: 'GET', url: `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel%3D%3DMINE&startDate=${inicio}&endDate=${fim}&metrics=averageViewDuration,averageViewPercentage,shares&filters=video%3D%3D${encodeURIComponent(id)}`, headers: { Authorization: `Bearer ${token}` }, tipo: 'nenhum', simular, registro, simulado: () => ({ rows: [[0, 0, 0]] }) });
    const linha = a.rows?.[0];
    if (linha) { saida.tempo_medio_s = Number(linha[0]); saida.percentual_assistido = Number(linha[1]); saida.compartilhamentos = Number(linha[2]); }
  } catch { saida.observacao = 'tempo médio indisponível (sem escopo yt-analytics.readonly)'; }
  return saida;
}

export async function lerComentarios({ id, env = process.env, simular = false, registro, limite = 100 }) {
  const { access_token: token } = await obterToken({ env, simular, registro });
  const itens = [];
  let pagina = null;
  do {
    const u = new URL(`${API}/commentThreads`);
    u.searchParams.set('part', 'snippet'); u.searchParams.set('videoId', id); u.searchParams.set('maxResults', '100'); u.searchParams.set('order', 'relevance'); u.searchParams.set('textFormat', 'plainText');
    if (pagina) u.searchParams.set('pageToken', pagina);
    const r = await chamar({ plataforma: 'youtube', descricao: 'commentThreads.list', metodo: 'GET', url: u.toString(), headers: { Authorization: `Bearer ${token}` }, tipo: 'nenhum', simular, registro, simulado: () => ({ items: [] }) });
    for (const item of r.items || []) {
      const s = item.snippet?.topLevelComment?.snippet || {};
      itens.push({ texto: s.textOriginal || s.textDisplay || '', curtidas: s.likeCount ?? null, data: s.publishedAt || null });
    }
    pagina = simular ? null : r.nextPageToken || null;
  } while (pagina && itens.length < limite);
  return itens.slice(0, limite);
}
