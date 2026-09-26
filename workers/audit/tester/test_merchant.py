"""Merchant v1: stier, paginering, feilhåndtering og ukjente felt.

Alt offline. Ingen nøkler, ingen nett, ingen base.
"""
from __future__ import annotations

import unittest
from unittest import mock

from felles.nett import KildeFeil, Mangler, Nektet, Rate, feildetaljer
from klienter import merchant

ENV = {"GOOGLE_SA_JSON_PATH": "/finnes/ikke"}
KONTO = "5365874444"


def _nett_forbudt(*a, **k):
    raise AssertionError("http() ble kalt — vakten slapp gjennom et kall")


class V1Stier(unittest.TestCase):
    """v1beta ble stengt 28.02.2026. Ingen sti får peke dit."""

    def test_ingen_v1beta_eller_v1alpha_i_stiene(self):
        for sti in (merchant.STI_PRODUKTER, merchant.STI_PRODUKT,
                    merchant.STI_DATAKILDER, merchant.STI_VARSLER):
            with self.subTest(sti=sti):
                self.assertNotIn("v1beta", sti)
                self.assertNotIn("v1alpha", sti)
                self.assertIn("/v1/", sti)

    def test_stiene_er_de_verifiserte(self):
        self.assertEqual(merchant.STI_PRODUKTER, "/products/v1/accounts/{konto}/products")
        self.assertEqual(merchant.STI_DATAKILDER,
                         "/datasources/v1/accounts/{konto}/dataSources")
        self.assertEqual(merchant.STI_VARSLER, "/accounts/v1/accounts/{konto}/issues")

    def test_googles_maksverdier(self):
        # Å be om mer enn Googles maks gir 400. Disse er ikke valgfrie.
        self.assertEqual(merchant.MAKS_PRODUKTER_PER_SIDE, 1000)
        self.assertEqual(merchant.MAKS_DATAKILDER_PER_SIDE, 1000)
        self.assertEqual(merchant.MAKS_VARSLER_PER_SIDE, 100)

    def test_vakten_avviser_v1beta(self):
        with self.assertRaises(merchant.SkrivingAvvist):
            merchant._vakt("GET", merchant.VERT + "/products/v1beta/accounts/1/products")


class Vakten(unittest.TestCase):

    def test_godtar_de_fire_leseendepunktene(self):
        for sti in (f"/products/v1/accounts/{KONTO}/products",
                    f"/products/v1/accounts/{KONTO}/products/online~no~NO~12345",
                    f"/datasources/v1/accounts/{KONTO}/dataSources",
                    f"/accounts/v1/accounts/{KONTO}/issues"):
            with self.subTest(sti=sti):
                merchant._vakt("GET", merchant.VERT + sti)

    def test_avviser_alle_metoder_som_ikke_er_get(self):
        url = merchant.VERT + f"/products/v1/accounts/{KONTO}/products"
        for metode in ("POST", "PUT", "PATCH", "DELETE", "post"):
            with self.subTest(metode=metode):
                with self.assertRaises(merchant.SkrivingAvvist):
                    merchant._vakt(metode, url)

    def test_avviser_skrivende_endepunkter(self):
        for sti in (f"/products/v1/accounts/{KONTO}/products:insert",
                    f"/products/v1/accounts/{KONTO}/products/1:delete",
                    f"/products/v1/accounts/{KONTO}/productInputs",
                    f"/products/v1/accounts/{KONTO}/productInputs:insert",
                    f"/datasources/v1/accounts/{KONTO}/dataSources:create",
                    f"/datasources/v1/accounts/{KONTO}/dataSources/1:fetch",
                    f"/accounts/v1/accounts/{KONTO}/developerRegistration:registerGcp",
                    "/products/v1/accounts/1/products/2/localInventories"):
            with self.subTest(sti=sti):
                with self.assertRaises(merchant.SkrivingAvvist):
                    merchant._vakt("GET", merchant.VERT + sti)

    def test_produkt_id_med_ordet_update_avvises_ikke(self):
        # ID-en er kundedata. Den skal ikke kunne utløse en falsk avvisning.
        merchant._vakt(
            "GET",
            merchant.VERT + f"/products/v1/accounts/{KONTO}/products/online~no~NO~update-2",
        )

    def test_avvist_kall_naar_ikke_nettet(self):
        with self.assertRaises(merchant.SkrivingAvvist):
            merchant._get(ENV, f"/products/v1beta/accounts/{KONTO}/products",
                          _http=_nett_forbudt)

    def test_productinputs_finnes_ikke_i_modulen(self):
        for navn in dir(merchant):
            self.assertNotIn("productinput", navn.lower())
            self.assertNotIn("register", navn.lower())


