"""Search Console — KUN lesing.

Read-only-sikringen her er bevisst annerledes enn for Merchant (§6), fordi
Search Analytics er `POST .../searchAnalytics/query`: en POST som leser. En
«bare GET»-regel ville gjort klienten ubrukelig uten å gjøre den tryggere.

Sikringen er derfor to andre ting:
  1. Scope `webmasters.readonly`. Det scopet kan teknisk ikke skrive noe.
  2. En tillatelsesliste med nøyaktig ett endepunkt. Alt annet avvises av
     _sjekk_url() før det finnes en forespørsel.

Modulen eksporterer bare lesefunksjoner.
"""
from __future__ import annotations

import urllib.parse

from felles.google_auth import hent_token
from felles.nett import Rate, http

SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"

VERT = "https://searchconsole.googleapis.com"
# Det ENESTE endepunktet dette laget får bruke.
STI_MAL = "/webmasters/v3/sites/{site}/searchAnalytics/query"

# Googles grense per forespørsel. Paginering skjer med startRow.
MAKS_RADER = 25_000

# Granulariteter fra spesifikasjonen §3.2: tabellnavn → dimensjoner.
GRANULARITETER: dict[str, tuple[str, ...]] = {
    "gsc_site_daily": ("date",),
    "gsc_page_daily": ("date", "page", "device", "country"),
    "gsc_query_daily": ("date", "query", "device", "country"),
    "gsc_query_page_daily": ("date", "query", "page"),
}


class GscFeil(Exception):
    pass


class SkrivingAvvist(Exception):
    """Noe forsøkte å bruke denne klienten til noe annet enn det ene leseendepunktet."""


def _sjekk_url(url: str, site_url: str) -> None:
    """Tillatelsesliste. Kaster SkrivingAvvist på alt som ikke er lese-endepunktet."""
    forventet = VERT + STI_MAL.format(site=urllib.parse.quote(site_url, safe=""))
    if url != forventet:
        raise SkrivingAvvist(
            "GSC-klienten tillater kun searchAnalytics/query for den konfigurerte "
            f"eiendommen. Avviste: {url}"
        )


def _be_om(
    env: dict[str, str],
    site_url: str,
    kropp: dict,
    _http=None,
) -> dict:
    """Ett kall mot searchAnalytics/query. _http finnes for testing uten nett."""
    kall = _http or http
    url = VERT + STI_MAL.format(site=urllib.parse.quote(site_url, safe=""))
    _sjekk_url(url, site_url)
    token = hent_token(env, [SCOPE])
    status, data = kall(
        "POST",
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        body=kropp,
    )
    if status != 200 or not isinstance(data, dict):
        raise GscFeil(f"GSC svarte HTTP {status}: {str(data)[:400]}")
    return data


def hent_dag(
    env: dict[str, str],
    site_url: str,
    dato: str,
    tabell: str,
    search_type: str = "web",
    _http=None,
) -> tuple[list[dict], dict]:
    """Alle rader for én dag og én granularitet. Returnerer (rader, params).

    Pagineres med startRow til svaret er kortere enn MAKS_RADER. Kaster Rate
    videre til kalleren — det er jobben som bestemmer hvor lenge den venter.

    `params` er det som skal lagres i audit_snapshots.params, slik at hver rad
    vet nøyaktig hva som ble spurt om.
    """
    if tabell not in GRANULARITETER:
        raise GscFeil(f"Ukjent granularitet: {tabell}")
    dimensjoner = list(GRANULARITETER[tabell])

    params = {
        "date": dato,
        "table": tabell,
        "dimensions": dimensjoner,
        "searchType": search_type,
        "dataState": "final",
        "rowLimit": MAKS_RADER,
    }

    rader: list[dict] = []
    start = 0
    while True:
        kropp = {
            "startDate": dato,
            "endDate": dato,
            "dimensions": dimensjoner,
            "type": search_type,
            # 'final' utelater ferske, ujusterte tall. Historikk skal være stabil.
            "dataState": "final",
            "rowLimit": MAKS_RADER,
            "startRow": start,
        }
        data = _be_om(env, site_url, kropp, _http=_http)
        side = data.get("rows") or []
        rader.extend(side)
        if len(side) < MAKS_RADER:
            break
        start += MAKS_RADER

    return rader, params


def til_rader(tabell: str, rader: list[dict], dato: str, search_type: str) -> list[dict]:
    """GSC-svar → kolonner slik migrering 0013 definerer dem.

    Tallene kopieres som GSC oppgir dem. Ingenting regnes ut her — heller ikke
    CTR. Mangler et felt, blir det null, ikke et anslag.
    """
    dimensjoner = GRANULARITETER[tabell]
    ut: list[dict] = []
    for r in rader:
        nokler = r.get("keys") or []
        if len(nokler) != len(dimensjoner):
            # Kilden ga en rad vi ikke kan tolke. Hopp over den og la radtallet
            # avvike — det er ærligere enn å gjette hvilken dimensjon som mangler.
            continue
        d = dict(zip(dimensjoner, nokler))
        rad = {
            "date": d.get("date") or dato,
            "clicks": r.get("clicks"),
            "impressions": r.get("impressions"),
            "ctr": r.get("ctr"),
            "position": r.get("position"),
        }
        if tabell == "gsc_site_daily":
            rad["search_type"] = search_type
        if "page" in dimensjoner:
            rad["page"] = d.get("page")
        if "query" in dimensjoner:
            rad["query"] = d.get("query")
        if "device" in dimensjoner:
            rad["device"] = d.get("device")
        if "country" in dimensjoner:
            rad["country"] = d.get("country")
        ut.append(rad)
    return ut


def site_total(rader: list[dict]) -> dict:
    """Sum klikk og visninger i et sett rader. Brukes til kontroll mot GSC-UI."""
    return {
        "klikk": sum(int(r.get("clicks") or 0) for r in rader),
        "visninger": sum(int(r.get("impressions") or 0) for r in rader),
    }


__all__ = [
    "SCOPE",
    "MAKS_RADER",
    "GRANULARITETER",
    "GscFeil",
    "SkrivingAvvist",
    "Rate",
    "hent_dag",
    "til_rader",
    "site_total",
]
