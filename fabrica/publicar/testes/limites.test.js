import test from 'node:test';
import assert from 'node:assert/strict';
import { cortarTexto, cortarBytes, validarArquivo, LIMITES } from '../limites.js';

test('cortarTexto não parte hashtag nem palavra', () => {
  const texto = 'Ele atendia o guichê da madrugada. Epi. 01 #pov #historia #suspense #rodoviaria';
  const cortado = cortarTexto(texto, 60);
  assert.ok(cortado.length <= 60);
  assert.ok(!/#\w*$/.test(cortado) || texto.includes(cortado.split(' ').pop() + ' ') || texto.endsWith(cortado.split(' ').pop()));
  // a hashtag "#rodoviaria" não pode virar "#rodov"
  assert.ok(!cortado.includes('#rodov') || cortado.includes('#rodoviaria'));
  assert.equal(cortarTexto('curto', 60), 'curto');
});

test('cortarTexto remove a hashtag que ficaria incompleta', () => {
  const texto = 'frase #abcdefghij';
  const cortado = cortarTexto(texto, 10); // "frase #abc" → fica só "frase"
  assert.equal(cortado, 'frase');
});

test('cortarBytes respeita bytes UTF-8', () => {
  const texto = 'ção '.repeat(100);
  const cortado = cortarBytes(texto, 50);
  assert.ok(new TextEncoder().encode(cortado).length <= 50);
});

test('validarArquivo recusa formato e duração errados', () => {
  const info = { arquivo: 'x.avi', tamanho_bytes: 1000, duracao_s: 1, largura: 1080, altura: 1920 };
  const r = validarArquivo('tiktok', info);
  assert.equal(r.ok, false);
  assert.ok(r.erros.some((e) => e.includes('formato')));
  assert.ok(r.erros.some((e) => e.includes('menos de')));
});

test('validarArquivo avisa Facebook acima de 90 s e YouTube acima de 180 s', () => {
  const info = { arquivo: 'x.mp4', tamanho_bytes: 1000, duracao_s: 100, largura: 1080, altura: 1920 };
  assert.ok(validarArquivo('facebook', info).avisos.some((a) => a.includes('vídeo comum')));
  assert.ok(validarArquivo('youtube', { ...info, duracao_s: 200 }).avisos.some((a) => a.includes('Shorts')));
  assert.equal(validarArquivo('instagram', info).ok, true);
  assert.equal(LIMITES.tiktok.pedaco_min_bytes, 5 * 1024 * 1024);
});
