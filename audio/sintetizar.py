#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sintetiza DO ZERO (sem baixar nada, sem direitos de terceiros) as camadas de som do episódio
a partir da linha do tempo (capítulo 64: fala, ambiente, efeitos, tensão):

  audio/camadas/ambiente.wav   o som do lugar, bem baixo
  audio/camadas/efeitos.wav    sons pontuais ligados à imagem
  audio/camadas/tensao.wav     grave crescente, pancada e o "drone" dos climas escalada/clímax

Tudo com semente (mesma linha do tempo → mesmo som). 48 kHz, mono, 24 bits.
Nos `silencios` da linha do tempo, ambiente e tensão caem quase a zero (o silêncio é roteiro).

Uso:
  python3 audio/sintetizar.py --episodio episodios/ep01_x [--linha-do-tempo arquivo.json] [--semente 7]
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _comum import (aplicar_reverb, carregar_canal, carregar_json, db_para_ganho, escrever_wav, falar,  # noqa: E402
                    filtrar_banda, impulso_sala, convolver, normalizar_rms, pico, rampa, resolver_episodio, rms, salvar_json)

SR = 48000

# nível de pico (dBFS) de cada efeito antes da mixagem; `ganho_db` do efeito soma a isto
NIVEL_PADRAO_DB = {
    "clique": -20, "clique_triplo": -16, "passos": -16, "porta_abrir": -14, "porta_fechar": -12, "batida": -8,
    "vidro": -12, "celular_vibrar": -16, "notificacao": -18, "estatica_radio": -18, "lampada_estalo": -16,
    "lampada_piscar": -16, "grave_crescente": -6, "pancada": -5, "freio_onibus": -12, "motor_onibus": -14,
    "sino": -14, "campainha": -12, "papel": -22, "carimbo": -17,
}
# quanto de reverb de saguão cada efeito recebe (0 = perto do ouvido, seco)
REVERB_DB = {
    "clique": 0.0, "clique_triplo": 0.3, "passos": 0.25, "porta_abrir": 0.25, "porta_fechar": 0.25, "batida": 0.25,
    "vidro": 0.25, "celular_vibrar": 0.0, "notificacao": 0.0, "estatica_radio": 0.0, "lampada_estalo": 0.2,
    "lampada_piscar": 0.2, "grave_crescente": 0.0, "pancada": 0.0, "freio_onibus": 0.15, "motor_onibus": 0.12,
    "sino": 0.3, "campainha": 0.1, "papel": 0.0, "carimbo": 0.05,
}
CAMADA_TENSAO = {"grave_crescente", "pancada"}


# ---------------------------------------------------------------- blocos básicos

def _t(n: int) -> np.ndarray:
    return np.arange(n) / SR


def _n(seg: float) -> int:
    return max(1, int(round(seg * SR)))


def _tom(freq, n: int, fase0: float = 0.0) -> np.ndarray:
    if np.isscalar(freq):
        return np.sin(2 * math.pi * float(freq) * _t(n) + fase0)
    fase = np.cumsum(2 * math.pi * np.asarray(freq) / SR)
    return np.sin(fase + fase0)


def _decai(n: int, tau: float) -> np.ndarray:
    return np.exp(-_t(n) / max(tau, 1e-4))


def _ruido(rng, n: int) -> np.ndarray:
    return rng.standard_normal(n).astype(np.float32)


def _normaliza(y: np.ndarray, pico_db: float) -> np.ndarray:
    p = pico(y)
    if p <= 1e-9:
        return y.astype(np.float32)
    return (y / p * db_para_ganho(pico_db)).astype(np.float32)


def _fade(y: np.ndarray, entrada_s: float = 0.003, saida_s: float = 0.01) -> np.ndarray:
    y = y.astype(np.float32).copy()
    a, b = min(_n(entrada_s), y.size), min(_n(saida_s), y.size)
    if a > 1:
        y[:a] *= rampa(a, True)
    if b > 1:
        y[-b:] *= rampa(b, False)
    return y


