"""startRow-logikken og radmappingen, uten nett og uten nøkler.

Pagineringen er det som gjør at 25 000-grensen ikke stille kutter en dag. Den må
derfor kunne testes uten Google — ellers blir den aldri testet.
"""
from __future__ import annotations

import unittest
from unittest import mock

from felles.nett import Rate
from klienter import gsc

ENV = {"GOOGLE_SA_JSON_PATH": "/finnes/ikke"}


def _svar(antall: int, dimensjoner: int = 1, forskyvning: int = 0) -> dict:
    """Et GSC-lignende svar med `antall` rader."""
    return {
        "rows": [
            {
                "keys": ["2026-09-22"] + [f"v{i}" for i in range(dimensjoner - 1)],
                "clicks": 1, "impressions": 10, "ctr": 0.1, "position": 5.0,
            }
            for i in range(forskyvning, forskyvning + antall)
        ]
    }


class Paginering(unittest.TestCase):
    """hent_dag skal blaere til svaret er kortere enn rowLimit."""

    def setUp(self):
        # hent_token treffer nettet. Her erstattes den; testen handler om paginering.
        self.token = mock.patch.object(gsc, "hent_token", return_value="falskt-token")
        self.token.start()
        self.addCleanup(self.token.stop)

    def test_en_side_som_ikke_er_full(self):
        kall = []

        def falsk(metode, url, headers=None, body=None, timeout=60):
            kall.append(body["startRow"])
            return 200, _svar(5)

        rader, params = gsc.hent_dag(ENV, "sc-domain:detox.no", "2026-09-22",
                                     "gsc_site_daily", _http=falsk)
        self.assertEqual(kall, [0])
        self.assertEqual(len(rader), 5)
        self.assertEqual(params["dataState"], "final")
        self.assertEqual(params["table"], "gsc_site_daily")

    def test_tre_sider_der_den_siste_ikke_er_full(self):
        kall = []

        def falsk(metode, url, headers=None, body=None, timeout=60):
            kall.append(body["startRow"])
            n = gsc.MAKS_RADER if len(kall) <= 2 else 17
            return 200, _svar(n, dimensjoner=4)

        rader, _ = gsc.hent_dag(ENV, "sc-domain:detox.no", "2026-09-22",
                                "gsc_page_daily", _http=falsk)
        self.assertEqual(kall, [0, gsc.MAKS_RADER, 2 * gsc.MAKS_RADER])
        self.assertEqual(len(rader), 2 * gsc.MAKS_RADER + 17)

    def test_full_siste_side_etterfulgt_av_tom(self):
        # Grensetilfellet: dagen har nøyaktig MAKS_RADER rader. Da må jobben
        # spørre én gang til for å vite at det er slutt.
        kall = []

        def falsk(metode, url, headers=None, body=None, timeout=60):
            kall.append(body["startRow"])
            return (200, _svar(gsc.MAKS_RADER)) if len(kall) == 1 else (200, {"rows": []})

        rader, _ = gsc.hent_dag(ENV, "sc-domain:detox.no", "2026-09-22",
                                "gsc_site_daily", _http=falsk)
        self.assertEqual(kall, [0, gsc.MAKS_RADER])
        self.assertEqual(len(rader), gsc.MAKS_RADER)

    def test_svar_uten_rader(self):
        # En dag uten trafikk. Ingen rad = ukjent, ikke null — jobben skal ikke
        # dikte opp en nullrad.
        def falsk(metode, url, headers=None, body=None, timeout=60):
            return 200, {}

        rader, _ = gsc.hent_dag(ENV, "sc-domain:detox.no", "2026-09-22",
                                "gsc_site_daily", _http=falsk)
        self.assertEqual(rader, [])

    def test_rate_kastes_videre_til_jobben(self):
        def falsk(metode, url, headers=None, body=None, timeout=60):
            raise Rate(429, retry_after=60)

        with self.assertRaises(Rate):
            gsc.hent_dag(ENV, "sc-domain:detox.no", "2026-09-22",
                         "gsc_site_daily", _http=falsk)

    def test_feilstatus_blir_gscfeil(self):
        def falsk(metode, url, headers=None, body=None, timeout=60):
            return 403, "ingen tilgang til eiendommen"

        with self.assertRaises(gsc.GscFeil):
            gsc.hent_dag(ENV, "sc-domain:detox.no", "2026-09-22",
                         "gsc_site_daily", _http=falsk)

    def test_ukjent_granularitet_avvises(self):
        with self.assertRaises(gsc.GscFeil):
            gsc.hent_dag(ENV, "sc-domain:detox.no", "2026-09-22", "finnes_ikke")


class Radmapping(unittest.TestCase):
    """til_rader skal kopiere kildens tall, ikke regne ut egne."""

    def test_site_daily(self):
        raa = [{"keys": ["2026-09-22"], "clicks": 42, "impressions": 900,
                "ctr": 0.0467, "position": 8.7}]
        r = gsc.til_rader("gsc_site_daily", raa, "2026-09-22", "web")[0]
        self.assertEqual(r["date"], "2026-09-22")
        self.assertEqual(r["search_type"], "web")
        self.assertEqual(r["clicks"], 42)
        self.assertEqual(r["impressions"], 900)
        # CTR kommer fra GSC. 42/900 = 0.04667 — vi lagrer 0.0467, kildens tall.
        self.assertEqual(r["ctr"], 0.0467)
        self.assertEqual(r["position"], 8.7)

    def test_page_daily_alle_dimensjoner(self):
        raa = [{"keys": ["2026-09-22", "https://detox.no/products/x", "DESKTOP", "nor"],
                "clicks": 3, "impressions": 20, "ctr": 0.15, "position": 4.2}]
        r = gsc.til_rader("gsc_page_daily", raa, "2026-09-22", "web")[0]
        self.assertEqual(r["page"], "https://detox.no/products/x")
        # Enhet og land lagres rått, slik GSC skriver dem.
        self.assertEqual(r["device"], "DESKTOP")
        self.assertEqual(r["country"], "nor")
        self.assertNotIn("query", r)

    def test_query_page_daily(self):
        raa = [{"keys": ["2026-09-22", "binder dosering", "https://detox.no/x"],
                "clicks": 1, "impressions": 4, "ctr": 0.25, "position": 11.0}]
        r = gsc.til_rader("gsc_query_page_daily", raa, "2026-09-22", "web")[0]
        self.assertEqual(r["query"], "binder dosering")
        self.assertEqual(r["page"], "https://detox.no/x")
        self.assertNotIn("device", r)

    def test_rad_med_feil_antall_nokler_hoppes_over(self):
        raa = [
            {"keys": ["2026-09-22"], "clicks": 1},                      # for få
            {"keys": ["2026-09-22", "s", "DESKTOP", "nor"], "clicks": 2},  # riktig
        ]
        ut = gsc.til_rader("gsc_page_daily", raa, "2026-09-22", "web")
        self.assertEqual(len(ut), 1)
        self.assertEqual(ut[0]["clicks"], 2)

    def test_manglende_tall_blir_none_ikke_null(self):
        raa = [{"keys": ["2026-09-22"]}]
        r = gsc.til_rader("gsc_site_daily", raa, "2026-09-22", "web")[0]
        self.assertIsNone(r["clicks"])
        self.assertIsNone(r["ctr"])

    def test_site_total(self):
        raa = [{"clicks": 10, "impressions": 100}, {"clicks": 5, "impressions": 50},
               {"impressions": 7}]
        self.assertEqual(gsc.site_total(raa), {"klikk": 15, "visninger": 157})


if __name__ == "__main__":
    unittest.main()
