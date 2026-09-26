"""HTTP via urllib — samme mønster og samme begrunnelse som scripts/sok-natt.py.

Ingen requests, ingen urllib3. `google-auth` er den eneste nye avhengigheten i
dette repoet, og den brukes kun til å signere JWT.

Feilklassifisering følger Googles egen dokumentasjon (AIP-193):

    {"error": {"code": 403, "message": "...", "status": "PERMISSION_DENIED",
               "details": [{"@type": "...ErrorInfo", "reason": "...",
                            "domain": "merchantapi.googleapis.com",
                            "metadata": {"REASON": "..."}}]}}

Google sier eksplisitt: bruk `metadata.REASON` til å avgjøre årsak programmatisk,
ikke meldingsteksten. `feildetaljer()` plukker ut den.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request

# Supabase avviser nye sb_-nøkler fra nettleser-lignende User-Agent.
UA = "detox-audit/1.0"

# Statuser det er riktig å prøve igjen på. 429 = for høy rate (Google: «slow down»),
# 5xx = som regel forbigående (Google: «retry with exponential backoff»).
RETRYBARE = (429, 500, 502, 503, 504)


class KildeFeil(Exception):
    """Feil fra en ekstern kilde, med statuskode og Googles REASON bevart."""

    def __init__(self, status: int, reason: str = "", melding: str = ""):
        self.status = status
        self.reason = reason
        self.melding = melding
        deler = [f"HTTP {status}"]
        if reason:
            deler.append(f"reason={reason}")
        if melding:
            deler.append(melding[:300])
        super().__init__(" — ".join(deler))


class Rate(KildeFeil):
    """429 eller 5xx. Kalleren bestemmer hvor lenge den venter."""

    def __init__(self, status: int, retry_after: int | None = None, reason: str = "",
                 melding: str = ""):
        super().__init__(status, reason, melding)
        self.retry_after = retry_after


class Nektet(KildeFeil):
    """401 eller 403. Nøkkel, scope eller brukerrolle — ikke prøv igjen."""


class Mangler(KildeFeil):
    """404. Ressursen finnes ikke, eller stien/API-versjonen er feil."""


def feildetaljer(data: object) -> dict:
    """Plukker ut Googles feilfelter. Tåler at svaret ikke er AIP-193 i det hele tatt."""
    ut = {"status": "", "reason": "", "melding": ""}
    if isinstance(data, str):
        # Ikke JSON — behold teksten, avkortet, som melding.
        ut["melding"] = data[:400]
        return ut
    if not isinstance(data, dict):
        return ut
    feil = data.get("error")
    if not isinstance(feil, dict):
        return ut
    ut["status"] = str(feil.get("status") or "")
    ut["melding"] = str(feil.get("message") or "")[:400]
    for d in feil.get("details") or []:
        if not isinstance(d, dict):
            continue
        # metadata.REASON er den stabile identifikatoren. reason er nest best.
        meta = d.get("metadata")
        if isinstance(meta, dict) and meta.get("REASON"):
            ut["reason"] = str(meta["REASON"])
            return ut
        if d.get("reason"):
            ut["reason"] = str(d["reason"])
    return ut


def reis(status: int, data: object) -> None:
    """Kaster riktig feiltype for en ikke-2xx-status. Returnerer aldri."""
    d = feildetaljer(data)
    if status in RETRYBARE:
        raise Rate(status, None, d["reason"], d["melding"])
    if status in (401, 403):
        raise Nektet(status, d["reason"], d["melding"])
    if status == 404:
        raise Mangler(status, d["reason"], d["melding"])
    raise KildeFeil(status, d["reason"], d["melding"])


def http(
    metode: str,
    url: str,
    headers: dict | None = None,
    body=None,
    timeout: int = 60,
) -> tuple[int, object]:
    """Returnerer (status, parset JSON eller rå tekst). Kaster Rate ved 429/5xx.

    Kaster ikke ved 4xx utenom det — kalleren får statuskoden og bestemmer selv.
    Bruk reis() hvis du vil ha 401/403/404 som typede unntak.
    """
    req = urllib.request.Request(
        url,
        data=None if body is None else json.dumps(body).encode(),
        headers={"User-Agent": UA, **(headers or {})},
        method=metode,
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        kropp = e.read()[:2000].decode(errors="replace")
        try:
            data = json.loads(kropp)
        except (json.JSONDecodeError, ValueError):
            data = kropp
        if e.code in RETRYBARE:
            ra = e.headers.get("Retry-After") if e.headers else None
            try:
                ra_sek = int(ra) if ra else None
            except (TypeError, ValueError):
                ra_sek = None
            d = feildetaljer(data)
            raise Rate(e.code, ra_sek, d["reason"], d["melding"]) from None
        return e.code, data
