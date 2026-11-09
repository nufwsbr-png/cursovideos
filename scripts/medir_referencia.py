"""Mede um vídeo de referência (estudo de edição) com ffmpeg e faster-whisper.

Uso: python -I scripts/medir_referencia.py referencias/videos/ID.mp4 [--sem-whisper] [--limiar 12]
Saída: referencias/medidas/ID.json (+ ID_cenas.csv, ID_folha.jpg com 1 quadro por segundo).

O que mede:
- duração, resolução, fps;
- pontuação de troca de cena por quadro (filtro scdet, 0-100) e cortes = picos acima do limiar
  separados por pelo menos 0,4 s;
- loudness integrado (EBU R128), faixa de loudness, pico verdadeiro; trechos de silêncio (< -40 dB por >= 0,4 s);
- transcrição com tempo por palavra: primeira fala, falas (segmentos), palavras por minuto.
Tudo é MEDIDO por máquina; a leitura do que significa fica para a anotação (HIPÓTESE).
"""
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path


def ffbin(nome):
    achado = shutil.which(nome)
    if achado:
        return achado
    base = Path(os.environ.get('LOCALAPPDATA', '')) / 'Microsoft' / 'WinGet' / 'Packages'
    for p in base.glob('Gyan.FFmpeg*/ffmpeg-*/bin/' + nome + '.exe'):
        return str(p)
    raise SystemExit(f'{nome} não encontrado no PATH')


FFMPEG, FFPROBE = ffbin('ffmpeg'), ffbin('ffprobe')


def rodar(args):
    return subprocess.run(args, capture_output=True, text=True, encoding='utf-8', errors='replace')


def info(arq):
    r = rodar([FFPROBE, '-v', 'error', '-select_streams', 'v:0', '-show_entries',
               'stream=width,height,r_frame_rate:format=duration', '-of', 'json', arq])
    d = json.loads(r.stdout)
    s = d['streams'][0]
    n, m = s['r_frame_rate'].split('/')
    return {'largura': s['width'], 'altura': s['height'], 'fps': round(int(n) / int(m), 3),
            'duracao_s': round(float(d['format']['duration']), 3)}


def cenas(arq, csv):
    r = rodar([FFMPEG, '-hide_banner', '-i', arq, '-an', '-vf',
               'scale=270:480,scdet=threshold=0,metadata=print:file=-', '-f', 'null', '-'])
    pts, pontos = None, []
    for linha in r.stdout.splitlines():
        m = re.search(r'pts_time:([\d.]+)', linha)
        if m:
            pts = float(m.group(1))
        m = re.search(r'lavfi\.scd\.score=([\d.]+)', linha)
        if m and pts is not None:
            pontos.append((pts, float(m.group(1))))
    Path(csv).write_text('t,score\n' + '\n'.join(f'{t:.3f},{s:.2f}' for t, s in pontos), encoding='utf-8')
    return pontos


def cortes(pontos, limiar, sep=0.4):
    picos = sorted([p for p in pontos if p[1] >= limiar], key=lambda p: -p[1])
    escolhidos = []
    for t, s in picos:
        if all(abs(t - e[0]) >= sep for e in escolhidos):
            escolhidos.append((t, s))
    return sorted(escolhidos)


