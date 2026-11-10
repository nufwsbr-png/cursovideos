#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mixagem: a voz manda (capítulo 64).

1. Coloca cada fala em `linha_do_tempo.falas[].inicio_s`, com o filtro dela (telefone, rádio, alto-falante).
2. Iguala as vozes pela faixa da voz (300–3000 Hz, a mesma da prova), não pela faixa inteira: alvo -22 dBFS
   (sussurro -24; grito -20), de novo depois do filtro (telefone, rádio e alto-falante não saem mais quentes);
   pico limitado.
3. Abaixa ambiente (-7 dB) e tensão (-4 dB) enquanto alguém fala (ataque 150 ms, soltura 400 ms).
4. Soma os efeitos e o zumbido grave (calibrado para 84 % da energia em 20–80 Hz) e leva ao alvo do canal
   (`canal.json → audio.lufs_alvo`, -14 LUFS) com limitador de picos e loudnorm linear.
4b. Piso da voz: toda fala fica >= fundo sem fala + 6 dB na faixa da voz (o critério da prova,
   `medir.banda_de_voz`). A que fica abaixo sobe o que falta (até +4 dB) e a mixagem é refeita (até 3 rodadas).
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
                    salvar_json, suavizar_ataque_soltura, filtrar_banda)
from filtros import aplicar_filtro  # noqa: E402
from medir import CRITERIO_VOZ_DB, banda_de_voz  # noqa: E402

SR = 48000
ALVO_VOZ_DBFS = -22.0           # RMS da fala na faixa da voz, só onde há voz (até 2026-11-10: -20 na faixa inteira)
BANDA_VOZ_HZ = (300.0, 3000.0)  # a mesma faixa da prova (medir.banda_de_voz)
PISO_VOZ_SUBIDA_MAX_DB = 4.0    # o piso da voz sobe uma fala no máximo isto
DUCK_AMBIENTE_DB = -7.0
DUCK_TENSAO_DB = -4.0


def alvo_da_fala(estilo: str) -> float:
    e = (estilo or "").lower()
    if "whisper" in e or "sussur" in e or "barely audible" in e:
        return ALVO_VOZ_DBFS - 2.0
    if "shout" in e or "loud" in e or "grit" in e:
        return ALVO_VOZ_DBFS + 2.0
    return ALVO_VOZ_DBFS


def nivel_banda_voz(x: np.ndarray) -> float:
    """RMS (linear) da fala na faixa da voz, só nos blocos de 50 ms com voz (até 25 dB abaixo do mais forte)."""
    b = filtrar_banda(np.asarray(x, dtype=np.float32), SR, *BANDA_VOZ_HZ)
    env = envelope_rms(b, SR, 0.05)
    if env.size == 0 or float(env.max()) <= 1e-9:
        return 0.0
    ativo = env >= float(env.max()) * db_para_ganho(-25.0)
    return float(np.sqrt(np.mean(env[ativo] ** 2)))


def nivelar_fala(x: np.ndarray, alvo_dbfs: float) -> np.ndarray:
    """Leva a fala ao alvo pela faixa da voz (o que importa para entender), não pela faixa inteira: uma voz grave
    (muita energia abaixo de 300 Hz) e uma aguda ficam igualmente audíveis. Medido no Epi. 01 (2026-11-10): pela faixa
    inteira, as vozes graves ficavam 2–4 dB mais baixas na faixa da voz."""
    nivel = nivel_banda_voz(x)
    return np.asarray(x, dtype=np.float32) if nivel <= 0 else (x * (db_para_ganho(alvo_dbfs) / nivel)).astype(np.float32)


