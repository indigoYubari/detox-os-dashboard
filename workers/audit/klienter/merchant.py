"""Merchant Center, API **v1** — KUN lesing, håndhevet av en vakt (spesifikasjon §6).

v1beta ble stengt 28.02.2026. Alle stier her er v1, verifisert mot Googles
dokumentasjon 26.09.2026 (se README, «Verifiserte v1-endepunkter»).

Scopet `content` tillater OGSÅ skriving. Read-only kan derfor ikke hviles på
scopet her, slik det kan for GSC. Sikringen er tre lag:

  1. Brukerrollen i Merchant Center (Kims ansvar, ikke kodens).
  2. _vakt(): avviser enhver HTTP-metode som ikke er GET.
  3. _vakt(): avviser enhver URL med et skrivende metodenavn i stien
     (insert, patch, update, delete, create, register, fetch).

Merchant API har dessuten en innebygd hjelp: `accounts.products` er en LEST
ressurs. Skriving skjer mot `accounts.productInputs`, som ikke finnes i denne
modulen. `_vakt()` avviser `productInputs` eksplisitt, så en framtidig utvidelse
ikke kan snike den inn.

`registerGcp` finnes IKKE her. Den ligger i skript/register-gcp.mjs, kjøres
manuelt én gang av et menneske med ADMIN, og er bevisst unntatt vakten.
"""
from __future__ import annotations

import re
import urllib.parse

from felles.google_auth import hent_token
from felles.nett import KildeFeil, Mangler, Nektet, Rate, http, reis

SCOPE = "https://www.googleapis.com/auth/content"

VERT = "https://merchantapi.googleapis.com"

# ── Verifiserte v1-stier (Googles dokumentasjon, 26.09.2026) ─────────────────
# products.list       GET /products/v1/accounts/{konto}/products        pageSize ≤ 1000
# products.get        GET /products/v1/accounts/{konto}/products/{id}
# dataSources.list    GET /datasources/v1/accounts/{konto}/dataSources  pageSize ≤ 1000
# accounts.issues.list GET /accounts/v1/accounts/{konto}/issues         pageSize ≤ 100 (std 50)
STI_PRODUKTER = "/products/v1/accounts/{konto}/products"
STI_PRODUKT = "/products/v1/accounts/{konto}/products/{produkt}"
STI_DATAKILDER = "/datasources/v1/accounts/{konto}/dataSources"
STI_VARSLER = "/accounts/v1/accounts/{konto}/issues"

# Googles egne maksverdier. Å be om mer gir 400, så de er ikke valgfrie.
MAKS_PRODUKTER_PER_SIDE = 1000
MAKS_DATAKILDER_PER_SIDE = 1000
MAKS_VARSLER_PER_SIDE = 100

# Sikkerhetsnett mot en nextPageToken som aldri tar slutt.
MAKS_SIDER = 500

# ── Vakten: tillatelsesliste først, svarteliste som andre lag ────────────────
#
# En tillatelsesliste er strengere enn en svarteliste: den avviser alt vi ikke
# har verifisert, inkludert endepunkter Google legger til i framtiden. Den unngår
# også falske avvisninger — en produkt-ID som inneholder «update» er ikke en
# skriving, og skal ikke stoppes.
#
# Produkt-ID-en kan ikke inneholde kolon. Det gjør at `products/x:delete` faller
# utenfor lista i stedet for å bli lest som en ID.
_TILLATT = (
    re.compile(r"^/products/v1/accounts/\d+/products$"),
    re.compile(r"^/products/v1/accounts/\d+/products/(?P<id>[^/:]+)$"),
    re.compile(r"^/datasources/v1/accounts/\d+/dataSources$"),
    re.compile(r"^/accounts/v1/accounts/\d+/issues$"),
)

