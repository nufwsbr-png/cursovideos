import test from 'node:test';
import assert from 'node:assert/strict';
import { formulaTexto, textoPara, normalizarHashtags, numeroEpisodio } from '../textos.js';

test('fórmula do capítulo 71: situação + Epi. XX + 2 a 4 hashtags', () => {
  const t = formulaTexto({ situacao: 'Ele estava no posto e as bombas ligaram sozinhas', numero: 1, hashtags: ['#pov', 'fyp', 'suspense', 'rodoviaria', 'extra'] });
  assert.equal(t, 'Ele estava no posto e as bombas ligaram sozinhas. Epi. 01 #pov #fyp #suspense #rodoviaria');
  assert.equal(numeroEpisodio(12), 'Epi. 12');
});

test('não duplica Epi. quando a situação já traz', () => {
  const t = formulaTexto({ situacao: 'Algo aconteceu. Epi. 03', numero: 3, hashtags: ['pov'] });
  assert.equal(t, 'Algo aconteceu. Epi. 03 #pov');
});

test('normalizarHashtags tira #, espaços e repetidas', () => {
  assert.deepEqual(normalizarHashtags(['#pov', 'POV', ' his toria ', '', 'x'], 4), ['pov', 'historia', 'x']);
});

const textos = { titulo: 'Uma pra das três, por favor · Epi. 01', descricao: 'Ele atendia o guichê da madrugada e o painel anunciou um ônibus que não existe. Epi. 01', hashtags: ['pov', 'historia', 'suspense', 'rodoviaria'], comentario_fixado: 'Votação aberta: VENDER ou FECHAR?' };
const canal = { publicacao: { hashtags_max: 4 } };

test('youtube: título ≤ 100 com #Shorts, tags ≤ 500 chars', () => {
  const t = textoPara('youtube', { ...textos, titulo: 'x'.repeat(120) }, canal);
  assert.ok(t.titulo.length <= 100);
  assert.ok(t.titulo.endsWith('#Shorts'));
  assert.ok(t.tags.join(',').length <= 500);
  assert.ok(t.tags.includes('shorts'));
  assert.ok(t.descricao.includes('Votação aberta'));
});

test('tiktok e instagram: texto com hashtags dentro do limite', () => {
  const tt = textoPara('tiktok', textos, canal);
  assert.ok(tt.titulo.includes('#pov') && tt.titulo.length <= 2200);
  const ig = textoPara('instagram', textos, canal);
  assert.ok(ig.legenda.includes('#rodoviaria') && ig.legenda.length <= 2200);
  assert.equal(ig.comentario_fixado, textos.comentario_fixado);
});

test('respeita por_plataforma quando existe', () => {
  const t = textoPara('facebook', { ...textos, por_plataforma: { facebook: { descricao: 'texto do fb' } } }, canal);
  assert.equal(t.descricao, 'texto do fb');
});
