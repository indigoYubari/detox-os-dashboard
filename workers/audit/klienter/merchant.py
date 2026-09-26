"""Merchant Center — KUN lesing, håndhevet av en vakt (spesifikasjon §6).

Scopet `content` tillater OGSÅ skriving. Read-only kan derfor ikke hviles på
scopet her, slik det kan for GSC. Sikringen er tre lag:

  1. Brukerrollen i Merchant Center (Kims ansvar, ikke kodens).
  2. _vakt(): avviser enhver HTTP-metode som ikke er GET.
  3. _vakt(): avviser enhver URL som inneholder et skrivende metodenavn
     (insert, patch, update, delete, create, register).

`registerGcp` finnes IKKE i denne modulen. Den ligger i
skript/register-gcp.mjs, kjøres manuelt én gang av et menneske med ADMIN, og er
bevisst unntatt vakten. Se README.
"""
from __future__ import annotations

import re
import urllib.parse

from felles.google_auth import hent_token
from felles.nett import Rate, http

SCOPE = "https://www.googleapis.com/auth/content"

VERT = "https://merchantapi.googleapis.com"

# Metodenavn som betyr skriving. Treffer både sti-segmenter (accounts/.../insert)
# og custom methods (:update, :delete).
SKRIVEORD = ("insert", "patch", "update", "delete", "create", "register")
_SKRIVEMONSTER = re.compile(r"(?i)(?:^|[/:._-])(" + "|".join(SKRIVEORD) + r")(?:$|[/:._-])")


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
    delt = urllib.parse.urlsplit(url)
    # Bare sti og eventuell custom method sjekkes. Query-strengen kan inneholde
    # kundedata (f.eks. et produktnavn) og skal ikke utløse falske avvisninger.
    if _SKRIVEMONSTER.search(delt.path):
        raise SkrivingAvvist(
            f"Merchant-klienten avviser skrivende metodenavn i stien: {delt.path}"
        )


def _get(env: dict[str, str], sti: str, parametre: dict | None = None, _http=None) -> dict:
    """GET mot Merchant API. _http finnes for testing uten nett."""
    kall = _http or http
    url = VERT + sti
    if parametre:
        url += "?" + urllib.parse.urlencode(parametre)
    _vakt("GET", url)
    token = hent_token(env, [SCOPE])
    status, data = kall("GET", url, headers={"Authorization": f"Bearer {token}"})
    if status != 200 or not isinstance(data, dict):
        raise MerchantFeil(f"Merchant svarte HTTP {status}: {str(data)[:400]}")
    return data


def _alle_sider(
    env: dict[str, str],
    sti: str,
    felt: str,
    parametre: dict | None = None,
    _http=None,
) -> list[dict]:
    """Følger nextPageToken til slutt. Returnerer råe objekter, uten mapping."""
    ut: list[dict] = []
    p = dict(parametre or {})
    while True:
        data = _get(env, sti, p, _http=_http)
        ut.extend(data.get(felt) or [])
        token = data.get("nextPageToken")
        if not token:
            return ut
        p["pageToken"] = token


# ── Lesefunksjonene. Modulen eksporterer ingenting annet. ────────────────────
#
# MERK: sti-malene under er IKKE verifisert mot et ekte svar ennå — Merchant
# API-et er ikke kalt fra dette repoet før. Første øyeblikksbilde (sprint 1b)
# skal lagre hele råsvaret i attributes/raw og rapportere avvik, ikke gjette.
# Se README, «Uverifisert mot ekte API».

def produkter(env: dict[str, str], konto: str, _http=None) -> list[dict]:
    """Alle produkter i kontoen, råe."""
    return _alle_sider(
        env, f"/products/v1beta/accounts/{konto}/products", "products",
        {"pageSize": 250}, _http=_http,
    )


def datakilder(env: dict[str, str], konto: str, _http=None) -> list[dict]:
    """Datakildene i kontoen, råe. Her ser vi hvordan «Found by Google» kommer inn."""
    return _alle_sider(
        env, f"/datasources/v1beta/accounts/{konto}/dataSources", "dataSources",
        {"pageSize": 100}, _http=_http,
    )


def kontovarsler(env: dict[str, str], konto: str, _http=None) -> list[dict]:
    """Kontonivå-varsler, råe."""
    return _alle_sider(
        env, f"/accounts/v1beta/accounts/{konto}/issues", "accountIssues",
        {"pageSize": 100}, _http=_http,
    )


__all__ = [
    "SCOPE",
    "SKRIVEORD",
    "MerchantFeil",
    "SkrivingAvvist",
    "Rate",
    "produkter",
    "datakilder",
    "kontovarsler",
]
