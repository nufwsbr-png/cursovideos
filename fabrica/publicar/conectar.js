// Ajuda a obter credenciais UMA vez, na máquina do usuário:
//   node fabrica/publicar/conectar.js youtube   → OAuth do Google com refresh token
//   node fabrica/publicar/conectar.js tiktok    → OAuth do TikTok (Login Kit) com refresh token
//   node fabrica/publicar/conectar.js meta      → token de Página de longa duração + META_PAGE_ID + IG_USER_ID
//   node fabrica/publicar/conectar.js kwai      → abre o navegador para você fazer login no perfil persistente
// Nada é gravado automaticamente: as linhas para o .env são impressas e você cola. Nunca cole tokens em chat nem no cérebro.
// NÃO CONFERIDO NA DOC nesta sessão: URLs de autorização conforme documentação pública conhecida até 2025.
import http from 'node:http';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { execFile } from 'node:child_process';
import { carregarEnv, raizRepo, redigir } from './_util.js';
import { PERFIL_KWAI } from './kwai.js';

const PORTA = Number(process.env.CONECTAR_PORTA || 8765);
const REDIRECT = `http://localhost:${PORTA}/callback`;

function abrirNavegador(url) {
  const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  execFile(cmd[0], cmd[1], () => {});
}

function esperarCodigo() {
  return new Promise((resolve, reject) => {
    const servidor = http.createServer((req, res) => {
      const u = new URL(req.url, `http://localhost:${PORTA}`);
      if (u.pathname !== '/callback') { res.writeHead(404); res.end(); return; }
      const code = u.searchParams.get('code');
      const erro = u.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(code ? '<h2>Pronto. Pode voltar ao terminal.</h2>' : `<h2>Falhou: ${erro || 'sem código'}</h2>`);
      servidor.close();
      code ? resolve(code) : reject(new Error(erro || 'autorização sem código'));
    });
    servidor.listen(PORTA, () => console.log(`aguardando o retorno em ${REDIRECT} ...`));
    setTimeout(() => { servidor.close(); reject(new Error('tempo esgotado esperando a autorização (10 min)')); }, 10 * 60 * 1000).unref();
  });
}

async function perguntar(texto) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const resposta = (await rl.question(texto)).trim();
  rl.close();
  return resposta;
}

async function codigoPorServidorOuColagem(urlAutorizacao) {
  console.log('\nAbra esta URL no navegador (vou tentar abrir sozinho):\n' + urlAutorizacao + '\n');
  abrirNavegador(urlAutorizacao);
  console.log('Se a janela não voltar sozinha, cole aqui a URL completa para a qual você foi redirecionado (ou só o code).');
  const codigo = await Promise.race([
    esperarCodigo(),
    perguntar('> ').then((texto) => {
      if (!texto) return new Promise(() => {});
      try { return new URL(texto).searchParams.get('code') || texto; } catch { return texto; }
    }),
  ]);
  return codigo;
}

async function conectarYoutube(env) {
  const id = env.YOUTUBE_CLIENT_ID || await perguntar('YOUTUBE_CLIENT_ID: ');
  const segredo = env.YOUTUBE_CLIENT_SECRET || await perguntar('YOUTUBE_CLIENT_SECRET: ');
  const escopos = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.force-ssl', 'https://www.googleapis.com/auth/yt-analytics.readonly'];
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.search = new URLSearchParams({ client_id: id, redirect_uri: REDIRECT, response_type: 'code', scope: escopos.join(' '), access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' }).toString();
  const code = await codigoPorServidorOuColagem(u.toString());
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: id, client_secret: segredo, redirect_uri: REDIRECT, grant_type: 'authorization_code' }) });
  const dados = await r.json();
  if (!dados.refresh_token) throw new Error(`Google não devolveu refresh_token (${JSON.stringify(dados).slice(0, 300)}). Revogue o acesso em myaccount.google.com/permissions e tente de novo.`);
  console.log('\nCole no .env (ou nos segredos do GitHub):');
  console.log(`YOUTUBE_CLIENT_ID=${id}`);
  console.log(`YOUTUBE_CLIENT_SECRET=${segredo}`);
  console.log(`YOUTUBE_REFRESH_TOKEN=${dados.refresh_token}`);
  console.log('\nObservação: app OAuth em modo "Testing" expira o refresh token em 7 dias; publique o app (Production) para ele durar.');
}

