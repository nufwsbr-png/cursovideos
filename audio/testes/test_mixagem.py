# -*- coding: utf-8 -*-
"""Testes da voz na mixagem (2026-11-10): as falas são igualadas pela faixa da voz (300–3000 Hz, a mesma da prova),
de novo depois do filtro, e o critério "fala >= fundo sem fala + 6 dB" é o mesmo na mixagem (piso da voz) e na prova.
Rodar: npm run testes:audio"""
import math
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

AUDIO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AUDIO))

import mixar as M  # noqa: E402
from medir import CRITERIO_VOZ_DB, banda_de_voz  # noqa: E402
from _comum import dbfs, escrever_wav, filtrar_banda, rms  # noqa: E402

SR = M.SR


def voz_sintetica(f0: float, dur: float = 1.6) -> np.ndarray:
    """Fala de mentira: harmônicos de f0 caindo 1/k e sílabas a 4 Hz."""
    t = np.arange(int(dur * SR)) / SR
    y = sum((1.0 / k) * np.sin(2 * math.pi * f0 * k * t) for k in range(1, 25) if f0 * k < 8000)
    return (y * (0.5 + 0.5 * np.sin(2 * math.pi * 4 * t)) * 0.05).astype(np.float32)


class TesteVozNaMixagem(unittest.TestCase):
    def test_voz_grave_e_aguda_ficam_iguais_na_faixa_da_voz(self):
        grave, aguda = voz_sintetica(90), voz_sintetica(230)
        for v in (grave, aguda):
            self.assertAlmostEqual(dbfs(M.nivel_banda_voz(M.nivelar_fala(v, -22.0))), -22.0, delta=0.3)
        # pela faixa inteira (o jeito antigo) a grave ficava bem mais baixa na faixa da voz
        g = grave * (10 ** (-20 / 20) / rms(grave))
        a = aguda * (10 ** (-20 / 20) / rms(aguda))
        self.assertGreater(dbfs(M.nivel_banda_voz(a)) - dbfs(M.nivel_banda_voz(g)), 1.5)

    def test_filtro_nao_deixa_a_fala_mais_quente(self):
        with tempfile.TemporaryDirectory() as d:
            ep = Path(d)
            (ep / "audio" / "falas").mkdir(parents=True)
            escrever_wav(ep / "audio" / "falas" / "f01.wav", voz_sintetica(150), SR)
            niveis = {}
            for filtro in (None, "telefone", "radio", "alto_falante"):
                y, _ant, info = M.preparar_fala(ep, {"id": "f01", "filtro": filtro}, {"estilo": "calm"}, None, 7)
                niveis[filtro] = info["banda_final_dbfs"]
                self.assertAlmostEqual(info["banda_final_dbfs"], M.ALVO_VOZ_DBFS, delta=0.6, msg=f"{filtro}: {info}")
            y, _ant, info = M.preparar_fala(ep, {"id": "f01"}, {"estilo": "whisper"}, None, 7, 1.5)
            self.assertAlmostEqual(info["banda_final_dbfs"], M.ALVO_VOZ_DBFS - 2.0 + 1.5, delta=0.6)
            self.assertEqual(info["piso_voz_db"], 1.5)

    def test_criterio_da_voz_igual_na_mixagem_e_na_prova(self):
        rng = np.random.default_rng(1)
        n = 9 * SR
        x = filtrar_banda(rng.standard_normal(n).astype(np.float32), SR, 300, 3000) * 0.004
        t = np.arange(2 * SR) / SR
        tom = np.sin(2 * math.pi * 1000 * t).astype(np.float32)
        fundo = float(np.sqrt(np.mean(x[: SR] ** 2)))
        x[1 * SR:3 * SR] += tom * fundo * 10 ** (12 / 20) * math.sqrt(2)   # 12 dB acima do fundo
        x[5 * SR:7 * SR] += tom * fundo * 10 ** (2 / 20) * math.sqrt(2)    # só 2 dB acima
        falas = [{"id": "f01", "inicio_s": 1.0, "fim_s": 3.0}, {"id": "f02", "inicio_s": 5.0, "fim_s": 7.0}]
        r = banda_de_voz(x, SR, falas)
        self.assertEqual(r["falas_possivelmente_encobertas"], ["f02"])
        margens = {p["id"]: p["margem_db"] for p in r["por_fala"]}
        self.assertGreater(margens["f01"], CRITERIO_VOZ_DB)
        self.assertLess(margens["f02"], CRITERIO_VOZ_DB)
        self.assertEqual(r["criterio_db"], CRITERIO_VOZ_DB)


if __name__ == "__main__":
    unittest.main()
