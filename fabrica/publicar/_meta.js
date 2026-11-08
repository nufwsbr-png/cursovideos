// Pedaços comuns ao Instagram e ao Facebook (Graph API da Meta).
import { chamar } from './_http.js';

export function versaoGraph(env = process.env) {
  return env.META_GRAPH_VERSION || 'v21.0';
}

export function graphUrl(env, caminho, params = {}) {
  const u = new URL(`https://graph.facebook.com/${versaoGraph(env)}/${caminho.replace(/^\//, '')}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  return u.toString();
}

/** GET simples na Graph API com token em query string (padrão da Meta). */
export async function graphGet({ env, caminho, params, token, plataforma, descricao, simular, registro, simulado }) {
  return chamar({ plataforma, descricao, metodo: 'GET', url: graphUrl(env, caminho, { ...params, access_token: token }), tipo: 'nenhum', simular, registro, simulado });
}

/** POST com parâmetros como formulário (a Meta aceita form ou query). */
export async function graphPost({ env, caminho, params, token, plataforma, descricao, simular, registro, simulado }) {
  return chamar({ plataforma, descricao, metodo: 'POST', url: graphUrl(env, caminho), tipo: 'form', corpo: { ...params, access_token: token }, simular, registro, simulado });
}

/** Lê comentários de um objeto (mídia do IG ou vídeo do FB) sem devolver nome de usuário. */
export async function lerComentariosGraph({ env, caminho, token, campos, plataforma, simular, registro, limite = 100 }) {
  const itens = [];
  let url = graphUrl(env, `${caminho}/comments`, { fields: campos.join(','), limit: Math.min(limite, 100), access_token: token });
  while (url && itens.length < limite) {
    const pagina = await chamar({ plataforma, descricao: 'ler comentários', metodo: 'GET', url, tipo: 'nenhum', simular, registro, simulado: () => ({ data: [] }) });
    for (const c of pagina.data || []) {
      itens.push({ texto: c.text ?? c.message ?? '', curtidas: c.like_count ?? null, data: c.timestamp ?? c.created_time ?? null });
    }
    url = simular ? null : pagina.paging?.next || null;
  }
  return itens.slice(0, limite);
}
