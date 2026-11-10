# -*- coding: utf-8 -*-
"""
Utilidades compartilhadas da frente SOM (sem scipy: só numpy, wave e ffmpeg).

Tudo aqui é determinístico quando recebe uma semente. Funções principais:
- ler_wav / escrever_wav           (PCM 16 bit via módulo wave; float32 em -1..1)
- reamostrar                       (interpolação linear, suficiente para voz e efeitos)
- dbfs / rms / pico                (medidas simples)
- filtrar_banda                    (filtro por FFT com transição suave, sem ondulação)
- convolver                        (convolução por FFT, usada para reverb)
- impulso_sala                     (resposta de sala sintética para o saguão)
- envelope_rms                     (RMS por janela)
- suavizar_ataque_soltura          (seguidor de envelope com ataque/soltura, em blocos)
- extrair_audio_ffmpeg             (qualquer mp4/wav → numpy mono em uma taxa)
- carregar_json / salvar_json / agora_iso / carregar_canal / pasta_raiz
"""
from __future__ import annotations

import json
import math
import os
import subprocess
import sys
import wave
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

RAIZ = Path(__file__).resolve().parents[1]


def _garantir_ffmpeg_no_path() -> None:
    """Põe ffmpeg/ffprobe no PATH quando o shell é antigo (Windows + WinGet). Mesma ordem de fabrica/util/binarios.js."""
    from shutil import which
    if which("ffmpeg") and which("ffprobe"):
        return
    candidatos = []
    if os.environ.get("FFMPEG_DIR"):
        candidatos.append(Path(os.environ["FFMPEG_DIR"]))
    if sys.platform == "win32":
        local = Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData" / "Local")))
        pacotes = local / "Microsoft" / "WinGet" / "Packages"
        if pacotes.exists():
            for p in sorted(pacotes.glob("Gyan.FFmpeg*")):
                for sub in sorted(p.glob("ffmpeg-*"), reverse=True):
                    candidatos.append(sub / "bin")
        candidatos.append(local / "Microsoft" / "WinGet" / "Links")
    ext = ".exe" if sys.platform == "win32" else ""
    for c in candidatos:
        if (c / f"ffmpeg{ext}").exists() and (c / f"ffprobe{ext}").exists():
            os.environ["PATH"] = str(c) + os.pathsep + os.environ.get("PATH", "")
            return


_garantir_ffmpeg_no_path()


# ---------------------------------------------------------------- arquivos e json

def pasta_raiz() -> Path:
    return RAIZ


def carregar_json(caminho) -> dict:
    with open(caminho, "r", encoding="utf-8") as f:
        return json.load(f)


def salvar_json(caminho, dados) -> None:
    Path(caminho).parent.mkdir(parents=True, exist_ok=True)
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)
        f.write("\n")


def carregar_canal() -> dict:
    return carregar_json(RAIZ / "canal" / "canal.json")


def agora_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def resolver_episodio(arg: str) -> Path:
    p = Path(arg)
    if not p.is_absolute():
        p = (Path.cwd() / p).resolve()
    if not p.exists():
        alt = RAIZ / "episodios" / arg
        if alt.exists():
            return alt
        sys.exit(f"Pasta do episódio não encontrada: {arg}")
    return p


def falar(msg: str, silencioso: bool = False) -> None:
    """Imprime no stderr para não sujar a saída --json."""
    if not silencioso:
        print(msg, file=sys.stderr)


# ---------------------------------------------------------------- wav

