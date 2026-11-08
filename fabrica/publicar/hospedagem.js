// Hospedagem temporária do MP4 em URL pública (o Instagram só aceita vídeo por URL).
// Provedores: `supabase` (Storage REST) e `github_release` (asset de release).
// NÃO CONFERIDO NA DOC nesta sessão (supabase.com e docs.github.com fora da rede permitida). Referências:
//   https://supabase.com/docs/guides/storage  (POST /storage/v1/object/{bucket}/{path}, header x-upsert, URL pública /storage/v1/object/public/...)
//   https://docs.github.com/en/rest/releases/assets  (POST https://uploads.github.com/repos/{owner}/{repo}/releases/{id}/assets?name=)
import fs from 'node:fs';
import path from 'node:path';
import { chamar } from './_http.js';
import { ErroPublicacao, variaveisFaltando } from './_util.js';

function tipoMime(arquivo) {
  const ext = path.extname(arquivo).toLowerCase();
  return { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }[ext] || 'application/octet-stream';
}

function lerCorpo(arquivo, simular) {
  return simular ? Buffer.alloc(0) : fs.readFileSync(arquivo);
}

async function hospedarSupabase({ arquivo, nome, canal, env, simular, registro }) {
  const faltando = variaveisFaltando(env, ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']);
  if (faltando.length && !simular) throw new ErroPublicacao(`hospedagem supabase: faltam ${faltando.join(', ')}`);
  const base = String(env.SUPABASE_URL || 'https://SEU-PROJETO.supabase.co').replace(/\/$/, '');
  const chave = env.SUPABASE_SERVICE_KEY || '';
  const bucket = canal?.hospedagem?.bucket || 'videos';
  const pasta = canal?.hospedagem?.pasta || canal?.arroba || 'canal';
  const caminho = `${pasta}/${nome}`.replace(/^\/+/, '');
  const cabecalhos = { Authorization: `Bearer ${chave}`, apikey: chave };

  // garante o bucket público (409 = já existe)
  await chamar({
    plataforma: 'hospedagem', descricao: `garantir bucket público "${bucket}"`, metodo: 'POST', url: `${base}/storage/v1/bucket`,
    headers: cabecalhos, corpo: { id: bucket, name: bucket, public: true }, resposta: 'completa', simular, registro, simulado: () => ({ status: 409 }),
  });

  await chamar({
    plataforma: 'hospedagem', descricao: `enviar ${caminho} para o Storage`, metodo: 'POST', url: `${base}/storage/v1/object/${bucket}/${caminho}`,
    headers: { ...cabecalhos, 'Content-Type': tipoMime(arquivo), 'x-upsert': 'true' }, tipo: 'binario', corpo: lerCorpo(arquivo, simular),
    simular, registro, tentativas: 2, simulado: () => ({ Key: `${bucket}/${caminho}` }),
  });
  return { url: `${base}/storage/v1/object/public/${bucket}/${caminho}`, provedor: 'supabase', base, bucket, caminho, faltando };
}

async function removerSupabase({ referencia, env, simular, registro }) {
  const base = referencia.base || String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const chave = env.SUPABASE_SERVICE_KEY || '';
  await chamar({
    plataforma: 'hospedagem', descricao: `remover ${referencia.caminho}`, metodo: 'DELETE', url: `${base}/storage/v1/object/${referencia.bucket}`,
    headers: { Authorization: `Bearer ${chave}`, apikey: chave }, corpo: { prefixes: [referencia.caminho] }, simular, registro, simulado: () => ({}),
  });
}

function cabecalhosGithub(env) {
  return { Authorization: `Bearer ${env.GITHUB_TOKEN || ''}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'fabrica-pov-viral' };
}

async function hospedarGithub({ arquivo, nome, canal, env, simular, registro }) {
  const faltando = variaveisFaltando(env, ['GITHUB_TOKEN', 'GITHUB_REPOSITORY']);
  if (faltando.length && !simular) throw new ErroPublicacao(`hospedagem github_release: faltam ${faltando.join(', ')}`);
  const repo = env.GITHUB_REPOSITORY || 'usuario/repositorio';
  const tag = canal?.hospedagem?.tag_release || 'videos-publicados';
  const h = cabecalhosGithub(env);

  let release = await chamar({
    plataforma: 'hospedagem', descricao: `buscar release ${tag}`, metodo: 'GET', url: `https://api.github.com/repos/${repo}/releases/tags/${tag}`,
    headers: h, resposta: 'completa', simular, registro, simulado: () => ({ status: 200, json: { id: 1, assets: [] } }),
  });
  if (release.status === 404) {
    const criado = await chamar({
      plataforma: 'hospedagem', descricao: `criar release ${tag}`, metodo: 'POST', url: `https://api.github.com/repos/${repo}/releases`,
      headers: h, corpo: { tag_name: tag, name: 'Vídeos publicados pela fábrica', body: 'Arquivos hospedados temporariamente para a publicação no Instagram.', prerelease: false }, simular, registro, simulado: () => ({ id: 1, assets: [] }),
    });
    release = { status: 201, json: criado };
  }
  const dados = release.json || {};
  const existente = (dados.assets || []).find((a) => a.name === nome);
  if (existente) {
    await chamar({ plataforma: 'hospedagem', descricao: `apagar asset antigo ${nome}`, metodo: 'DELETE', url: `https://api.github.com/repos/${repo}/releases/assets/${existente.id}`, headers: h, resposta: 'nenhuma', simular, registro, simulado: () => ({}) });
  }
  const asset = await chamar({
    plataforma: 'hospedagem', descricao: `enviar asset ${nome}`, metodo: 'POST', url: `https://uploads.github.com/repos/${repo}/releases/${dados.id}/assets?name=${encodeURIComponent(nome)}`,
    headers: { ...h, 'Content-Type': tipoMime(arquivo) }, tipo: 'binario', corpo: lerCorpo(arquivo, simular), simular, registro, tentativas: 2,
    simulado: () => ({ id: 2, browser_download_url: `https://github.com/${repo}/releases/download/${tag}/${nome}` }),
  });
  return { url: asset.browser_download_url, provedor: 'github_release', asset_id: asset.id, repo, faltando, aviso: 'URLs de release redirecionam para objects.githubusercontent.com; se o Instagram recusar, use o provedor supabase' };
}

