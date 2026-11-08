#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mixagem: a voz manda (capítulo 64).

1. Coloca cada fala em `linha_do_tempo.falas[].inicio_s`, com o filtro dela (telefone, rádio, alto-falante).
2. Iguala as vozes: cada fala vai para um RMS alvo (-20 dBFS; sussurro -23; grito -18) com pico limitado.
3. Abaixa ambiente (-7 dB) e tensão (-4 dB) enquanto alguém fala (ataque 150 ms, soltura 400 ms).
4. Soma os efeitos, limita, normaliza em duas passagens (loudnorm I=-16 LUFS, TP=-1 dB, LRA=11).
5. Muxa com o vídeo mudo (vídeo copiado, áudio AAC 192 kb/s) com a duração exata do vídeo.
6. Mede o resultado e grava `audio/mixagem.json`.

Uso:
  python3 audio/mixar.py --episodio episodios/ep01_x [--video video_mudo.mp4] [--saida ep01.mp4]
                         [--linha-do-tempo arquivo.json] [--so-audio mix.wav] [--semente 7]
Mudou só o som? Rode de novo: as imagens não são geradas de novo (o vídeo mudo é copiado).
"""
from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _comum import (carregar_canal, carregar_json, db_para_ganho, dbfs, duracao_arquivo, envelope_rms,  # noqa: E402
                    escrever_raw_f32, expandir_blocos, falar, ler_wav, pico, reamostrar, resolver_episodio, rms,
                    salvar_json, suavizar_ataque_soltura)
from filtros import aplicar_filtro  # noqa: E402

SR = 48000
ALVO_VOZ_DBFS = -20.0
DUCK_AMBIENTE_DB = -7.0
DUCK_TENSAO_DB = -4.0


def alvo_da_fala(estilo: str) -> float:
    e = (estilo or "").lower()
    if "whisper" in e or "sussur" in e or "barely audible" in e:
        return ALVO_VOZ_DBFS - 2.0
    if "shout" in e or "loud" in e or "grit" in e:
        return ALVO_VOZ_DBFS + 2.0
    return ALVO_VOZ_DBFS


def preparar_fala(ep: Path, fala_tl: dict, fala_rot: dict, medida: dict | None, semente: int) -> tuple[np.ndarray, float, dict]:
    caminho = ep / "audio" / "falas" / f"{fala_tl['id']}.wav"
    x, taxa = ler_wav(caminho)
    x = reamostrar(x, taxa, SR)
    # máscara da parte com voz (das medidas) para igualar pelo que importa
    mascara = None
    if medida and medida.get("fim_voz_s"):
        a, b = int(float(medida["inicio_voz_s"]) * SR), int(float(medida["fim_voz_s"]) * SR)
        if b > a:
            mascara = np.zeros(x.size, dtype=bool)
            mascara[a:min(b, x.size)] = True
    alvo = alvo_da_fala(fala_rot.get("estilo", ""))
    base = x[mascara] if (mascara is not None and np.any(mascara)) else x
    r = rms(base)
    ganho = db_para_ganho(alvo) / max(r, 1e-6)
    x = (x * ganho).astype(np.float32)
    y, antecipacao = aplicar_filtro(x, SR, fala_tl.get("filtro") or fala_rot.get("filtro"), semente + int(fala_tl["id"].lstrip("f") or 0))
    # depois do filtro, confere o nível de novo e limita o pico em -3 dBFS
    p = pico(y)
    teto = db_para_ganho(-3.0)
    if p > teto:
        y = np.tanh(y / p * 1.5) / math.tanh(1.5) * teto
    info = {"id": fala_tl["id"], "quem": fala_tl.get("quem"), "filtro": fala_tl.get("filtro"), "alvo_rms_dbfs": alvo,
            "rms_final_dbfs": round(dbfs(rms(y)), 1), "pico_final_dbfs": round(dbfs(pico(y)), 1), "duracao_s": round(y.size / SR, 3)}
    return y.astype(np.float32), antecipacao, info


def colocar(camada: np.ndarray, y: np.ndarray, t: float) -> None:
    p = int(round(t * SR))
    if p < 0:
        y = y[-p:]
        p = 0
    fim = min(camada.size, p + y.size)
    if fim > p:
        camada[p:fim] += y[: fim - p]


def ler_camada(caminho: Path, n: int) -> np.ndarray:
    if not caminho.exists():
        return np.zeros(n, dtype=np.float32)
    x, taxa = ler_wav(caminho)
    x = reamostrar(x, taxa, SR)
    out = np.zeros(n, dtype=np.float32)
    out[: min(n, x.size)] = x[:n]
    return out


def ganho_ducking(voz: np.ndarray, reducao_db: float) -> np.ndarray:
    passo = 0.01
    env = envelope_rms(voz, SR, passo)
    ativo = (20 * np.log10(np.maximum(env, 1e-9)) > -45.0).astype(np.float64)
    reducao = ativo * (1.0 - db_para_ganho(reducao_db))          # 0 sem voz, (1 - ganho) com voz
    # o seguidor sobe rápido (ataque: a voz começou, abaixa o fundo) e desce devagar (soltura: a voz parou)
    suave = suavizar_ataque_soltura(reducao, passo, ataque_s=0.15, soltura_s=0.4)
    g = 1.0 - suave
    return expandir_blocos(g, int(passo * SR), voz.size).astype(np.float32)


TETO_PICO_DBFS = -2.0      # pico de amostra antes do AAC (sobra para o pico verdadeiro ficar abaixo de -1 dBTP)
ALVO_LUFS = -16.0


def limitar_picos(x: np.ndarray, teto_dbfs: float = TETO_PICO_DBFS, antecipacao_s: float = 0.005, soltura_s: float = 0.08) -> tuple[np.ndarray, float]:
    """Limitador simples com antecipação: só segura os picos que passam do teto. Devolve (sinal, redução máxima em dB)."""
    teto = db_para_ganho(teto_dbfs)
    bloco = max(1, int(0.0005 * SR))
    total = int(math.ceil(x.size / bloco))
    pad = np.zeros(total * bloco, dtype=np.float32)
    pad[: x.size] = x
    picos = np.max(np.abs(pad.reshape(total, bloco)), axis=1)
    ganho_nec = np.minimum(1.0, teto / np.maximum(picos, 1e-9))
    la = max(1, int(antecipacao_s / 0.0005))
    # mínimo deslizante olhando para a frente (antecipação)
    from numpy.lib.stride_tricks import sliding_window_view
    ext = np.concatenate([ganho_nec, np.ones(la)])
    adiantado = sliding_window_view(ext, la + 1).min(axis=1)[:total]
    # ataque imediato (segue o mínimo), soltura exponencial
    a_so = math.exp(-0.0005 / soltura_s)
    g = np.empty(total)
    y = 1.0
    for i in range(total):
        v = float(adiantado[i])
        y = v if v < y else (a_so * y + (1 - a_so) * v)
        g[i] = y
    gs = expandir_blocos(g, bloco, x.size)
    return (x * gs).astype(np.float32), round(-20 * math.log10(max(float(g.min()), 1e-6)), 2)


def loudnorm_duas_passagens(raw_f32: Path, saida_wav: Path, silencioso: bool) -> dict:
    entrada = ["-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", str(raw_f32)]
    p1 = subprocess.run(["ffmpeg", "-v", "info", "-nostats", *entrada, "-af", "loudnorm=I=-16:TP=-1:LRA=11:print_format=json", "-f", "null", "-"],
                        capture_output=True, text=True)
    txt = p1.stderr
    ini, fim = txt.rfind("{"), txt.rfind("}")
    if ini < 0:
        raise RuntimeError("loudnorm (passagem 1) não devolveu JSON:\n" + txt[-500:])
    m = json.loads(txt[ini:fim + 1])
    filtro = ("loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={input_i}:measured_TP={input_tp}:measured_LRA={input_lra}:"
              "measured_thresh={input_thresh}:offset={target_offset}:linear=true:print_format=json").format(**m)
    p2 = subprocess.run(["ffmpeg", "-v", "info", "-nostats", "-y", *entrada, "-af", filtro, "-ar", str(SR), "-c:a", "pcm_s24le", str(saida_wav)],
                        capture_output=True, text=True)
    if p2.returncode != 0:
        raise RuntimeError("loudnorm (passagem 2) falhou:\n" + p2.stderr[-500:])
    txt2 = p2.stderr
    ini2, fim2 = txt2.rfind("{"), txt2.rfind("}")
    m2 = json.loads(txt2[ini2:fim2 + 1]) if ini2 >= 0 else {}
    falar(f"loudnorm: entrada {m.get('input_i')} LUFS / pico {m.get('input_tp')} dBTP → saída {m2.get('output_i')} LUFS / pico {m2.get('output_tp')} dBTP "
          f"(modo {m2.get('normalization_type')})", silencioso)
    return {"passagem_1": m, "passagem_2": m2}


def medir_loudness_ffmpeg_raw(raw_f32: Path) -> dict:
    p = subprocess.run(["ffmpeg", "-v", "info", "-nostats", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", str(raw_f32),
                        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
    txt = p.stderr
    ini, fim = txt.rfind("{"), txt.rfind("}")
    if ini < 0:
        return {}
    m = json.loads(txt[ini:fim + 1])
    return {k: (float(v) if v not in (None, "-inf", "inf") else None) for k, v in m.items() if k.startswith("input_")}


def muxar(video: Path, mix_wav: Path, saida: Path, silencioso: bool) -> None:
    dur = duracao_arquivo(video)
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", str(video), "-i", str(mix_wav), "-map", "0:v:0", "-map", "1:a:0",
           "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", str(SR), "-af", "apad", "-t", f"{dur:.3f}",
           "-movflags", "+faststart", str(saida)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("ffmpeg não conseguiu juntar vídeo e áudio:\n" + r.stderr[-500:])
    falar(f"MP4 pronto: {saida} (vídeo copiado, áudio AAC 192 kb/s, {dur:.2f} s)", silencioso)


def mixar(ep: Path, linha: dict, video: Path | None, saida: Path | None, so_audio: Path | None, semente: int, silencioso: bool) -> dict:
    roteiro = carregar_json(ep / "roteiro.json")
    medidas = carregar_json(ep / "medidas.json") if (ep / "medidas.json").exists() else {}
    falas_rot = {f["id"]: f for f in roteiro["falas"]}
    total = float(linha["duracao_total_s"])
    n = int(round(total * SR))

    pasta_cam = ep / "audio" / "camadas"
    if not (pasta_cam / "ambiente.wav").exists():
        falar("Camadas não encontradas: sintetizando agora.", silencioso)
        from sintetizar import gerar_camadas
        gerar_camadas(linha, pasta_cam, semente, silencioso)

    voz = np.zeros(n, dtype=np.float32)
    relatorio_falas = []
    for f in linha["falas"]:
        fr = falas_rot.get(f["id"])
        if not fr:
            falar(f"  fala {f['id']} está na linha do tempo mas não no roteiro; pulei", silencioso)
            continue
        caminho = ep / "audio" / "falas" / f"{f['id']}.wav"
        if not caminho.exists():
            relatorio_falas.append({"id": f["id"], "erro": "arquivo de voz não existe"})
            falar(f"  FALTA a voz {f['id']} ({caminho.name})", silencioso)
            continue
        y, antecipacao, info = preparar_fala(ep, f, fr, medidas.get(f["id"]), semente)
        colocar(voz, y, float(f["inicio_s"]) - antecipacao)
        info["inicio_s"] = float(f["inicio_s"])
        relatorio_falas.append(info)

    ambiente = ler_camada(pasta_cam / "ambiente.wav", n)
    efeitos = ler_camada(pasta_cam / "efeitos.wav", n)
    tensao = ler_camada(pasta_cam / "tensao.wav", n)
    g_amb = ganho_ducking(voz, DUCK_AMBIENTE_DB)
    g_ten = ganho_ducking(voz, DUCK_TENSAO_DB)
    mistura = voz + ambiente * g_amb + efeitos + tensao * g_ten
    p = pico(mistura)
    if p > 0.98:
        mistura = mistura * (0.98 / p)

    tmpdir = Path(tempfile.mkdtemp(prefix="mix_"))
    raw = tmpdir / "mistura.f32"
    # ganho linear até o alvo de loudness, depois o limitador segura só os picos que sobram
    # (até 3 rodadas: o limitador tira um pouco de loudness, então mede de novo e corrige)
    ganho_total_db, reducao_db, pre = 0.0, 0.0, {}
    for rodada in range(3):
        escrever_raw_f32(raw, mistura)
        pre = medir_loudness_ffmpeg_raw(raw)
        if pre.get("input_i") is None:
            break
        ganho_db = ALVO_LUFS - pre["input_i"]
        if abs(ganho_db) < 0.25:
            break
        mistura = (mistura * db_para_ganho(ganho_db)).astype(np.float32)
        mistura, red = limitar_picos(mistura)
        ganho_total_db += ganho_db
        reducao_db = max(reducao_db, red)
    falar(f"pré-mixagem: ganho linear {ganho_total_db:+.2f} dB, limitador segurou até {reducao_db} dB, agora {pre.get('input_i')} LUFS / pico {pre.get('input_tp')} dBTP", silencioso)
    escrever_raw_f32(raw, mistura)
    ganho_db = ganho_total_db
    mix_wav = so_audio if so_audio else (ep / "mix.wav")
    medidas_loud = loudnorm_duas_passagens(raw, mix_wav, silencioso)
    medidas_loud["ganho_linear_db"] = round(ganho_db, 2)
    medidas_loud["limitador_reducao_max_db"] = reducao_db
    try:
        os.unlink(raw)
    except OSError:
        pass

    resultado = {"duracao_total_s": total, "falas": relatorio_falas, "ducking_db": {"ambiente": DUCK_AMBIENTE_DB, "tensao": DUCK_TENSAO_DB},
                 "mix_wav": str(mix_wav), "loudnorm": medidas_loud, "video": None, "saida": None}
    if video and video.exists() and saida:
        muxar(video, mix_wav, saida, silencioso)
        resultado["video"] = str(video)
        resultado["saida"] = str(saida)
        try:
            from medir import medir_arquivo, imprimir
            med = medir_arquivo(saida, linha)
            resultado["medido"] = med
            if not silencioso:
                imprimir(med)
        except Exception as e:  # pragma: no cover
            falar(f"Não consegui medir o MP4 final: {e}", silencioso)
    elif video and not video.exists():
        falar(f"Vídeo mudo não encontrado ({video}); gerei só o áudio em {mix_wav}.", silencioso)
    salvar_json(ep / "audio" / "mixagem.json", resultado)
    return resultado


def main() -> None:
    ap = argparse.ArgumentParser(description="Mixa falas, ambiente, efeitos e tensão e junta com o vídeo mudo.")
    ap.add_argument("--episodio", required=True)
    ap.add_argument("--video", default="video_mudo.mp4", help="caminho (relativo ao episódio ou absoluto)")
    ap.add_argument("--saida", default=None, help="padrão: <episodio>/epNN.mp4")
    ap.add_argument("--linha-do-tempo", default=None)
    ap.add_argument("--so-audio", default=None, help="gera só o WAV mixado neste caminho")
    ap.add_argument("--semente", type=int, default=None)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    ep = resolver_episodio(args.episodio)
    caminho_linha = Path(args.linha_do_tempo) if args.linha_do_tempo else ep / "linha_do_tempo.json"
    if not caminho_linha.exists():
        sys.exit(f"Linha do tempo não encontrada: {caminho_linha}")
    linha = carregar_json(caminho_linha)
    canal = carregar_canal()
    semente = args.semente if args.semente is not None else int(canal.get("estilo", {}).get("semente", 7))
    video = Path(args.video)
    if not video.is_absolute():
        video = (ep / args.video) if (ep / args.video).exists() or not Path(args.video).exists() else Path(args.video).resolve()
    numero = carregar_json(ep / "roteiro.json").get("numero", 0)
    saida = Path(args.saida) if args.saida else ep / f"ep{int(numero):02d}.mp4"
    if not saida.is_absolute() and args.saida:
        saida = (ep / args.saida)
    so_audio = Path(args.so_audio) if args.so_audio else None
    if so_audio and not so_audio.is_absolute():
        so_audio = ep / so_audio
    res = mixar(ep, linha, None if so_audio else video, None if so_audio else saida, so_audio, semente, args.json)
    if args.json:
        print(json.dumps(res, ensure_ascii=False))


if __name__ == "__main__":
    main()
