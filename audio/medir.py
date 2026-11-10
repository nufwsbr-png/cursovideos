#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mede um vídeo ou áudio pronto (capítulos 64 e 66): formato, duração, LUFS integrado, pico
verdadeiro, volume médio e a banda de voz (300–3000 Hz) com e sem fala.

Uso:
  python3 audio/medir.py --arquivo ep01.mp4 [--linha-do-tempo linha_do_tempo.json] [--json]

Veredito da voz: "voz se destaca" quando a banda de voz nos trechos com fala fica pelo menos
6 dB acima dos trechos sem fala. É uma medida, não um ouvido: ouça sempre com fones e no celular.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _comum import (carregar_canal, carregar_json, dbfs, energia_por_banda, envelope_rms, extrair_audio_ffmpeg,  # noqa: E402
                    ffprobe_json, filtrar_banda, medir_loudness_ffmpeg, pico, rms)

SR = 48000
PASSO = 0.05


def _fps(stream: dict) -> float | None:
    for chave in ("avg_frame_rate", "r_frame_rate"):
        v = stream.get(chave)
        if v and "/" in v:
            a, b = v.split("/")
            if float(b) > 0:
                return round(float(a) / float(b), 3)
    return None


def medir_arquivo(arquivo, linha: dict | None = None) -> dict:
    info = ffprobe_json(arquivo)
    fmt = info.get("format", {})
    saida = {"arquivo": str(arquivo), "formato": fmt.get("format_name"), "duracao_s": round(float(fmt.get("duration", 0) or 0), 3),
             "tamanho_mb": round(float(fmt.get("size", 0) or 0) / 1e6, 2), "video": None, "audio": None}
    for s in info.get("streams", []):
        if s.get("codec_type") == "video" and saida["video"] is None:
            saida["video"] = {"codec": s.get("codec_name"), "largura": s.get("width"), "altura": s.get("height"), "fps": _fps(s), "pix_fmt": s.get("pix_fmt")}
        if s.get("codec_type") == "audio" and saida["audio"] is None:
            saida["audio"] = {"codec": s.get("codec_name"), "taxa": int(s.get("sample_rate", 0) or 0), "canais": s.get("channels")}
    if saida["audio"] is None:
        saida["aviso"] = "arquivo sem trilha de áudio"
        return saida

    loud = medir_loudness_ffmpeg(arquivo)
    saida["lufs_integrado"] = loud.get("input_i")
    saida["pico_verdadeiro_dbtp"] = loud.get("input_tp")
    saida["faixa_de_loudness_lra"] = loud.get("input_lra")

    x = extrair_audio_ffmpeg(arquivo, SR)
    saida["volume_medio_dbfs"] = round(dbfs(rms(x)), 2)
    saida["pico_amostra_dbfs"] = round(dbfs(pico(x)), 2)
    aud = (carregar_canal() or {}).get("audio", {})
    alvo, tol, teto = float(aud.get("lufs_alvo", -14.0)), float(aud.get("lufs_tolerancia", 1.0)), float(aud.get("pico_max_dbtp", -1.0))
    saida["alvo_lufs"] = alvo
    saida["ok_lufs"] = loud.get("input_i") is not None and alvo - tol <= loud["input_i"] <= alvo + tol
    saida["ok_pico"] = loud.get("input_tp") is not None and loud["input_tp"] <= teto + 0.05
    # assinatura do som (a mesma medida feita na referência): zumbido grave, nunca silêncio, voz × fundo
    fim_perg = (linha or {}).get("pergunta", {}) or {}
    saida["bandas"] = energia_por_banda(x, SR, (linha or {}).get("falas"), None)
    saida["bandas"]["fim_considerado_s"] = fim_perg.get("fim_s")

    banda = filtrar_banda(x, SR, 300, 3000)
    env = envelope_rms(banda, SR, PASSO)
    env_db = 20 * np.log10(np.maximum(env, 1e-9))
    tempos = (np.arange(env.size) + 0.5) * PASSO
    if linha and linha.get("falas"):
        com = np.zeros(env.size, dtype=bool)
        perto = np.zeros(env.size, dtype=bool)
        por_fala = []
        for f in linha["falas"]:
            a, b = float(f["inicio_s"]), float(f["fim_s"])
            sel = (tempos >= a + 0.1) & (tempos <= b - 0.1)
            com |= sel
            perto |= (tempos >= a - 0.3) & (tempos <= b + 0.5)
            if np.any(sel):
                nivel = 10 * math.log10(float(np.mean(env[sel] ** 2)) + 1e-18)
                por_fala.append({"id": f["id"], "banda_voz_dbfs": round(nivel, 1)})
        sem = ~perto
        nivel_com = 10 * math.log10(float(np.mean(env[com] ** 2)) + 1e-18) if np.any(com) else None
        nivel_sem = 10 * math.log10(float(np.mean(env[sem] ** 2)) + 1e-18) if np.any(sem) else None
        dif = (nivel_com - nivel_sem) if (nivel_com is not None and nivel_sem is not None) else None
        encobertas = [pf["id"] for pf in por_fala if nivel_sem is not None and pf["banda_voz_dbfs"] < nivel_sem + 6]
        saida["banda_de_voz"] = {"com_fala_dbfs": None if nivel_com is None else round(nivel_com, 1),
                                 "sem_fala_dbfs": None if nivel_sem is None else round(nivel_sem, 1),
                                 "diferenca_db": None if dif is None else round(dif, 1),
                                 "veredito": ("voz se destaca" if (dif is not None and dif >= 6) else "voz pode estar encoberta: vá ouvir"),
                                 "falas_possivelmente_encobertas": encobertas, "por_fala": por_fala}
    else:
        saida["banda_de_voz"] = {"nivel_medio_dbfs": round(10 * math.log10(float(np.mean(env ** 2)) + 1e-18), 1),
                                 "veredito": "sem linha do tempo: não dá para separar com e sem fala"}
    return saida


