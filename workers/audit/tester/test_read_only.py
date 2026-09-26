"""Read-only-sikringen (spesifikasjon §6): hver skriving skal FEILE.

Testene er offline med vilje. Vakten avviser før det finnes en forespørsel, så
ingen av dem trenger nett, nøkler eller en base. Treffer en av dem nettet, er
sikringen feil bygget.

Kjør:  python3 -m unittest discover -s tester -t . -v
"""
from __future__ import annotations

import unittest

from klienter import gsc, merchant, shopify


def _nett_forbudt(*a, **k):
    """Erstatter http() i testene. Kalles den, har vakten sviktet."""
    raise AssertionError("http() ble kalt — vakten slapp gjennom et kall")


class MerchantAvviserSkriving(unittest.TestCase):
    """Merchant-scopet 'content' tillater skriving. Vakten er det som stopper den."""

    def test_avviser_alle_metoder_som_ikke_er_get(self):
        for metode in ("POST", "PUT", "PATCH", "DELETE", "post", "patch"):
            with self.subTest(metode=metode):
                with self.assertRaises(merchant.SkrivingAvvist):
                    merchant._vakt(metode, "https://merchantapi.googleapis.com/x/y")

    def test_godtar_get(self):
        merchant._vakt("GET", "https://merchantapi.googleapis.com/products/v1beta/x/products")

    def test_avviser_skrivende_metodenavn_i_stien(self):
        stier = (
            "/products/v1beta/accounts/1/products:insert",
            "/products/v1beta/accounts/1/products/create",
            "/accounts/v1beta/accounts/1:update",
            "/accounts/v1beta/accounts/1/products/2:delete",
            "/accounts/v1beta/accounts/1/developerRegistration:register",
            "/datasources/v1beta/accounts/1/dataSources:patch",
        )
        for sti in stier:
            with self.subTest(sti=sti):
                with self.assertRaises(merchant.SkrivingAvvist):
                    merchant._vakt("GET", "https://merchantapi.googleapis.com" + sti)

    def test_lesekall_naar_ikke_nettet_hvis_vakten_avviser(self):
        # _get bruker vakten. En skrivende sti skal stoppe før http() kalles.
        with self.assertRaises(merchant.SkrivingAvvist):
            merchant._get({}, "/products/v1beta/accounts/1/products:insert", _http=_nett_forbudt)

    def test_query_streng_utloser_ikke_falsk_avvisning(self):
        # Et produktnavn kan inneholde 'update'. Bare stien sjekkes.
        merchant._vakt(
            "GET",
            "https://merchantapi.googleapis.com/products/v1beta/accounts/1/products"
            "?filter=title%3Dupdate",
        )

    def test_registergcp_finnes_ikke_i_modulen(self):
        # Det eneste skrivende kallet i sprinten ligger i skript/register-gcp.mjs,
        # bevisst utenfor denne modulen.
        for navn in dir(merchant):
            self.assertNotIn("register", navn.lower())


class ShopifyAvviserMutasjon(unittest.TestCase):

    def test_avviser_mutation(self):
        dok = "mutation { productUpdate(input: {id: 1}) { product { id } } }"
        with self.assertRaises(shopify.SkrivingAvvist):
            shopify._sjekk_dokument(dok)

    def test_avviser_mutation_etter_query(self):
        dok = "query A { shop { name } }\nmutation B { productDelete(input: {}) { id } }"
        with self.assertRaises(shopify.SkrivingAvvist):
            shopify._sjekk_dokument(dok)

    def test_avviser_mutation_gjemt_bak_kommentar(self):
        # Kommentarer strippes FØR sjekken, så dette skal fortsatt avvises.
        dok = "query Q { shop { name } } # snill\nmutation M { x }"
        with self.assertRaises(shopify.SkrivingAvvist):
            shopify._sjekk_dokument(dok)

    def test_avviser_subscription(self):
        with self.assertRaises(shopify.SkrivingAvvist):
            shopify._sjekk_dokument("subscription S { x }")

    def test_avviser_anonymt_dokument(self):
        with self.assertRaises(shopify.SkrivingAvvist):
            shopify._sjekk_dokument("{ shop { name } }")

    def test_avviser_tomt_dokument(self):
        with self.assertRaises(shopify.SkrivingAvvist):
            shopify._sjekk_dokument("   \n # bare en kommentar \n ")

    def test_godtar_ren_query(self):
        shopify._sjekk_dokument("query Produkter { products(first: 10) { nodes { id } } }")

    def test_mutasjon_naar_ikke_nettet(self):
        env = {"SHOPIFY_SHOP_DOMAIN": "x.myshopify.com", "SHOPIFY_ADMIN_TOKEN": "t" * 20}
        with self.assertRaises(shopify.SkrivingAvvist):
            shopify.sporring(env, "mutation M { x }", _http=_nett_forbudt)

    def test_ordet_mutation_i_variabler_er_greit(self):
        # Variabler er ikke dokumentet. De skal ikke kunne utløse avvisning.
        kalt = {}

        def falsk_http(metode, url, headers=None, body=None, timeout=60):
            kalt["body"] = body
            return 200, {"data": {"products": {"nodes": []}}}

        env = {"SHOPIFY_SHOP_DOMAIN": "x.myshopify.com", "SHOPIFY_ADMIN_TOKEN": "t" * 20}
        shopify.sporring(
            env, "query S($q: String) { products(first: 1, query: $q) { nodes { id } } }",
            {"q": "title:mutation"}, _http=falsk_http,
        )
        self.assertEqual(kalt["body"]["variables"], {"q": "title:mutation"})


class GscErLesescope(unittest.TestCase):

    def test_scopet_er_readonly(self):
        self.assertEqual(gsc.SCOPE, "https://www.googleapis.com/auth/webmasters.readonly")

    def test_tillatelsesliste_avviser_annet_endepunkt(self):
        with self.assertRaises(gsc.SkrivingAvvist):
            gsc._sjekk_url(
                "https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Adetox.no",
                "sc-domain:detox.no",
            )

    def test_tillatelsesliste_avviser_sitemap_skriving(self):
        with self.assertRaises(gsc.SkrivingAvvist):
            gsc._sjekk_url(
                "https://searchconsole.googleapis.com/webmasters/v3/sites/"
                "sc-domain%3Adetox.no/sitemaps/x",
                "sc-domain:detox.no",
            )

    def test_tillatelsesliste_avviser_annen_eiendom(self):
        with self.assertRaises(gsc.SkrivingAvvist):
            gsc._sjekk_url(
                "https://searchconsole.googleapis.com/webmasters/v3/sites/"
                "sc-domain%3Aannen.no/searchAnalytics/query",
                "sc-domain:detox.no",
            )

    def test_godtar_lese_endepunktet(self):
        gsc._sjekk_url(
            "https://searchconsole.googleapis.com/webmasters/v3/sites/"
            "sc-domain%3Adetox.no/searchAnalytics/query",
            "sc-domain:detox.no",
        )


if __name__ == "__main__":
    unittest.main()
