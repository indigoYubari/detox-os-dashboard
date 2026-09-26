"""merchant_kontroll — første ekte Merchant-lesing, som kontroll og ikke som import.

Skriver INGENTING til basen. Jobben gjør tre ting:

  1. Leser products.list, dataSources.list og accounts.issues.list (v1, read-only).
  2. Lagrer hvert rå sidesvar UENDRET i raadata/ før noe tolkes.
  3. Rapporterer hvor feltene i spesifikasjonen §3.3 faktisk ligger — og hvilke
     som ikke finnes. Den gjetter ikke, og den fyller ikke inn null for et felt
     som mangler.

Kontrollproduktet er MegaSporeBiotic, samme produkt auditens schema-funn ble gjort
på (`detox.no/products/megasporebiotic-sporebiotika`). Det gjør at feltrapporten
kan holdes mot noe et menneske har sett i Merchant Center og på siden.

Bruk (fra workers/audit):
  python3 -m jobber.merchant_kontroll --tilganger        sjekk bare at kallene svarer
  python3 -m jobber.merchant_kontroll                    full kontroll + feltrapport
  python3 -m jobber.merchant_kontroll --produkt <navn>   ett bestemt ressursnavn
"""
from __future__ import annotations

import argparse
import sys

from felles import raa
from felles.hemmelig import les_env, mangler
from felles.nett import KildeFeil, Mangler, Nektet, Rate
from klienter import merchant

# Kontrollproduktet: handle på detox.no. Merchant kobles via `link`, fordi
# offer_id-mønsteret (shopify_NO_<produktId>_<variantId>) er UVERIFISERT — se
# spesifikasjonen §3.6, som selv sier at det skal verifiseres mot faktiske data.
KONTROLL_HANDLE = "megasporebiotic-sporebiotika"

FORVENTET_ANTALL = 334  # 309 fra Shopify-feeden + 25 «Found by Google», per §7


def _forklar(e: Exception) -> str:
    """Én linje som sier hva feilen betyr, ikke bare hva den het."""
    if isinstance(e, Nektet):
        # Merchant API svarer 401 med REASON=GCP_NOT_REGISTERED når Cloud-prosjektet
        # ikke er registrert — ikke 403, som man skulle tro. Verifisert mot ekte
        # svar 26.09.2026. Google sier selv: bruk REASON, ikke meldingsteksten.
        if e.reason == "GCP_NOT_REGISTERED":
            return ("401 GCP_NOT_REGISTERED — Cloud-prosjektet detox-audit er ikke "
                    "registrert mot Merchant Center-kontoen. Dette er DET ENESTE "
                    "som mangler: kjør skript/register-gcp.mjs én gang som "
                    "b2b@detox.no (ADMIN), vent 5 minutter, prøv igjen. "
                    "Nøkkelen og scopet virker.")
        if e.status == 401:
            return (f"401 UNAUTHENTICATED (REASON={e.reason or 'ukjent'}) — tokenet "
                    "ble ikke godtatt. Sjekk nøkkelen og systemklokka. "
                    f"{e.melding[:200]}")
        return (f"403 PERMISSION_DENIED (REASON={e.reason or 'ukjent'}) — kallet ble "
                "autentisert, men kontoen har ikke tilgang. Vanligste årsak: "
                "service-kontoen mangler brukerrolle i Merchant Center. "
                f"{e.melding[:200]}")
    if isinstance(e, Mangler):
        return ("404 — stien eller API-versjonen er feil, ELLER konto-ID-en finnes "
                "ikke. v1beta ble stengt 28.02.2026; denne klienten bruker v1.")
    if isinstance(e, Rate):
        return (f"{e.status} — for høy rate eller forbigående feil hos Google. "
                "Prøv igjen med økende pause."
                + (f" REASON={e.reason}" if e.reason else ""))
    if isinstance(e, KildeFeil):
        return f"{e.status} — uventet. REASON={e.reason or 'ukjent'}: {e.melding}"
    return f"{type(e).__name__}: {e}"


def _lagrer(kilde: str, navn: str):
    """Returnerer en paa_side-funksjon som lagrer hvert rå sidesvar."""
    def paa_side(nr: int, data: dict) -> None:
        sti = raa.lagre(kilde, f"{navn}-side{nr:03d}", data)
        print(f"      rådata lagret: {raa.relativ(sti)}")
    return paa_side


def _feltrapport(produkt_obj: dict) -> int:
    """Skriv ut hvor hvert §3.3-felt ligger. Returnerer antall felter som mangler."""
    rapport = merchant.feltrapport(produkt_obj)
    funnet = [k for k, v in rapport.items() if v["funnet"]]
    savnet = [k for k, v in rapport.items() if not v["funnet"]]

    print(f"\n  Feltrapport — {len(funnet)} av {len(rapport)} felter funnet")
    print(f"  {'kolonne i 0013':<22} {'funnet på sti':<42} type")
    print(f"  {'-' * 22} {'-' * 42} {'-' * 10}")
    for kolonne, v in rapport.items():
        if v["funnet"]:
            print(f"  {kolonne:<22} {v['sti']:<42} {v['type']}")
        else:
            print(f"  {kolonne:<22} {'IKKE FUNNET':<42} —")

    if savnet:
        print(f"\n  AVVIK: {len(savnet)} felt(er) fra spesifikasjonen §3.3 finnes ikke "
              "i svaret:")
        for k in savnet:
            print(f"    - {k}")
        print("  Hele råobjektet er lagret og ligger i attributes-kolonnen. "
              "Ikke gjett på erstatninger — rapporter avviket.")

    # Toppnivåfelter Google sendte som vi ikke har kart for. Ikke en feil, men
    # verdt å vite: det kan være data auditten burde bruke.
    kjente_topp = {"name", "offerId", "dataSource", "feedLabel", "contentLanguage",
                   "productAttributes", "productStatus", "attributes", "versionNumber",
                   "customAttributes", "automatedDiscounts"}
    ukjente = sorted(set(produkt_obj) - kjente_topp)
    if ukjente:
        print(f"\n  Nye toppnivåfelter i svaret (ikke i vårt kart): {ukjente}")
    return len(savnet)


