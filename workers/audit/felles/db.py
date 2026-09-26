"""Supabase via PostgREST med service_role. Samme mønster som scripts/sok-natt.py.

Skriver bare til audit_*-tabellene fra migrering 0013. Rører ingen eksisterende
Detox OS-tabell.
"""
from __future__ import annotations

from felles.hemmelig import masker
from felles.nett import http

# PostgREST krever like nøkler i alle rader i en bulk-insert.
BUNKE = 500

# Den unike nøkkelen per tabell, slik migrering 0013 definerer den. Målet for
# on_conflict, så en avbrutt dag som kjøres på nytt blir en upsert, ikke dubletter.
NOKKEL = {
    "audit_gsc_site_daily": ("snapshot_id", "date", "search_type"),
    "audit_gsc_page_daily": ("snapshot_id", "date", "page", "device", "country"),
    "audit_gsc_query_daily": ("snapshot_id", "date", "query", "device", "country"),
    "audit_gsc_query_page_daily": ("snapshot_id", "date", "query", "page"),
    "audit_merchant_products": ("snapshot_id", "name"),
    "audit_merchant_data_sources": ("snapshot_id", "name"),
    "audit_merchant_account_issues": ("snapshot_id",),
    "audit_shopify_products": ("snapshot_id", "product_id"),
    "audit_shopify_variants": ("snapshot_id", "variant_id"),
}

# Kolonnene hver tabell skal ha, i fast rekkefølge.
KOLONNER = {
    "audit_gsc_site_daily": (
        "snapshot_id", "date", "search_type", "clicks", "impressions", "ctr", "position"),
    "audit_gsc_page_daily": (
        "snapshot_id", "date", "page", "device", "country",
        "clicks", "impressions", "ctr", "position"),
    "audit_gsc_query_daily": (
        "snapshot_id", "date", "query", "device", "country",
        "clicks", "impressions", "ctr", "position"),
    "audit_gsc_query_page_daily": (
        "snapshot_id", "date", "query", "page",
        "clicks", "impressions", "ctr", "position"),
}


class DbFeil(Exception):
    pass


class Detox:
    """PostgREST mot Detox-basen med service_role."""

    def __init__(self, env: dict[str, str]):
        self.url = env.get("DETOX_SUPABASE_URL", "").rstrip("/")
        self.key = env.get("DETOX_SUPABASE_SERVICE_ROLE_KEY", "")

    def ok(self) -> bool:
        return bool(self.url and self.key)

    def _h(self, ekstra: dict | None = None) -> dict:
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            **(ekstra or {}),
        }

    def les(self, tabell: str, parametre: dict) -> tuple[int, object]:
        import urllib.parse

        q = urllib.parse.urlencode(parametre, quote_via=urllib.parse.quote, safe=",.()*:")
        return http("GET", f"{self.url}/rest/v1/{tabell}?{q}", headers=self._h())

    def insert(self, tabell: str, rader: list[dict], retur: bool = False) -> tuple[int, object]:
        pref = "return=representation" if retur else "return=minimal"
        return http(
            "POST", f"{self.url}/rest/v1/{tabell}",
            headers=self._h({"Prefer": pref}), body=rader,
        )

    def oppdater(self, tabell: str, filter_: dict, verdier: dict) -> tuple[int, object]:
        import urllib.parse

        q = urllib.parse.urlencode(filter_, quote_via=urllib.parse.quote, safe=",.()*:")
        return http(
            "PATCH", f"{self.url}/rest/v1/{tabell}?{q}",
            headers=self._h({"Prefer": "return=minimal"}), body=verdier,
        )

    def upsert(self, tabell: str, rader: list[dict]) -> tuple[int, object]:
        if tabell not in NOKKEL:
            raise DbFeil(f"Ingen kjent unik nøkkel for {tabell}")
        mal = f"{self.url}/rest/v1/{tabell}?on_conflict={','.join(NOKKEL[tabell])}"
        for i in range(0, len(rader), BUNKE):
            s, d = http(
                "POST", mal,
                headers=self._h({"Prefer": "resolution=merge-duplicates,return=minimal"}),
                body=rader[i:i + BUNKE],
            )
            if s not in (200, 201, 204):
                return s, d
        return 201, None

    def feiltekst(self, d: object) -> str:
        """Feilmelding med nøkkelen maskert. Brukes på ALT som printes."""
        return masker(str(d), self.key)[:300]


def uten_dubletter(tabell: str, rader: list[dict]) -> tuple[list[dict], int]:
    """ON CONFLICT kan ikke treffe samme rad to ganger i én insert."""
    sett, ut = set(), []
    droppet = 0
    for r in rader:
        k = tuple(r.get(c) for c in NOKKEL[tabell])
        if k in sett:
            droppet += 1
            continue
        sett.add(k)
        ut.append(r)
    return ut, droppet


def rad(tabell: str, **verdier) -> dict:
    """Én rad med alle kolonnene tabellen krever, i fast rekkefølge."""
    kolonner = KOLONNER[tabell]
    ukjente = set(verdier) - set(kolonner)
    if ukjente:
        raise DbFeil(f"ukjente kolonner for {tabell}: {sorted(ukjente)}")
    return {k: verdier.get(k) for k in kolonner}


# ── Øyeblikksbilder ──────────────────────────────────────────────────────────

def nytt_snapshot(
    db: Detox, source: str, job: str, params: dict, api_version: str | None = None,
) -> str:
    """Opprett et øyeblikksbilde med status 'partial'. Returnerer snapshot_id.

    Bildet opprettes FØR radene, fordi faktatabellene har fremmednøkkel hit.
    Status blir 'ok' først når alle sider er skrevet — et bilde som står
    'partial' er en avbrutt kjøring, ikke en sannhet.
    """
    s, d = db.insert(
        "audit_snapshots",
        [{
            "source": source, "job": job, "params": params,
            "api_version": api_version, "status": "partial",
        }],
        retur=True,
    )
    if s not in (200, 201) or not isinstance(d, list) or not d:
        raise DbFeil(f"Kunne ikke opprette øyeblikksbilde: HTTP {s} — {db.feiltekst(d)}")
    return d[0]["snapshot_id"]


def fullfor_snapshot(
    db: Detox, snapshot_id: str, status: str, row_count: int | None = None,
    error: str | None = None,
) -> None:
    """Sett sluttstatus på et øyeblikksbilde."""
    verdier: dict = {"status": status}
    if row_count is not None:
        verdier["row_count"] = row_count
    if error is not None:
        verdier["error"] = error[:2000]
    s, d = db.oppdater("audit_snapshots", {"snapshot_id": f"eq.{snapshot_id}"}, verdier)
    if s not in (200, 204):
        raise DbFeil(f"Kunne ikke lukke øyeblikksbilde: HTTP {s} — {db.feiltekst(d)}")


def alt_hentet(db: Detox, job: str) -> set[tuple[str, str]]:
    """(dato, tabell) som allerede er ferdig hentet for denne jobben.

    Dette er det som gjør backfill avbrytbar. Den unike indeksen i 0013 gjør at
    et par bare kan stå 'ok' én gang.
    """
    s, d = db.les("audit_snapshots", {
        "job": f"eq.{job}", "status": "eq.ok",
        "select": "params", "limit": "100000",
    })
    if s != 200 or not isinstance(d, list):
        raise DbFeil(f"Kunne ikke lese øyeblikksbilder: HTTP {s} — {db.feiltekst(d)}")
    ut = set()
    for r in d:
        p = r.get("params") or {}
        if p.get("date") and p.get("table"):
            ut.add((p["date"], p["table"]))
    return ut