class Paginering(unittest.TestCase):

    def setUp(self):
        self.token = mock.patch.object(merchant, "hent_token", return_value="falskt")
        self.token.start()
        self.addCleanup(self.token.stop)

    def test_folger_nextpagetoken(self):
        kall = []

        def falsk(metode, url, headers=None, body=None, timeout=60):
            kall.append(url)
            if "pageToken=t1" in url:
                return 200, {"products": [{"name": "c"}]}
            if "pageToken" in url:
                return 200, {"products": [{"name": "b"}], "nextPageToken": "t1"}
            return 200, {"products": [{"name": "a"}], "nextPageToken": "t0"}

        ut = merchant.produkter(ENV, KONTO, _http=falsk)
        self.assertEqual([p["name"] for p in ut], ["a", "b", "c"])
        self.assertEqual(len(kall), 3)
        self.assertIn(f"pageSize={merchant.MAKS_PRODUKTER_PER_SIDE}", kall[0])

    def test_tomt_svar_uten_feltet_er_ikke_feil(self):
        # En konto uten produkter svarer {} — ikke {"products": []}.
        def falsk(metode, url, headers=None, body=None, timeout=60):
            return 200, {}

        self.assertEqual(merchant.produkter(ENV, KONTO, _http=falsk), [])

    def test_feil_type_paa_listefeltet_stopper_med_forklaring(self):
        def falsk(metode, url, headers=None, body=None, timeout=60):
            return 200, {"products": {"ikke": "en liste"}}

        with self.assertRaises(merchant.MerchantFeil) as ctx:
            merchant.produkter(ENV, KONTO, _http=falsk)
        self.assertIn("liste", str(ctx.exception))

    def test_uendelig_paginering_avbrytes(self):
        def falsk(metode, url, headers=None, body=None, timeout=60):
            return 200, {"products": [{"name": "x"}], "nextPageToken": "alltid"}

        with self.assertRaises(merchant.MerchantFeil):
            merchant.produkter(ENV, KONTO, _http=falsk)

    def test_paa_side_far_raa_svar_for_tolkning(self):
        sett = []

        def falsk(metode, url, headers=None, body=None, timeout=60):
            return 200, {"products": [{"name": "a"}], "ukjentFelt": 1}

        merchant.produkter(ENV, KONTO, _http=falsk,
                           paa_side=lambda nr, d: sett.append((nr, d)))
        self.assertEqual(sett[0][0], 1)
        # Rådata skal være uendret, inkludert felter vi ikke kjenner.
        self.assertEqual(sett[0][1]["ukjentFelt"], 1)

    def test_ukjente_toppnivafelter_ignoreres_ikke_avvises(self):
        def falsk(metode, url, headers=None, body=None, timeout=60):
            return 200, {"products": [{"name": "a"}], "nyttFeltFraGoogle": {"x": 1},
                         "enda_et": [1, 2]}

        self.assertEqual(len(merchant.produkter(ENV, KONTO, _http=falsk)), 1)

    def test_ikke_dict_i_lista_hoppes_over(self):
        def falsk(metode, url, headers=None, body=None, timeout=60):
            return 200, {"products": [{"name": "a"}, "rar streng", None]}

        self.assertEqual(len(merchant.produkter(ENV, KONTO, _http=falsk)), 1)

    def test_varsler_bruker_riktig_maks(self):
        kall = []

        def falsk(metode, url, headers=None, body=None, timeout=60):
            kall.append(url)
            return 200, {"accountIssues": []}

        merchant.kontovarsler(ENV, KONTO, _http=falsk)
        self.assertIn("pageSize=100", kall[0])


