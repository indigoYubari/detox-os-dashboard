#!/usr/bin/env python3
"""Synk Indigos Kim-kort (markdown i mindmatter-icm) → public.kim_cards (Detox-Supabase).

Bruk:
  DETOX_SUPABASE_URL=… DETOX_SUPABASE_SERVICE_ROLE_KEY=… \
  python3 scripts/sync-kim-cards.py --icm /opt/icm [--dry-run]

Leser `detox/indigo/jobs/topics/<story>/kim-kort.md` + QA-status fra
`topics/README.md` (active/draft — eies der, kopieres ikke inn i kode). Upsert på
(story, version); eldre versjoner av samme story settes til superseded.
Ingen delete. Nøkkelen leses fra miljøet og printes aldri.
"""
import argparse, json, os, re, subprocess, sys, urllib.request, urllib.error, datetime

SECTIONS = {
    "Hva dette betyr for Detox": "betydning_for_detox",
    "Hva du kan si": "kan_si",
    "Hva du aldri sier": "aldri_si",
    "Produkt": "produkt",
    "Hva du gjør i dag": "gjor_i_dag",
    "Når dette dør": "dor_naar",
    "Kilde (ikke les først)": "kilde",
}
ANCHOR_RE = re.compile(r"(PMID\s*(\d+)|PMC(\d+)|DOI\s*(10\.\S+)|\b(NCT\d{8})\b)")


def parse_card(text: str) -> dict:
    lines = text.splitlines()
    title = next((l[2:].strip() for l in lines if l.startswith("# ")), "").strip()
    meta = next((l for l in lines if l.startswith("Versjon:")), "")
    m = re.search(r"Versjon:\s*(\d{4}-\d{2}-\d{2})", meta)
    version = m.group(1) if m else None
    anchors = []
    for a in ANCHOR_RE.finditer(meta.split("Ankere:", 1)[1] if "Ankere:" in meta else ""):
        if a.group(2): anchors.append({"type": "pmid", "id": a.group(2)})
        elif a.group(3): anchors.append({"type": "pmc", "id": "PMC" + a.group(3)})
        elif a.group(4): anchors.append({"type": "doi", "id": a.group(4).rstrip(".)")})
        elif a.group(5): anchors.append({"type": "nct", "id": a.group(5)})
    body, cur = {}, None
    for l in lines:
        if l.startswith("## "):
            cur = SECTIONS.get(l[3:].strip()); body.setdefault(cur, []) if cur else None; continue
        if cur and l.strip(): body[cur].append(l.rstrip())
    out = {}
    for key, rows in body.items():
        if key == "kan_si":
            d = {}
            for r in rows:
                mm = re.match(r"-\s*\**(Portal|Reels|Mail)\**:\**\s*(.*)", r)
                if mm: d[mm.group(1).lower()] = mm.group(2).strip()
            out[key] = d
        elif key in ("aldri_si", "kilde"):
            out[key] = [re.sub(r"^-\s*", "", r).strip() for r in rows]
        else:
            out[key] = " ".join(r.strip() for r in rows)
    return {"title": title, "version": version, "anchors": anchors, "body": out}


def read_statuses(readme: str) -> dict:
    """README-tabellen: | **story** | [`kim-kort.md`] | **active** ... | → {story: active|draft}."""
    st = {}
    for l in readme.splitlines():
        m = re.match(r"\|\s*\**([a-z0-9-]+)\**\s*🆕?\s*\|\s*\[`kim-kort\.md`\][^|]*\|\s*([^|]+)\|", l)
        if m:
            st[m.group(1)] = "active" if re.search(r"\*\*active\*\*|^\s*active", m.group(2)) else "draft"
    return st


KOE_ID = "kim-kort"
KILDE = "sync-kim-cards"
POSTER_TABELL_MANGLER = "koe_poster finnes ikke ennå (migrasjon 0011) — poster hoppes over"


