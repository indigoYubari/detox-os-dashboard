"""Rådata: lagre kildens svar UENDRET før noen normalisering.

Hvorfor: feltnavn i Merchant API avviker fra antakelsene i spesifikasjonen §3.3.
Når vi mapper feil, skal originalen fortsatt finnes — ellers oppdager vi aldri
hva vi mistet. Spesifikasjonen sier det rett ut: lagre hele råsvaret og rapporter
avviket, ikke gjett.

Mappa er gitignorert. Dette er lokal arbeidsevidens, ikke noe som skal i repoet.
Supabase Storage-bøtta `audit-raw` (§1) kommer senere; denne fila er forløperen,
og `sti()` returnerer en sti som kan gjenbrukes som `raw_path`.
"""
from __future__ import annotations

import gzip
import json
from datetime import datetime, timezone
from pathlib import Path

# workers/audit/raadata/ — se .gitignore.
ROT = Path(__file__).resolve().parent.parent / "raadata"


def _stempel() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def lagre(kilde: str, navn: str, data: object, komprimer: bool = True) -> Path:
    """Skriv svaret uendret til raadata/<kilde>/<stempel>-<navn>.json[.gz].

    `data` serialiseres som det kom inn — ingen felt fjernes, ingen nøkler endres,
    ingen sortering. Returnerer stien.
    """
    mappe = ROT / kilde
    mappe.mkdir(parents=True, exist_ok=True)
    trygt = "".join(c if c.isalnum() or c in "-_." else "-" for c in navn)[:80]
    fil = mappe / f"{_stempel()}-{trygt}.json{'.gz' if komprimer else ''}"
    # ensure_ascii=False: norske tegn og produkttitler skal være lesbare i fila.
    tekst = json.dumps(data, ensure_ascii=False, indent=2)
    if komprimer:
        with gzip.open(fil, "wt", encoding="utf-8") as f:
            f.write(tekst)
    else:
        fil.write_text(tekst, encoding="utf-8")
    return fil


def les(fil: Path) -> object:
    """Les tilbake en lagret råfil."""
    if str(fil).endswith(".gz"):
        with gzip.open(fil, "rt", encoding="utf-8") as f:
            return json.load(f)
    return json.loads(Path(fil).read_text(encoding="utf-8"))


def relativ(fil: Path) -> str:
    """Stien slik den kan lagres i audit_snapshots.raw_path."""
    try:
        return str(Path(fil).relative_to(ROT.parent))
    except ValueError:
        return str(fil)