def _ruido_lento(rng, n: int, freq_hz: float) -> np.ndarray:
    """Ruído suave (random walk filtrado) entre -1 e 1, para modulações lentas."""
    pontos = max(3, int(n / SR * freq_hz) + 2)
    valores = rng.standard_normal(pontos)
    xp = np.linspace(0, n, pontos)
    y = np.interp(np.arange(n), xp, valores)
    return np.clip(y / 2.5, -1, 1)


# ---------------------------------------------------------------- efeitos

def ef_clique(rng, **k):
    n = _n(0.07)
    t = _t(n)
    y = _ruido(rng, n) * np.exp(-t * 350) * 0.7 + np.sin(2 * math.pi * 1900 * t) * np.exp(-t * 110) * 0.5
    return _fade(filtrar_banda(y.astype(np.float32), SR, 400, 7000))


def ef_clique_triplo(rng, **k):
    y = np.zeros(_n(0.5), dtype=np.float32)
    for i, g in enumerate((1.0, 0.85, 0.95)):
        c = ef_clique(rng) * g
        p = _n(0.13 * i)
        y[p:p + c.size] += c
    return y


def ef_passos(rng, duracao_s=3.0, ritmo="normal", **k):
    intervalo = {"lento": 0.78, "normal": 0.58, "rapido": 0.42}.get(str(ritmo), 0.58)
    n = _n(float(duracao_s) + 0.4)
    y = np.zeros(n, dtype=np.float32)
    t = 0.05
    i = 0
    while t < float(duracao_s):
        n_p = _n(0.14)
        tt = _t(n_p)
        f = np.linspace(85, 55, n_p)
        thump = _tom(f, n_p) * np.exp(-tt / 0.045)
        n_s = _n(0.05)
        scrape = filtrar_banda(_ruido(rng, n_s), SR, 700, 4500) * np.exp(-_t(n_s) / 0.015)
        passo = np.zeros(n_p, dtype=np.float32)
        passo[: n_p] += (thump * 0.9).astype(np.float32)
        passo[: n_s] += (scrape * 0.45).astype(np.float32)
        g = (1.0 if i % 2 == 0 else 0.82) * (0.9 + 0.2 * rng.random())
        p = _n(t + rng.uniform(-0.015, 0.015))
        fim = min(n, p + n_p)
        y[p:fim] += passo[: fim - p] * g
        t += intervalo * (0.95 + 0.1 * rng.random())
        i += 1
    return y


def ef_porta_abrir(rng, **k):
    n = _n(1.3)
    t = _t(n)
    f = 330 + 180 * _ruido_lento(rng, n, 2.5) + 60 * np.sin(2 * math.pi * 0.7 * t)
    fase = np.cumsum(2 * math.pi * f / SR)
    serra = 2 * ((fase / (2 * math.pi)) % 1.0) - 1.0
    # atrito em "pula-pula": trepidação irregular
    trep = 0.55 + 0.45 * (np.sign(np.sin(2 * math.pi * 17 * t + 3 * _ruido_lento(rng, n, 6))) + 1) / 2
    env = np.concatenate([rampa(_n(0.08)), np.ones(n - _n(0.08) - _n(0.25)), rampa(_n(0.25), False)])
    creak = serra * trep * env * (0.6 + 0.4 * _ruido_lento(rng, n, 3))
    creak = filtrar_banda(creak.astype(np.float32), SR, 220, 3200)
    rumble = filtrar_banda(_ruido(rng, n), SR, 40, 160) * env * 0.5
    return _fade((creak * 0.8 + rumble).astype(np.float32))


def ef_porta_fechar(rng, **k):
    n = _n(0.6)
    t = _t(n)
    thump = _tom(np.linspace(75, 48, n), n) * np.exp(-t / 0.09)
    ruido = filtrar_banda(_ruido(rng, n), SR, 80, 1800) * np.exp(-t / 0.03)
    y = (thump * 0.9 + ruido * 0.6).astype(np.float32)
    c = ef_clique(rng) * 0.8
    p = _n(0.09)
    y[p:p + c.size] += c
    return _fade(y)


