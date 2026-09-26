"""Nøkler og maskering. Samme mønster som scripts/sok-natt.py.

Nøkler leses fra miljøet (systemd på huben), ellers fra /root/.env.secrets.
De printes aldri, og URL-er med nøkler logges aldri.
"""
from __future__ import annotations

import os
from pathlib import Path

ENV_SEKRETS = "/root/.env.secrets"

# Kun navnene dette laget trenger. Alt annet i .env.secrets ignoreres.
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

# Lokal standardplassering for service-konto-nøkkelen (chmod 600).
# Brukes bare hvis verken GOOGLE_SA_JSON eller GOOGLE_SA_JSON_PATH er satt.
SA_STANDARDSTI = Path.home() / ".config" / "detox-audit" / "sa.json"


def les_env() -> dict[str, str]:
    """Miljøet først (systemd), ellers /root/.env.secrets. Bare navnene vi trenger."""
    ut = {k: os.environ[k] for k in TRENGS if os.environ.get(k)}
    try:
        with open(ENV_SEKRETS, encoding="utf-8") as f:
            for linje in f:
                linje = linje.strip()
                if linje.startswith("export "):
                    linje = linje[7:].lstrip()
                if linje.startswith("#") or "=" not in linje:
                    continue
                k, v = linje.split("=", 1)
                k = k.strip()
                if k in TRENGS and k not in ut:
                    ut[k] = v.strip().strip('"').strip("'")
    except (FileNotFoundError, PermissionError, IsADirectoryError):
        pass
    # Lokal fallback: nøkkelfila der Kim har den.
    if "GOOGLE_SA_JSON" not in ut and "GOOGLE_SA_JSON_PATH" not in ut:
        if SA_STANDARDSTI.is_file():
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
