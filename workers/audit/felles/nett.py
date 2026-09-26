"""HTTP via urllib — samme mønster og samme begrunnelse som scripts/sok-natt.py.

Ingen requests, ingen urllib3. `google-auth` er den eneste nye avhengigheten i
dette repoet, og den brukes kun til å signere JWT.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request

# Supabase avviser nye sb_-nøkler fra nettleser-lignende User-Agent.
UA = "detox-audit/1.0"


class Rate(Exception):
    """429 eller 503 fra kilden. Kalleren bestemmer hvor lenge den venter."""

    def __init__(self, status: int, retry_after: int | None = None):
        super().__init__(f"HTTP {status}")
        self.status = status
        self.retry_after = retry_after


def http(
    metode: str,
    url: str,
    headers: dict | None = None,
    body=None,
    timeout: int = 60,
) -> tuple[int, object]:
    """Returnerer (status, parset JSON eller rå tekst). Kaster Rate ved 429/503.

    Kaster ikke ved andre HTTP-feil — kalleren får statuskoden og bestemmer selv.
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
        if e.code in (429, 503):
            ra = e.headers.get("Retry-After") if e.headers else None
            try:
                ra_sek = int(ra) if ra else None
            except (TypeError, ValueError):
                ra_sek = None
            raise Rate(e.code, ra_sek) from None
        return e.code, e.read()[:800].decode(errors="replace")