def ef_batida(rng, **k):
    n = _n(0.55)
    t = _t(n)
    y = _tom(np.linspace(70, 45, n), n) * np.exp(-t / 0.12) + filtrar_banda(_ruido(rng, n), SR, 60, 2500) * np.exp(-t / 0.025) * 0.8
    return _fade(y.astype(np.float32))


def ef_vidro(rng, **k):
    n = _n(0.8)
    t = _t(n)
    y = np.zeros(n)
    for f, tau, g in ((2600, 0.35, 1.0), (3900, 0.28, 0.7), (5200, 0.22, 0.5), (7100, 0.15, 0.35)):
        y += np.sin(2 * math.pi * f * (1 + 0.002 * rng.standard_normal()) * t) * np.exp(-t / tau) * g
    y += filtrar_banda(_ruido(rng, n), SR, 1500, 9000) * np.exp(-t / 0.012) * 1.5
    return _fade(y.astype(np.float32))


def ef_celular_vibrar(rng, **k):
    n = _n(1.25)
    t = _t(n)
    env = np.zeros(n)
    for ini in (0.0, 0.7):
        a, b = _n(ini), min(n, _n(ini + 0.45))
        env[a:b] = 1.0
        env[a:min(b, a + _n(0.02))] *= np.linspace(0, 1, min(b, a + _n(0.02)) - a)
    motor = (np.sin(2 * math.pi * 170 * t) + 0.5 * np.sin(2 * math.pi * 340 * t)) * (0.55 + 0.45 * np.sign(np.sin(2 * math.pi * 23 * t)))
    mesa = filtrar_banda(_ruido(rng, n), SR, 900, 3000) * 0.25 * (0.5 + 0.5 * np.sign(np.sin(2 * math.pi * 23 * t + 1)))
    y = filtrar_banda(((motor + mesa) * env).astype(np.float32), SR, 90, 2600)
    return _fade(y)


def ef_notificacao(rng, **k):
    n = _n(0.6)
    y = np.zeros(n)
    for ini, dur, f in ((0.0, 0.14, 880.0), (0.13, 0.32, 1174.7)):
        m = _n(dur)
        tt = _t(m)
        tom = (np.sin(2 * math.pi * f * tt) + 0.25 * np.sin(2 * math.pi * 3 * f * tt)) * np.exp(-tt / (dur * 0.6))
        tom[: _n(0.008)] *= rampa(_n(0.008))
        p = _n(ini)
        y[p:p + m] += tom
    return _fade(y.astype(np.float32))


def ef_estatica_radio(rng, duracao_s=0.7, **k):
    n = _n(float(duracao_s))
    t = _t(n)
    base = filtrar_banda(_ruido(rng, n), SR, 1000, 4500) * (0.6 + 0.4 * _ruido_lento(rng, n, 12))
    crep = filtrar_banda(((rng.random(n) < 0.0012) * _ruido(rng, n)).astype(np.float32), SR, 2000, 8000) * 4
    env = np.concatenate([rampa(_n(0.05)), np.ones(max(0, n - _n(0.05) - _n(0.15))), rampa(_n(0.15), False)])[:n]
    return _fade(((base + crep) * env).astype(np.float32))


def ef_lampada_estalo(rng, **k):
    n = _n(0.25)
    t = _t(n)
    estalo = _ruido(rng, n) * np.exp(-t * 600)
    fase = np.cumsum(2 * math.pi * 120 * np.ones(n) / SR)
    buzz = (2 * ((fase / (2 * math.pi)) % 1.0) - 1.0) * np.exp(-t / 0.06) * 0.5
    buzz += filtrar_banda(_ruido(rng, n), SR, 2000, 6000) * np.exp(-t / 0.05) * 0.4
    return _fade(filtrar_banda((estalo + buzz).astype(np.float32), SR, 150, 9000))


def ef_lampada_piscar(rng, **k):
    n = _n(1.6)
    y = np.zeros(n, dtype=np.float32)
    t = 0.0
    while t < 1.3:
        e = ef_lampada_estalo(rng) * (0.6 + 0.4 * rng.random())
        p = _n(t)
        fim = min(n, p + e.size)
        y[p:fim] += e[: fim - p]
        t += rng.uniform(0.12, 0.38)
    return y


