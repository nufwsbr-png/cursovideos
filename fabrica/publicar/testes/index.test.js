import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { criarEpisodioTeste, canalTeste, ENV_COMPLETO } from './_fixtures.js';
import { mesclarPublicacao, publicarTudo, lerMetricasTudo, lerComentariosTudo, plataformasAtivas } from '../index.js';

test('mesclarPublicacao mantém sucesso anterior e acumula pendências', () => {
  const anterior = { publicado_em: '2026-01-01T00:00:00Z', plataformas: { tiktok: { ok: true, id: '1', url: 'u' } }, pendencias_manuais: ['a'] };
  const novo = mesclarPublicacao(anterior, [
    { plataforma: 'tiktok', ok: false, erro: 'falhou agora', detalhes: {} },
    { plataforma: 'youtube', ok: true, id: 'y', url: 'yu', detalhes: { pendencias_manuais: ['a', 'b'] } },
  ]);
  assert.equal(novo.plataformas.tiktok.ok, true);
  assert.equal(novo.plataformas.tiktok.id, '1');
  assert.ok(novo.plataformas.tiktok.ultima_tentativa.erro.includes('falhou'));
  assert.equal(novo.plataformas.youtube.ok, true);
  assert.deepEqual(novo.pendencias_manuais, ['a', 'b']);
  assert.equal(novo.publicado_em, '2026-01-01T00:00:00Z');
});

test('plataformasAtivas respeita canal e filtro', () => {
  const canal = canalTeste();
  assert.deepEqual(plataformasAtivas(canal), ['tiktok', 'instagram', 'facebook', 'youtube', 'kwai']);
  assert.deepEqual(plataformasAtivas(canal, ['youtube', 'TikTok', 'inexistente']), ['youtube', 'tiktok']);
  assert.deepEqual(plataformasAtivas({ ...canal, plataformas: { ...canal.plataformas, kwai: { ativo: false } } }), ['tiktok', 'instagram', 'facebook', 'youtube']);
});

test('recusa episódio com bloqueios, aceita com --forcar', async () => {
  const ep = criarEpisodioTeste('ep97_bloqueado', { bloqueios: ['voz falsa'] });
  const canal = canalTeste();
  await assert.rejects(() => publicarTudo({ dirEpisodio: ep.dir, canal, env: ENV_COMPLETO, simular: true, log: () => {} }), /bloqueios/);
  const r = await publicarTudo({ dirEpisodio: ep.dir, canal, env: ENV_COMPLETO, simular: true, forcar: true, log: () => {} });
  assert.equal(r.ok, true);
});

test('publicarTudo em simulação cobre as 5 plataformas e grava publicacao.simulada.json', async () => {
  const ep = criarEpisodioTeste('ep96_simulado');
  const canal = canalTeste();
  const r = await publicarTudo({ dirEpisodio: ep.dir, canal, env: ENV_COMPLETO, simular: true, log: () => {} });
  assert.equal(r.ok, true, JSON.stringify(r.resultados.filter((x) => !x.ok)));
  assert.deepEqual(r.resultados.map((x) => x.plataforma), ['tiktok', 'instagram', 'facebook', 'youtube', 'kwai']);
  const gravado = JSON.parse(fs.readFileSync(path.join(ep.dir, 'publicacao.simulada.json'), 'utf8'));
  assert.equal(Object.keys(gravado.plataformas).length, 5);
  assert.ok(gravado.requisicoes.length > 10);
  assert.ok(r.pendencias_manuais.some((p) => p.toLowerCase().includes('fixar')));
  assert.ok(!fs.existsSync(path.join(ep.dir, 'publicacao.json')), 'simulação não pode gravar publicacao.json');

  const m = await lerMetricasTudo({ dirEpisodio: ep.dir, canal, env: ENV_COMPLETO, simular: true });
  assert.ok(fs.existsSync(m.arquivo));
  assert.ok('youtube' in m.metricas && 'views' in m.metricas.youtube);
  const c = await lerComentariosTudo({ dirEpisodio: ep.dir, canal, env: ENV_COMPLETO, simular: true });
  assert.ok('tiktok' in c.comentarios);
  assert.equal(c.comentarios.tiktok.quantidade, 0);
});

test('reexecução só tenta o que falhou', async () => {
  const ep = criarEpisodioTeste('ep95_reexecucao');
  const canal = canalTeste();
  fs.writeFileSync(path.join(ep.dir, 'publicacao.json'), JSON.stringify({ publicado_em: '2026-01-01T00:00:00Z', plataformas: { tiktok: { ok: true, id: 'x' }, youtube: { ok: false, erro: 'antes' } } }));
  const r = await publicarTudo({ dirEpisodio: ep.dir, canal, env: ENV_COMPLETO, simular: true, log: () => {} });
  assert.ok(!r.resultados.some((x) => x.plataforma === 'tiktok'));
  assert.ok(r.resultados.some((x) => x.plataforma === 'youtube'));
});