# Andre lag. 'fetch' er med fordi dataSources.fetch utløser en henting hos Google
# — en bieffekt, ikke en lesing.
SKRIVEORD = ("insert", "patch", "update", "delete", "create", "register", "fetch")
_SKRIVEMONSTER = re.compile(r"(?i)(?:^|[/:._-])(" + "|".join(SKRIVEORD) + r")(?:$|[/:._-])")
# Skriveressursen i Merchant API. Skal aldri nås herfra.
_FORBUDT_RESSURS = re.compile(r"(?i)productInputs")


class MerchantFeil(Exception):
    pass


class SkrivingAvvist(Exception):
    """Vakten stoppet et kall som ikke var en ren lesing."""


def _vakt(metode: str, url: str) -> None:
    """Kaster SkrivingAvvist på alt som ikke er en GET mot et lese-endepunkt.

    Kalles FØR det finnes en forespørsel, så et avvist kall aldri treffer nettet.
    """
    if metode.upper() != "GET":
        raise SkrivingAvvist(
            f"Merchant-klienten tillater kun GET. Avviste {metode.upper()}."
        )
    # Bare stien sjekkes. Query-strengen kan inneholde produktdata (f.eks. en
    # tittel med ordet «update») og skal ikke utløse falske avvisninger.
    sti = urllib.parse.urlsplit(url).path

    # Lag 1: tillatelseslista. Alt som ikke er et verifisert leseendepunkt avvises.
    treff = next((m for m in (r.match(sti) for r in _TILLATT) if m), None)
    if treff is None:
        grunn = "ikke et verifisert v1-leseendepunkt"
        if _FORBUDT_RESSURS.search(sti):
            grunn = "productInputs er skriveressursen i Merchant API"
        elif "/v1beta/" in sti or "/v1alpha/" in sti:
            grunn = "v1beta ble stengt 28.02.2026 og v1alpha er ustabil — bruk v1"
        raise SkrivingAvvist(f"Merchant-klienten avviste {sti}: {grunn}.")

    # Lag 2: svartelista, på stien UTEN produkt-ID-en. ID-en er kundedata og skal
    # ikke kunne utløse en avvisning.
    uten_id = sti
    if "id" in treff.groupdict() and treff.group("id"):
        uten_id = sti[: treff.start("id")] + "{id}"
    if _SKRIVEMONSTER.search(uten_id):
        raise SkrivingAvvist(
            f"Merchant-klienten avviser skrivende metodenavn i stien: {uten_id}"
        )


def _get(env: dict[str, str], sti: str, parametre: dict | None = None, _http=None) -> dict:
    """GET mot Merchant API v1.

    Kaster Nektet (401/403), Mangler (404), Rate (429/5xx) eller KildeFeil.
    _http finnes for testing uten nett.
    """
    kall = _http or http
    url = VERT + sti
    if parametre:
        url += "?" + urllib.parse.urlencode(parametre)
    _vakt("GET", url)
    token = hent_token(env, [SCOPE])
    status, data = kall("GET", url, headers={"Authorization": f"Bearer {token}"})
    if status != 200:
        reis(status, data)
    if not isinstance(data, dict):
        raise MerchantFeil(f"Merchant svarte 200 men ikke et JSON-objekt: {type(data).__name__}")
    return data