def ler_wav(caminho) -> tuple[np.ndarray, int]:
    """Lê WAV PCM (8/16/24/32 bits ou float32) → (float32 mono em -1..1, taxa)."""
    with wave.open(str(caminho), "rb") as w:
        canais = w.getnchannels()
        largura = w.getsampwidth()
        taxa = w.getframerate()
        quadros = w.readframes(w.getnframes())
    if largura == 2:
        x = np.frombuffer(quadros, dtype="<i2").astype(np.float32) / 32768.0
    elif largura == 4:
        # pode ser int32 ou float32; o módulo wave não distingue. Assume int32.
        x = np.frombuffer(quadros, dtype="<i4").astype(np.float32) / 2147483648.0
    elif largura == 3:
        b = np.frombuffer(quadros, dtype=np.uint8).reshape(-1, 3)
        x = (b[:, 0].astype(np.int32) | (b[:, 1].astype(np.int32) << 8) | (b[:, 2].astype(np.int8).astype(np.int32) << 16))
        x = x.astype(np.float32) / 8388608.0
    elif largura == 1:
        x = (np.frombuffer(quadros, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
    else:
        raise ValueError(f"Largura de amostra não suportada: {largura}")
    if canais > 1:
        x = x.reshape(-1, canais).mean(axis=1)
    return x.astype(np.float32), taxa


def escrever_wav(caminho, x: np.ndarray, taxa: int, bits: int = 16) -> None:
    """Escreve WAV PCM mono (16 ou 24 bits) a partir de float -1..1 (com clipe duro)."""
    Path(caminho).parent.mkdir(parents=True, exist_ok=True)
    x = np.clip(np.asarray(x, dtype=np.float64), -1.0, 1.0)
    with wave.open(str(caminho), "wb") as w:
        w.setnchannels(1)
        w.setframerate(int(taxa))
        if bits == 24:
            w.setsampwidth(3)
            v = np.round(x * 8388607.0).astype(np.int32)
            b = np.empty((v.size, 3), dtype=np.uint8)
            b[:, 0] = v & 0xFF
            b[:, 1] = (v >> 8) & 0xFF
            b[:, 2] = (v >> 16) & 0xFF
            w.writeframes(b.tobytes())
        else:
            w.setsampwidth(2)
            w.writeframes(np.round(x * 32767.0).astype("<i2").tobytes())


def escrever_raw_f32(caminho, x: np.ndarray) -> None:
    np.asarray(x, dtype="<f4").tofile(str(caminho))


# ---------------------------------------------------------------- medidas simples

def rms(x: np.ndarray) -> float:
    if x.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(np.square(x.astype(np.float64)))))


def pico(x: np.ndarray) -> float:
    if x.size == 0:
        return 0.0
    return float(np.max(np.abs(x)))


def dbfs(valor: float) -> float:
    return 20.0 * math.log10(max(valor, 1e-9))


def db_para_ganho(db: float) -> float:
    return 10.0 ** (db / 20.0)


def envelope_rms(x: np.ndarray, taxa: int, passo_s: float = 0.05) -> np.ndarray:
    """RMS por janela de passo_s (sem sobreposição). Retorna array float64 (linear)."""
    n = max(1, int(round(passo_s * taxa)))
    total = int(math.ceil(x.size / n))
    preenchido = np.zeros(total * n, dtype=np.float64)
    preenchido[: x.size] = x
    blocos = preenchido.reshape(total, n)
    return np.sqrt(np.mean(np.square(blocos), axis=1))


def suavizar_ataque_soltura(sinal: np.ndarray, passo_s: float, ataque_s: float, soltura_s: float) -> np.ndarray:
    """Seguidor de envelope em blocos (loop em Python; use em taxa de bloco, não de amostra)."""
    a_at = math.exp(-passo_s / max(ataque_s, 1e-6))
    a_so = math.exp(-passo_s / max(soltura_s, 1e-6))
    saida = np.empty_like(sinal, dtype=np.float64)
    y = float(sinal[0]) if sinal.size else 0.0
    for i, v in enumerate(sinal):
        coef = a_at if v > y else a_so
        y = coef * y + (1.0 - coef) * float(v)
        saida[i] = y
    return saida


def expandir_blocos(valores: np.ndarray, n_por_bloco: int, tamanho: int) -> np.ndarray:
    """Interpola linearmente valores por bloco para o comprimento em amostras."""
    centros = (np.arange(valores.size) + 0.5) * n_por_bloco
    pos = np.arange(tamanho)
    return np.interp(pos, centros, valores, left=valores[0], right=valores[-1])


# ---------------------------------------------------------------- processamento

def reamostrar(x: np.ndarray, taxa_origem: int, taxa_destino: int) -> np.ndarray:
    if taxa_origem == taxa_destino or x.size == 0:
        return x.astype(np.float32)
    n_dest = int(round(x.size * taxa_destino / taxa_origem))
    t_orig = np.arange(x.size) / taxa_origem
    t_dest = np.arange(n_dest) / taxa_destino
    if taxa_destino < taxa_origem:
        # evita aliasing grosseiro antes de reduzir a taxa
        x = filtrar_banda(x, taxa_origem, None, taxa_destino * 0.45)
    return np.interp(t_dest, t_orig, x).astype(np.float32)


