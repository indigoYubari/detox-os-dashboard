"""Tilgangstoken for service-kontoen audit-reader@detox-audit.

`google-auth` brukes KUN til å signere JWT-en (RS256 — Pythons standardbibliotek
kan ikke det). Selve token-byttet går via urllib, som resten av laget.

Nøkkelen leses fra GOOGLE_SA_JSON (base64, hubens hemmeligheter) eller
GOOGLE_SA_JSON_PATH (fil, lokalt). Verken nøkkelen eller tokenet skrives noen
gang til logg — masker() i felles/hemmelig.py brukes på alt som printes.
"""
from __future__ import annotations

import base64
import binascii
import json
import time
import urllib.parse
import urllib.request

from google.auth import jwt as gjwt
from google.oauth2 import service_account

TOKEN_URI = "https://oauth2.googleapis.com/token"
GRANT = "urn:ietf:params:oauth:grant-type:jwt-bearer"

# Token varer i en time hos Google. Vi fornyer litt før, så en lang backfill
# ikke faller på et token som utløp midt i en paginering.
MARGIN_SEK = 300

_hurtiglager: dict[str, tuple[str, float]] = {}


class AuthFeil(Exception):
    pass


def _les_nokkel(env: dict[str, str]) -> dict:
    """Service-konto-JSON som dict. Kaster AuthFeil med grunn, aldri med innhold."""
    rå = env.get("GOOGLE_SA_JSON")
    if rå:
        try:
            tekst = base64.b64decode(rå, validate=True).decode("utf-8")
        except (binascii.Error, UnicodeDecodeError, ValueError):
            raise AuthFeil(
                "GOOGLE_SA_JSON er ikke gyldig base64 av UTF-8. Legg inn "
                "`base64 -i sa.json` sin utskrift, uten linjeskift."
            ) from None
        try:
            return json.loads(tekst)
        except json.JSONDecodeError:
            raise AuthFeil("GOOGLE_SA_JSON dekodet, men er ikke gyldig JSON.") from None

    sti = env.get("GOOGLE_SA_JSON_PATH")
    if not sti:
        raise AuthFeil(
            "Verken GOOGLE_SA_JSON eller GOOGLE_SA_JSON_PATH er satt, og "
            "~/.config/detox-audit/sa.json finnes ikke."
        )
    try:
        with open(sti, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        raise AuthFeil(f"Fant ikke nøkkelfila: {sti}") from None
    except PermissionError:
        raise AuthFeil(f"Ingen lesetilgang til nøkkelfila: {sti}") from None
    except json.JSONDecodeError:
        raise AuthFeil(f"Nøkkelfila er ikke gyldig JSON: {sti}") from None


def hent_token(env: dict[str, str], scopes: list[str]) -> str:
    """Tilgangstoken for de oppgitte scopene. Hurtiglagres per scope-kombinasjon."""
    nokkel = " ".join(sorted(scopes))
    truffet = _hurtiglager.get(nokkel)
    if truffet and truffet[1] > time.time():
        return truffet[0]

    info = _les_nokkel(env)
    try:
        creds = service_account.Credentials.from_service_account_info(info, scopes=scopes)
    except (ValueError, KeyError) as e:
        raise AuthFeil(f"Nøkkelen mangler felt eller er ugyldig: {type(e).__name__}") from None

    naa = int(time.time())
    assertion = gjwt.encode(
        creds.signer,
        {
            "iss": creds.service_account_email,
            "scope": " ".join(scopes),
            "aud": info.get("token_uri", TOKEN_URI),
            "iat": naa,
            "exp": naa + 3600,
        },
    )
    if isinstance(assertion, bytes):
        assertion = assertion.decode("ascii")

    body = urllib.parse.urlencode({"grant_type": GRANT, "assertion": assertion}).encode()
    # Token-byttet er form-kodet, ikke JSON — derfor ikke http() sin body-vei.
    req = urllib.request.Request(
        info.get("token_uri", TOKEN_URI),
        data=body,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "detox-audit/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            svar = json.loads(r.read())
    except Exception as e:  # noqa: BLE001 — assertion skal aldri ut i en feilmelding
        raise AuthFeil(
            f"Token-bytte feilet: {type(e).__name__}. Sjekk at service-kontoen har "
            f"tilgang, og at systemklokka er riktig (JWT-en er tidsfølsom)."
        ) from None

    token = svar.get("access_token")
    if not token:
        raise AuthFeil("Google svarte uten access_token.")
    varighet = int(svar.get("expires_in", 3600))
    _hurtiglager[nokkel] = (token, time.time() + varighet - MARGIN_SEK)
    return token


def glem_tokens() -> None:
    """Tømmer hurtiglageret. Brukes av testene."""
    _hurtiglager.clear()
