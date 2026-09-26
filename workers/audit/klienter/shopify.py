"""Shopify Admin API — KUN GraphQL query, aldri mutation (spesifikasjon §6).

Hvorfor GraphQL og ikke REST, som src/app/api/shopify/i-dag/route.ts bruker:
i REST er en skriving bare en POST, så «kun lesing» må gates på HTTP-metode. I
GraphQL går alt over samme POST, og skillet ligger i dokumentet. Da kan vi
avvise skriving ved å avvise selve ordet `mutation` — en sikring som faktisk er
håndhevbar, og som er det §6 ber om.

Publiseringene (`resourcePublications`) finnes dessuten bare i GraphQL, og det er
de som forklarer 309 produkter i Merchant mot 301 i nettbutikken.
"""
from __future__ import annotations

import re

from felles.nett import Rate, http

# Nyeste stabile versjon. Shopify slipper nye kvartalsvis (2026-01, -04, -07, -10).
# MERK: repoets egen rute src/app/api/shopify/i-dag/route.ts står på 2024-01, som
# er utgått. Den er bevisst IKKE endret i denne sprinten. Se README.
API_VERSJON = "2026-07"

# Kommentarer strippes før sjekk, så en `# mutation` i et dokument ikke
# feilaktig avvises — og en ekte mutasjon ikke kan gjemmes bak en kommentar.
_KOMMENTAR = re.compile(r"#[^\n]*")
_MUTATION = re.compile(r"(?i)\bmutation\b")
_SUBSCRIPTION = re.compile(r"(?i)\bsubscription\b")


class ShopifyFeil(Exception):
    pass


class SkrivingAvvist(Exception):
    """Dokumentet var ikke en ren query."""


def _sjekk_dokument(dokument: str) -> None:
    """Kaster SkrivingAvvist på alt som ikke er en navngitt query.

    Kalles FØR det finnes en forespørsel, så et avvist dokument aldri sendes.
    """
    ren = _KOMMENTAR.sub("", dokument).strip()
    if not ren:
        raise SkrivingAvvist("Tomt GraphQL-dokument.")
    if _MUTATION.search(ren):
        raise SkrivingAvvist("Shopify-klienten avviser dokumenter som inneholder 'mutation'.")
    if _SUBSCRIPTION.search(ren):
        raise SkrivingAvvist("Shopify-klienten avviser 'subscription'.")
    # Krev eksplisitt `query`. Et anonymt `{ ... }` er gyldig GraphQL, men vi
    # skriver dokumentene selv, og en eksplisitt regel er lettere å håndheve.
    if not ren.lower().startswith("query"):
        raise SkrivingAvvist(
            "Shopify-klienten krever at dokumentet starter med 'query'. "
            f"Fikk: {ren[:40]!r}"
        )


def sporring(
    env: dict[str, str],
    dokument: str,
    variabler: dict | None = None,
    _http=None,
) -> dict:
    """Én GraphQL-query mot Admin API. _http finnes for testing uten nett."""
    _sjekk_dokument(dokument)
    butikk = env.get("SHOPIFY_SHOP_DOMAIN")
    token = env.get("SHOPIFY_ADMIN_TOKEN")
    if not butikk or not token:
        raise ShopifyFeil("SHOPIFY_SHOP_DOMAIN eller SHOPIFY_ADMIN_TOKEN mangler i miljøet")

    kall = _http or http
    url = f"https://{butikk}/admin/api/{API_VERSJON}/graphql.json"
    status, data = kall(
        "POST",
        url,
        headers={"X-Shopify-Access-Token": token, "Content-Type": "application/json"},
        body={"query": dokument, "variables": variabler or {}},
    )
    if status != 200 or not isinstance(data, dict):
        raise ShopifyFeil(f"Shopify svarte HTTP {status}: {str(data)[:400]}")
    if data.get("errors"):
        raise ShopifyFeil(f"GraphQL-feil: {str(data['errors'])[:400]}")
    return data.get("data") or {}


def api_versjon_svarer(env: dict[str, str], _http=None) -> tuple[bool, str]:
    """Sjekk at API_VERSJON faktisk finnes. Returnerer (ok, forklaring).

    Skriver ingenting, endrer ingenting. Brukes til å verifisere versjonsvalget
    før noe bygges på det.
    """
    try:
        data = sporring(env, "query { shop { name } }", _http=_http)
    except (ShopifyFeil, SkrivingAvvist) as e:
        return False, str(e)
    navn = (data.get("shop") or {}).get("name")
    return bool(navn), f"butikk: {navn}" if navn else "svarte uten shop.name"


__all__ = [
    "API_VERSJON",
    "ShopifyFeil",
    "SkrivingAvvist",
    "Rate",
    "sporring",
    "api_versjon_svarer",
]
