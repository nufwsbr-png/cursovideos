#!/usr/bin/env node
// Monta a linha do tempo de um episódio (tempos de falas, linhas, movimentos, cartões, pergunta, ambientes) com a
// mesma função que o motor usa na prévia. Os efeitos de som entram depois, pelo audio/_linha_previa.py --efeitos-de.
// Uso: node motor/montar_linha.js --episodio episodios/ep01_x --saida episodios/ep01_x/linha_do_tempo.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { montarLinhaDoTempo } from './cena/linha_do_tempo.js';
import { planejarDuracoes } from './cena/plano_camera.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const p = process.argv[i + 1]; if (p && !p.startsWith('--')) { args[a.slice(2)] = p; i++; } else args[a.slice(2)] = true; } }
if (!args.episodio) { console.error('uso: node motor/montar_linha.js --episodio <pasta> [--saida arquivo]'); process.exit(2); }
const dir = path.resolve(RAIZ, args.episodio);
const lerJson = (p, padrao) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : padrao);
const canal = lerJson(path.join(RAIZ, 'canal', 'canal.json'));
const roteiro = lerJson(path.join(dir, 'roteiro.json'));
const medidas = lerJson(path.join(dir, 'medidas.json'), null);
const plano = planejarDuracoes(roteiro, canal);
const linha = montarLinhaDoTempo(roteiro, medidas, canal, plano);
if (plano.avisos?.length) linha.avisos_plano = plano.avisos;
const saida = args.saida ? path.resolve(RAIZ, args.saida) : null;
if (saida) { fs.writeFileSync(saida, JSON.stringify(linha, null, 2) + '\n'); console.log(`[linha] ${linha.duracao_total_s} s, ${linha.falas.length} falas, ${linha.linhas.length} linhas → ${path.relative(RAIZ, saida)}`); }
else console.log(JSON.stringify(linha, null, 2));