def ef_grave_crescente(rng, duracao_s=8.0, **k):
    n = _n(float(duracao_s))
    t = _t(n)
    prog = t / max(float(duracao_s), 1e-3)
    f = 42 + 13 * prog
    y = _tom(f, n) + 0.4 * _tom(2 * f, n, 0.5) + 0.18 * _tom(3 * f, n, 1.1)
    trem = 1.0 - 0.25 * prog * (0.5 + 0.5 * np.sin(2 * math.pi * (0.5 + 2.5 * prog) * t))
    ar = filtrar_banda(_ruido(rng, n), SR, 90, 320) * prog * 0.5
    env = prog ** 2.2
    saida = (y * trem * env + ar * env).astype(np.float32)
    saida[-_n(0.03):] *= rampa(_n(0.03), False)
    saida[: _n(0.3)] *= rampa(_n(0.3))
    return saida


def ef_pancada(rng, **k):
    n = _n(1.6)
    t = _t(n)
    y = _tom(np.linspace(52, 40, n), n) * np.exp(-t / 0.35) + 0.6 * _tom(85, n) * np.exp(-t / 0.15)
    y += filtrar_banda(_ruido(rng, n), SR, 100, 3000) * np.exp(-t / 0.02) * 1.6
    cauda = convolver(y.astype(np.float32) * 0.35, impulso_sala(SR, 1.2, int(rng.integers(1, 9999)), 0.4))
    out = np.zeros(cauda.size, dtype=np.float32)
    out[:n] += y.astype(np.float32)
    out += cauda
    return _fade(out, 0.001, 0.2)


def ef_freio_onibus(rng, **k):
    n = _n(1.3)
    t = _t(n)
    hiss = filtrar_banda(_ruido(rng, n), SR, 1500, 7000) * np.exp(-t / 0.35) * np.concatenate([rampa(_n(0.02)), np.ones(n - _n(0.02))])
    m = _n(0.5)
    tt = _t(m)
    squeal = np.sin(2 * math.pi * 1900 * tt * (1 + 0.004 * np.sin(2 * math.pi * 7 * tt))) * np.exp(-tt / 0.18) * 0.35
    y = hiss.astype(np.float32)
    p = _n(0.12)
    y[p:p + m] += squeal.astype(np.float32)
    thud = _tom(np.linspace(60, 40, _n(0.3)), _n(0.3)) * np.exp(-_t(_n(0.3)) / 0.08) * 0.6
    q = _n(0.85)
    y[q:q + thud.size] += thud.astype(np.float32)
    return _fade(y)


def ef_motor_onibus(rng, duracao_s=6.0, **k):
    n = _n(float(duracao_s))
    t = _t(n)
    prog = t / max(float(duracao_s), 1e-3)
    f = np.where(prog < 0.75, 30.0, 30.0 - 5.0 * (prog - 0.75) / 0.25)
    fase = np.cumsum(2 * math.pi * f / SR)
    diesel = np.zeros(n)
    for h in range(1, 18):
        diesel += np.sin(h * fase + 0.3 * h) / (h ** 0.9) * (1 + 0.15 * np.sin(2 * math.pi * 0.9 * h * t))
    diesel = filtrar_banda(diesel.astype(np.float32), SR, 25, 380)
    rumble = filtrar_banda(_ruido(rng, n), SR, 30, 220) * 0.6
    env = 0.15 + 0.85 * prog ** 1.5
    y = ((diesel * 0.8 + rumble) * env).astype(np.float32)
    y = filtrar_banda(y, SR, None, 650)   # está do lado de fora, atrás da porta
    return _fade(y, 0.2, 0.3)


