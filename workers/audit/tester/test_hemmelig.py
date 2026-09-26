"""Rekkefølgen på hemmelighetskildene, og at ingenting lekker.

Testene bruker egne midlertidige filer og patcher modulstiene, så de aldri leser
Kims ekte ~/.config/detox-audit/supabase.env. Ingen test printer en verdi.
"""
from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from felles import hemmelig


class Rekkefolge(unittest.TestCase):
    """Miljø → lokal env-fil → hubens env-fil. Første treff vinner."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.lokal = Path(self.tmp.name) / "supabase.env"
        self.hub = Path(self.tmp.name) / "env.secrets"
        self.sa = Path(self.tmp.name) / "sa.json"
        p = mock.patch.multiple(
            hemmelig, LOKAL_ENV=self.lokal, ENV_SEKRETS=str(self.hub),
            SA_STANDARDSTI=self.sa,
        )
        p.start()
        self.addCleanup(p.stop)
        # Tomt miljø som utgangspunkt, så maskinens egne variabler ikke forstyrrer.
        e = mock.patch.dict(os.environ, {}, clear=True)
        e.start()
        self.addCleanup(e.stop)

    def test_miljoet_vinner_over_lokal_fil(self):
        self.lokal.write_text("DETOX_SUPABASE_URL=fra-fil\n", encoding="utf-8")
        with mock.patch.dict(os.environ, {"DETOX_SUPABASE_URL": "fra-miljo"}):
            self.assertEqual(hemmelig.les_env()["DETOX_SUPABASE_URL"], "fra-miljo")

    def test_lokal_fil_vinner_over_hubens(self):
        self.lokal.write_text("DETOX_SUPABASE_URL=fra-lokal\n", encoding="utf-8")
        self.hub.write_text("DETOX_SUPABASE_URL=fra-hub\n", encoding="utf-8")
        self.assertEqual(hemmelig.les_env()["DETOX_SUPABASE_URL"], "fra-lokal")

    def test_hubens_brukes_nar_lokal_mangler(self):
        self.hub.write_text("DETOX_SUPABASE_URL=fra-hub\n", encoding="utf-8")
        self.assertEqual(hemmelig.les_env()["DETOX_SUPABASE_URL"], "fra-hub")

    def test_manglende_filer_er_ikke_feil(self):
        self.assertEqual(hemmelig.les_env(), {})


class Parsing(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.lokal = Path(self.tmp.name) / "supabase.env"
        p = mock.patch.multiple(
            hemmelig, LOKAL_ENV=self.lokal,
            ENV_SEKRETS=str(Path(self.tmp.name) / "finnes-ikke"),
            SA_STANDARDSTI=Path(self.tmp.name) / "finnes-ikke.json",
        )
        p.start()
        self.addCleanup(p.stop)
        e = mock.patch.dict(os.environ, {}, clear=True)
        e.start()
        self.addCleanup(e.stop)

    def test_export_prefiks_kommentarer_og_hermetegn(self):
        self.lokal.write_text(
            "# en kommentar\n"
            "\n"
            "export DETOX_SUPABASE_URL=\"https://x.supabase.co\"\n"
            "  DETOX_SUPABASE_SERVICE_ROLE_KEY='enkle-hermetegn'  \n"
            "en linje uten likhetstegn\n"
            "GSC_SITE_URL=sc-domain:detox.no\n",
            encoding="utf-8",
        )
        env = hemmelig.les_env()
        self.assertEqual(env["DETOX_SUPABASE_URL"], "https://x.supabase.co")
        self.assertEqual(env["DETOX_SUPABASE_SERVICE_ROLE_KEY"], "enkle-hermetegn")
        self.assertEqual(env["GSC_SITE_URL"], "sc-domain:detox.no")

    def test_bare_navn_i_trengs_leses_inn(self):
        # En env-fil kan inneholde nøkler til helt andre systemer. De skal ikke
        # inn i prosessen i det hele tatt.
        self.lokal.write_text(
            "DETOX_SUPABASE_URL=ja\n"
            "STRIPE_SECRET_KEY=skal-ikke-leses\n"
            "AWS_SECRET_ACCESS_KEY=skal-ikke-leses\n",
            encoding="utf-8",
        )
        env = hemmelig.les_env()
        self.assertEqual(set(env), {"DETOX_SUPABASE_URL"})
        self.assertNotIn("STRIPE_SECRET_KEY", env)
        self.assertNotIn("AWS_SECRET_ACCESS_KEY", env)

    def test_verdi_med_likhetstegn_beholdes_hel(self):
        self.lokal.write_text("DETOX_SUPABASE_SERVICE_ROLE_KEY=a=b=c\n", encoding="utf-8")
        self.assertEqual(hemmelig.les_env()["DETOX_SUPABASE_SERVICE_ROLE_KEY"], "a=b=c")


class ServiceKontoFallback(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.sa = Path(self.tmp.name) / "sa.json"
        p = mock.patch.multiple(
            hemmelig,
            LOKAL_ENV=Path(self.tmp.name) / "finnes-ikke.env",
            ENV_SEKRETS=str(Path(self.tmp.name) / "finnes-ikke"),
            SA_STANDARDSTI=self.sa,
        )
        p.start()
        self.addCleanup(p.stop)
        e = mock.patch.dict(os.environ, {}, clear=True)
        e.start()
        self.addCleanup(e.stop)

    def test_standardsti_brukes_nar_ingenting_annet_er_satt(self):
        self.sa.write_text("{}", encoding="utf-8")
        self.assertEqual(hemmelig.les_env()["GOOGLE_SA_JSON_PATH"], str(self.sa))

    def test_standardsti_overstyrer_ikke_en_satt_sti(self):
        self.sa.write_text("{}", encoding="utf-8")
        with mock.patch.dict(os.environ, {"GOOGLE_SA_JSON_PATH": "/min/egen/sti.json"}):
            self.assertEqual(hemmelig.les_env()["GOOGLE_SA_JSON_PATH"], "/min/egen/sti.json")

    def test_standardsti_overstyrer_ikke_base64_varianten(self):
        self.sa.write_text("{}", encoding="utf-8")
        with mock.patch.dict(os.environ, {"GOOGLE_SA_JSON": "base64her"}):
            self.assertNotIn("GOOGLE_SA_JSON_PATH", hemmelig.les_env())

    def test_ingen_nokkelfil_gir_ingen_sti(self):
        self.assertNotIn("GOOGLE_SA_JSON_PATH", hemmelig.les_env())


class Maskering(unittest.TestCase):

    def test_bytter_ut_hemmeligheten(self):
        self.assertEqual(hemmelig.masker("token=abcdefghijk", "abcdefghijk"),
                         "token=<maskert>")

    def test_korte_strenger_maskeres_ikke(self):
        # Ellers ville et hvilket som helst kort ord ødelagt feilmeldinger.
        self.assertEqual(hemmelig.masker("status=ok", "ok"), "status=ok")

    def test_tom_hemmelighet_er_trygt(self):
        self.assertEqual(hemmelig.masker("noe", "", None or ""), "noe")

    def test_flere_hemmeligheter(self):
        ut = hemmelig.masker("a=hemmelighet1 b=hemmelighet2", "hemmelighet1", "hemmelighet2")
        self.assertEqual(ut, "a=<maskert> b=<maskert>")


class Rapportering(unittest.TestCase):

    def test_mangler_returnerer_navn_ikke_verdier(self):
        env = {"DETOX_SUPABASE_URL": "en-verdi"}
        savnet = hemmelig.mangler(env, "DETOX_SUPABASE_URL", "GSC_SITE_URL")
        self.assertEqual(savnet, ["GSC_SITE_URL"])
        self.assertNotIn("en-verdi", " ".join(savnet))

    def test_kilder_sier_bare_sti_og_status(self):
        for linje in hemmelig.kilder():
            self.assertRegex(linje, r"(finnes|finnes ikke)$")


if __name__ == "__main__":
    unittest.main()
