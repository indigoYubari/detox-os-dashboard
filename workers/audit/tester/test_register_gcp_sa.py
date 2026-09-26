"""JA-porten og isolasjonen rundt det eneste skrivende kallet.

Kjernepåstanden testene vokter: uten et eksplisitt «JA» sendes ingenting.
`urllib.request.urlopen` erstattes med en funksjon som kaster hvis den blir kalt,
så en port som svikter gir en rød test og ikke en registrering.
"""
from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path
from unittest import mock

# Skriptet ligger i skript/, som ikke er en pakke. Det lastes derfor etter sti.
_STI = Path(__file__).resolve().parent.parent / "skript" / "register_gcp_sa.py"
_spec = importlib.util.spec_from_file_location("register_gcp_sa", _STI)
reg = importlib.util.module_from_spec(_spec)
sys.modules["register_gcp_sa"] = reg
_spec.loader.exec_module(reg)

ENV = {"GOOGLE_SA_JSON_PATH": "/finnes/ikke", "MERCHANT_ACCOUNT_ID": "5365874444"}


def _nett_forbudt(*a, **k):
    raise AssertionError("urllib.request.urlopen ble kalt — JA-porten sviktet")


class Endepunktet(unittest.TestCase):

    def test_er_v1_ikke_v1beta(self):
        url = reg._endepunkt("5365874444")
        self.assertIn("/accounts/v1/", url)
        self.assertNotIn("v1beta", url)
        self.assertNotIn("v1alpha", url)

    def test_riktig_metode_og_konto(self):
        self.assertEqual(
            reg._endepunkt("5365874444"),
            "https://merchantapi.googleapis.com/accounts/v1/accounts/5365874444"
            "/developerRegistration:registerGcp",
        )

    def test_developer_email_er_admin_kontoen_ikke_service_kontoen(self):
        self.assertEqual(reg.DEVELOPER_EMAIL, "b2b@detox.no")
        self.assertNotIn("iam.gserviceaccount.com", reg.DEVELOPER_EMAIL)

    def test_scopet_er_content(self):
        self.assertEqual(reg.SCOPE, "https://www.googleapis.com/auth/content")


class Isolasjon(unittest.TestCase):
    """Skriptet skal ikke gå gjennom read-only-vakten — den ville avvist det."""

    def test_importerer_ikke_merchant_klienten(self):
        kilde = _STI.read_text(encoding="utf-8")
        # Kommentarlinjer nevner klienten med vilje; det er import-setninger som teller.
        for linje in kilde.splitlines():
            s = linje.strip()
            if s.startswith(("import ", "from ")):
                self.assertNotIn("klienter", s, f"skal ikke importere klienter: {s}")

    def test_vakten_ville_avvist_dette_endepunktet(self):
        # Beviser at skriptet er unntatt vakten, ikke bare utenfor den ved uhell.
        from klienter import merchant
        with self.assertRaises(merchant.SkrivingAvvist):
            merchant._vakt("POST", reg._endepunkt("5365874444"))
        with self.assertRaises(merchant.SkrivingAvvist):
            merchant._vakt("GET", reg._endepunkt("5365874444"))


class JaPorten(unittest.TestCase):

    def setUp(self):
        for navn, verdi in (("les_env", lambda: dict(ENV)),
                            ("hent_token", lambda env, scopes: "falskt-token")):
            p = mock.patch.object(reg, navn, verdi)
            p.start()
            self.addCleanup(p.stop)
        p = mock.patch.object(reg.urllib.request, "urlopen", _nett_forbudt)
        p.start()
        self.addCleanup(p.stop)

    def _kjor(self, svar):
        with mock.patch.object(reg, "input", create=True, return_value=svar):
            return reg.kjor([])

    def test_nei_sender_ingenting(self):
        self.assertEqual(self._kjor("nei"), 1)

    def test_tomt_svar_sender_ingenting(self):
        self.assertEqual(self._kjor(""), 1)

    def test_ja_med_sma_bokstaver_sender_ingenting(self):
        # Porten krever STORE bokstaver. «ja» er ikke godt nok.
        self.assertEqual(self._kjor("ja"), 1)

    def test_yes_sender_ingenting(self):
        self.assertEqual(self._kjor("yes"), 1)

    def test_avbrudd_sender_ingenting(self):
        with mock.patch.object(reg, "input", create=True, side_effect=KeyboardInterrupt):
            self.assertEqual(reg.kjor([]), 1)

    def test_eof_sender_ingenting(self):
        # Kjørt uten terminal (f.eks. i en pipe) skal den avbryte, ikke sende.
        with mock.patch.object(reg, "input", create=True, side_effect=EOFError):
            self.assertEqual(reg.kjor([]), 1)


class ManglendeNokkel(unittest.TestCase):

    def test_stopper_uten_service_konto_nokkel(self):
        with mock.patch.object(reg, "les_env", lambda: {}), \
             mock.patch.object(reg.urllib.request, "urlopen", _nett_forbudt):
            self.assertEqual(reg.kjor([]), 1)


class Forklaringene(unittest.TestCase):
    """Feilkodene skal forklares, ikke bare gjentas."""

    def test_403_nevner_begge_arsakene(self):
        t = reg._forklar(403, "")
        self.assertIn("ADMIN", t)
        self.assertIn("service-konto", t)

    def test_404_er_sti_ikke_manglende_konto(self):
        self.assertIn("stien eller API-versjonen", reg._forklar(404, ""))

    def test_409_nevner_at_prosjektet_alt_er_registrert(self):
        self.assertIn("registrert", reg._forklar(409, ""))

    def test_200_sier_ikke_kjor_igjen(self):
        self.assertIn("ikke kjøres igjen", reg._forklar(200, ""))


if __name__ == "__main__":
    unittest.main()