def imprimir(m: dict) -> None:
    print(f"Arquivo: {m['arquivo']}")
    print(f"Formato: {m.get('formato')} · duração {m.get('duracao_s')} s · {m.get('tamanho_mb')} MB")
    if m.get("video"):
        v = m["video"]
        print(f"Vídeo: {v['codec']} {v['largura']}x{v['altura']} @ {v['fps']} fps ({v['pix_fmt']})")
    if m.get("audio"):
        a = m["audio"]
        print(f"Áudio: {a['codec']} {a['taxa']} Hz, {a['canais']} canal(is)")
    if "lufs_integrado" in m:
        print(f"Loudness: {m['lufs_integrado']} LUFS (alvo {m.get('alvo_lufs')}) {'OK' if m['ok_lufs'] else 'FORA'} · pico verdadeiro {m['pico_verdadeiro_dbtp']} dBTP (teto -1) {'OK' if m['ok_pico'] else 'FORA'} · LRA {m['faixa_de_loudness_lra']}")
        print(f"Volume médio {m['volume_medio_dbfs']} dBFS · pico de amostra {m['pico_amostra_dbfs']} dBFS")
    bd = m.get("bandas") or {}
    if bd:
        print(f"Grave 20–80 Hz: {bd.get('fracao_20_80')} da energia · picos {bd.get('picos_graves_hz')} Hz · nível por segundo p10 {bd.get('nivel_1s_p10_db')} / p90 {bd.get('nivel_1s_p90_db')} dB · trechos abaixo de -40 dB: {len(bd.get('trechos_abaixo_40db', []))}")
    b = m.get("banda_de_voz") or {}
    if "diferenca_db" in b:
        print(f"Banda de voz: com fala {b['com_fala_dbfs']} dBFS · sem fala {b['sem_fala_dbfs']} dBFS · diferença {b['diferenca_db']} dB → {b['veredito']}")
        if b.get("falas_possivelmente_encobertas"):
            print(f"  Falas para ouvir com atenção: {', '.join(b['falas_possivelmente_encobertas'])}")
    elif b:
        print(f"Banda de voz: {b.get('veredito')}")
    if m.get("aviso"):
        print("AVISO: " + m["aviso"])


def main() -> None:
    ap = argparse.ArgumentParser(description="Mede formato, loudness e banda de voz de um vídeo/áudio.")
    ap.add_argument("--arquivo", required=True)
    ap.add_argument("--linha-do-tempo", default=None)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    linha = carregar_json(args.linha_do_tempo) if args.linha_do_tempo else None
    m = medir_arquivo(args.arquivo, linha)
    if args.json:
        print(json.dumps(m, ensure_ascii=False))
    else:
        imprimir(m)


if __name__ == "__main__":
    main()