async function conectarTiktok(env) {
  const chave = env.TIKTOK_CLIENT_KEY || await perguntar('TIKTOK_CLIENT_KEY: ');
  const segredo = env.TIKTOK_CLIENT_SECRET || await perguntar('TIKTOK_CLIENT_SECRET: ');
  const redirect = env.TIKTOK_REDIRECT_URI || await perguntar(`Redirect URI cadastrada no app (Enter para ${REDIRECT}; o TikTok costuma exigir HTTPS): `) || REDIRECT;
  const estado = Math.random().toString(36).slice(2);
  const u = new URL('https://www.tiktok.com/v2/auth/authorize/');
  u.search = new URLSearchParams({ client_key: chave, scope: 'user.info.basic,video.publish,video.upload,video.list', response_type: 'code', redirect_uri: redirect, state: estado }).toString();
  const code = await codigoPorServidorOuColagem(u.toString());
  const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_key: chave, client_secret: segredo, code: decodeURIComponent(code), grant_type: 'authorization_code', redirect_uri: redirect }) });
  const dados = await r.json();
  if (!dados.refresh_token) throw new Error(`TikTok não devolveu refresh_token: ${JSON.stringify(dados).slice(0, 300)}`);
  console.log('\nCole no .env (ou nos segredos do GitHub):');
  console.log(`TIKTOK_CLIENT_KEY=${chave}`);
  console.log(`TIKTOK_CLIENT_SECRET=${segredo}`);
  console.log(`TIKTOK_REFRESH_TOKEN=${dados.refresh_token}`);
  console.log(`# access token (dura 24 h, a fábrica renova sozinha): ${redigir(dados.access_token)}`);
  console.log('\nObservação: o refresh token dura 365 dias e é trocado a cada renovação; a fábrica avisa quando vier um novo.');
}

async function conectarMeta(env) {
  console.log('\nPasso a passo (Meta):');
  console.log('1. developers.facebook.com → seu app (tipo Business) → adicione os produtos "Facebook Login for Business" e "Instagram Graph API".');
  console.log('2. Graph API Explorer → gere um token de USUÁRIO com as permissões: pages_manage_posts, pages_read_engagement, pages_show_list, pages_read_user_content, instagram_basic, instagram_content_publish, instagram_manage_comments, instagram_manage_insights.');
  console.log('3. Cole aqui esse token curto e o id/segredo do app: eu troco por um token de longa duração e listo as Páginas.');
  const appId = env.META_APP_ID || await perguntar('META_APP_ID: ');
  const appSecret = env.META_APP_SECRET || await perguntar('META_APP_SECRET: ');
  const tokenCurto = await perguntar('token de usuário (curto): ');
  const versao = env.META_GRAPH_VERSION || 'v21.0';
  const longo = await (await fetch(`https://graph.facebook.com/${versao}/oauth/access_token?` + new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: tokenCurto }))).json();
  if (!longo.access_token) throw new Error(`não consegui o token longo: ${JSON.stringify(longo).slice(0, 300)}`);
  const paginas = await (await fetch(`https://graph.facebook.com/${versao}/me/accounts?` + new URLSearchParams({ fields: 'id,name,access_token,instagram_business_account{id,username}', access_token: longo.access_token }))).json();
  if (!paginas.data?.length) throw new Error('nenhuma Página encontrada para este usuário (você precisa ser administrador da Página).');
  console.log('\nPáginas encontradas:');
  paginas.data.forEach((p, i) => console.log(`${i + 1}. ${p.name} (id ${p.id})${p.instagram_business_account ? ` · Instagram @${p.instagram_business_account.username} (IG_USER_ID ${p.instagram_business_account.id})` : ' · sem Instagram profissional ligado'}`));
  const escolha = Number(await perguntar('qual número? ')) - 1;
  const p = paginas.data[escolha];
  if (!p) throw new Error('escolha inválida');
  console.log('\nCole no .env (ou nos segredos do GitHub):');
  console.log(`META_PAGE_ID=${p.id}`);
  console.log(`META_PAGE_ACCESS_TOKEN=${p.access_token}`);
  if (p.instagram_business_account) console.log(`IG_USER_ID=${p.instagram_business_account.id}`);
  else console.log('# ligue uma conta profissional do Instagram à Página para publicar Reels (IG_USER_ID)');
  console.log('\nObservação: o token de Página obtido a partir de um token de usuário de longa duração não expira, mas é revogado se você trocar a senha ou remover o app.');
}

async function conectarKwai() {
  const { chromium } = await import('playwright');
  const executablePath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
  console.log(`\nAbrindo o navegador com o perfil ${PERFIL_KWAI}. Faça login no Kwai e depois feche a janela.`);
  console.log('⚠️ Leia os Termos de Uso do Kwai antes de automatizar; a responsabilidade pelo uso é sua.');
  const contexto = await chromium.launchPersistentContext(PERFIL_KWAI, { headless: false, executablePath, viewport: { width: 1280, height: 900 }, locale: 'pt-BR' });
  const pagina = await contexto.newPage();
  await pagina.goto('https://www.kwai.com/', { waitUntil: 'domcontentloaded' });
  await new Promise((resolve) => contexto.on('close', resolve));
  console.log('Perfil salvo. Agora `KWAI_MODO=navegador` pode publicar a partir desta máquina.');
}

const alvo = (process.argv[2] || '').toLowerCase();
const env = carregarEnv(raizRepo());
try {
  if (alvo === 'youtube') await conectarYoutube(env);
  else if (alvo === 'tiktok') await conectarTiktok(env);
  else if (alvo === 'meta' || alvo === 'instagram' || alvo === 'facebook') await conectarMeta(env);
  else if (alvo === 'kwai') await conectarKwai();
  else { console.error('uso: node fabrica/publicar/conectar.js <youtube|tiktok|meta|kwai>'); process.exit(2); }
} catch (e) {
  console.error(`erro: ${e.message}`);
  process.exit(1);
}