def rest(url: str, key: str, path: str, method: str = "GET", body=None, prefer: str | None = None):
    """PostgREST med service_role. Returnerer (status, json-eller-tekst)."""
    hdr = {"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json"}
    if prefer:
        hdr["Prefer"] = prefer
    req = urllib.request.Request(f"{url}/rest/v1/{path}", data=json.dumps(body).encode() if body is not None else None,
                                 headers=hdr, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw.strip() else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, raw[:300]


def tabell_mangler(st, res) -> bool:
    return st == 404 or (isinstance(res, dict) and str(res.get("code")) == "PGRST205")


def now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def utfor_avgjorelser(url: str, key: str) -> bool:
    """Eierne har sagt ja/nei på /koe. Ja = kortet aktiveres. Kvitterer i utfort_*.
    Returnerer False hvis koe_poster ikke finnes (0011 ikke kjørt)."""
    st, poster = rest(url, key, f"koe_poster?koe_id=eq.{KOE_ID}&status=in.(ja,nei)&utfort_at=is.null&select=id,ekstern_id,status")
    if tabell_mangler(st, poster):
        print(POSTER_TABELL_MANGLER); return False
    if st != 200 or not isinstance(poster, list):
        print(f"koe_poster-lesing feilet HTTP {st}: {str(poster)[:200]}"); return True
    for p in poster:
        if p["status"] == "ja":
            st2, res2 = rest(url, key, f"kim_cards?id=eq.{p['ekstern_id']}",
                             "PATCH", {"status": "active", "requires_review": False, "updated_at": now_iso()}, "return=minimal")
            if st2 not in (200, 204):
                print(f"  aktivering feilet for {p['ekstern_id']}: HTTP {st2} {str(res2)[:160]}"); continue
            print(f"  aktivert kort {p['ekstern_id']} (eierens ja)")
        else:
            print(f"  kort {p['ekstern_id']}: eieren sa nei — forblir utkast")
        rest(url, key, f"koe_poster?id=eq.{p['id']}", "PATCH",
             {"utfort_av": KILDE, "utfort_at": now_iso(), "oppdatert": now_iso()}, "return=minimal")
    return True


def skriv_poster(url: str, key: str, utkast: list) -> tuple[int, str | None]:
    """Én post per utkast-kort (insert-only: en avgjort post skal ikke bli venter igjen).
    Kort som ikke lenger er utkast får sine ventende poster satt til utgatt.
    Returnerer (antall ventende, eldste opprettet)."""
    for c in utkast:
        body = {"koe_id": KOE_ID, "ekstern_id": c["id"], "tittel": c["title"],
                "detalj": f"{c['story']} · versjon {c['version']}" + (f" — {c['utdrag']}" if c.get("utdrag") else ""),
                "lenke": None, "prioritet": 2, "eier": "indigo", "handling": "ja-nei", "status": "venter", "kilde": KILDE}
        st, res = rest(url, key, "koe_poster?on_conflict=koe_id,ekstern_id", "POST", body,
                       "resolution=ignore-duplicates,return=minimal")
        if st not in (200, 201, 204):
            print(f"  post-feil for {c['story']}: HTTP {st} {str(res)[:160]}")
    ids = ",".join(f'"{c["id"]}"' for c in utkast)
    filt = f"&ekstern_id=not.in.({ids})" if utkast else ""
    rest(url, key, f"koe_poster?koe_id=eq.{KOE_ID}&status=eq.venter{filt}", "PATCH",
         {"status": "utgatt", "oppdatert": now_iso()}, "return=minimal")
    st, venter = rest(url, key, f"koe_poster?koe_id=eq.{KOE_ID}&status=eq.venter&select=opprettet&order=opprettet.asc")
    if st != 200 or not isinstance(venter, list):
        return len(utkast), None
    return len(venter), (venter[0]["opprettet"] if venter else None)


def skriv_koe(url: str, key: str, antall: int, eldste, utkast_stories: list) -> None:
    """Kø-raden til forsiden (tabell koer). Denne synken eier «kim-kort»."""
    koe = {"id": KOE_ID, "navn": "Kort til godkjenning", "antall": antall, "eldste": eldste,
           "detalj": (f"{antall} utkast venter på Indigo: " + ", ".join(utkast_stories)) if antall else "Ingen utkast venter. Alle kort er aktive.",
           "kilde": KILDE, "oppdatert": now_iso()}
    st, res = rest(url, key, "koer?on_conflict=id", "POST", koe, "resolution=merge-duplicates,return=minimal")
    if st in (200, 201, 204):
        print(f"OK: koer/{KOE_ID} = {antall} utkast")
    else:
        print(f"koer-feil HTTP {st}: {str(res)[:200]}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--icm", required=True, help="sti til mindmatter-icm-klone")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    url = os.environ.get("DETOX_SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("DETOX_SUPABASE_SERVICE_ROLE_KEY", "")
    if not a.dry_run and (not url or not key or "kwrjhyytvbcaiszbfria" not in url):
        sys.exit("MANGLER DETOX_SUPABASE_URL/DETOX_SUPABASE_SERVICE_ROLE_KEY (Detox-prosjektet, ikke MindMatter)")
    topics = os.path.join(a.icm, "detox/indigo/jobs/topics")
    statuses = read_statuses(open(os.path.join(topics, "README.md"), encoding="utf-8").read())
    try:
        commit = subprocess.run(["git", "-C", a.icm, "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip() or None
    except Exception:
        commit = None

    # 1) Eiernes avgjørelser først, så en aktivering står seg i steg 2.
    poster_ok = True
    if not a.dry_run:
        poster_ok = utfor_avgjorelser(url, key)

    # 2) Status: README kan gjøre et kort aktivt; et kort eieren har aktivert i basen degraderes aldri av README.
    eksisterende = {}
    if not a.dry_run:
        st, rows_db = rest(url, key, "kim_cards?select=story,version,status")
        if st == 200 and isinstance(rows_db, list):
            eksisterende = {(r["story"], r["version"]): r["status"] for r in rows_db}

    rows = []
    for story in sorted(os.listdir(topics)):
        p = os.path.join(topics, story, "kim-kort.md")
        if not os.path.isfile(p): continue
        c = parse_card(open(p, encoding="utf-8").read())
        if not c["version"] or not c["title"]:
            print(f"HOPPER OVER {story}: mangler Versjon/tittel"); continue
        readme = statuses.get(story, "draft")
        i_basen = eksisterende.get((story, c["version"]))
        status = "active" if (readme == "active" or i_basen == "active") else (i_basen or readme)
        rows.append({
            "story": story, "version": c["version"], "title": c["title"], "anchors": c["anchors"], "body": c["body"],
            "source_repo": "MindMatter1444/mindmatter-icm", "source_path": f"detox/indigo/jobs/topics/{story}/kim-kort.md",
            "source_commit": commit, "status": status, "requires_review": status != "active",
            "updated_at": now_iso(),
        })
    print(f"{len(rows)} kort lest; status:", {r['story']: r['status'] for r in rows})
    if a.dry_run:
        print(json.dumps(rows[0], ensure_ascii=False, indent=1)[:1500] if rows else "ingen"); return

    # 3) Kortene inn (upsert på story+version), eldre versjoner → superseded.
    st, got = rest(url, key, "kim_cards?on_conflict=story,version", "POST", rows, "resolution=merge-duplicates,return=representation")
    if st not in (200, 201) or not isinstance(got, list):
        sys.exit(f"FEIL HTTP {st}: {str(got)[:400]}")
    print(f"OK: {len(got)} rader upsertet")
    for r in rows:
        st2, res2 = rest(url, key, f"kim_cards?story=eq.{r['story']}&version=lt.{r['version']}&status=neq.superseded",
                         "PATCH", {"status": "superseded"}, "return=minimal")
        if st2 not in (200, 204): print("supersede-feil", r["story"], st2)

    # 4) Poster for utkastene, og kø-raden.
    utdrag = {r["story"]: (r["body"].get("betydning_for_detox") or "").strip().replace("\n", " ")[:140] for r in rows if isinstance(r.get("body"), dict)}
    utkast = [{"id": g["id"], "story": g["story"], "version": g["version"], "title": g["title"], "utdrag": utdrag.get(g["story"], "")}
              for g in got if g.get("status") == "draft"]
    if poster_ok:
        antall, eldste = skriv_poster(url, key, utkast)
    else:
        antall, eldste = len(utkast), None
    skriv_koe(url, key, antall, eldste, sorted(u["story"] for u in utkast))
    print("OK: sync ferdig")


if __name__ == "__main__":
    main()
