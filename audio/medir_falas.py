#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mede cada fala gerada (capítulo 50: "conferir sem ficar louco") e grava `medidas.json`.

Para cada `audio/falas/fNN.wav`:
- duração, início e fim da voz (limiar -40 dB relativo ao pico, com histerese de 5 dB),
- RMS e pico em dBFS,
- envelope RMS por janela de 50 ms, normalizado 0..1 (a boca dos bonecos segue isto),
- transcrição com faster-whisper quando o modelo estiver disponível localmente
  (`WHISPER_MODELO`, padrão "small"; `WHISPER_DESLIGADO=1` desliga), comparação com o
  texto pedido e um resumo curto das diferenças.

Transcrição é ALERTA, não prova: diferença quer dizer "vá ouvir", não "está errado".

Uso:
  python3 audio/medir_falas.py --episodio episodios/ep01_x [--json] [--sem-whisper]
"""
from __future__ import annotations

import argparse
import difflib
import json
import math
import os
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _comum import (agora_iso, carregar_json, dbfs, envelope_rms, falar, ler_wav, normalizar_texto, pico,  # noqa: E402
                    resolver_episodio, rms, salvar_json)

PASSO_ENVELOPE_S = 0.05


def carregar_whisper(silencioso: bool):
    """Tenta carregar o faster-whisper só com arquivos locais. Devolve (modelo, motivo_se_nao)."""
    if os.environ.get("WHISPER_DESLIGADO") == "1":
        return None, "WHISPER_DESLIGADO=1"
    try:
        from faster_whisper import WhisperModel  # type: ignore
    except Exception as e:  # pragma: no cover
        return None, f"faster-whisper não instalado ({e.__class__.__name__}). Instale com: pip install faster-whisper"
    nome = os.environ.get("WHISPER_MODELO", "small")
    try:
        modelo = WhisperModel(nome, device="cpu", compute_type="int8", local_files_only=True)
        return modelo, None
    except Exception as e:
        return None, (f"modelo '{nome}' não está baixado neste computador ({e.__class__.__name__}). "
                      f"Com internet, rode uma vez: python3 -c \"from faster_whisper import WhisperModel; WhisperModel('{nome}')\"")


def transcrever_arquivo(modelo, caminho: Path) -> str:
    segmentos, _info = modelo.transcribe(str(caminho), language="pt", beam_size=5, vad_filter=False)
    return " ".join(s.text.strip() for s in segmentos).strip()


def comparar(pedido: str, ouvido: str | None) -> tuple[bool | None, str | None]:
    if ouvido is None:
        return None, None
    a, b = normalizar_texto(pedido), normalizar_texto(ouvido)
    if a == b:
        return True, None
    razao = difflib.SequenceMatcher(None, a.split(), b.split()).ratio()
    if razao >= 0.9:
        return True, None
    sm = difflib.SequenceMatcher(None, a.split(), b.split())
    difs = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            continue
        pedaco_a = " ".join(a.split()[i1:i2]) or "∅"
        pedaco_b = " ".join(b.split()[j1:j2]) or "∅"
        difs.append(f"pedido '{pedaco_a}' / ouvido '{pedaco_b}'")
    return False, "; ".join(difs)[:300]


def medir_um(caminho: Path) -> dict:
    x, taxa = ler_wav(caminho)
    dur = x.size / taxa
    env = envelope_rms(x, taxa, PASSO_ENVELOPE_S)
    p = pico(x)
    env_db = 20 * np.log10(np.maximum(env, 1e-9) / max(p, 1e-9))
    # início: primeira janela acima de -40 dB (rel. ao pico) sustentada por 2 janelas
    ini_idx, fim_idx = None, None
    for i in range(env_db.size):
        if env_db[i] > -40 and (i + 1 >= env_db.size or env_db[i + 1] > -45):
            ini_idx = i
            break
    for i in range(env_db.size - 1, -1, -1):
        if env_db[i] > -45 and (i - 1 < 0 or env_db[i - 1] > -50 or env_db[i] > -40):
            fim_idx = i
            break
    inicio = (ini_idx * PASSO_ENVELOPE_S) if ini_idx is not None else 0.0
    fim = ((fim_idx + 1) * PASSO_ENVELOPE_S) if fim_idx is not None else dur
    fim = min(fim, dur)
    env_norm = (env / (env.max() + 1e-12)) if env.size else env
    return {
        "arquivo": None,  # preenchido pelo chamador (caminho relativo)
        "duracao_s": round(dur, 3),
        "inicio_voz_s": round(inicio, 3),
        "fim_voz_s": round(fim, 3),
        "rms_dbfs": round(dbfs(rms(x)), 2),
        "pico_dbfs": round(dbfs(p), 2),
        "envelope_passo_s": PASSO_ENVELOPE_S,
        "envelope": [round(float(v), 3) for v in env_norm],
        "taxa": taxa,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Mede as falas de um episódio e grava medidas.json.")
    ap.add_argument("--episodio", required=True)
    ap.add_argument("--json", action="store_true", help="imprime só o JSON")
    ap.add_argument("--sem-whisper", action="store_true")
    args = ap.parse_args()
    ep = resolver_episodio(args.episodio)
    roteiro = carregar_json(ep / "roteiro.json")
    pasta = ep / "audio" / "falas"
    origem_path = pasta / "origem.json"
    origem = carregar_json(origem_path) if origem_path.exists() else {}

    modelo, motivo = (None, "--sem-whisper") if args.sem_whisper else carregar_whisper(args.json)
    conferido_por = "whisper" if modelo else "nao_conferido"
    if not modelo:
        falar(f"Transcrição desligada: {motivo}", args.json)

    medidas = {}
    faltando = []
    for fala in roteiro["falas"]:
        fid = fala["id"]
        caminho = pasta / f"{fid}.wav"
        if not caminho.exists():
            faltando.append(fid)
            continue
        m = medir_um(caminho)
        m["arquivo"] = f"audio/falas/{fid}.wav"
        m["quem"] = fala.get("quem")
        m["texto_pedido"] = fala["texto"]
        m["provedor"] = origem.get(fid, {}).get("provedor", "desconhecido")
        if modelo:
            try:
                m["transcricao"] = transcrever_arquivo(modelo, caminho)
            except Exception as e:  # pragma: no cover
                m["transcricao"] = None
                falar(f"{fid}: erro ao transcrever ({e})", args.json)
        else:
            m["transcricao"] = None
        m["igual"], m["diferencas"] = comparar(fala["texto"], m["transcricao"])
        m["conferido_por"] = "whisper" if m["transcricao"] is not None else "nao_conferido"
        medidas[fid] = m

    medidas["conferido_por"] = conferido_por
    medidas["medido_em"] = agora_iso()
    medidas["faltando"] = faltando
    salvar_json(ep / "medidas.json", medidas)

    if args.json:
        print(json.dumps(medidas, ensure_ascii=False))
        return

    # tabela legível (capítulo 50)
    print(f"{'id':<5}{'quem':<13}{'dur':>6}{'rms':>8}{'pico':>7}{'ini':>6}{'fim':>6}  texto pedido → texto ouvido")
    for fid, m in medidas.items():
        if not fid.startswith("f") or not isinstance(m, dict):
            continue
        ouvido = m["transcricao"] if m["transcricao"] is not None else "(não conferido)"
        marca = "" if m["igual"] in (True, None) else "  ← DIFERENÇA, vá ouvir"
        print(f"{fid:<5}{str(m['quem'])[:12]:<13}{m['duracao_s']:>6.2f}{m['rms_dbfs']:>8.1f}{m['pico_dbfs']:>7.1f}"
              f"{m['inicio_voz_s']:>6.2f}{m['fim_voz_s']:>6.2f}  {m['texto_pedido'][:38]!r} → {ouvido[:38]!r}{marca}")
    if faltando:
        print(f"FALTANDO arquivos de voz: {', '.join(faltando)}")
    print(f"Conferido por: {conferido_por}. Gravado em {ep / 'medidas.json'}")
    falsos = [fid for fid, m in medidas.items() if isinstance(m, dict) and m.get("provedor") == "falso"]
    if falsos:
        print(f"AVISO: {len(falsos)} fala(s) com voz FALSA (não publicável).")


if __name__ == "__main__":
    main()