def ef_sino(rng, **k):
    n = _n(2.4)
    t = _t(n)
    y = np.zeros(n)
    for razao, tau, g in ((1.0, 2.0, 1.0), (2.0, 1.5, 0.6), (2.4, 1.2, 0.5), (3.0, 0.9, 0.35), (4.2, 0.6, 0.25)):
        y += np.sin(2 * math.pi * 520 * razao * t) * np.exp(-t / tau) * g
    y += filtrar_banda(_ruido(rng, n), SR, 2000, 9000) * np.exp(-t / 0.01) * 1.2
    return _fade(y.astype(np.float32), 0.001, 0.1)


def ef_campainha(rng, duracao_s=2.5, **k):
    n = _n(float(duracao_s))
    y = np.zeros(n)
    t0 = 0.0
    while t0 < float(duracao_s) - 0.2:
        m = min(_n(1.0), n - _n(t0))
        tt = _t(m)
        martelo = np.abs(np.sin(2 * math.pi * 20 * tt)) ** 3
        sino = (np.sin(2 * math.pi * 1150 * tt) + 0.6 * np.sin(2 * math.pi * 1450 * tt) + 0.3 * np.sin(2 * math.pi * 2300 * tt)
                + 0.2 * np.sin(2 * math.pi * 3450 * tt))
        ring = sino * (0.35 + 0.65 * martelo)
        env = np.ones(m)
        env[-_n(0.12):] = rampa(_n(0.12), False)[: _n(0.12)] if m > _n(0.12) else env[-_n(0.12):]
        env[: _n(0.01)] *= rampa(_n(0.01))[: _n(0.01)]
        p = _n(t0)
        y[p:p + m] += ring * env
        t0 += 2.5
    return _fade(filtrar_banda(y.astype(np.float32), SR, 500, 7000))


def ef_papel(rng, **k):
    n = _n(0.5)
    picos = (rng.random(n) < (60.0 / SR)).astype(np.float32) * rng.random(n)
    env = np.convolve(picos, np.exp(-_t(_n(0.02)) / 0.004), mode="same")
    env = env / (env.max() + 1e-9)
    y = filtrar_banda(_ruido(rng, n), SR, 1200, 9000) * (0.2 + env)
    return _fade(y.astype(np.float32))


def ef_carimbo(rng, **k):
    n = _n(0.18)
    t = _t(n)
    y = _tom(np.linspace(150, 110, n), n) * np.exp(-t / 0.05) + np.sin(2 * math.pi * 900 * t) * np.exp(-t / 0.02) * 0.4
    y += _ruido(rng, n) * np.exp(-t / 0.004) * 0.9
    return _fade(filtrar_banda(y.astype(np.float32), SR, 70, 6000))


EFEITOS = {
    "clique": ef_clique, "clique_triplo": ef_clique_triplo, "passos": ef_passos, "porta_abrir": ef_porta_abrir,
    "porta_fechar": ef_porta_fechar, "batida": ef_batida, "vidro": ef_vidro, "celular_vibrar": ef_celular_vibrar,
    "notificacao": ef_notificacao, "estatica_radio": ef_estatica_radio, "lampada_estalo": ef_lampada_estalo,
    "lampada_piscar": ef_lampada_piscar, "grave_crescente": ef_grave_crescente, "pancada": ef_pancada,
    "freio_onibus": ef_freio_onibus, "motor_onibus": ef_motor_onibus, "sino": ef_sino, "campainha": ef_campainha,
    "papel": ef_papel, "carimbo": ef_carimbo,
}


# ---------------------------------------------------------------- ambientes

def _grilos(rng, n: int, densidade: float = 1.0) -> np.ndarray:
    t = _t(n)
    y = np.zeros(n)
    for f, taxa in ((4300, 31.0), (4700, 27.0)):
        chirp = (0.5 + 0.5 * np.sign(np.sin(2 * math.pi * taxa * t))) ** 2
        grupo = (np.sin(2 * math.pi * 1.1 * t + rng.random() * 6) > 0.2).astype(float)
        pausa = (_ruido_lento(rng, n, 0.08) > -0.6 * densidade).astype(float)
        y += np.sin(2 * math.pi * f * t) * chirp * grupo * pausa
    return filtrar_banda((y * 0.5).astype(np.float32), SR, 3000, 7000)


