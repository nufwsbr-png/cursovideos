import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularPedacos } from '../tiktok.js';

const MB = 1024 * 1024;

test('arquivo pequeno vai num pedaço só', () => {
  const p = calcularPedacos(3 * MB);
  assert.equal(p.total_chunk_count, 1);
  assert.equal(p.chunk_size, 3 * MB);
  assert.deepEqual(p.pedacos, [{ inicio: 0, fim: 3 * MB - 1 }]);
});

test('25 MB com pedaço de 10 MB vira 2 pedaços, o resto no último', () => {
  const p = calcularPedacos(25 * MB);
  assert.equal(p.chunk_size, 10 * MB);
  assert.equal(p.total_chunk_count, 2);
  assert.equal(p.pedacos[0].fim, 10 * MB - 1);
  assert.equal(p.pedacos[1].inicio, 10 * MB);
  assert.equal(p.pedacos[1].fim, 25 * MB - 1);
  const soma = p.pedacos.reduce((a, x) => a + (x.fim - x.inicio + 1), 0);
  assert.equal(soma, 25 * MB);
});

test('nunca passa de 1000 pedaços nem de 64 MB por pedaço', () => {
  const p = calcularPedacos(4 * 1024 * MB - 1);
  assert.ok(p.total_chunk_count <= 1000);
  assert.ok(p.chunk_size <= 64 * MB);
  assert.equal(p.pedacos[p.pedacos.length - 1].fim, 4 * 1024 * MB - 2);
});