def _mascara_banda(n_fft: int, taxa: int, f_baixa, f_alta, oitavas_transicao: float) -> np.ndarray:
    freqs = np.fft.rfftfreq(n_fft, 1.0 / taxa)
    m = np.ones_like(freqs)
    eps = 1e-6
    lf = np.log2(np.maximum(freqs, eps))
    if f_baixa:
        a = math.log2(max(f_baixa, 1.0))
        t = np.clip((lf - (a - oitavas_transicao)) / oitavas_transicao, 0.0, 1.0)
        m *= 0.5 - 0.5 * np.cos(np.pi * t)
    if f_alta:
        b = math.log2(max(f_alta, 1.0))
        t = np.clip(((b + oitavas_transicao) - lf) / oitavas_transicao, 0.0, 1.0)
        m *= 0.5 - 0.5 * np.cos(np.pi * t)
    return m


def filtrar_banda(x: np.ndarray, taxa: int, f_baixa=None, f_alta=None, oitavas_transicao: float = 0.5) -> np.ndarray:
    """Passa-banda por FFT com transição em cosseno (em oitavas). f_baixa/f_alta podem ser None."""
    if x.size == 0 or (f_baixa is None and f_alta is None):
        return x.astype(np.float32)
    n = int(2 ** math.ceil(math.log2(max(x.size, 2))))
    X = np.fft.rfft(x.astype(np.float64), n)
    X *= _mascara_banda(n, taxa, f_baixa, f_alta, oitavas_transicao)
    return np.fft.irfft(X, n)[: x.size].astype(np.float32)


def enfatizar_banda(x: np.ndarray, taxa: int, centro: float, largura_oitavas: float, ganho_db: float) -> np.ndarray:
    """Pico/corte suave em torno de uma frequência (formantes, ressonâncias)."""
    n = int(2 ** math.ceil(math.log2(max(x.size, 2))))
    freqs = np.fft.rfftfreq(n, 1.0 / taxa)
    lf = np.log2(np.maximum(freqs, 1e-6))
    g = db_para_ganho(ganho_db) - 1.0
    forma = np.exp(-0.5 * ((lf - math.log2(max(centro, 1.0))) / max(largura_oitavas, 0.05)) ** 2)
    X = np.fft.rfft(x.astype(np.float64), n) * (1.0 + g * forma)
    return np.fft.irfft(X, n)[: x.size].astype(np.float32)


def convolver(x: np.ndarray, h: np.ndarray) -> np.ndarray:
    """Convolução linear por FFT (saída com o tamanho de x + h - 1)."""
    if x.size == 0 or h.size == 0:
        return x.astype(np.float32)
    n = int(2 ** math.ceil(math.log2(x.size + h.size - 1)))
    y = np.fft.irfft(np.fft.rfft(x.astype(np.float64), n) * np.fft.rfft(h.astype(np.float64), n), n)
    return y[: x.size + h.size - 1].astype(np.float32)


def impulso_sala(taxa: int, duracao_s: float = 0.7, semente: int = 7, brilho: float = 0.6) -> np.ndarray:
    """Resposta de sala sintética: ruído em decaimento exponencial + primeiras reflexões."""
    rng = np.random.default_rng(semente)
    n = int(duracao_s * taxa)
    t = np.arange(n) / taxa
    cauda = rng.standard_normal(n) * np.exp(-t * (6.9 / duracao_s))
    cauda = filtrar_banda(cauda, taxa, 120, 2500 + 5000 * brilho)
    h = np.zeros(n, dtype=np.float64)
    h[0] = 1.0
    for atraso_ms, ganho in ((11, 0.45), (19, 0.35), (27, 0.3), (41, 0.22), (57, 0.18)):
        i = int(atraso_ms * taxa / 1000)
        if i < n:
            h[i] += ganho
    h += cauda * 0.35
    h /= np.max(np.abs(h)) + 1e-9
    return h.astype(np.float32)


def aplicar_reverb(x: np.ndarray, taxa: int, molhado: float = 0.25, duracao_s: float = 0.7, semente: int = 7) -> np.ndarray:
    if molhado <= 0:
        return x.astype(np.float32)
    h = impulso_sala(taxa, duracao_s, semente)
    y = convolver(x, h)
    seco = np.zeros_like(y)
    seco[: x.size] = x
    energia = np.sqrt(np.sum(h.astype(np.float64) ** 2))
    return (seco * (1 - molhado) + y * (molhado / max(energia, 1e-6))).astype(np.float32)


