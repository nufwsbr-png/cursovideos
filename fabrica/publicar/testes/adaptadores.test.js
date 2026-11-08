import test from 'node:test';
import assert from 'node:assert/strict';
import { criarEpisodioTeste, canalTeste, ENV_COMPLETO, ENV_VAZIO } from './_fixtures.js';
import { criarRegistro } from '../_http.js';
import { ADAPTADORES } from '../index.js';

const ep = criarEpisodioTeste('ep98_adaptadores');
const textos = JSON.parse((await import('node:fs')).readFileSync(`${ep.dir}/textos.json`, 'utf8'));
const roteiro = JSON.parse((await import('node:fs')).readFileSync(`${ep.dir}/roteiro.json`, 'utf8'));
const canal = canalTeste();

const esperados = {
  tiktok: ['open.tiktokapis.com/v2/oauth/token/', 'creator_info/query', 'video/init', 'status/fetch'],
  instagram: ['supabase.co/storage/v1/object/', '/media', '/media_publish', '/comments'],
  facebook: ['/video_reels', 'rupload.facebook.com', '/comments'],
  youtube: ['oauth2.googleapis.com/token', 'uploadType=resumable', 'thumbnails/set', 'commentThreads'],
  kwai: ['kwai.com'],
};

for (const [nome, trechos] of Object.entries(esperados)) {
  test(`${nome}: modo simular monta as requisições certas e devolve ok`, async () => {
    const registro = criarRegistro();
    const r = await ADAPTADORES[nome].publicar({ arquivo: ep.mp4, capa: ep.capa, textos, canal, env: ENV_COMPLETO, simular: true, registro, roteiro });
    assert.equal(r.ok, true, r.erro);
    assert.equal(r.plataforma, nome);
    assert.ok(r.id);
    const urls = registro.itens.map((i) => i.url).join('\n');
    for (const trecho of trechos) assert.ok(urls.includes(trecho), `${nome}: faltou requisição com "${trecho}"\n${urls}`);
    for (const item of registro.itens) {
      const h = JSON.stringify(item.headers || {});
      assert.ok(!h.includes('"Bearer tok"') && !h.includes('"Bearer simulado_'), 'segredo vazou no registro: ' + h);
    }
  });
}

test('tiktok: etiqueta de IA e comentários ligados no post_info', async () => {
  const registro = criarRegistro();
  await ADAPTADORES.tiktok.publicar({ arquivo: ep.mp4, textos, canal, env: ENV_COMPLETO, simular: true, registro, roteiro });
  const init = registro.itens.find((i) => i.url.includes('video/init'));
  assert.equal(init.corpo.post_info.is_aigc, true);
  assert.equal(init.corpo.post_info.disable_comment, false);
  assert.equal(init.corpo.post_info.privacy_level, 'PUBLIC_TO_EVERYONE');
  assert.equal(init.corpo.source_info.source, 'FILE_UPLOAD');
  assert.equal(init.corpo.source_info.total_chunk_count, 1);
});

test('youtube: containsSyntheticMedia e #Shorts', async () => {
  const registro = criarRegistro();
  await ADAPTADORES.youtube.publicar({ arquivo: ep.mp4, capa: ep.capa, textos, canal, env: ENV_COMPLETO, simular: true, registro });
  const inicio = registro.itens.find((i) => i.url.includes('uploadType=resumable'));
  assert.equal(inicio.corpo.status.containsSyntheticMedia, true);
  assert.equal(inicio.corpo.status.selfDeclaredMadeForKids, false);
  assert.ok(inicio.corpo.snippet.title.includes('#Shorts'));
});

test('simular sem variáveis de ambiente registra o que falta mas não quebra', async () => {
  const registro = criarRegistro();
  const r = await ADAPTADORES.instagram.publicar({ arquivo: ep.mp4, textos, canal, env: ENV_VAZIO, simular: true, registro, roteiro });
  assert.equal(r.ok, true);
  assert.ok(r.detalhes.avisos.some((a) => a.includes('META_PAGE_ACCESS_TOKEN')));
});

test('sem simular e sem credenciais, o adaptador falha com mensagem clara (sem rede)', async () => {
  const r = await ADAPTADORES.youtube.publicar({ arquivo: ep.mp4, textos, canal, env: ENV_VAZIO, simular: false });
  assert.equal(r.ok, false);
  assert.ok(r.erro.includes('YOUTUBE_CLIENT_ID'));
});

test('kwai em fila_manual deixa o pacote pronto', async () => {
  const canalFila = canalTeste({ plataformas: { ...canal.plataformas, kwai: { ativo: true, modo: 'fila_manual' } } });
  const r = await ADAPTADORES.kwai.publicar({ arquivo: ep.mp4, capa: ep.capa, textos, canal: canalFila, env: ENV_VAZIO, simular: false, roteiro });
  assert.equal(r.ok, true);
  const fs = await import('node:fs');
  assert.ok(fs.existsSync(`${r.detalhes.pasta}/LEIA-ME.txt`));
  assert.ok(fs.existsSync(`${r.detalhes.pasta}/video.mp4`));
  fs.rmSync(r.detalhes.pasta, { recursive: true, force: true });
});

test('lerComentarios nunca devolve nome de usuário', async () => {
  for (const nome of Object.keys(ADAPTADORES)) {
    const lista = await ADAPTADORES[nome].lerComentarios({ id: '1', canal, env: ENV_COMPLETO, simular: true, registro: criarRegistro() });
    assert.ok(Array.isArray(lista));
    for (const c of lista) assert.deepEqual(Object.keys(c).sort(), ['curtidas', 'data', 'texto']);
  }
});