def preparar_fala(ep: Path, fala_tl: dict, fala_rot: dict, medida: dict | None, semente: int,
                  ganho_extra_db: float = 0.0) -> tuple[np.ndarray, float, dict]:
    caminho = ep / "audio" / "falas" / f"{fala_tl['id']}.wav"
    x, taxa = ler_wav(caminho)
    x = reamostrar(x, taxa, SR)
    alvo = alvo_da_fala(fala_rot.get("estilo", "")) + float(ganho_extra_db)
    # mede só a parte com voz (das medidas), quando houver
    if medida and medida.get("fim_voz_s"):
        a, b = int(float(medida["inicio_voz_s"]) * SR), min(int(float(medida["fim_voz_s"]) * SR), x.size)
        nivel = nivel_banda_voz(x[a:b]) if b > a else nivel_banda_voz(x)
    else:
        nivel = nivel_banda_voz(x)
    if nivel > 0:
        x = (x * (db_para_ganho(alvo) / nivel)).astype(np.float32)
    filtro = fala_tl.get("filtro") or fala_rot.get("filtro")
    y, antecipacao = aplicar_filtro(x, SR, filtro, semente + int(fala_tl["id"].lstrip("f") or 0))
    # o filtro muda o nível (o alto-falante saía 8 dB mais quente): iguala de novo na faixa da voz
    if filtro and filtro != "null":
        y = nivelar_fala(y, alvo)
    # limita o pico em -3 dBFS
    p = pico(y)
    teto = db_para_ganho(-3.0)
    if p > teto:
        y = np.tanh(y / p * 1.5) / math.tanh(1.5) * teto
    info = {"id": fala_tl["id"], "quem": fala_tl.get("quem"), "filtro": fala_tl.get("filtro"), "alvo_banda_dbfs": round(alvo, 1),
            "banda_final_dbfs": round(dbfs(nivel_banda_voz(y)), 1), "rms_final_dbfs": round(dbfs(rms(y)), 1),
            "pico_final_dbfs": round(dbfs(pico(y)), 1), "duracao_s": round(y.size / SR, 3)}
    if ganho_extra_db:
        info["piso_voz_db"] = round(float(ganho_extra_db), 1)
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
ALVO_LUFS = -14.0          # o da referência (medido em 2026-11-10: -14,1 LUFS); canal.json → audio.lufs_alvo manda


def energias_banda(x: np.ndarray, lo: float = 20.0, hi: float = 80.0) -> tuple[float, float]:
    """(energia total acima de 20 Hz, energia em lo–hi Hz) pelo espectro do sinal inteiro."""
    P = np.abs(np.fft.rfft(x.astype(np.float64))) ** 2
    f = np.fft.rfftfreq(x.size, 1 / SR)
    return float(P[f > 20].sum()), float(P[(f >= lo) & (f < hi)].sum())


def ganho_do_drone(outros: np.ndarray, drone: np.ndarray, alvo: float) -> float:
    """Ganho do zumbido para a faixa 20–80 Hz ficar com `alvo` da energia da mistura (sinais sem correlação):
    g² = (alvo·E_o − E_o,banda) / (E_d,banda − alvo·E_d)."""
    eo, eob = energias_banda(outros)
    ed, edb = energias_banda(drone)
    den = edb - alvo * ed
    if den <= 1e-12 or ed <= 1e-12:
        return 1.0
    g2 = (alvo * eo - eob) / den
    return float(math.sqrt(max(g2, 0.0)))


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