def saturar(x: np.ndarray, quantidade: float = 2.0) -> np.ndarray:
    """Saturação suave (tanh) mantendo o nível aproximado."""
    if quantidade <= 0:
        return x.astype(np.float32)
    return (np.tanh(x * quantidade) / math.tanh(min(quantidade, 20.0))).astype(np.float32)


def normalizar_rms(x: np.ndarray, alvo_dbfs: float, mascara: np.ndarray | None = None, teto_pico_dbfs: float = -1.0) -> np.ndarray:
    """Ajusta o ganho para que o RMS (da parte mascarada) fique no alvo, sem o pico passar do teto."""
    base = x[mascara] if (mascara is not None and np.any(mascara)) else x
    r = rms(base)
    if r <= 1e-7:
        return x.astype(np.float32)
    g = db_para_ganho(alvo_dbfs) / r
    p = pico(x) * g
    teto = db_para_ganho(teto_pico_dbfs)
    if p > teto:
        g *= teto / p
    return (x * g).astype(np.float32)


def rampa(n: int, subir: bool = True) -> np.ndarray:
    r = 0.5 - 0.5 * np.cos(np.linspace(0, math.pi, max(n, 1)))
    return r if subir else r[::-1]


def envelope_adsr(n: int, taxa: int, ataque_s: float, decaimento_s: float, sustain: float, soltura_s: float) -> np.ndarray:
    a = max(1, int(ataque_s * taxa))
    d = max(1, int(decaimento_s * taxa))
    r = max(1, int(soltura_s * taxa))
    s = max(0, n - a - d - r)
    partes = [np.linspace(0, 1, a), np.linspace(1, sustain, d), np.full(s, sustain), np.linspace(sustain, 0, r)]
    env = np.concatenate(partes)
    if env.size < n:
        env = np.concatenate([env, np.zeros(n - env.size)])
    return env[:n]


# ---------------------------------------------------------------- ffmpeg

def ffmpeg_existe() -> bool:
    from shutil import which
    return which("ffmpeg") is not None and which("ffprobe") is not None


def rodar(cmd: list[str], capturar: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=capturar, text=True)


def extrair_audio_ffmpeg(arquivo, taxa: int = 48000) -> np.ndarray:
    """Decodifica qualquer arquivo com ffmpeg → float32 mono na taxa pedida."""
    cmd = ["ffmpeg", "-v", "error", "-i", str(arquivo), "-vn", "-ac", "1", "-ar", str(taxa), "-f", "f32le", "-"]
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg não conseguiu ler {arquivo}: {r.stderr.decode('utf-8', 'ignore')[-400:]}")
    return np.frombuffer(r.stdout, dtype="<f4").astype(np.float32)


def ffprobe_json(arquivo) -> dict:
    r = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(arquivo)],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffprobe falhou em {arquivo}: {r.stderr[-400:]}")
    return json.loads(r.stdout)


def duracao_arquivo(arquivo) -> float:
    info = ffprobe_json(arquivo)
    try:
        return float(info["format"]["duration"])
    except Exception:
        for s in info.get("streams", []):
            if "duration" in s:
                return float(s["duration"])
    return 0.0


def medir_loudness_ffmpeg(arquivo) -> dict:
    """Passagem de medição do loudnorm: devolve input_i, input_tp, input_lra, input_thresh (float)."""
    cmd = ["ffmpeg", "-v", "info", "-nostats", "-i", str(arquivo), "-vn",
           "-af", "loudnorm=I=-16:TP=-1:LRA=11:print_format=json", "-f", "null", "-"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    txt = r.stderr
    ini = txt.rfind("{")
    fim = txt.rfind("}")
    if ini < 0 or fim < 0:
        raise RuntimeError("Não achei o JSON do loudnorm na saída do ffmpeg:\n" + txt[-600:])
    dados = json.loads(txt[ini:fim + 1])
    saida = {}
    for k in ("input_i", "input_tp", "input_lra", "input_thresh", "target_offset"):
        try:
            saida[k] = float(dados.get(k))
        except (TypeError, ValueError):
            saida[k] = None
    return saida


# ---------------------------------------------------------------- texto

def normalizar_texto(t: str) -> str:
    import re
    import unicodedata
    t = unicodedata.normalize("NFD", t or "")
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = t.lower()
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def contar_palavras(texto: str) -> int:
    return len([p for p in normalizar_texto(texto).split(" ") if p])