class Feilhandtering(unittest.TestCase):
    """401, 403, 404, 429 og 5xx skal bli typede unntak med Googles REASON."""

    def setUp(self):
        self.token = mock.patch.object(merchant, "hent_token", return_value="falskt")
        self.token.start()
        self.addCleanup(self.token.stop)

    def _svar(self, status: int, reason: str = "", navn: str = ""):
        def falsk(metode, url, headers=None, body=None, timeout=60):
            if status in (429, 500, 502, 503, 504):
                raise Rate(status, None, reason, "for mye")
            return status, {
                "error": {
                    "code": status, "message": "noe gikk galt", "status": navn,
                    "details": [{
                        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
                        "reason": reason, "domain": "merchantapi.googleapis.com",
                        "metadata": {"REASON": reason},
                    }],
                }
            }
        return falsk

    def test_401_blir_nektet(self):
        with self.assertRaises(Nektet) as c:
            merchant.produkter(ENV, KONTO, _http=self._svar(401, "", "UNAUTHENTICATED"))
        self.assertEqual(c.exception.status, 401)

    def test_403_blir_nektet_med_reason(self):
        with self.assertRaises(Nektet) as c:
            merchant.produkter(
                ENV, KONTO,
                _http=self._svar(403, "developer_registration_required", "PERMISSION_DENIED"))
        self.assertEqual(c.exception.status, 403)
        self.assertEqual(c.exception.reason, "developer_registration_required")

    def test_gcp_not_registered_er_401_ikke_403(self):
        # Ekte svar fra Merchant API 26.09.2026. Registreringen mangler, og Google
        # svarer 401 UNAUTHENTICATED med REASON=GCP_NOT_REGISTERED — ikke 403, som
        # man skulle tro. Derfor kan ikke koden gjette på statuskoden alene.
        with self.assertRaises(Nektet) as c:
            merchant.produkter(
                ENV, KONTO, _http=self._svar(401, "GCP_NOT_REGISTERED", "UNAUTHENTICATED"))
        self.assertEqual(c.exception.status, 401)
        self.assertEqual(c.exception.reason, "GCP_NOT_REGISTERED")

    def test_404_blir_mangler(self):
        with self.assertRaises(Mangler) as c:
            merchant.produkter(ENV, KONTO, _http=self._svar(404, "", "NOT_FOUND"))
        self.assertEqual(c.exception.status, 404)

    def test_429_blir_rate(self):
        with self.assertRaises(Rate) as c:
            merchant.produkter(
                ENV, KONTO, _http=self._svar(429, "quota/request_rate_too_high"))
        self.assertEqual(c.exception.status, 429)
        self.assertEqual(c.exception.reason, "quota/request_rate_too_high")

    def test_5xx_blir_rate_og_er_dermed_noe_man_prover_igjen(self):
        for status in (500, 502, 503, 504):
            with self.subTest(status=status):
                with self.assertRaises(Rate) as c:
                    merchant.produkter(ENV, KONTO,
                                       _http=self._svar(status, "internal_error"))
                self.assertEqual(c.exception.status, status)

    def test_400_blir_generisk_kildefeil(self):
        with self.assertRaises(KildeFeil) as c:
            merchant.produkter(ENV, KONTO, _http=self._svar(400, "", "INVALID_ARGUMENT"))
        self.assertEqual(c.exception.status, 400)
        self.assertNotIsInstance(c.exception, (Nektet, Mangler, Rate))

    def test_200_men_ikke_objekt(self):
        def falsk(metode, url, headers=None, body=None, timeout=60):
            return 200, "<html>en feilside</html>"

        with self.assertRaises(merchant.MerchantFeil):
            merchant.produkter(ENV, KONTO, _http=falsk)


class Feildetaljer(unittest.TestCase):
    """AIP-193-parsing. Google sier: bruk metadata.REASON, ikke meldingsteksten."""

    def test_plukker_metadata_reason(self):
        d = feildetaljer({"error": {"code": 403, "message": "m", "status": "PERMISSION_DENIED",
                                    "details": [{"reason": "r1",
                                                 "metadata": {"REASON": "ekte_grunn"}}]}})
        self.assertEqual(d["reason"], "ekte_grunn")
        self.assertEqual(d["status"], "PERMISSION_DENIED")

    def test_faller_tilbake_pa_reason(self):
        d = feildetaljer({"error": {"details": [{"reason": "bare_denne"}]}})
        self.assertEqual(d["reason"], "bare_denne")

    def test_talker_svar_som_ikke_er_aip193(self):
        self.assertEqual(feildetaljer("ren tekst")["melding"], "ren tekst")
        self.assertEqual(feildetaljer(None)["reason"], "")
        self.assertEqual(feildetaljer({"noe": "annet"})["reason"], "")
        self.assertEqual(feildetaljer({"error": "ikke et objekt"})["reason"], "")
        self.assertEqual(feildetaljer({"error": {"details": "ikke en liste"}})["reason"], "")