def amb_saguao_noite(rng, n: int) -> np.ndarray:
    t = _t(n)
    flutter = 1 + 0.12 * np.sin(2 * math.pi * 0.3 * t) + 0.05 * _ruido_lento(rng, n, 0.5)
    hum = (0.5 * np.sin(2 * math.pi * 60 * t) + 0.5 * np.sin(2 * math.pi * 120 * t) + 0.2 * np.sin(2 * math.pi * 180 * t)) * flutter
    buzz = filtrar_banda(_ruido(rng, n), SR, 1800, 4500) * (np.abs(np.sin(2 * math.pi * 100 * t)) ** 2) * (0.6 + 0.4 * _ruido_lento(rng, n, 0.7))
    fan = filtrar_banda(_ruido(rng, n), SR, 60, 900) * (0.7 + 0.3 * np.sin(2 * math.pi * 1.3 * t)) * (0.85 + 0.15 * _ruido_lento(rng, n, 0.2))
    grilos = _grilos(rng, n, 0.7)
    y = hum * 0.45 + buzz * 0.25 + fan * 0.6 + grilos * 0.07
    return aplicar_reverb(y.astype(np.float32), SR, 0.15, 0.6, int(rng.integers(1, 9999)))


def amb_rua_noite(rng, n: int) -> np.ndarray:
    t = _t(n)
    vento = filtrar_banda(_ruido(rng, n), SR, 40, 420) * (0.5 + 0.5 * _ruido_lento(rng, n, 0.15)) ** 2
    y = vento * 0.7 + _grilos(rng, n, 1.0) * 0.18 + np.sin(2 * math.pi * 50 * t) * 0.05
    # carros distantes, de vez em quando
    pos = 12.0
    while pos < n / SR - 6:
        m = _n(5.0)
        tt = _t(m)
        env = np.sin(math.pi * tt / 5.0) ** 2
        carro = filtrar_banda(_ruido(rng, m), SR, 150, 1500) * env * 0.5
        p = _n(pos)
        y[p:p + m] += carro[: max(0, min(m, n - p))]
        pos += rng.uniform(18, 40)
    return y.astype(np.float32)


def amb_chuva(rng, n: int) -> np.ndarray:
    t = _t(n)
    base = filtrar_banda(_ruido(rng, n), SR, 700, 9000) * (0.8 + 0.2 * _ruido_lento(rng, n, 0.3))
    gotas = filtrar_banda(((rng.random(n) < (25.0 / SR)) * _ruido(rng, n) * 6).astype(np.float32), SR, 2000, 7000)
    gotas = np.convolve(gotas, np.exp(-_t(_n(0.012)) / 0.003), mode="same")
    rumble = filtrar_banda(_ruido(rng, n), SR, 40, 150) * 0.4
    return (base * 0.6 + gotas * 0.4 + rumble).astype(np.float32)


def amb_vento(rng, n: int) -> np.ndarray:
    t = _t(n)
    raj = (0.5 + 0.5 * _ruido_lento(rng, n, 0.2)) ** 2
    y = filtrar_banda(_ruido(rng, n), SR, 40, 600) * raj
    assobio = filtrar_banda(_ruido(rng, n), SR, 600, 950, 0.2) * np.maximum(raj - 0.6, 0) * 2.0
    return (y + assobio * 0.5).astype(np.float32)


def amb_silencio(rng, n: int) -> np.ndarray:
    return (_ruido(rng, n) * 0.0003).astype(np.float32)


AMBIENTES = {"saguao_noite": amb_saguao_noite, "rua_noite": amb_rua_noite, "chuva": amb_chuva, "vento": amb_vento, "silencio": amb_silencio}


# ---------------------------------------------------------------- montagem

def _colocar(camada: np.ndarray, y: np.ndarray, t: float, ganho: float = 1.0) -> None:
    p = int(round(t * SR))
    if p >= camada.size:
        return
    if p < 0:
        y = y[-p:]
        p = 0
    fim = min(camada.size, p + y.size)
    camada[p:fim] += (y[: fim - p] * ganho).astype(np.float32)