def kjor(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Merchant v1 read-only-kontroll")
    p.add_argument("--tilganger", action="store_true",
                   help="sjekk bare at de tre kallene svarer")
    p.add_argument("--produkt", metavar="RESSURSNAVN",
                   help="hent ett bestemt produkt i stedet for å søke etter kontrollproduktet")
    a = p.parse_args(argv)

    env = les_env()
    konto = env.get("MERCHANT_ACCOUNT_ID")
    if not konto:
        print("FEIL: MERCHANT_ACCOUNT_ID mangler (f.eks. '5365874444')")
        return 1
    if mangler(env, "GOOGLE_SA_JSON") and mangler(env, "GOOGLE_SA_JSON_PATH"):
        print("FEIL: verken GOOGLE_SA_JSON eller GOOGLE_SA_JSON_PATH er satt")
        return 1

    print(f"merchant_kontroll — konto {konto} — Merchant API v1 — SKRIVER INGENTING\n")
    feil = 0

    # ── Datakilder. Minst og billigst, og svaret sier om tilgangen virker. ──
    print("  dataSources.list")
    kilder: list[dict] = []
    try:
        kilder = merchant.datakilder(env, konto, paa_side=_lagrer("merchant", "datasources"))
        print(f"      {len(kilder)} datakilde(r)")
        for k in kilder:
            print(f"        - {k.get('displayName') or '(uten navn)'} "
                  f"[type={k.get('type') or 'ukjent'}] {k.get('name')}")
    except Exception as e:  # noqa: BLE001 — feilen skal forklares, ikke skjules
        print(f"      FEIL: {_forklar(e)}")
        feil += 1

    # ── Kontovarsler ──
    print("\n  accounts.issues.list")
    try:
        varsler = merchant.kontovarsler(env, konto, paa_side=_lagrer("merchant", "issues"))
        print(f"      {len(varsler)} kontovarsel/varsler")
    except Exception as e:  # noqa: BLE001
        print(f"      FEIL: {_forklar(e)}")
        feil += 1

    # ── Produkter ──
    print("\n  products.list")
    produkter: list[dict] = []
    if a.produkt:
        try:
            produkter = [merchant.produkt(env, konto, a.produkt)]
            raa.lagre("merchant", f"produkt-{a.produkt}", produkter[0])
        except Exception as e:  # noqa: BLE001
            print(f"      FEIL: {_forklar(e)}")
            return 1
    else:
        try:
            produkter = merchant.produkter(
                env, konto, paa_side=_lagrer("merchant", "products"))
            print(f"      {len(produkter)} produkt(er)")
            if len(produkter) != FORVENTET_ANTALL:
                print(f"      MERK: §7 forventer ca. {FORVENTET_ANTALL} "
                      f"(309 Shopify-feed + 25 Found by Google). Avviket er "
                      f"{len(produkter) - FORVENTET_ANTALL:+d} og er ikke forklart.")
        except Exception as e:  # noqa: BLE001
            print(f"      FEIL: {_forklar(e)}")
            feil += 1

    if a.tilganger:
        print(f"\ntilgangssjekk ferdig — {feil} feil")
        return 1 if feil else 0

    # ── Kontrollproduktet ──
    if produkter and not a.produkt:
        print(f"\n  Kontrollprodukt: {KONTROLL_HANDLE}")
        traff = [
            p for p in produkter
            if KONTROLL_HANDLE in str(
                merchant._plukk(p, ("productAttributes", "link"))[1]
                or merchant._plukk(p, ("attributes", "link"))[1]
                or ""
            )
        ]
        if not traff:
            print("      IKKE FUNNET blant produktene. Det kan bety at produktet "
                  "ikke er i feeden, at `link` ligger et annet sted i svaret, eller "
                  "at handle er endret. Sjekk rådata før du konkluderer.")
            feil += 1
        else:
            if len(traff) > 1:
                print(f"      {len(traff)} treff — bruker det første. "
                      "Flere treff kan være varianter.")
            produkter = [traff[0]]

    if produkter:
        p0 = produkter[0]
        print(f"      ressursnavn: {p0.get('name')}")
        savnet = _feltrapport(p0)
        if savnet:
            feil += 1

    print(f"\nferdig — {feil} avvik/feil. Ingenting skrevet til basen.")
    return 1 if feil else 0


if __name__ == "__main__":
    sys.exit(kjor())