def loudness(arq):
    r = rodar([FFMPEG, '-hide_banner', '-i', arq, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'])
    txt = r.stderr[r.stderr.rfind('Summary:'):]
    def num(rot):
        m = re.search(rot + r':\s+(-?[\d.]+)', txt)
        return float(m.group(1)) if m else None
    return {'lufs_integrado': num('I'), 'lra_lu': num('LRA'), 'pico_dbtp': num('Peak')}


def silencios(arq, db=-40, dur=0.4):
    r = rodar([FFMPEG, '-hide_banner', '-i', arq, '-vn', '-af', f'silencedetect=noise={db}dB:d={dur}', '-f', 'null', '-'])
    ini, out = None, []
    for linha in r.stderr.splitlines():
        m = re.search(r'silence_start: (-?[\d.]+)', linha)
        if m:
            ini = max(0.0, float(m.group(1)))
        m = re.search(r'silence_end: ([\d.]+)', linha)
        if m and ini is not None:
            out.append([round(ini, 2), round(float(m.group(1)), 2)])
            ini = None
    return out


def folha(arq, saida, dur):
    # 1 quadro por segundo, 10 colunas, quadros de 108x192.
    linhas = int(dur // 10) + 1
    rodar([FFMPEG, '-y', '-hide_banner', '-loglevel', 'error', '-i', arq, '-vf',
           "fps=1,scale=108:192,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='%{pts\\:hms}'"
           f":x=2:y=2:fontsize=12:fontcolor=white:box=1:boxcolor=black@0.6,tile=10x{linhas}",
           '-frames:v', '1', '-q:v', '3', '-update', '1', saida])


def movimento(arq, passo=0.1, janela=0.5):
    """Brilho médio por quadro (0-255) e mudança visual entre t e t-janela (média |dif| em 54x96 cinza).
    Corte seco, giro de cabeça e zoom aparecem como picos de mudança; escurecimento como queda de brilho."""
    import numpy as np
    r = subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-i', arq, '-vf',
                        f'fps={round(1 / passo)},scale=54:96,format=gray', '-f', 'rawvideo', '-'], capture_output=True)
    q = np.frombuffer(r.stdout, dtype=np.uint8).reshape(-1, 96, 54).astype(np.float32)
    brilho = q.mean(axis=(1, 2))
    k = round(janela / passo)
    mud = np.zeros(len(q))
    mud[k:] = np.abs(q[k:] - q[:-k]).mean(axis=(1, 2))
    # trechos escuros (brilho < 20) e picos de mudança (> 30, separados por 1 s)
    escuros, ini = [], None
    for i, b in enumerate(brilho):
        if b < 20 and ini is None:
            ini = i
        if b >= 20 and ini is not None:
            escuros.append([round(ini * passo, 1), round(i * passo, 1)]); ini = None
    if ini is not None:
        escuros.append([round(ini * passo, 1), round(len(brilho) * passo, 1)])
    picos = []
    for i in np.argsort(-mud):
        if mud[i] < 30:
            break
        if all(abs(i - j) * passo >= 1.0 for j in picos):
            picos.append(int(i))
    picos.sort()
    return {'passo_s': passo, 'janela_s': janela,
            'brilho_medio': round(float(brilho.mean()), 1),
            'trechos_escuros': escuros,
            'mudanca_mediana': round(float(np.median(mud[k:])), 2),
            'mudanca_p90': round(float(np.percentile(mud[k:], 90)), 2),
            'picos_mudanca': [[round(i * passo, 1), round(float(mud[i]), 1)] for i in picos],
            'segundos_em_movimento_forte': round(float((mud > 15).sum() * passo), 1)}


def transcrever(arq, modelo='small'):
    import numpy as np
    from faster_whisper import WhisperModel
    # O áudio é decodificado pelo ffmpeg (16 kHz mono float32): evita a leitura via PyAV, que quebra com av >= 15.
    r = subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-i', arq, '-vn', '-ac', '1', '-ar', '16000',
                        '-f', 'f32le', '-'], capture_output=True)
    audio = np.frombuffer(r.stdout, dtype=np.float32)
    m = WhisperModel(modelo, device='cpu', compute_type='int8')
    # Sem VAD: com trilha e efeitos por baixo, o VAD descartava falas inteiras (medido no Mercado Epi. 03: 3 × 21 falas).
    segs, _ = m.transcribe(audio, language='pt', word_timestamps=True, vad_filter=False,
                           condition_on_previous_text=False)
    falas, palavras = [], []
    for s in segs:
        falas.append({'ini': round(s.start, 2), 'fim': round(s.end, 2), 'texto': s.text.strip()})
        for w in (s.words or []):
            palavras.append({'ini': round(w.start, 2), 'fim': round(w.end, 2), 'p': w.word.strip()})
    return falas, palavras


def main():
    args = sys.argv[1:]
    arq = args[0]
    limiar = float(args[args.index('--limiar') + 1]) if '--limiar' in args else 12.0
    vid = Path(arq).stem
    dest = Path('referencias/medidas')
    dest.mkdir(parents=True, exist_ok=True)
    res = {'id': vid, 'arquivo': arq, **info(arq)}
    pts = cenas(arq, dest / f'{vid}_cenas.csv')
    cs = cortes(pts, limiar)
    tempos = [0.0] + [t for t, _ in cs] + [res['duracao_s']]
    planos = [round(b - a, 2) for a, b in zip(tempos, tempos[1:])]
    res['cortes'] = {'limiar_scdet': limiar, 'n': len(cs), 'instantes': [[round(t, 2), round(s, 1)] for t, s in cs],
                     'duracao_planos_s': planos,
                     'plano_medio_s': round(sum(planos) / len(planos), 2),
                     'plano_mediano_s': sorted(planos)[len(planos) // 2]}
    res['movimento'] = movimento(arq)
    res['audio'] = loudness(arq)
    res['audio']['silencios'] = silencios(arq)
    folha(arq, str(dest / f'{vid}_folha.jpg'), res['duracao_s'])
    if '--sem-whisper' not in args:
        falas, pal = transcrever(arq)
        fala_total = sum(f['fim'] - f['ini'] for f in falas)
        res['fala'] = {'primeira_fala_s': falas[0]['ini'] if falas else None,
                       'ultima_fala_fim_s': falas[-1]['fim'] if falas else None,
                       'n_segmentos': len(falas), 'n_palavras': len(pal),
                       'palavras_por_minuto_video': round(len(pal) / res['duracao_s'] * 60, 1),
                       'palavras_por_segundo_falando': round(len(pal) / fala_total, 2) if fala_total else None,
                       'segundos_com_fala': round(fala_total, 1),
                       'falas': falas, 'palavras': pal}
    (dest / f'{vid}.json').write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding='utf-8')
    resumo = {k: v for k, v in res.items() if k not in ('fala',)}
    resumo['cortes'] = {k: v for k, v in res['cortes'].items() if k != 'duracao_planos_s'}
    resumo['audio'] = {k: v for k, v in res['audio'].items() if k != 'silencios'} | {'n_silencios': len(res['audio']['silencios'])}
    if 'fala' in res:
        resumo['fala'] = {k: v for k, v in res['fala'].items() if k not in ('falas', 'palavras')}
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(resumo, ensure_ascii=False))


if __name__ == '__main__':
    main()
