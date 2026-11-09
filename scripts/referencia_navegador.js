// Abre um Chromium VISÍVEL com perfil próprio (referencias/.navegador, fora do git) no perfil de referência
// do Instagram, espera o dono fazer login à mão, lista os reels (link + texto do cartão, que traz as visualizações)
// e exporta os cookies em formato Netscape para o yt-dlp baixar os vídeos escolhidos.
// Uso: node scripts/referencia_navegador.js [perfil]   (padrão: tecoazarado)
// Nenhuma senha passa por aqui: o login é digitado pelo dono na janela do navegador.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const perfil = process.argv[2] || 'tecoazarado';
const raiz = path.resolve('referencias');
const dirNav = path.join(raiz, '.navegador');
fs.mkdirSync(dirNav, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const ctx = await chromium.launchPersistentContext(dirNav, {
  headless: false,
  viewport: { width: 1280, height: 900 },
  locale: 'pt-BR',
});
const page = ctx.pages()[0] || (await ctx.newPage());
await page.goto(`https://www.instagram.com/${perfil}/`, { waitUntil: 'domcontentloaded' });
log('Navegador aberto. Aguardando login (até 20 min)...');

const logado = async () => (await ctx.cookies('https://www.instagram.com')).some((c) => c.name === 'sessionid' && c.value);
const inicio = Date.now();
while (!(await logado())) {
  if (Date.now() - inicio > 20 * 60 * 1000) { log('Tempo esgotado sem login.'); await ctx.close(); process.exit(2); }
  await new Promise((r) => setTimeout(r, 2000));
}
log('Login detectado.');
await new Promise((r) => setTimeout(r, 4000));

// Cookies no formato Netscape (yt-dlp --cookies).
const cookies = await ctx.cookies();
const linhas = ['# Netscape HTTP Cookie File'];
for (const c of cookies) {
  linhas.push([c.domain, c.domain.startsWith('.') ? 'TRUE' : 'FALSE', c.path, c.secure ? 'TRUE' : 'FALSE',
    Math.max(0, Math.round(c.expires || 0)), c.name, c.value].join('\t'));
}
fs.writeFileSync(path.join(raiz, 'cookies.txt'), linhas.join('\n') + '\n');
log('cookies.txt salvo.');

// Lista os reels rolando a aba de reels.
await page.goto(`https://www.instagram.com/${perfil}/reels/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
const vistos = new Map();
let semNovos = 0;
for (let i = 0; i < 80 && semNovos < 6; i++) {
  const itens = await page.$$eval('a[href*="/reel/"]', (as) => as.map((a) => ({ href: a.getAttribute('href'), texto: a.innerText.replace(/\s+/g, ' ').trim() })));
  const antes = vistos.size;
  for (const it of itens) {
    const id = (it.href.match(/\/reel\/([^/?#]+)/) || [])[1];
    if (id && !vistos.has(id)) vistos.set(id, { id, url: `https://www.instagram.com/reel/${id}/`, ordem_na_grade: vistos.size, texto_cartao: it.texto });
  }
  semNovos = vistos.size === antes ? semNovos + 1 : 0;
  await page.mouse.wheel(0, 2500);
  await page.waitForTimeout(1800);
}
const lista = [...vistos.values()];
fs.writeFileSync(path.join(raiz, 'lista_reels.json'), JSON.stringify({ perfil, coletado_em: new Date().toISOString(), reels: lista }, null, 2));
log(`${lista.length} reels listados em referencias/lista_reels.json`);
await page.screenshot({ path: path.join(raiz, 'grade_reels.png') });
await ctx.close();
