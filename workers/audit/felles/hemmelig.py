"""Nøkler og maskering. Samme mønster som scripts/sok-natt.py.

Rekkefølge, første treff vinner:

  1. Miljøet — systemd på huben, eller `export` i skallet.
  2. ~/.config/detox-audit/supabase.env — lokalt hos Kim (chmod 600).
  3. /root/.env.secrets — hubens hemmeligheter.

Service-konto-nøkkelen har i tillegg en standardplassering
(~/.config/detox-audit/sa.json) som brukes hvis verken GOOGLE_SA_JSON eller
GOOGLE_SA_JSON_PATH er satt noe sted.

Verdiene printes aldri, logges aldri, og returneres bare for navnene i TRENGS.
Alt som skal til skjerm eller logg går gjennom masker().
"""
from __future__ import annotations

import os
from pathlib import Path

# Hubens hemmeligheter.
ENV_SEKRETS = "/root/.env.secrets"

# Lokal mappe for audit-hemmeligheter (chmod 700, filene 600).
LOKAL_MAPPE = Path.home() / ".config" / "detox-audit"
# Lokal env-fil: Supabase-nøklene når jobben kjøres fra Kims maskin.
LOKAL_ENV = LOKAL_MAPPE / "supabase.env"
# Service-konto-nøkkelen.
SA_STANDARDSTI = LOKAL_MAPPE / "sa.json"

# Kun navnene dette laget trenger. Alt annet i env-filene ignoreres — en fil kan
# inneholde nøkler til andre systemer, og de skal ikke inn i prosessen.
TRENGS = (
    # Supabase — samme to som sok-natt bruker.
    "DETOX_SUPABASE_URL",
    "DETOX_SUPABASE_SERVICE_ROLE_KEY",
    # Google service-konto: enten base64 av JSON-en (huben), eller en filsti (lokalt).
    "GOOGLE_SA_JSON",
    "GOOGLE_SA_JSON_PATH",
    # Search Console-eiendommen, f.eks. 'sc-domain:detox.no'.
    "GSC_SITE_URL",
    # Merchant Center-konto, f.eks. '5365874444'.
    "MERCHANT_ACCOUNT_ID",
    # Shopify — samme to som src/app/api/shopify/i-dag/route.ts bruker.
    "SHOPIFY_SHOP_DOMAIN",
    "SHOPIFY_ADMIN_TOKEN",
)


def _les_fil(sti, ut: dict[str, str]) -> None:
    """Legg inn navn fra en env-fil som ikke alt er satt. Stille hvis fila mangler.

    Tåler `export NAVN=verdi`, kommentarer, tomme linjer og verdier i hermetegn.
    """
    try:
        with open(sti, encoding="utf-8") as f:
            for linje in f:
                linje = linje.strip()
                if linje.startswith("export "):
                    linje = linje[7:].lstrip()
                if linje.startswith("#") or "=" not in linje:
                    continue
                k, v = linje.split("=", 1)
                k = k.strip()
                # Første treff vinner: en verdi fra miljøet overskrives aldri.
                if k in TRENGS and k not in ut:
                    ut[k] = v.strip().strip('"').strip("'")
    except (FileNotFoundError, PermissionError, IsADirectoryError, UnicodeDecodeError):
        pass


def les_env() -> dict[str, str]:
    """Nøkler fra miljøet, så lokal env-fil, så hubens. Bare navnene i TRENGS."""
    ut = {k: os.environ[k] for k in TRENGS if os.environ.get(k)}
    _les_fil(LOKAL_ENV, ut)
    _les_fil(ENV_SEKRETS, ut)
    # Service-konto-nøkkelen: fall tilbake på standardplasseringen.
    if "GOOGLE_SA_JSON" not in ut and "GOOGLE_SA_JSON_PATH" not in ut:
        if Path(SA_STANDARDSTI).is_file():
            ut["GOOGLE_SA_JSON_PATH"] = str(SA_STANDARDSTI)
    return ut


def masker(tekst: str, *hemmeligheter: str) -> str:
    """Bytt ut hver hemmelighet med <maskert>. Kalles på ALT som skal printes."""
    for h in hemmeligheter:
        if h and len(h) >= 8:
            tekst = tekst.replace(h, "<maskert>")
    return tekst


def mangler(env: dict[str, str], *navn: str) -> list[str]:
    """Hvilke av disse navnene mangler? Returnerer navn, aldri verdier."""
    return [n for n in navn if not env.get(n)]


def kilder() -> list[str]:
    """Hvilke hemmelighetskilder finnes på denne maskinen? Navn og status, ingen verdier."""
    ut = []
    for merkelapp, sti in (("lokal env-fil", LOKAL_ENV), ("hubens env-fil", ENV_SEKRETS),
                           ("service-konto-nøkkel", SA_STANDARDSTI)):
        p = Path(sti)
        try:
            finnes = p.is_file()
        except PermissionError:
            finnes = False
        ut.append(f"{merkelapp}: {sti} — {'finnes' if finnes else 'finnes ikke'}")
    return ut
