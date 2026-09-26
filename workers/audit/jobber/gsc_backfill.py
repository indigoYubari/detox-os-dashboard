"""gsc_backfill — 16 måneder GSC-historikk til audit_gsc_* (migrering 0013).

Hvorfor: GSC-grensesnittet viser maks 1 000 rader og holder ikke historikk
lenger enn 16 måneder. Auditten skal kunne analysere hele søkeord- og sidetapet,
så historikken må ut av UI-et og inn i basen mens den finnes.

Slik jobben oppfører seg:
  - Én dag om gangen, fire granulariteter per dag (§3.2), billigste først.
  - `dataState: final` — ferske, ujusterte tall utelates. Historikk skal være stabil.
  - Paginering med `startRow`, 25 000 rader per kall.
  - Ett øyeblikksbilde per (dag, granularitet). Det blir 'ok' med row_count først
    når alle sider er skrevet. Feiler noe, står det 'failed' med grunn.
  - Avbrytbar: neste kjøring hopper over par som allerede står 'ok'.
  - Ved 429: vent, prøv igjen, opptil tre ganger. Deretter merkes dagen 'failed'
    og jobben går videre — én vanskelig dag skal ikke stoppe seksten måneder.

Som sok-natt PROJISERER jobben: klikk, visninger, CTR og posisjon lagres slik GSC
oppgir dem. Ingenting regnes ut. Svarer ikke kilden, skrives ingen rad — og da er
svaret «ukjent», aldri null.

Bruk:
  python3 -m jobber.gsc_backfill --torrkjor --dag 2026-09-22   én dag, skriver ingenting
  python3 -m jobber.gsc_backfill --dag 2026-09-22              én dag, skriver
  python3 -m jobber.gsc_backfill                               hele perioden
  python3 -m jobber.gsc_backfill --fra 2025-06-01 --til 2025-06-30
"""
from __future__ import annotations

import argparse
import sys
import time
from datetime import date, datetime, timedelta, timezone

from felles import db as dbmod
from felles.hemmelig import les_env, mangler
from felles.nett import Rate
from klienter import gsc

JOBB = "gsc_backfill"
KILDE = "gsc"
API_VERSJON = "webmasters/v3"

# Rekkefølge: billigste spørring først, så en dag som ryker på kvote har fått
# site-totalen i boks — det tallet er kontrollen mot GSC-grensesnittet.
REKKEFOLGE = ("gsc_site_daily", "gsc_page_daily", "gsc_query_daily", "gsc_query_page_daily")

# GSC holder ca. 16 måneder. Vi starter der og går fram.
MANEDER_BAKOVER = 16
# De siste dagene justeres av Google. gsc_daily (sprint 1b) henter dem på nytt.
DAGER_MARGIN = 3

# Integritetsstatus per granularitet, med auditens egne merker.
#
# Jobben rapporterer AVVIKET mot referansetotalen, men påstår ikke årsaken. Et
# avvik er 🟢 for hva kilden rapporterer — aldri for hvorfor.
#
# query-granularitetene: Google anonymiserer sjeldne søk, så et gap er delvis
#   eller primært forventet. 🟡 fordi mekanismen er kjent, men andelen ikke målt.
# gsc_page_daily: har INGEN query-dimensjon, så query-anonymisering forklarer den
#   ikke. Google aggregerer dessuten property og side ulikt, og Search Analytics
#   garanterer ikke at alle datarader returneres. Årsaken er derfor ikke fastslått.
INTEGRITET = {
    "gsc_site_daily": "referansetotal — ingen query-dimensjon",
    "gsc_page_daily": "🔵 avvik observert, årsak ikke fastslått",
    "gsc_query_daily": "🟡 avvik delvis/primært forventet: query-anonymisering",
    "gsc_query_page_daily": "🟡 avvik delvis/primært forventet: query-anonymisering",
}

VENT_VED_429_SEK = 15 * 60
MAKS_FORSOK = 3
# Liten pause mellom kall, så vi ikke tærer på kvoten raskere enn nødvendig.
PAUSE_MELLOM_KALL_SEK = 1.0


def _minus_maneder(d: date, n: int) -> date:
    aar, mnd = divmod((d.year * 12 + d.month - 1) - n, 12)
    mnd += 1
    dag = min(d.day, [31, 29 if aar % 4 == 0 and (aar % 100 != 0 or aar % 400 == 0) else 28,
                      31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mnd - 1])
    return date(aar, mnd, dag)


def _dager(fra: date, til: date) -> list[str]:
    ut, d = [], fra
    while d <= til:
        ut.append(d.isoformat())
        d += timedelta(days=1)
    return ut


def _hent_med_forsok(env, site, dag: str, tabell: str) -> tuple[list[dict], dict]:
    """hent_dag med tålmodighet ved 429. Kaster videre hvis den gir opp."""
    for forsok in range(1, MAKS_FORSOK + 1):
        try:
            return gsc.hent_dag(env, site, dag, tabell)
        except Rate as e:
            if forsok == MAKS_FORSOK:
                raise
            vent = e.retry_after or VENT_VED_429_SEK
            print(f"    kvote ({e.status}) — venter {vent // 60} min, forsøk "
                  f"{forsok}/{MAKS_FORSOK}", flush=True)
            time.sleep(vent)
    raise RuntimeError("uventet")  # pragma: no cover


