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
    rows = []
    for story in sorted(os.listdir(topics)):
        p = os.path.join(topics, story, "kim-kort.md")
        if not os.path.isfile(p): continue
        c = parse_card(open(p, encoding="utf-8").read())
        if not c["version"] or not c["title"]:
            print(f"HOPPER OVER {story}: mangler Versjon/tittel"); continue
        rows.append({
            "story": story, "version": c["version"], "title": c["title"], "anchors": c["anchors"], "body": c["body"],
            "source_repo": "MindMatter1444/mindmatter-icm", "source_path": f"detox/indigo/jobs/topics/{story}/kim-kort.md",
            "source_commit": commit, "status": statuses.get(story, "draft"), "requires_review": statuses.get(story, "draft") != "active",
            "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        })
    print(f"{len(rows)} kort lest; status:", {r['story']: r['status'] for r in rows})
    if a.dry_run:
        print(json.dumps(rows[0], ensure_ascii=False, indent=1)[:1500] if rows else "ingen"); return
    hdr = {"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json",
           "Prefer": "resolution=merge-duplicates,return=representation"}
    req = urllib.request.Request(f"{url}/rest/v1/kim_cards?on_conflict=story,version", data=json.dumps(rows).encode(), headers=hdr, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            got = json.loads(r.read()); print(f"OK: {len(got)} rader upsertet")
    except urllib.error.HTTPError as e:
        sys.exit(f"FEIL HTTP {e.code}: {e.read().decode()[:400]}")
    # eldre versjoner av samme story → superseded
    for r in rows:
        req = urllib.request.Request(f"{url}/rest/v1/kim_cards?story=eq.{r['story']}&version=lt.{r['version']}&status=neq.superseded",
                                     data=json.dumps({"status": "superseded"}).encode(), headers={**hdr, "Prefer": "return=minimal"}, method="PATCH")
        try: urllib.request.urlopen(req, timeout=30)
        except urllib.error.HTTPError as e: print("supersede-feil", r["story"], e.code)
    write_koe(url, key, hdr, rows)
    print("OK: sync ferdig")


KOE_ID = "kim-kort"


def write_koe(url: str, key: str, hdr: dict, rows: list) -> None:
    """Kø-raden til forsiden (tabell koer, eiernes køer): utkast som venter på Indigo.

    Én skriver per rad — denne synken eier «kim-kort». Forsiden summerer alle rader i
    «Venter på dere» og viser denne som én linje; ingen dashbordkode trengs for det.
    Statusen kommer fra topics/README.md i ICM, samme kilde som kortene selv.
    """
    utkast = sorted(r["story"] for r in rows if r["status"] == "draft")
    eldste = None
    try:
        q = urllib.request.Request(f"{url}/rest/v1/kim_cards?status=eq.draft&select=created_at&order=created_at.asc&limit=1",
                                   headers={"apikey": key, "Authorization": "Bearer " + key})
        with urllib.request.urlopen(q, timeout=30) as r:
            got = json.loads(r.read())
            eldste = got[0]["created_at"] if got else None
    except (urllib.error.HTTPError, OSError, ValueError, KeyError, IndexError):
        eldste = None
    koe = {"id": KOE_ID, "navn": "Kort til godkjenning", "antall": len(utkast), "eldste": eldste,
           "detalj": (f"{len(utkast)} utkast venter på Indigo: " + ", ".join(utkast)) if utkast else "Ingen utkast venter. Alle kort er aktive.",
           "kilde": "sync-kim-cards", "oppdatert": datetime.datetime.now(datetime.timezone.utc).isoformat()}
    req = urllib.request.Request(f"{url}/rest/v1/koer?on_conflict=id", data=json.dumps(koe).encode(),
                                 headers={**hdr, "Prefer": "resolution=merge-duplicates,return=minimal"}, method="POST")
    try:
        urllib.request.urlopen(req, timeout=30)
        print(f"OK: koer/{KOE_ID} = {len(utkast)} utkast")
    except urllib.error.HTTPError as e:
        print(f"koer-feil HTTP {e.code}: {e.read().decode()[:200]}")


if __name__ == "__main__":
    main()
