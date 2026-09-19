#!/usr/bin/env python3
"""sok-natt — Detox' søke- og AI-synlighet til public.sok_rangering og
public.sok_ai_sitering (migrasjon 0012). Nattjobb-skjelett, Fase 2 19.09.

Hvorfor: Detox skal vite hvem som eier svaret når kundene søker — i Google/Bing
og i AI-svar. Dashbordet på Railway kan ikke hente dette selv. Huben henter og
skriver (service_role), dashbordet leser (RLS: authenticated SELECT).

VIKTIG — jobben PROJISERER. Tallene kommer fra kilden (GSC, Bing, DataForSEO,
AI-motoren). Jobben regner ikke ut egne, heller ikke CTR. Har en kilde ikke
svart, skrives ingen rad, og da er svaret «ukjent» — aldri et anslag.

Kilder per 19.09:
  bing        gratis. Koden under er klar, men IKKE prøvd mot ekte API: detox.no
              er ikke verifisert i Bing Webmaster Tools, og BING_WEBMASTER_API_KEY
              finnes ikke. Det krever et menneske (se Fase 2-rapporten i ICM).
  gsc         gratis. Venter tirsdag 22.09 (tilgang fra property-eieren).
  dataforseo  betalt. Venter tirsdag 22.09. Ingen kode her kaller betalt API.
  ai          uke 39 (Perplexity/Gemini/Claude, ev. OpenAI). Ikke koblet.

run_id — fryst 19.09 og håndhevet av CHECK i 0012:
  seed-ÅÅÅÅ-MM-DD      seed-lista (det vi følger med på)
  baseline-ÅÅÅÅ-MM-DD  første fulle måling mot fryst seed. Skrives én gang.
  natt-ÅÅÅÅ-MM-DD      nattlig kjøring
  manuell-ÅÅÅÅ-MM-DD   engangsprøver
  valgfritt suffiks -<a-z0-9>, f.eks. natt-2026-09-23-2
Hver kjøring skriver bare egne rader (run_id er del av den unike nøkkelen), så
en baseline blir aldri overskrevet, og samme run_id på nytt er en upsert.

Bruk (på huben):
  python3 sok-natt.py --dry-run                 natten, uten å skrive
  python3 sok-natt.py                           natten
  python3 sok-natt.py --baseline                natten, merket baseline (tirsdag)
  python3 sok-natt.py --seed FIL [--dry-run]    skriv seed-lista (data_mode='seed')
  python3 sok-natt.py --status "søk"            siste måling per kilde, eller ukjent

Nøkler leses fra miljøet, ellers fra /root/.env.secrets. De printes aldri, og
URL-er med nøkler logges aldri.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

ENV_SEKRETS = "/root/.env.secrets"
TRENGS = ("DETOX_SUPABASE_URL", "DETOX_SUPABASE_SERVICE_ROLE_KEY",
          "BING_WEBMASTER_API_KEY", "BING_SITE_URL")
# Supabase avviser nye sb_-nøkler fra nettleser-lignende User-Agent.
UA = "detox-sok-natt/1.0"
RUN_ID_RE = re.compile(r"^(seed|baseline|natt|manuell)-\d{4}-\d{2}-\d{2}(-[a-z0-9]+)?$")
REGISTRE = ("praktisk", "faglig", "menneskelig")

# Samme kolonner i hver rad: PostgREST krever like nøkler i en bulk-insert.
RANGERING = ("run_id", "kilde", "data_mode", "query", "tema", "register", "dato",
             "side", "domene", "rang", "posisjon", "klikk", "visninger", "ctr",
             "land", "enhet", "synced_at")
AI = ("run_id", "kilde", "data_mode", "sporsmal", "tema", "register", "detox_svar",
      "dato", "modell", "sitert_detox", "detox_url", "rang", "siterte_domener",
      "svar_hash", "synced_at")
# Den unike nøkkelen i 0012 (nulls not distinct) — målet for on_conflict.
NOKKEL = {
    "sok_rangering": ("run_id", "kilde", "query", "side", "land", "enhet", "dato", "rang"),
    "sok_ai_sitering": ("run_id", "kilde", "modell", "sporsmal", "dato"),
}

# Det som aldri skal inn i seed: e-post, telefonnummer, ordrenummer,
# anonymiserings-plassholdere fra korpuset og sitat-tegn.
PII = [
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"), "e-postadresse"),
    (re.compile(r"(?<!\d)(\+?47 ?)?\d{8}(?!\d)"), "telefonnummer-lignende"),
    (re.compile(r"#\d{3,}|ordre ?nr|ordrenummer", re.I), "ordrenummer"),
    (re.compile(r"\[(kunde|adresse|ordre)\]", re.I), "plassholder fra korpuset"),
    (re.compile(r"[«»\"]"), "sitat-tegn"),
]


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
    except (FileNotFoundError, PermissionError):
        pass
    return ut


def masker(tekst: str, *hemmeligheter: str) -> str:
    for h in hemmeligheter:
        if h:
            tekst = tekst.replace(h, "<maskert>")
    return tekst


def http(metode: str, url: str, headers: dict | None = None, body=None, timeout: int = 30):
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
        return e.code, e.read()[:400].decode(errors="replace")


def spor(tekst: str) -> str:
    """Søkefrase: små bokstaver, enkle mellomrom (samme form som GSC/Bing gir)."""
    return re.sub(r"\s+", " ", tekst or "").strip().lower()


def setning(tekst: str) -> str:
    return re.sub(r"\s+", " ", tekst or "").strip()


def rad(kolonner: tuple[str, ...], **verdier) -> dict:
    ukjente = set(verdier) - set(kolonner)
    if ukjente:
        raise ValueError(f"ukjente kolonner: {sorted(ukjente)}")
    return {k: verdier.get(k) for k in kolonner}


def ikke_negativ(v):
    return v if isinstance(v, int) and v >= 0 else None


class Detox:
    """PostgREST mot Detox-basen med service_role."""

    def __init__(self, env: dict[str, str]):
        self.url = env.get("DETOX_SUPABASE_URL", "").rstrip("/")
        self.key = env.get("DETOX_SUPABASE_SERVICE_ROLE_KEY", "")

    def ok(self) -> bool:
        return bool(self.url and self.key)

    def _h(self, ekstra: dict | None = None) -> dict:
        return {"apikey": self.key, "Authorization": f"Bearer {self.key}",
                "Content-Type": "application/json", **(ekstra or {})}

    def les(self, tabell: str, parametre: dict):
        q = urllib.parse.urlencode(parametre, quote_via=urllib.parse.quote, safe=",.()*:")
        return http("GET", f"{self.url}/rest/v1/{tabell}?{q}", headers=self._h())

    def upsert(self, tabell: str, rader: list[dict]):
        mal = f"{self.url}/rest/v1/{tabell}?on_conflict={','.join(NOKKEL[tabell])}"
        for i in range(0, len(rader), 500):
            s, d = http("POST", mal, headers=self._h({
                "Prefer": "resolution=merge-duplicates,return=minimal"}), body=rader[i:i + 500])
            if s not in (200, 201, 204):
                return s, d
        return 201, None


def uten_dubletter(tabell: str, rader: list[dict]) -> list[dict]:
    """ON CONFLICT kan ikke treffe samme rad to ganger i én insert."""
    sett, ut = set(), []
    for r in rader:
        k = tuple(r.get(c) for c in NOKKEL[tabell])
        if k in sett:
            print(f"  ADVARSEL: dublett droppet i {tabell}: {k[2:4]}")
            continue
        sett.add(k)
        ut.append(r)
    return ut


def skriv(db: Detox, tabell: str, rader: list[dict], dry: bool) -> int:
    rader = uten_dubletter(tabell, rader)
    if dry:
        print(f"  (dry) {tabell}: {len(rader)} rad(er) ville blitt skrevet")
        return 0
    if not rader:
        return 0
    s, d = db.upsert(tabell, rader)
    if s in (200, 201, 204):
        print(f"  skrevet: {tabell} HTTP {s} ({len(rader)} rad(er))")
        return 0
    print(f"  FEIL: {tabell} HTTP {s} — {masker(str(d), db.key)[:300]}")
    if s == 404:
        print("  → Er migrasjon 0012_sok.sql kjørt? Tabellen finnes ikke.")
    return 1


# ── Kildene ──────────────────────────────────────────────────────────────────

class KildeFeil(Exception):
    pass


class Bing:
    """Bing Webmaster Tools: GetQueryStats (egne søk, ukentlig oppdatert hos Bing).
    Nøkkelen er per bruker og lages i Bing Webmaster Tools → Settings → API Access."""

    navn, tabell = "bing", "sok_rangering"
    ENDEPUNKT = "https://ssl.bing.com/webmaster/api.svc/json/GetQueryStats"

    def klar(self, env):
        if not env.get("BING_WEBMASTER_API_KEY"):
            return False, ("BING_WEBMASTER_API_KEY mangler. detox.no må verifiseres i Bing "
                           "Webmaster Tools og nøkkelen lages der — krever et menneske.")
        return True, f"nøkkel finnes, site {env.get('BING_SITE_URL', 'https://detox.no/')}"

    @staticmethod
    def dato(verdi: str | None) -> str | None:
        """'/Date(1316156400000-0700)/' → '2011-09-16' (datoen i kildens egen tidssone)."""
        m = re.match(r"/Date\((-?\d+)([+-]\d{4})?\)/", verdi or "")
        if not m:
            return None
        t = datetime.fromtimestamp(int(m.group(1)) / 1000, timezone.utc)
        if m.group(2):
            fortegn = 1 if m.group(2)[0] == "+" else -1
            t += fortegn * timedelta(hours=int(m.group(2)[1:3]), minutes=int(m.group(2)[3:5]))
        return t.date().isoformat()

    def hent(self, env, run_id: str, naa: str) -> list[dict]:
        nokkel = env["BING_WEBMASTER_API_KEY"]
        site = env.get("BING_SITE_URL", "https://detox.no/")
        url = self.ENDEPUNKT + "?" + urllib.parse.urlencode({"siteUrl": site, "apikey": nokkel})
        try:
            s, d = http("GET", url, headers={"Content-Type": "application/json; charset=utf-8"},
                        timeout=60)
        except Exception as e:  # noqa: BLE001 — URL-en (med nøkkel) skal aldri ut
            raise KildeFeil(f"{type(e).__name__}: {masker(str(e), nokkel)[:200]}") from None
        if s != 200 or not isinstance(d, dict):
            raise KildeFeil(f"Bing svarte HTTP {s}: {masker(str(d), nokkel)[:200]}")
        ut = []
        for q in d.get("d") or []:
            query, dag = spor(q.get("Query")), self.dato(q.get("Date"))
            if not query or not dag:
                continue
            pos = q.get("AvgImpressionPosition")
            ut.append(rad(RANGERING, run_id=run_id, kilde="bing", data_mode="live",
                          query=query, dato=dag, domene="detox.no",
                          posisjon=pos if isinstance(pos, (int, float)) and pos >= 1 else None,
                          klikk=ikke_negativ(q.get("Clicks")),
                          visninger=ikke_negativ(q.get("Impressions")),
                          synced_at=naa))
        return ut


class Venter:
    """En kilde som ikke er koblet ennå. Den svarer ærlig og henter ingenting."""

    def __init__(self, navn: str, tabell: str, grunn: str):
        self.navn, self.tabell, self.grunn = navn, tabell, grunn

    def klar(self, env):
        return False, self.grunn

    def hent(self, env, run_id, naa):
        return []


KILDER = [
    Venter("gsc", "sok_rangering",
           "venter tirsdag 22.09: tilgang (service-konto) fra property-eieren. "
           "detox.no har google-site-verification, men hvem som eier eiendommen er ikke bekreftet."),
    Bing(),
    Venter("dataforseo", "sok_rangering",
           "betalt — venter Adrians ja tirsdag 22.09. Ingen kode her kaller betalt API før da."),
    Venter("ai", "sok_ai_sitering",
           "uke 39 — motorer og kostnad besluttes etter tirsdag. Ikke koblet."),
]


# ── Kommandoene ──────────────────────────────────────────────────────────────

def natt(env, dry: bool, baseline: bool) -> int:
    idag = datetime.now(timezone.utc).date().isoformat()
    run_id = f"{'baseline' if baseline else 'natt'}-{idag}"
    naa = datetime.now(timezone.utc).isoformat()
    print("sok-natt", "(dry-run)" if dry else "", "—", run_id,
          datetime.now(timezone.utc).strftime("%H:%M UTC"))
    db = Detox(env)
    if not db.ok():
        print("  FEIL: DETOX_SUPABASE_URL / _SERVICE_ROLE_KEY mangler")
        return 1
    if baseline:
        # Frys: en baseline skrives én gang. Finnes den, er den hellig.
        for tabell in NOKKEL:
            s, d = db.les(tabell, {"run_id": f"eq.{run_id}", "select": "id", "limit": "1"})
            if s != 200:
                print(f"  FEIL: kunne ikke sjekke {tabell} for {run_id}: HTTP {s}")
                return 1
            if d:
                print(f"  FEIL: {run_id} finnes allerede i {tabell} — baseline er fryst")
                return 1

    koblet = feil = 0
    for k in KILDER:
        ok, grunn = k.klar(env)
        if not ok:
            print(f"  {k.navn:<11} ikke koblet — {grunn}")
            continue
        koblet += 1
        try:
            rader = k.hent(env, run_id, naa)
        except KildeFeil as e:
            feil += 1
            print(f"  {k.navn:<11} FEIL: {e}")
            continue
        print(f"  {k.navn:<11} {len(rader)} rad(er) fra kilden")
        feil += skriv(db, k.tabell, rader, dry)

    if koblet == 0:
        print("  ingen kilde koblet — ingenting skrevet. Ingen rad = ukjent, ikke null.")
    return 1 if feil else 0


def seed(env, sti: str, dry: bool) -> int:
    d = json.load(open(sti, encoding="utf-8"))
    run_id = d.get("run_id", "")
    if not RUN_ID_RE.match(run_id) or not run_id.startswith("seed-"):
        print(f"  FEIL: run_id {run_id!r} er ikke seed-ÅÅÅÅ-MM-DD")
        return 1
    naa = datetime.now(timezone.utc).isoformat()
    avvik: list[str] = []

    def sjekk(hvor: str, *tekster):
        for t in tekster:
            for moenster, hva in PII:
                if t and moenster.search(t):
                    avvik.append(f"{hvor}: {hva}")

    rang, ai = [], []
    for i, r in enumerate(d.get("rangering") or []):
        q, reg = spor(r.get("query")), r.get("register")
        sjekk(f"rangering[{i}]", q, r.get("tema"))
        if not q or reg not in REGISTRE:
            avvik.append(f"rangering[{i}]: tomt søk eller ukjent register {reg!r}")
        rang.append(rad(RANGERING, run_id=run_id, kilde="kundeservice", data_mode="seed",
                        query=q, tema=r.get("tema"), register=reg, land="nor", synced_at=naa))
    for i, r in enumerate(d.get("ai_sitering") or []):
        sp, reg = setning(r.get("sporsmal")), r.get("register")
        sjekk(f"ai_sitering[{i}]", sp, r.get("tema"), r.get("detox_svar"))
        if not sp or reg not in REGISTRE:
            avvik.append(f"ai_sitering[{i}]: tomt spørsmål eller ukjent register {reg!r}")
        ai.append(rad(AI, run_id=run_id, kilde="kundeservice", data_mode="seed",
                      sporsmal=sp, tema=r.get("tema"), register=reg,
                      detox_svar=setning(r.get("detox_svar")) or None, synced_at=naa))

    print("sok-natt --seed", "(dry-run)" if dry else "", "—", run_id,
          f"— {len(rang)} søk, {len(ai)} spørsmål")
    if avvik:
        print("  STOPP — seed-fila bryter reglene (ingen PII, ingen sitat):")
        for a in avvik:
            print("   ", a)
        return 1
    print("  PII-sjekk: ren (e-post, telefon, ordrenummer, plassholdere, sitat-tegn)")
    db = Detox(env)
    if not db.ok() and not dry:
        print("  FEIL: DETOX_SUPABASE_URL / _SERVICE_ROLE_KEY mangler")
        return 1
    return skriv(db, "sok_rangering", rang, dry) + skriv(db, "sok_ai_sitering", ai, dry)


def status(env, tekst: str) -> int:
    db = Detox(env)
    if not db.ok():
        print("  FEIL: DETOX_SUPABASE_URL / _SERVICE_ROLE_KEY mangler")
        return 1
    q, sp = spor(tekst), setning(tekst)
    print(f"Status — {q!r}")

    s, frø = db.les("sok_rangering", {"query": f"eq.{q}", "data_mode": "eq.seed",
                                      "select": "run_id,tema,register", "order": "run_id.desc"})
    s2, live = db.les("sok_rangering", {"query": f"eq.{q}", "data_mode": "eq.live",
                                        "select": "kilde,dato,posisjon,rang,domene,run_id",
                                        "order": "dato.desc", "limit": "500"})
    if s != 200 or s2 != 200:
        print(f"  FEIL: HTTP {s}/{s2} — {masker(str(frø if s != 200 else live), db.key)[:200]}")
        return 1
    print("  søk i seed:", ", ".join(f"{r['run_id']} ({r['tema']}, {r['register']})" for r in frø)
          if frø else "nei — søket er ikke i seed-lista")
    for kilde in ("gsc", "bing", "dataforseo"):
        rader = [r for r in live if r["kilde"] == kilde]
        if not rader:
            print(f"  {kilde:<11} ukjent — ingen måling")
            continue
        n = rader[0]
        tall = (f"posisjon {n['posisjon']}" if n["posisjon"] is not None
                else f"rang {n['rang']} ({n['domene']})" if n["rang"] is not None else "ukjent")
        print(f"  {kilde:<11} {n['dato']}: {tall} [{n['run_id']}]")

    s3, spm = db.les("sok_ai_sitering", {"sporsmal": f"eq.{sp}",
                                         "select": "kilde,data_mode,dato,sitert_detox,run_id",
                                         "order": "dato.desc.nullslast", "limit": "100"})
    if s3 == 200 and spm:
        malt = [r for r in spm if r["data_mode"] == "live"]
        print("  AI-spørsmål i seed:", "ja" if any(r["data_mode"] == "seed" for r in spm) else "nei")
        print("  AI-sitering:", "ukjent — ingen måling" if not malt else
              ", ".join(f"{r['kilde']} {r['dato']}: {'sitert' if r['sitert_detox'] else 'ikke sitert'}"
                        for r in malt[:4]))
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Detox søke- og AI-synlighet → sok_* (0012)")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--baseline", action="store_true")
    p.add_argument("--seed", metavar="FIL")
    p.add_argument("--status", metavar="SØK")
    a = p.parse_args()
    env = les_env()
    if a.status:
        return status(env, a.status)
    if a.seed:
        return seed(env, a.seed, a.dry_run)
    return natt(env, a.dry_run, a.baseline)


if __name__ == "__main__":
    sys.exit(main())
