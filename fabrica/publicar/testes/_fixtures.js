// Cria uma pasta de episódio de teste no scratchpad (mp4 de 3 s, capa, textos, estado, roteiro).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const SCRATCH = process.env.SCRATCHPAD || '/tmp/claude-0/-home-user-cursovideos/88e5d9cc-f218-5c4b-8b9e-7ff9d81df1e8/scratchpad';

export function criarEpisodioTeste(nome = 'ep99_teste', { bloqueios = [], duracao = 3 } = {}) {
  const base = fs.existsSync(path.dirname(SCRATCH)) ? SCRATCH : os.tmpdir();
  const dir = path.join(base, 'publicar_teste', nome);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const mp4 = path.join(dir, 'ep99.mp4');
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `color=c=0x1f4e5f:s=1080x1920:d=${duracao}:r=30`, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', String(duracao), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', mp4]);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=0xd9772b:s=1080x1920:d=1', '-frames:v', '1', path.join(dir, 'capa.png')]);
  fs.writeFileSync(path.join(dir, 'roteiro.json'), JSON.stringify({ numero: 99, slug: 'teste', titulo: 'Teste da fila', descricao: 'Ele testava a fila e o painel piscou. Epi. 99', hashtags: ['pov', 'historia', 'suspense', 'rodoviaria'], comentario_fixado: 'Votação aberta: A ou B?', capa: { t_quadro: 1.0 } }, null, 2));
  fs.writeFileSync(path.join(dir, 'textos.json'), JSON.stringify({ titulo: 'Ele testava a fila e o painel piscou · Epi. 99', descricao: 'Ele testava a fila e o painel piscou. Epi. 99', hashtags: ['pov', 'historia', 'suspense', 'rodoviaria'], comentario_fixado: 'Votação aberta: A ou B? A mais votada decide o Epi. 100.', por_plataforma: { youtube: { titulo: 'Ele testava a fila e o painel piscou · Epi. 99' } } }, null, 2));
  fs.writeFileSync(path.join(dir, 'estado.json'), JSON.stringify({ etapa: 'capa', aprovado: true, bloqueios }, null, 2));
  return { dir, mp4, capa: path.join(dir, 'capa.png') };
}

export function canalTeste(extra = {}) {
  const canal = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'canal', 'canal.json'), 'utf8'));
  return { ...canal, ...extra };
}

export const ENV_VAZIO = {};
export const ENV_COMPLETO = {
  TIKTOK_CLIENT_KEY: 'k', TIKTOK_CLIENT_SECRET: 's', TIKTOK_REFRESH_TOKEN: 'r',
  META_PAGE_ID: '123', META_PAGE_ACCESS_TOKEN: 'tok', IG_USER_ID: '456',
  YOUTUBE_CLIENT_ID: 'id', YOUTUBE_CLIENT_SECRET: 'sec', YOUTUBE_REFRESH_TOKEN: 'ref',
  SUPABASE_URL: 'https://projeto.supabase.co', SUPABASE_SERVICE_KEY: 'chave',
};
