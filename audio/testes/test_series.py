# -*- coding: utf-8 -*-
"""O áudio usa o canal da série do episódio (desde 2026-11-10): canal.json + canal/series/<id>.json.
Rodar: npm run testes:audio"""
import json
import sys
import tempfile
import unittest
from pathlib import Path

AUDIO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AUDIO))

import _comum as C  # noqa: E402


class TesteSeriesNoAudio(unittest.TestCase):
    def test_serie_da_pasta_e_canal_efetivo(self):
        base = C.carregar_canal()
        info = C._info_series(base)
        outra = next((s for s in info["lista"] if s.get("arquivo")), None)
        if outra is None:
            self.skipTest("o canal tem uma série só")
        with tempfile.TemporaryDirectory() as d:
            pasta = Path(d) / f"{outra['prefixo_pasta']}-ep01_teste"
            pasta.mkdir()
            self.assertEqual(C.serie_da_pasta(pasta, base), outra["id"])
            efetivo = C.carregar_canal(pasta)
            sobre = json.loads((C.RAIZ / outra["arquivo"]).read_text(encoding="utf-8"))
            self.assertEqual(efetivo["protagonista"], sobre["protagonista"])
            self.assertEqual(efetivo["audio"], base["audio"])  # o som do canal é o mesmo nas séries
            padrao = Path(d) / "ep01_teste"
            padrao.mkdir()
            (padrao / "roteiro.json").write_text(json.dumps({"numero": 1}), encoding="utf-8")
            self.assertEqual(C.serie_da_pasta(padrao, base), info["padrao"])
            self.assertEqual(C.carregar_canal(padrao), base)

    def test_estilo_fundido(self):
        self.assertEqual(C._fundir({"a": 1, "b": {"c": 2, "d": 3}}, {"b": {"d": 4}}), {"a": 1, "b": {"c": 2, "d": 4}})


if __name__ == "__main__":
    unittest.main()
