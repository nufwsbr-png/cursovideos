#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Filtros de voz da fábrica: `telefone`, `radio`, `alto_falante` (e `None` = sem filtro).

Uso como módulo:
    from filtros import aplicar_filtro
    y, antecipacao_s = aplicar_filtro(x, taxa, "telefone", semente=7)

`antecipacao_s` é quanto o sinal filtrado começa ANTES da fala original (o alto-falante
tem um clique de 60 ms antes); a mixagem desloca a fala por esse valor.

Uso na linha de comando (para ouvir/testar um arquivo):
    python3 audio/filtros.py --entrada f06.wav --filtro alto_falante --saida teste.wav
"""
from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _comum import aplicar_reverb, escrever_wav, filtrar_banda, ler_wav, pico, saturar  # noqa: E402

FILTROS = ("telefone", "radio", "alto_falante")


def _clique(taxa: int, rng: np.random.Generator, ganho: float = 0.4) -> np.ndarray:
    n = int(0.06 * taxa)
    t = np.arange(n) / taxa
    estalo = rng.standard_normal(n) * np.exp(-t * 300.0)
    tom = np.sin(2 * math.pi * 1800 * t) * np.exp(-t * 120.0)
    y = filtrar_banda((estalo * 0.6 + tom * 0.5).astype(np.float32), taxa, 400, 6000)
    return (y * ganho).astype(np.float32)


def _compressor_simples(x: np.ndarray, taxa: int, limiar_db: float = -18.0, razao: float = 4.0) -> np.ndarray:
    """Compressão por blocos de 10 ms (sem loops longos)."""
    n = max(1, int(0.01 * taxa))
    total = int(math.ceil(x.size / n))
    pad = np.zeros(total * n, dtype=np.float64)
    pad[: x.size] = x
    bl = pad.reshape(total, n)
    nivel = 20 * np.log10(np.sqrt(np.mean(bl ** 2, axis=1)) + 1e-9)
    excesso = np.maximum(nivel - limiar_db, 0.0)
    ganho_db = -excesso * (1.0 - 1.0 / razao)
    # suaviza o ganho
    k = np.ones(5) / 5.0
    ganho_db = np.convolve(ganho_db, k, mode="same")
    ganho = 10 ** (ganho_db / 20.0)
    centros = (np.arange(total) + 0.5) * n
    g = np.interp(np.arange(x.size), centros, ganho, left=ganho[0], right=ganho[-1])
    return (x * g).astype(np.float32)


def filtro_telefone(x: np.ndarray, taxa: int, rng: np.random.Generator) -> np.ndarray:
    y = filtrar_banda(x, taxa, 300, 3400, oitavas_transicao=0.35)
    y = saturar(y * 1.6, 1.8) * 0.8
    ruido = filtrar_banda(rng.standard_normal(x.size).astype(np.float32), taxa, 300, 3400) * 0.004
    zumbido = np.sin(2 * math.pi * 60 * np.arange(x.size) / taxa) * 0.003
    return (y + ruido + zumbido).astype(np.float32)


def filtro_radio(x: np.ndarray, taxa: int, rng: np.random.Generator) -> np.ndarray:
    y = filtrar_banda(x, taxa, 400, 3000, oitavas_transicao=0.3)
    y = _compressor_simples(y, taxa, -22.0, 5.0)
    y = saturar(y * 2.2, 2.5) * 0.75
    estatica = filtrar_banda(rng.standard_normal(x.size).astype(np.float32), taxa, 1000, 5000)
    # crepitação: picos aleatórios esparsos
    mascara = (rng.random(x.size) < 0.0006).astype(np.float32)
    estalos = filtrar_banda((mascara * rng.standard_normal(x.size)).astype(np.float32), taxa, 2000, 7000) * 0.15
    return (y + estatica * 0.012 + estalos).astype(np.float32)


def filtro_alto_falante(x: np.ndarray, taxa: int, rng: np.random.Generator) -> np.ndarray:
    y = filtrar_banda(x, taxa, 250, 4000, oitavas_transicao=0.4)
    y = saturar(y * 1.5, 1.6) * 0.85
    y = aplicar_reverb(y, taxa, molhado=0.4, duracao_s=0.9, semente=int(rng.integers(1, 10_000)))
    y = y[: x.size + int(0.9 * taxa)]
    antes = _clique(taxa, rng, 0.35)
    depois = _clique(taxa, rng, 0.25)
    sil = np.zeros(int(0.05 * taxa), dtype=np.float32)
    return np.concatenate([antes, y, sil, depois]).astype(np.float32)


def aplicar_filtro(x: np.ndarray, taxa: int, nome: str | None, semente: int = 7) -> tuple[np.ndarray, float]:
    """Devolve (sinal filtrado, antecipação em segundos)."""
    if not nome or nome == "null":
        return x.astype(np.float32), 0.0
    rng = np.random.default_rng(semente)
    if nome == "telefone":
        return filtro_telefone(x, taxa, rng), 0.0
    if nome == "radio":
        return filtro_radio(x, taxa, rng), 0.0
    if nome == "alto_falante":
        return filtro_alto_falante(x, taxa, rng), 0.06
    raise ValueError(f"Filtro desconhecido: {nome} (use um de {FILTROS})")


def main() -> None:
    ap = argparse.ArgumentParser(description="Aplica um filtro de voz a um WAV (para teste).")
    ap.add_argument("--entrada", required=True)
    ap.add_argument("--filtro", required=True, choices=FILTROS)
    ap.add_argument("--saida", required=True)
    ap.add_argument("--semente", type=int, default=7)
    args = ap.parse_args()
    x, taxa = ler_wav(args.entrada)
    y, antecipacao = aplicar_filtro(x, taxa, args.filtro, args.semente)
    if pico(y) > 0.98:
        y = y / pico(y) * 0.98
    escrever_wav(args.saida, y, taxa)
    print(f"ok: {args.saida} ({args.filtro}, antecipação {antecipacao:.2f} s)")


if __name__ == "__main__":
    main()