def _en_dag(env, site, db, dag: str, torrkjor: bool) -> tuple[int, int, dict]:
    """Én dag, alle granulariteter. Returnerer (skrevet, feilet, site_total)."""
    skrevet = feilet = 0
    total: dict = {}
    for tabell in REKKEFOLGE:
        try:
            raa, params = _hent_med_forsok(env, site, dag, tabell)
        except Rate as e:
            print(f"    {tabell:<22} FEIL: ga opp på kvote ({e.status})")
            feilet += 1
            continue
        except gsc.GscFeil as e:
            print(f"    {tabell:<22} FEIL: {e}")
            feilet += 1
            continue

        rader = gsc.til_rader(tabell, raa, dag, "web")
        egen = gsc.site_total(raa)
        if tabell == "gsc_site_daily":
            total = egen
        # Totalen per granularitet skrives ut fordi avviket mot referansetotalen
        # er dokumentasjon (§7). Avviket oppgis som et tall; årsaken påstås ikke.
        # Se INTEGRITET øverst. Et avvik på 0 ville vært det mistenkelige.
        avvik = ""
        if total and tabell != "gsc_site_daily" and total["visninger"]:
            tapt = total["visninger"] - egen["visninger"]
            tapt_klikk = total["klikk"] - egen["klikk"]
            avvik = (f"  avvik mot referanse: {tapt} visninger "
                     f"({tapt / total['visninger']:.1%}), {tapt_klikk} klikk")
        print(f"    {tabell:<22} {len(rader):>7} rad(er)  "
              f"{egen['klikk']:>6} klikk  {egen['visninger']:>7} visninger{avvik}")
        print(f"      integritet: {INTEGRITET[tabell]}")

        if torrkjor:
            skrevet += len(rader)
            time.sleep(PAUSE_MELLOM_KALL_SEK)
            continue

        maltabell = f"audit_{tabell}"
        snapshot_id = dbmod.nytt_snapshot(db, KILDE, JOBB, params, API_VERSJON)
        try:
            med_id = [dbmod.rad(maltabell, snapshot_id=snapshot_id, **r) for r in rader]
            rene, droppet = dbmod.uten_dubletter(maltabell, med_id)
            if droppet:
                print(f"      ADVARSEL: {droppet} dublett(er) droppet før skriving")
            if rene:
                s, d = db.upsert(maltabell, rene)
                if s not in (200, 201, 204):
                    raise dbmod.DbFeil(f"HTTP {s} — {db.feiltekst(d)}")
            dbmod.fullfor_snapshot(db, snapshot_id, "ok", row_count=len(rene))
            skrevet += len(rene)
        except Exception as e:  # noqa: BLE001 — bildet må lukkes ærlig uansett
            dbmod.fullfor_snapshot(db, snapshot_id, "failed", error=f"{type(e).__name__}: {e}")
            print(f"    {tabell:<22} FEIL ved skriving: {type(e).__name__}: {e}")
            feilet += 1
        time.sleep(PAUSE_MELLOM_KALL_SEK)
    return skrevet, feilet, total


def kjor(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="GSC-backfill til audit_gsc_* (0013)")
    p.add_argument("--torrkjor", action="store_true",
                   help="hent og vis tall, skriv ingenting til basen")
    p.add_argument("--dag", metavar="ÅÅÅÅ-MM-DD", help="kun denne dagen")
    p.add_argument("--fra", metavar="ÅÅÅÅ-MM-DD")
    p.add_argument("--til", metavar="ÅÅÅÅ-MM-DD")
    a = p.parse_args(argv)

    env = les_env()
    site = env.get("GSC_SITE_URL")
    if not site:
        print("FEIL: GSC_SITE_URL mangler (f.eks. 'sc-domain:detox.no')")
        return 1
    if mangler(env, "GOOGLE_SA_JSON") and mangler(env, "GOOGLE_SA_JSON_PATH"):
        print("FEIL: verken GOOGLE_SA_JSON eller GOOGLE_SA_JSON_PATH er satt")
        return 1

    idag = datetime.now(timezone.utc).date()
    if a.dag:
        dager = [a.dag]
    else:
        fra = date.fromisoformat(a.fra) if a.fra else _minus_maneder(idag, MANEDER_BAKOVER)
        til = date.fromisoformat(a.til) if a.til else idag - timedelta(days=DAGER_MARGIN)
        dager = _dager(fra, til)

    db = dbmod.Detox(env)
    hentet: set[tuple[str, str]] = set()
    if not a.torrkjor:
        if not db.ok():
            print("FEIL: DETOX_SUPABASE_URL / _SERVICE_ROLE_KEY mangler")
            return 1
        hentet = dbmod.alt_hentet(db, JOBB)
        if hentet:
            print(f"{len(hentet)} (dag, granularitet) er hentet fra før og hoppes over")

    print(f"{JOBB}{' (tørrkjøring — skriver ingenting)' if a.torrkjor else ''} — "
          f"{site} — {len(dager)} dag(er): {dager[0]} → {dager[-1]}", flush=True)

    sum_skrevet = sum_feilet = 0
    feilede_dager: list[str] = []
    for i, dag in enumerate(dager, 1):
        if not a.torrkjor and all((dag, t) in hentet for t in REKKEFOLGE):
            continue
        print(f"  [{i}/{len(dager)}] {dag}", flush=True)
        skrevet, feilet, total = _en_dag(env, site, db, dag, a.torrkjor)
        sum_skrevet += skrevet
        sum_feilet += feilet
        if feilet:
            feilede_dager.append(dag)
        if total:
            print(f"    site-total: {total['klikk']} klikk, {total['visninger']} visninger")

    print(f"\nferdig — {sum_skrevet} rad(er) "
          f"{'ville blitt skrevet' if a.torrkjor else 'skrevet'}, {sum_feilet} feil")
    if feilede_dager:
        print("dager med feil (kjør jobben på nytt, de tas om igjen):")
        for d in feilede_dager:
            print("  ", d)
    return 1 if sum_feilet else 0


if __name__ == "__main__":
    sys.exit(kjor())