/** hospedar({ arquivo, nome, canal, env, simular, registro }) → { url, provedor, ... } */
export async function hospedar({ arquivo, nome, canal, env = process.env, simular = false, registro }) {
  const provedor = (env.HOSPEDAGEM_PROVEDOR || canal?.hospedagem?.provedor || 'supabase').toLowerCase();
  const nomeFinal = nome || path.basename(arquivo);
  if (provedor === 'supabase') return hospedarSupabase({ arquivo, nome: nomeFinal, canal, env, simular, registro });
  if (provedor === 'github_release' || provedor === 'github') return hospedarGithub({ arquivo, nome: nomeFinal, canal, env, simular, registro });
  if (provedor === 'url_fixa') {
    // o usuário já hospeda o arquivo em outro lugar e informa a base pública
    const base = String(env.HOSPEDAGEM_URL_BASE || '').replace(/\/$/, '');
    if (!base && !simular) throw new ErroPublicacao('hospedagem url_fixa: defina HOSPEDAGEM_URL_BASE');
    return { url: `${base || 'https://exemplo.com/videos'}/${nomeFinal}`, provedor: 'url_fixa' };
  }
  throw new ErroPublicacao(`hospedagem: provedor desconhecido "${provedor}"`);
}

/** Remoção best-effort depois que o Instagram terminou de processar. Nunca lança. */
export async function remover({ referencia, env = process.env, simular = false, registro }) {
  try {
    if (!referencia) return false;
    if (referencia.provedor === 'supabase') { await removerSupabase({ referencia, env, simular, registro }); return true; }
    if (referencia.provedor === 'github_release' && referencia.asset_id) {
      await chamar({ plataforma: 'hospedagem', descricao: 'apagar asset', metodo: 'DELETE', url: `https://api.github.com/repos/${referencia.repo}/releases/assets/${referencia.asset_id}`, headers: cabecalhosGithub(env), resposta: 'nenhuma', simular, registro, simulado: () => ({}) });
      return true;
    }
  } catch { /* best-effort */ }
  return false;
}