def _portao_silencios(n: int, silencios: list[dict], piso: float = 0.05) -> np.ndarray:
    g = np.ones(n, dtype=np.float32)
    r = _n(0.15)
    for s in silencios or []:
        a, b = int(float(s["inicio_s"]) * SR), int(float(s["fim_s"]) * SR)
        a, b = max(0, a), min(n, b)
        if b <= a:
            continue
        g[a:b] = piso
        if a - r >= 0:
            g[a - r:a] = np.minimum(g[a - r:a], 1 - (1 - piso) * rampa(r, True))
        if b + r <= n:
            g[b:b + r] = np.minimum(g[b:b + r], piso + (1 - piso) * rampa(r, True))
    return g


def _drone_dos_climas(rng, n: int, climas: list[dict], efeitos: list[dict], total: float) -> np.ndarray:
    """Grave baixo e contínuo nos climas escalada/clímax (some na pergunta)."""
    y = np.zeros(n, dtype=np.float32)
    nivel = {"rotina": 0.0, "sinal": 0.0, "escalada": db_para_ganho(-30), "climax": db_para_ganho(-24), "pergunta": 0.0}
    alvo = np.zeros(n, dtype=np.float32)
    for i, c in enumerate(climas or []):
        a = int(float(c["inicio_s"]) * SR)
        b = int(float(climas[i + 1]["inicio_s"]) * SR) if i + 1 < len(climas) else n
        alvo[max(0, a):min(n, b)] = nivel.get(c["clima"], 0.0)
    if not np.any(alvo):
        return y
    # suaviza o alvo em 2 s
    k = np.ones(_n(2.0)) / _n(2.0)
    env = np.convolve(alvo, k, mode="same")
    t = _t(n)
    base = np.sin(2 * math.pi * 36 * t) + np.sin(2 * math.pi * 36.35 * t) + 0.35 * np.sin(2 * math.pi * 72 * t)
    pulso = 0.8 + 0.2 * np.sin(2 * math.pi * 0.18 * t)
    y = (base * pulso * env * 0.5).astype(np.float32)
    # corta onde há grave_crescente explícito (ele assume)
    for e in efeitos:
        if e.get("tipo") == "grave_crescente":
            a = int(float(e["t"]) * SR)
            b = min(n, a + _n(float(e.get("duracao_s", 8.0))))
            y[a:b] *= 0.35
    return y