def _alle_sider(
    env: dict[str, str],
    sti: str,
    felt: str,
    parametre: dict | None = None,
    _http=None,
    paa_side=None,
) -> list[dict]:
    """Følger nextPageToken til slutt. Returnerer råe objekter, uten mapping.

    `paa_side(nr, data)` kalles med hvert rå sidesvar før noe tolkes — det er der
    rådata lagres (felles/raa.py), slik spesifikasjonen krever.

    Ukjente toppnivåfelter i svaret ignoreres, ikke avvises: Google kan legge til
    felter, og en ny nøkkel skal ikke stoppe en henting.
    """
    ut: list[dict] = []
    p = dict(parametre or {})
    for nr in range(1, MAKS_SIDER + 1):
        data = _get(env, sti, p, _http=_http)
        if paa_side:
            paa_side(nr, data)
        rader = data.get(felt)
        if rader is None:
            # Tomt svar har ikke feltet i det hele tatt. Det er ikke en feil.
            rader = []
        if not isinstance(rader, list):
            raise MerchantFeil(
                f"Forventet at '{felt}' var en liste, fikk {type(rader).__name__}. "
                "Feltnavnet kan ha endret seg — sjekk rådata før du endrer koden."
            )
        ut.extend(r for r in rader if isinstance(r, dict))
        token = data.get("nextPageToken")
        if not token:
            return ut
        p["pageToken"] = token
    raise MerchantFeil(
        f"nextPageToken tok ikke slutt etter {MAKS_SIDER} sider. Avbrutt med vilje."
    )


# ── Lesefunksjonene. Modulen eksporterer ingenting annet. ────────────────────

def produkter(env: dict[str, str], konto: str, _http=None, paa_side=None) -> list[dict]:
    """Alle produkter i kontoen, råe. products.list, v1."""
    return _alle_sider(
        env, STI_PRODUKTER.format(konto=konto), "products",
        {"pageSize": MAKS_PRODUKTER_PER_SIDE}, _http=_http, paa_side=paa_side,
    )


def produkt(env: dict[str, str], konto: str, produkt_id: str, _http=None) -> dict:
    """Ett produkt, rått. products.get, v1.

    `produkt_id` er siste segment av ressursnavnet, f.eks. 'online~no~NO~12345'.
    Det inneholder tegn som må kodes.
    """
    sti = STI_PRODUKT.format(
        konto=konto, produkt=urllib.parse.quote(produkt_id, safe=""),
    )
    return _get(env, sti, None, _http=_http)


def datakilder(env: dict[str, str], konto: str, _http=None, paa_side=None) -> list[dict]:
    """Datakildene i kontoen, råe. dataSources.list, v1.

    Her ser vi hvordan «Found by Google»-produktene faktisk kommer inn.
    """
    return _alle_sider(
        env, STI_DATAKILDER.format(konto=konto), "dataSources",
        {"pageSize": MAKS_DATAKILDER_PER_SIDE}, _http=_http, paa_side=paa_side,
    )


def kontovarsler(env: dict[str, str], konto: str, _http=None, paa_side=None) -> list[dict]:
    """Kontonivå-varsler, råe. accounts.issues.list, v1. pageSize er maks 100 her."""
    return _alle_sider(
        env, STI_VARSLER.format(konto=konto), "accountIssues",
        {"pageSize": MAKS_VARSLER_PER_SIDE}, _http=_http, paa_side=paa_side,
    )


# ── Feltrapport: hvor ligger feltene spesifikasjonen §3.3 antar? ─────────────
#
# Dokumentasjonen sier at produktdata ligger under `productAttributes` og status
# under `productStatus` — ikke på toppnivå, som §3.3 antar. Referansesidene
# rendres med JavaScript og kunne ikke leses direkte, så de eksakte navnene er
# bekreftet fra dokumentasjonstekst og søketreff, IKKE fra et ekte svar.
#
# Derfor gjetter ikke koden. Den leter på flere kandidatstier, rapporterer hvilken
# som traff, og lagrer alltid hele råobjektet. Traff ingen, står feltet som ukjent
# — aldri som null.

