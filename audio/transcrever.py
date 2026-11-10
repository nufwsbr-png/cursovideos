#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Transcreve o VÍDEO PRONTO e prova, fala por fala e na ordem, que o texto do roteiro está lá
(capítulo 66: "uma fala pode sumir na montagem sem ninguém notar").

Usa faster-whisper só com modelo já baixado (sem internet aqui). Quando não há modelo, devolve
`conferido_por: "nao_conferido"` e explica como instalar. Transcrição é alerta, não prova:
uma fala "duvidosa" quer dizer "vá ouvir esse trecho".

Uso:
  python3 audio/transcrever.py --arquivo ep01.mp4 --roteiro roteiro.json [--json]
"""
from __future__ import annotations

import argparse
import difflib
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import numpy as np  # noqa: E402

from _comum import carregar_json, ler_wav, normalizar_texto  # noqa: E402

COMO_INSTALAR = ("Para conferir por transcrição, no seu computador com internet rode uma vez:\n"
                 "  pip install faster-whisper\n"
                 "  python3 -c \"from faster_whisper import WhisperModel; WhisperModel('small')\"\n"
                 "Depois a fábrica passa a transcrever sozinha (variável WHISPER_MODELO muda o tamanho do modelo).")


def carregar_modelo():
    if os.environ.get("WHISPER_DESLIGADO") == "1":
        return None, "WHISPER_DESLIGADO=1"
    try:
        from faster_whisper import WhisperModel  # type: ignore
    except Exception as e:
        return None, f"faster-whisper não instalado ({e.__class__.__name__})"
    nome = os.environ.get("WHISPER_MODELO", "small")
    try:
        return WhisperModel(nome, device="cpu", compute_type="int8", local_files_only=True), None
    except Exception as e:
        return None, f"modelo '{nome}' não está baixado ({e.__class__.__name__})"


def extrair_wav_16k(arquivo: str) -> str:
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", arquivo, "-vn", "-ac", "1", "-ar", "16000", tmp.name], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("ffmpeg não conseguiu extrair o áudio: " + r.stderr[-300:])
    return tmp.name


def transcrever(modelo, wav: str) -> list[dict]:
    # o áudio vai já decodificado (16 kHz mono, extraído pelo ffmpeg): não depende do PyAV, que muda a API entre versões
    # (faster-whisper 1.2.1 com PyAV 19 falhava: "open() got an unexpected keyword argument 'metadata_errors'", 2026-11-10)
    x, taxa = ler_wav(wav)
    if taxa != 16000:
        raise ValueError(f"o Whisper espera 16 kHz e veio {taxa} Hz")
    segmentos, _ = modelo.transcribe(np.asarray(x, dtype=np.float32), language="pt", beam_size=5, word_timestamps=True, vad_filter=False)
    tokens = []
    for s in segmentos:
        palavras = getattr(s, "words", None) or []
        if palavras:
            for w in palavras:
                for tk in normalizar_texto(w.word).split():
                    tokens.append({"tok": tk, "t": float(w.start)})
        else:
            for tk in normalizar_texto(s.text).split():
                tokens.append({"tok": tk, "t": float(s.start)})
    return tokens


def casar_falas(roteiro: dict, tokens: list[dict]) -> dict:
    seq = [t["tok"] for t in tokens]
    cursor = 0
    encontradas, duvidosas, faltando = [], [], []
    for fala in roteiro["falas"]:
        alvo = normalizar_texto(fala["texto"]).split()
        if not alvo:
            continue
        melhor = (0.0, None, None)
        for tam in range(max(1, len(alvo) - 2), len(alvo) + 4):
            for ini in range(cursor, max(cursor, len(seq) - tam + 1)):
                janela = seq[ini:ini + tam]
                r = difflib.SequenceMatcher(None, alvo, janela).ratio()
                if r > melhor[0]:
                    melhor = (r, ini, ini + tam)
                if r > 0.98:
                    break
            if melhor[0] > 0.98:
                break
        razao, ini, fim = melhor
        item = {"id": fala["id"], "quem": fala.get("quem"), "texto": fala["texto"], "semelhanca": round(razao, 2),
                "t_s": (round(tokens[ini]["t"], 2) if ini is not None and ini < len(tokens) else None),
                "ouvido": (" ".join(seq[ini:fim]) if ini is not None else "")}
        if razao >= 0.8:
            encontradas.append(item)
            cursor = fim
        elif razao >= 0.55:
            duvidosas.append(item)
            cursor = fim
        else:
            faltando.append(item)
    return {"encontradas": encontradas, "duvidosas": duvidosas, "faltando": faltando}


def main() -> None:
    ap = argparse.ArgumentParser(description="Prova por transcrição que as falas do roteiro estão no vídeo pronto.")
    ap.add_argument("--arquivo", required=True)
    ap.add_argument("--roteiro", required=True)
    ap.add_argument("--so", default=None, help="confere só estas falas (ids separados por vírgula), ex.: as que têm voz de verdade")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    roteiro = carregar_json(args.roteiro)
    if args.so:
        ids = {i.strip() for i in args.so.split(",") if i.strip()}
        roteiro = {**roteiro, "falas": [f for f in roteiro.get("falas", []) if f.get("id") in ids]}
    modelo, motivo = carregar_modelo()
    if not modelo:
        saida = {"conferido_por": "nao_conferido", "motivo": motivo, "como_resolver": COMO_INSTALAR,
                 "falas_no_roteiro": len(roteiro.get("falas", [])), "encontradas": [], "duvidosas": [], "faltando": []}
        if args.json:
            print(json.dumps(saida, ensure_ascii=False))
        else:
            print(f"Transcrição NÃO conferida: {motivo}.\n{COMO_INSTALAR}")
        return
    wav = extrair_wav_16k(args.arquivo)
    try:
        tokens = transcrever(modelo, wav)
    finally:
        try:
            os.unlink(wav)
        except OSError:
            pass
    res = casar_falas(roteiro, tokens)
    res.update({"conferido_por": "whisper", "transcricao": " ".join(t["tok"] for t in tokens), "falas_no_roteiro": len(roteiro.get("falas", []))})
    if args.json:
        print(json.dumps(res, ensure_ascii=False))
        return
    print(f"Falas no roteiro: {res['falas_no_roteiro']} · encontradas {len(res['encontradas'])} · duvidosas {len(res['duvidosas'])} · faltando {len(res['faltando'])}")
    for grupo, titulo in (("duvidosas", "DUVIDOSAS (vá ouvir)"), ("faltando", "FALTANDO")):
        if res[grupo]:
            print(titulo + ":")
            for it in res[grupo]:
                print(f"  {it['id']} {it['quem']}: pedido {it['texto']!r} · ouvido {it['ouvido']!r} ({it['semelhanca']})")
    if not res["duvidosas"] and not res["faltando"]:
        print("Todas as falas foram encontradas, na ordem. (Transcrição é alerta, não prova: ouça o vídeo inteiro.)")


if __name__ == "__main__":
    main()