def gerar_camadas(linha: dict, pasta_saida: Path, semente: int = 7, silencioso: bool = False) -> dict:
    total = float(linha["duracao_total_s"])
    n = _n(total)
    rng = np.random.default_rng(semente)
    ambiente = np.zeros(n, dtype=np.float32)
    efeitos = np.zeros(n, dtype=np.float32)
    tensao = np.zeros(n, dtype=np.float32)
    registro = {"semente": semente, "duracao_total_s": total, "taxa": SR, "ambiente": [], "efeitos": [], "avisos": []}

    for amb in linha.get("ambiente", []) or [{"inicio_s": 0, "fim_s": total, "tipo": "saguao_noite", "ganho_db": -26}]:
        tipo = amb.get("tipo", "saguao_noite")
        fn = AMBIENTES.get(tipo)
        if not fn:
            registro["avisos"].append(f"ambiente desconhecido: {tipo} (usei saguao_noite)")
            fn = amb_saguao_noite
        a, b = float(amb.get("inicio_s", 0)), float(amb.get("fim_s", total))
        m = _n(b - a)
        y = fn(np.random.default_rng(semente + 101), m)
        y = normalizar_rms(y, float(amb.get("ganho_db", -26)), teto_pico_dbfs=-8)
        y = _fade(y, 0.6, 1.0)
        _colocar(ambiente, y, a)
        registro["ambiente"].append({"tipo": tipo, "inicio_s": a, "fim_s": b, "rms_dbfs": float(amb.get("ganho_db", -26))})

    for i, e in enumerate(sorted(linha.get("efeitos", []) or [], key=lambda e: float(e["t"]))):
        tipo = e.get("tipo")
        fn = EFEITOS.get(tipo)
        if not fn:
            registro["avisos"].append(f"efeito desconhecido: {tipo} em {e.get('t')} s (ignorado)")
            continue
        r = np.random.default_rng(semente * 7919 + i * 31 + int(float(e["t"]) * 10))
        params = {k: v for k, v in e.items() if k not in ("t", "tipo", "ganho_db")}
        y = fn(r, **params)
        nivel = NIVEL_PADRAO_DB.get(tipo, -16) + float(e.get("ganho_db", 0))
        y = _normaliza(y, nivel)
        rev = REVERB_DB.get(tipo, 0.0)
        if rev > 0:
            y = aplicar_reverb(y, SR, rev, 0.7, int(r.integers(1, 9999)))
        destino = tensao if tipo in CAMADA_TENSAO else efeitos
        _colocar(destino, y, float(e["t"]))
        registro["efeitos"].append({"t": float(e["t"]), "tipo": tipo, "pico_dbfs": round(nivel, 1), "camada": "tensao" if tipo in CAMADA_TENSAO else "efeitos", "duracao_s": round(y.size / SR, 2)})

    tensao += _drone_dos_climas(rng, n, linha.get("climas", []), linha.get("efeitos", []), total)

    portao = _portao_silencios(n, linha.get("silencios", []))
    ambiente *= portao
    tensao *= portao

    # a camada de tensão termina com a pergunta (a tela escura é silêncio)
    perg = linha.get("pergunta") or {}
    if perg.get("inicio_s") is not None:
        a = int(float(perg["inicio_s"]) * SR) + _n(0.8)
        if 0 < a < n:
            r = min(_n(0.6), n - a)
            tensao[a:a + r] *= rampa(r, False)
            tensao[a + r:] = 0.0

    for nome, cam in (("ambiente", ambiente), ("efeitos", efeitos), ("tensao", tensao)):
        p = pico(cam)
        if p > 0.95:
            cam *= 0.95 / p
            registro["avisos"].append(f"camada {nome} reduzida para não estourar (pico {p:.2f})")
        escrever_wav(pasta_saida / f"{nome}.wav", cam, SR, bits=24)
        registro[f"{nome}_pico_dbfs"] = round(20 * math.log10(max(pico(cam), 1e-9)), 1)
        registro[f"{nome}_rms_dbfs"] = round(20 * math.log10(max(rms(cam), 1e-9)), 1)
    salvar_json(pasta_saida / "camadas.json", registro)
    falar(f"Camadas em {pasta_saida}: ambiente {registro['ambiente_rms_dbfs']} dBFS RMS, efeitos pico {registro['efeitos_pico_dbfs']} dBFS, "
          f"tensão pico {registro['tensao_pico_dbfs']} dBFS, {len(registro['efeitos'])} efeitos", silencioso)
    for a in registro["avisos"]:
        falar("  aviso: " + a, silencioso)
    return registro


def main() -> None:
    ap = argparse.ArgumentParser(description="Sintetiza ambiente, efeitos e tensão do episódio a partir da linha do tempo.")
    ap.add_argument("--episodio", required=True)
    ap.add_argument("--linha-do-tempo", default=None, help="padrão: <episodio>/linha_do_tempo.json")
    ap.add_argument("--semente", type=int, default=None)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    ep = resolver_episodio(args.episodio)
    caminho = Path(args.linha_do_tempo) if args.linha_do_tempo else ep / "linha_do_tempo.json"
    if not caminho.exists():
        sys.exit(f"Linha do tempo não encontrada: {caminho}. Rode a etapa de tempo (ou audio/_linha_previa.py) antes.")
    linha = carregar_json(caminho)
    canal = carregar_canal()
    semente = args.semente if args.semente is not None else int(canal.get("estilo", {}).get("semente", 7))
    reg = gerar_camadas(linha, ep / "audio" / "camadas", semente, args.json)
    if args.json:
        print(json.dumps(reg, ensure_ascii=False))


if __name__ == "__main__":
    main()