# kolonne i 0013 → kandidatstier, i prioritert rekkefølge
FELTKART: dict[str, tuple[tuple[str, ...], ...]] = {
    "offer_id": (("offerId",),),
    "data_source": (("dataSource",),),
    "feed_label": (("feedLabel",),),
    "content_language": (("contentLanguage",),),
    "title": (("productAttributes", "title"), ("attributes", "title"), ("title",)),
    "link": (("productAttributes", "link"), ("attributes", "link"), ("link",)),
    "image_link": (("productAttributes", "imageLink"), ("attributes", "imageLink")),
    "brand": (("productAttributes", "brand"), ("attributes", "brand")),
    # Dokumentasjonen omtaler feltet som `gtins` (liste). `gtin` er v1beta-formen.
    "gtin": (("productAttributes", "gtins"), ("productAttributes", "gtin"),
             ("attributes", "gtins"), ("attributes", "gtin")),
    "mpn": (("productAttributes", "mpn"), ("attributes", "mpn")),
    "availability": (("productAttributes", "availability"), ("attributes", "availability")),
    "price_micros": (("productAttributes", "price", "amountMicros"),
                     ("attributes", "price", "amountMicros")),
    "currency": (("productAttributes", "price", "currencyCode"),
                 ("attributes", "price", "currencyCode")),
    "condition": (("productAttributes", "condition"), ("attributes", "condition")),
    "destination_statuses": (("productStatus", "destinationStatuses"),
                             ("destinationStatuses",)),
    "item_level_issues": (("productStatus", "itemLevelIssues"), ("itemLevelIssues",)),
}


def _plukk(obj: dict, sti: tuple[str, ...]):
    """Følg en nøkkelsti. Returnerer (funnet, verdi)."""
    naa = obj
    for nokkel in sti:
        if not isinstance(naa, dict) or nokkel not in naa:
            return False, None
        naa = naa[nokkel]
    return True, naa


def feltrapport(produkt_obj: dict) -> dict:
    """Hvor ligger hvert felt fra §3.3 i DETTE svaret?

    Returnerer {kolonne: {"funnet": bool, "sti": "a.b.c" | None, "type": str}}.
    Rapporterer. Endrer ingenting, antar ingenting.
    """
    ut: dict[str, dict] = {}
    for kolonne, kandidater in FELTKART.items():
        treff = None
        verdi = None
        for sti in kandidater:
            ok, v = _plukk(produkt_obj, sti)
            if ok:
                treff, verdi = ".".join(sti), v
                break
        ut[kolonne] = {
            "funnet": treff is not None,
            "sti": treff,
            "type": type(verdi).__name__ if treff else None,
        }
    return ut


def til_rad(produkt_obj: dict) -> dict:
    """Produkt → kolonnene i audit_merchant_products, med hele råsvaret bevart.

    Felter som ikke finnes blir None — ikke et anslag. `attributes` holder hele
    råobjektet og er autoritativt ved uenighet, slik §3.3 krever.
    """
    rad: dict = {"name": produkt_obj.get("name")}
    for kolonne in FELTKART:
        treff = None
        for sti in FELTKART[kolonne]:
            ok, v = _plukk(produkt_obj, sti)
            if ok:
                treff = v
                break
        rad[kolonne] = treff
    # gtin-kolonnen er text[] i 0013. Én streng pakkes i en liste; ingenting kastes.
    if isinstance(rad.get("gtin"), str):
        rad["gtin"] = [rad["gtin"]]
    # price_micros er bigint i 0013, men Google sender micros som streng.
    p = rad.get("price_micros")
    if isinstance(p, str):
        try:
            rad["price_micros"] = int(p)
        except ValueError:
            # Uventet format. Behold råverdien i attributes og sett kolonnen null.
            rad["price_micros"] = None
    rad["attributes"] = produkt_obj
    return rad


__all__ = [
    "SCOPE",
    "SKRIVEORD",
    "STI_PRODUKTER", "STI_PRODUKT", "STI_DATAKILDER", "STI_VARSLER",
    "MAKS_PRODUKTER_PER_SIDE", "MAKS_DATAKILDER_PER_SIDE", "MAKS_VARSLER_PER_SIDE",
    "MerchantFeil", "SkrivingAvvist",
    "KildeFeil", "Nektet", "Mangler", "Rate",
    "produkter", "produkt", "datakilder", "kontovarsler",
    "FELTKART", "feltrapport", "til_rad",
]
