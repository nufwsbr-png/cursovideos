# -*- coding: utf-8 -*-
"""Testes do som no padrão medido da referência (2026-11-10): zumbido grave contínuo 46/69/92 Hz, bipe triplo do
alerta, batidas repetidas, passos no ritmo do balanço (2,9 Hz), calibração da faixa 20–80 Hz e a análise por faixa.
Rodar: npm run testes:audio   (python -I -m unittest discover -s audio/testes -t audio/testes)"""
import math
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

AUDIO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AUDIO))

import sintetizar as S  # noqa: E402
from _comum import energia_por_banda, ler_wav  # noqa: E402
from mixar import ganho_do_drone, energias_banda  # noqa: E402

SR = S.SR


def inicios(y, limiar_rel=0.25, min_sep_s=0.1):
    """Instantes (s) em que o envelope cruza o limiar subindo."""
    env = np.abs(y)
    j = int(0.005 * SR)
    m = env.size // j
    e = np.concatenate([[0.0], env[: m * j].reshape(m, j).max(axis=1)])  # começa do silêncio: pega o que começa em t = 0
    lim = e.max() * limiar_rel
    t, ultimo = [], -1e9
    for i in range(1, m + 1):
        ti = (i - 1) * j / SR
        if e[i] >= lim > e[i - 1] and (ti - ultimo) >= min_sep_s:
            t.append(ti)
            ultimo = ti
    return t


class TestCamadas(unittest.TestCase):
    def test_zumbido_continuo_e_parciais(self):
        n = int(20 * SR)
        y = S.camada_drone(n, [{"inicio_s": 0, "clima": "rotina"}, {"inicio_s": 10, "clima": "climax"}])
        b = energia_por_banda(y, SR)
        self.assertEqual(b["trechos_abaixo_40db"], [])
        for alvo in (46, 69, 92):
            self.assertTrue(any(abs(p - alvo) <= 1 for p in b["picos_graves_hz"]), b["picos_graves_hz"])
        self.assertGreater(b["fracao_20_80"], 0.8)
        # sobe no clímax (+4 dB), suave
        r1 = np.sqrt(np.mean(y[2 * SR:8 * SR] ** 2)); r2 = np.sqrt(np.mean(y[13 * SR:19 * SR] ** 2))
        self.assertAlmostEqual(20 * math.log10(r2 / r1), 4.0, delta=0.8)

    def test_bipe_triplo_do_alerta(self):
        y = S.ef_alerta_bipe(np.random.default_rng(1))
        ts = inicios(y)
        self.assertEqual(len(ts), 3, ts)
        self.assertAlmostEqual(ts[1] - ts[0], 0.2, delta=0.02)
        P = np.abs(np.fft.rfft(y)) ** 2; f = np.fft.rfftfreq(y.size, 1 / SR)
        self.assertAlmostEqual(float(f[np.argmax(P)]), 1600, delta=20)

    def test_passos_no_ritmo_do_balanco(self):
        y = S.ef_passos_camera(np.random.default_rng(2), duracao_s=3.0, intervalo_s=1 / 2.9)
        ts = inicios(y, 0.3, 0.2)
        self.assertGreaterEqual(len(ts), 8)
        difs = np.diff(ts)
        self.assertTrue(np.all(np.abs(difs - 1 / 2.9) < 0.012), difs)

    def test_batidas_repetidas_e_zumbido_nas_camadas(self):
        linha = {"duracao_total_s": 8.0, "falas": [], "climas": [{"inicio_s": 0, "clima": "rotina"}],
                 "efeitos": [{"t": 1.0, "tipo": "batida", "repeticoes": 4, "intervalo_s": 1.0}],
                 "ambiente": [{"inicio_s": 0, "fim_s": 8, "tipo": "corredor_servico", "ganho_db": -30}], "silencios": [], "pergunta": None}
        with tempfile.TemporaryDirectory() as d:
            reg = S.gerar_camadas(linha, Path(d), 7, True, {"drone": {}})
            ef, _ = ler_wav(Path(d) / "efeitos.wav")
            ts = inicios(ef, 0.3, 0.5)
            self.assertEqual(len(ts), 4, ts)
            self.assertTrue(all(abs((b - a) - 1.0) < 0.06 for a, b in zip(ts, ts[1:])), ts)
            dr, _ = ler_wav(Path(d) / "drone.wav")
            self.assertEqual(energia_por_banda(dr, SR)["trechos_abaixo_40db"], [])
            self.assertFalse(reg["avisos"], reg["avisos"])

    def test_calibracao_da_faixa_grave(self):
        rng = np.random.default_rng(3)
        n = 10 * SR
        voz = np.convolve(rng.standard_normal(n), np.ones(8) / 8, mode="same").astype(np.float32) * 0.1  # ruído na faixa da voz
        dr = S.camada_drone(n, [])
        g = ganho_do_drone(voz, dr, 0.84)
        et, eb = energias_banda(voz + dr * g)
        self.assertAlmostEqual(eb / et, 0.84, delta=0.02)

    def test_analise_por_faixa(self):
        t = np.arange(5 * SR) / SR
        x = 0.5 * np.sin(2 * math.pi * 46 * t) + 0.05 * np.sin(2 * math.pi * 1000 * t)
        x[2 * SR:int(2.6 * SR)] = 0.0  # um buraco de 0,6 s
        b = energia_por_banda(x, SR)
        self.assertGreater(b["fracao_20_80"], 0.95)
        self.assertEqual(b["picos_graves_hz"][0], 46)
        self.assertEqual(len(b["trechos_abaixo_40db"]), 1)


if __name__ == "__main__":
    unittest.main()
