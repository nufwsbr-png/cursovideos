"""Mede o balanço vertical da câmera num trecho de vídeo (andar/correr), pelo mesmo método usado na referência:
correlação de fase entre quadros consecutivos na faixa de cima da imagem (teto/paredes, longe das mãos), integra o
deslocamento vertical, tira a deriva lenta e acha a frequência dominante entre 0,8 e 5 Hz.

Uso: python -I scripts/medir_balanco.py <video.mp4> [--inicio s] [--duracao s] [--faixa 0.06,0.62]
Saída: JSON com frequencia_hz e meia_amplitude_px_1920 (referência medida em 2026-11-10: ≈ 2,9 Hz, ±3–9 px).
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from medir_referencia import FFMPEG, info  # noqa: E402


def quadros(arq, ini, dur, w=270, h=480):
    args = [FFMPEG, '-loglevel', 'error']
    if ini is not None:
        args += ['-ss', str(ini)]
    if dur is not None:
        args += ['-t', str(dur)]
    args += ['-i', arq, '-vf', f'scale={w}:{h},format=gray', '-f', 'rawvideo', '-']
    r = subprocess.run(args, capture_output=True)
    return np.frombuffer(r.stdout, dtype=np.uint8).reshape(-1, h, w).astype(np.float32)


def desloc(a, b):
    jan = np.hanning(a.shape[0])[:, None] * np.hanning(a.shape[1])[None, :]
    A = np.fft.fft2(a * jan); B = np.fft.fft2(b * jan)
    R = A * np.conj(B); R /= np.abs(R) + 1e-9
    c = np.abs(np.fft.ifft2(R)); dy, dx = np.unravel_index(np.argmax(c), c.shape)
    H, W = a.shape
    return (dy - H if dy > H // 2 else dy), (dx - W if dx > W // 2 else dx)


def medir(arq, ini=None, dur=None, faixa=(0.06, 0.62)):
    fps = info(arq)['fps']
    q = quadros(arq, ini, dur)
    h = q.shape[1]
    reg = q[:, int(faixa[0] * h):int(faixa[1] * h), 40:230]
    dys = np.array([desloc(reg[i], reg[i + 1])[0] for i in range(len(reg) - 1)], dtype=float)
    y = np.cumsum(dys)
    y = y - np.convolve(y, np.ones(15) / 15, 'same')
    y = y[10:-10] if len(y) > 40 else y
    F = np.abs(np.fft.rfft(y - y.mean())); fr = np.fft.rfftfreq(len(y), 1 / fps)
    banda = (fr > 0.8) & (fr < 5)
    f0 = float(fr[banda][np.argmax(F[banda])]) if banda.any() else None
    amp = float((np.percentile(y, 95) - np.percentile(y, 5)) / 2) if len(y) else 0.0
    return {'arquivo': arq, 'fps': fps, 'quadros': int(len(q)), 'frequencia_hz': round(f0, 2) if f0 else None,
            'meia_amplitude_px_480': round(amp, 2), 'meia_amplitude_px_1920': round(amp * 4, 1)}


if __name__ == '__main__':
    a = sys.argv[1:]
    arq = a[0]
    pega = lambda k: float(a[a.index(k) + 1]) if k in a else None  # noqa: E731
    faixa = tuple(map(float, a[a.index('--faixa') + 1].split(','))) if '--faixa' in a else (0.06, 0.62)
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(medir(arq, pega('--inicio'), pega('--duracao'), faixa), ensure_ascii=False))