def loudnorm_duas_passagens(raw_f32: Path, saida_wav: Path, silencioso: bool, alvo: float = ALVO_LUFS) -> dict:
    entrada = ["-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", str(raw_f32)]
    p1 = subprocess.run(["ffmpeg", "-v", "info", "-nostats", *entrada, "-af", f"loudnorm=I={alvo}:TP=-1:LRA=11:print_format=json", "-f", "null", "-"],
                        capture_output=True, text=True)
    txt = p1.stderr
    ini, fim = txt.rfind("{"), txt.rfind("}")
    if ini < 0:
        raise RuntimeError("loudnorm (passagem 1) não devolveu JSON:\n" + txt[-500:])
    m = json.loads(txt[ini:fim + 1])
    filtro = ("loudnorm=I={alvo}:TP=-1.5:LRA=11:measured_I={input_i}:measured_TP={input_tp}:measured_LRA={input_lra}:"
              "measured_thresh={input_thresh}:offset={target_offset}:linear=true:print_format=json").format(alvo=alvo, **m)
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

    canal = carregar_canal(ep) or {}
    aud = canal.get("audio", {})
    alvo_lufs = float(aud.get("lufs_alvo", ALVO_LUFS))
    duck = aud.get("ducking_db", {})
    duck_amb, duck_ten = float(duck.get("ambiente", DUCK_AMBIENTE_DB)), float(duck.get("tensao", -3.0))
    pasta_cam = ep / "audio" / "camadas"
    if not (pasta_cam / "ambiente.wav").exists() or not (pasta_cam / "drone.wav").exists():
        falar("Camadas não encontradas (ou sem o zumbido grave): sintetizando agora.", silencioso)
        from sintetizar import gerar_camadas
        gerar_camadas(linha, pasta_cam, semente, silencioso, aud)

    ambiente = ler_camada(pasta_cam / "ambiente.wav", n)
    efeitos = ler_camada(pasta_cam / "efeitos.wav", n)
    tensao = ler_camada(pasta_cam / "tensao.wav", n)
    drone = ler_camada(pasta_cam / "drone.wav", n)
    cfg_drone = aud.get("drone", {})
    alvo_banda = float(cfg_drone.get("fracao_20_80_alvo", 0.84))
    tmpdir = Path(tempfile.mkdtemp(prefix="mix_"))
    raw = tmpdir / "mistura.f32"

    def montar_voz(ganhos: dict) -> tuple[np.ndarray, list]:
        voz = np.zeros(n, dtype=np.float32)
        relatorio = []
        for f in linha["falas"]:
            fr = falas_rot.get(f["id"])
            if not fr:
                falar(f"  fala {f['id']} está na linha do tempo mas não no roteiro; pulei", silencioso)
                continue
            caminho = ep / "audio" / "falas" / f"{f['id']}.wav"
            if not caminho.exists():
                relatorio.append({"id": f["id"], "erro": "arquivo de voz não existe"})
                falar(f"  FALTA a voz {f['id']} ({caminho.name})", silencioso)
                continue
            y, antecipacao, info = preparar_fala(ep, f, fr, medidas.get(f["id"]), semente, float(ganhos.get(f["id"], 0.0)))
            colocar(voz, y, float(f["inicio_s"]) - antecipacao)
            info["inicio_s"] = float(f["inicio_s"])
            relatorio.append(info)
        return voz, relatorio

    def mixar_uma_vez(voz: np.ndarray) -> dict:
        g_amb = ganho_ducking(voz, duck_amb)
        g_ten = ganho_ducking(voz, duck_ten)
        outros = voz + ambiente * g_amb + efeitos + tensao * g_ten
        # o zumbido grave não abaixa com a fala (está fora da faixa da voz) e é calibrado para a assinatura da referência
        g_drone = ganho_do_drone(outros, drone, alvo_banda) if np.any(drone) else 0.0
        mistura = outros + drone * g_drone
        et, eb = energias_banda(mistura)
        fracao = eb / max(et, 1e-30)
        p = pico(mistura)
        if p > 0.98:
            mistura = mistura * (0.98 / p)
        # ganho linear até o alvo de loudness, depois o limitador segura só os picos que sobram
        # (até 3 rodadas: o limitador tira um pouco de loudness, então mede de novo e corrige)
        ganho_total_db, reducao_db, pre = 0.0, 0.0, {}
        for rodada in range(3):
            escrever_raw_f32(raw, mistura)
            pre = medir_loudness_ffmpeg_raw(raw)
            if pre.get("input_i") is None:
                break
            ganho_db = alvo_lufs - pre["input_i"]
            if abs(ganho_db) < 0.25:
                break
            mistura = (mistura * db_para_ganho(ganho_db)).astype(np.float32)
            mistura, red = limitar_picos(mistura)
            ganho_total_db += ganho_db
            reducao_db = max(reducao_db, red)
        return {"mistura": mistura, "g_drone": g_drone, "fracao": fracao, "ganho_total_db": ganho_total_db,
                "reducao_db": reducao_db, "pre": pre}

    voz, relatorio_falas = montar_voz({})
    m = mixar_uma_vez(voz)
    # piso da voz, com o mesmo critério da prova: a fala a menos de 6 dB do fundo (faixa da voz) sobe o que falta.
    # O limitador e a calibração do zumbido comem parte da subida (medido no Epi. 01: 60–70 % fica), então são até
    # 3 rodadas, somando, com teto de +4 dB por fala.
    ajustes: dict = {}
    piso = banda_de_voz(m["mistura"], SR, linha.get("falas"))
    for rodada_piso in range(3):
        margens = {pf["id"]: pf.get("margem_db") for pf in piso.get("por_fala", [])}
        novos = {}
        for i in piso.get("falas_possivelmente_encobertas", []):
            if margens.get(i) is None:
                continue
            alvo = round(min(PISO_VOZ_SUBIDA_MAX_DB, ajustes.get(i, 0.0) + CRITERIO_VOZ_DB - margens[i] + 0.5), 1)
            if alvo > ajustes.get(i, 0.0) + 0.05:
                novos[i] = alvo
        if not novos:
            break
        ajustes.update(novos)
        falar(f"piso da voz (rodada {rodada_piso + 1}): {len(novos)} fala(s) a menos de {CRITERIO_VOZ_DB:g} dB do fundo na faixa da voz"
              " → subindo " + ", ".join(f"{i} {g:+.1f} dB" for i, g in novos.items()), silencioso)
        voz, relatorio_falas = montar_voz(ajustes)
        m = mixar_uma_vez(voz)
        piso = banda_de_voz(m["mistura"], SR, linha.get("falas"))
    ainda_abaixo = piso.get("falas_possivelmente_encobertas", [])
    if ainda_abaixo:
        falar(f"piso da voz: ainda abaixo depois de subir (vá ouvir): {', '.join(ainda_abaixo)}", silencioso)
    mistura, g_drone, fracao = m["mistura"], m["g_drone"], m["fracao"]
    ganho_total_db, reducao_db, pre = m["ganho_total_db"], m["reducao_db"], m["pre"]
    falar(f"pré-mixagem: ganho linear {ganho_total_db:+.2f} dB, limitador segurou até {reducao_db} dB, agora {pre.get('input_i')} LUFS / pico {pre.get('input_tp')} dBTP", silencioso)
    escrever_raw_f32(raw, mistura)
    ganho_db = ganho_total_db
    mix_wav = so_audio if so_audio else (ep / "mix.wav")
    medidas_loud = loudnorm_duas_passagens(raw, mix_wav, silencioso, alvo_lufs)
    medidas_loud["ganho_linear_db"] = round(ganho_db, 2)
    medidas_loud["limitador_reducao_max_db"] = reducao_db
    try:
        os.unlink(raw)
    except OSError:
        pass

    falar(f"zumbido grave: ganho {20 * math.log10(max(g_drone, 1e-9)):+.1f} dB → 20–80 Hz com {fracao:.3f} da energia (alvo {alvo_banda})", silencioso)
    resultado = {"duracao_total_s": total, "falas": relatorio_falas, "ducking_db": {"ambiente": duck_amb, "tensao": duck_ten},
                 "drone": {"ganho_db": round(20 * math.log10(max(g_drone, 1e-9)), 2), "fracao_20_80": round(fracao, 3), "alvo": alvo_banda}, "alvo_lufs": alvo_lufs,
                 "voz": {"nivelamento": "faixa da voz 300–3000 Hz", "alvo_banda_dbfs": ALVO_VOZ_DBFS},
                 "piso_voz": {"criterio_db": CRITERIO_VOZ_DB, "ajustes_db": ajustes, "ainda_abaixo": ainda_abaixo,
                              "por_fala": piso.get("por_fala")},
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
    canal = carregar_canal(ep)
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