class Feltkart(unittest.TestCase):
    """Feltrapporten skal rapportere, ikke gjette."""

    # Formen dokumentasjonen beskriver for v1: data under productAttributes,
    # status under productStatus, price som {amountMicros, currencyCode}.
    V1_PRODUKT = {
        "name": "accounts/5365874444/products/online~no~NO~megaspore",
        "offerId": "shopify_NO_123_456",
        "dataSource": "accounts/5365874444/dataSources/111",
        "feedLabel": "NO",
        "contentLanguage": "no",
        "productAttributes": {
            "title": "MegaSporeBiotic",
            "link": "https://detox.no/products/megasporebiotic-sporebiotika",
            "imageLink": "https://cdn.shopify.com/x.jpg",
            "brand": "Microbiome Labs",
            "gtins": ["0850000000001"],
            "mpn": "MSB-60",
            "availability": "in_stock",
            "price": {"amountMicros": "69900000", "currencyCode": "NOK"},
            "condition": "new",
        },
        "productStatus": {
            "destinationStatuses": [{"reportingContext": "SHOPPING_ADS"}],
            "itemLevelIssues": [{"code": "invalid_brand"}],
        },
    }

    def test_alle_felter_funnet_i_v1_formen(self):
        r = merchant.feltrapport(self.V1_PRODUKT)
        savnet = [k for k, v in r.items() if not v["funnet"]]
        self.assertEqual(savnet, [], f"skulle funnet alt, manglet: {savnet}")
        self.assertEqual(r["gtin"]["sti"], "productAttributes.gtins")
        self.assertEqual(r["price_micros"]["sti"], "productAttributes.price.amountMicros")
        self.assertEqual(r["item_level_issues"]["sti"], "productStatus.itemLevelIssues")

    def test_gtin_entall_tas_ogsa(self):
        p = {"productAttributes": {"gtin": "123"}}
        self.assertEqual(merchant.feltrapport(p)["gtin"]["sti"], "productAttributes.gtin")

    def test_manglende_felt_rapporteres_ikke_gjettes(self):
        r = merchant.feltrapport({"name": "x"})
        self.assertFalse(r["title"]["funnet"])
        self.assertIsNone(r["title"]["sti"])

    def test_til_rad_bevarer_hele_rasvaret(self):
        rad = merchant.til_rad(self.V1_PRODUKT)
        self.assertEqual(rad["attributes"], self.V1_PRODUKT)
        self.assertEqual(rad["title"], "MegaSporeBiotic")
        self.assertEqual(rad["gtin"], ["0850000000001"])
        # micros kommer som streng fra Google, kolonnen er bigint.
        self.assertEqual(rad["price_micros"], 69900000)
        self.assertEqual(rad["currency"], "NOK")

    def test_til_rad_pakker_enkelt_gtin_i_liste(self):
        rad = merchant.til_rad({"productAttributes": {"gtin": "123"}})
        self.assertEqual(rad["gtin"], ["123"])

    def test_til_rad_setter_none_ikke_anslag(self):
        rad = merchant.til_rad({"name": "x"})
        for kolonne in ("title", "brand", "availability", "price_micros", "currency"):
            self.assertIsNone(rad[kolonne], f"{kolonne} skulle vært None")

    def test_ugyldig_micros_blir_none_men_radata_beholdes(self):
        p = {"productAttributes": {"price": {"amountMicros": "seksti-ni", "currencyCode": "NOK"}}}
        rad = merchant.til_rad(p)
        self.assertIsNone(rad["price_micros"])
        self.assertEqual(rad["attributes"], p)

    def test_ukjente_felter_i_produktet_bevares_i_attributes(self):
        p = dict(self.V1_PRODUKT, nyttFeltFraGoogle={"noe": 1})
        rad = merchant.til_rad(p)
        self.assertEqual(rad["attributes"]["nyttFeltFraGoogle"], {"noe": 1})


if __name__ == "__main__":
    unittest.main()
